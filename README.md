# SecureDesk – microservices React/Node app hardened for security

Application de tickets sécurisée avec architecture microservices : passerelle HTTPS, services d'authentification et métier séparés, front React (Vite) et PostgreSQL. Livré avec protections OWASP, JWT + rotation de refresh tokens, RBAC, audit log et outillage (SonarQube, OWASP ZAP, npm audit).

## Démarrage rapide
1. Générer des certificats locaux dans `certs/` (mkcert recommandé, cf. `certs/README.md`).
2. Copier `.env.example` en `.env` et ajuster secrets (JWT, domaine cookie, origin du front).
3. Lancer :
   ```bash
   docker-compose up --build
   ```
   Front : https://localhost:4173 · Gateway : https://localhost:8443

> Premier admin : créer un compte via /register puis promouvoir depuis le SGBD :
> `docker exec -it projetfinal-db-1 psql -U securedesk -d securedesk -c "UPDATE users SET role='ADMIN' WHERE email='vous@example.com';"`

## Services
- **gateway (Node/Express)** : TLS, redirection HTTP→HTTPS, CORS strict, helmet/CSP, rate-limit, promotion du cookie d'accès HttpOnly en header `Authorization`, reverse proxy vers services internes.
- **auth-service** : inscription/connexion, Argon2, JWT access (15m) + refresh (7j) en cookies HttpOnly Secure SameSite=Strict, rotation et révocation des refresh tokens stockés hashés, verrouillage après N échecs, endpoints admin (`/users`).
- **api-service** : CRUD tickets avec contrôle d'ownership, RBAC admin (lecture globale + audit), vérification d'utilisateur actif, audit log.
- **front (Vite/React)** : pages login/register, dashboard tickets, admin utilisateurs & journal. Axios avec `withCredentials`, refresh automatique sur 401.
- **db (PostgreSQL)** : init SQL dans `db/init.sql` (tables users, refresh_tokens, tickets, audit_logs).
- **security tooling** : SonarQube (profil compose `security`), script ZAP baseline, npm audit.

## Sécurité implémentée
- **Transport** : HTTPS sur la gateway (self-signed/mkcert), HSTS, redirection HTTP, CSP/Referrer-Policy/Permissions-Policy via helmet, headers CORS strict (origine unique, headers/méthodes limités, credentials true), Nginx non requis.
- **Authentification** : Argon2 pour mots de passe, JWT access court + refresh long en cookies HttpOnly Secure SameSite=Strict, rotation + révocation stockage hashé, verrouillage temporaire après `ACCOUNT_LOCK_THRESHOLD` échecs, rate-limit `/login`.
- **Contrôles d'accès** : RBAC (USER, ADMIN), vérification ownership tickets côté serveur, blocage des comptes désactivés, admin peut désactiver des comptes.
- **OWASP** :
  - Injection : requêtes préparées `pg`, validation zod.
  - XSS : React par défaut, CSP restrictive, aucune insertion HTML non maîtrisée.
  - Broken Access Control : middleware auth systématique, checks de rôle/ownership, vérif compte actif.
  - Security Misconfig : secrets via env, headers sécurisés, CORS strict, pas de stack traces retournées.
  - Cryptographic Failures : TLS, Argon2, refresh tokens hashés.
  - V&O Components : dépendances récentes + `npm audit` (cf. sécurité).
- **Journalisation** : table `audit_logs` (logins, créations/suppressions tickets, changements admin, refresh rotation).

## Commandes utiles
- Lancer seulement l'appli : `docker-compose up gateway auth-service api-service front db`
- Outillage SonarQube : `docker-compose --profile security up sonarqube`
- ZAP baseline (après `docker-compose up`) : `./security/zap-baseline.sh https://localhost:8443`
- Audit dépendances : `npm audit --production --registry=https://registry.npmjs.org` dans chaque dossier service/front.

## Tests manuels essentiels
- Inscription puis login (vérifier cookies HttpOnly dans l'onglet Storage).
- Accès `/api/tickets` sans token → 401.
- USER voit uniquement ses tickets ; ADMIN voit tout et peut désactiver un compte (compte désactivé bloque login et accès API existant).
- Refresh token : appeler `/auth/refresh` après expiration (forcer en modifiant ACCESS_TOKEN_EXPIRES) → nouvelle rotation et ancienne entrée `refresh_tokens` marquée `revoked=true`.

## Documentation sécurité
Détails supplémentaires, procédures et exports ZAP/Sonar dans `security/` :
- `security/REPORT.md` : mesures de sécurité et justification.
- `security/procedures.md` : pas-à-pas TLS, démarrage, SonarQube, ZAP, npm audit.
- `security/zap-baseline.sh` : scan automatisé OWASP ZAP baseline.

## Notes
- Pas de secrets côté front. Ajuster `FRONTEND_ORIGIN`/`COOKIE_DOMAIN` dans `.env` si l'hôte change.
- Si vous n'avez pas les certifs TLS, Vite et la gateway peuvent démarrer sans HTTPS (avertissement) mais restez en HTTPS pour les tests sécurité.
