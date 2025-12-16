# Rapport sécurité – SecureDesk

## Objectifs
- Séparer les responsabilités (gateway, auth-service, api-service, front) pour limiter l'impact d'une compromission.
- Appliquer des protections OWASP concrètes et testables : TLS, headers, validation, contrôle d'accès, durcissement authentification.

## Mesures techniques
- **Chiffrement des communications** : gateway en HTTPS (self-signed/mkcert). HSTS activé côté gateway, redirection HTTP→HTTPS. Vite peut réutiliser les mêmes certs pour éviter du mixed content.
- **Headers de sécurité** : helmet sur gateway, auth-service, api-service (CSP restrictive, Referrer-Policy=no-referrer, frameAncestors=none, X-Content-Type-Options/others par défaut). Permissions-Policy minimale via helmet defaults.
- **CORS strict** : origine unique `FRONTEND_ORIGIN`, méthodes/headers limités, credentials activés pour cookies HttpOnly.
- **Authentification** :
  - Argon2id pour mots de passe.
  - JWT access (15m) + refresh (7j) stockés en cookies HttpOnly Secure SameSite=Strict.
  - Rotation des refresh tokens : hash en base (`refresh_tokens.token_hash`), révocation de l'ancien JTI, stockage du nouvel identifiant et métadonnées UA/IP.
  - Verrouillage temporaire après `ACCOUNT_LOCK_THRESHOLD` échecs + rate-limit IP sur `/login`.
  - Révocation `logout` et désactivation compte (admin) → contrôlé dans API + auth-service.
- **Contrôles d'accès** : RBAC (USER/ADMIN), ownership vérifié côté API, middleware `ensureActiveUser` empêche l'usage d'un token si le compte est désactivé, endpoints admin protégés.
- **Validation & anti-injection** : zod sur payloads, requêtes paramétrées `pg`, aucune concaténation dynamique. Les entrées affichées passent par React (auto-escape) + CSP.
- **Journalisation** : table `audit_logs` avec actions clés (login success/fail, refresh rotation, CRUD tickets, changements admin). Exportable pour preuves.
- **Secrets & configuration** : `.env` + `.env.example`, aucune clé committée dans le code. Cookies paramétrables via `COOKIE_DOMAIN`/`SECURE_COOKIES`.
- **Dépendances** : versions récentes Node 18, npm audit documenté.

## Menaces & réponses
- **Vol de refresh token** : stockage HttpOnly Secure + SameSite Strict ; token hashé en base ; rotation ; révocation dès usage ; journalisation.
- **Brute-force** : rate-limit IP + compteur par compte avec lock temporaire.
- **Broken Access Control** : vérification de l'utilisateur actif + rôle sur chaque route ; ownership systématique pour tickets ; gateway force Authorization à partir du cookie HttpOnly.
- **Injection SQL/XSS** : requêtes préparées + validation ; pas de rendu HTML non contrôlé ; CSP et React escaping.
- **Security Misconfiguration** : headers stricts, HSTS, CORS limité, pas de stack traces en réponse, secrets hors dépôt.

## Outils sécurité
- **SonarQube** : lancé via `docker-compose --profile security up sonarqube`. Config `security/sonar-project.properties`. Scanner : `SONAR_TOKEN=... sonar-scanner -Dproject.settings=security/sonar-project.properties`.
- **OWASP ZAP** : script `security/zap-baseline.sh` (baseline scan sur gateway). Les rapports peuvent être stockés `security/zap-report-*.html`.
- **npm audit** : à exécuter dans chaque service/front avec registre officiel, résultat à documenter dans `security/procedures.md` (corrigé ou acceptable + justification).

## Points de vigilance restants
- Générer et protéger les secrets dans `.env` (ne pas réutiliser ceux de l'exemple).
- Configurer correctement les certificats pour éviter de retomber en HTTP.
- Ajouter une surveillance centralisée des logs en production (hors scope atelier).
