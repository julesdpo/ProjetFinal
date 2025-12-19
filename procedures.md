# Procédures de sécurité

## Préparation TLS
1. Générer les certifs dans `certs/` (mkcert recommandé, cf. `certs/README.md`).
2. Mettre à jour `.env` : `TLS_CERT_PATH=./certs/dev.cert`, `TLS_KEY_PATH=./certs/dev.key`, `FRONTEND_ORIGIN=https://localhost:4173`.
3. Vite et la gateway réutiliseront ces certs ; sans eux, HTTPS est désactivé (à éviter).

## Démarrage stack sécurisée
```bash
docker-compose up --build
```
- Gateway : https://localhost:8443 (point d'entrée unique)
- Front : https://localhost:4173 (consomme uniquement la gateway)

## Comptes & rôles
- Créer un compte via `/register`.
- Promouvoir en ADMIN : `docker exec -it <container_db> psql -U $POSTGRES_USER -d $POSTGRES_DB -c "UPDATE users SET role='ADMIN' WHERE email='x@y.z';"`
- Désactiver un compte via page Admin ou endpoint `/auth/users/:id/status` (ADMIN uniquement).

## SonarQube (analyse statique)
1. Lancer : `docker-compose --profile security up sonarqube` (utilise la même base Postgres).
2. Config projet : `security/sonar-project.properties`.
3. Scanner depuis la racine :
```bash
SONAR_TOKEN=<token> sonar-scanner -Dproject.settings=security/sonar-project.properties
```
4. Archiver les résultats dans `security/sonarqube-data` (volume) ou exporter depuis l'UI.

## OWASP ZAP (baseline)
- Script : `./security/zap-baseline.sh https://localhost:8443`
- Le script produit `security/zap-report-<date>.html` (à conserver). Ajouter des notes de faux positifs dans ce dossier.

## npm audit
- À exécuter dans chaque service et dans `front/` :
```bash
npm audit --production --registry=https://registry.npmjs.org
```
- Documenter les vulnérabilités restantes et justifications ici (ex. dépendance dev uniquement, pas de vecteur exploitable).

## Vérifications manuelles rapides
- Cookies HttpOnly Secure visibles après login, pas accessibles via JS.
- CORS : appels depuis une autre origine doivent échouer.
- Verrouillage login : après N mots de passe faux, /login retourne 423 puis 401.
- Refresh rotation : chaque appel `/auth/refresh` invalide l'ancien `jti` dans `refresh_tokens`.
- RBAC : un USER ne peut pas accéder à `/api/audit` ou aux tickets d'autrui.
