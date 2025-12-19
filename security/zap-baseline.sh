#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./security/zap-baseline.sh
#   ./security/zap-baseline.sh https://localhost:8443/swagger
#   ./security/zap-baseline.sh https://host.docker.internal:8443
#
# Objectif: lancer un ZAP baseline scan via Docker et générer un rapport HTML + JSON dans ./security

BASE_URL="${1:-https://localhost:8443}"

# Convertit localhost -> host.docker.internal pour que Docker puisse accéder au Mac
TARGET_DOCKER="$(printf '%s' "$BASE_URL" | sed 's#://localhost#://host.docker.internal#g')"

OUT_DIR="security"
TS="$(date +%Y%m%d-%H%M%S)"
REPORT_HTML="zap-baseline-${TS}.html"
REPORT_JSON="zap-baseline-${TS}.json"
ZAP_IMAGE="ghcr.io/zaproxy/zaproxy:stable"

mkdir -p "$OUT_DIR"

echo "==> Vérifs Docker..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker n'est pas installé."; exit 1; }
docker info >/dev/null 2>&1 || { echo "❌ Docker n'est pas démarré."; exit 1; }

echo "==> Test accès cible depuis ta machine: $BASE_URL"
HTTP_CODE="$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 8 "$BASE_URL" || true)"
if [[ -z "$HTTP_CODE" || "$HTTP_CODE" == "000" ]]; then
  echo "❌ Impossible d'accéder à $BASE_URL (ton app n'est pas joignable)"
  exit 1
fi
echo "✅ Réponse HTTP: $HTTP_CODE (OK même si 404, le serveur répond)"

echo "==> Scan ZAP (Docker) sur: $TARGET_DOCKER"
echo "==> Rapports dans: $OUT_DIR/$REPORT_HTML et $OUT_DIR/$REPORT_JSON"

docker run --rm \
  -v "$(pwd)/$OUT_DIR":/zap/wrk:rw \
  -e HOME=/zap/wrk \
  -w /zap/wrk \
  "$ZAP_IMAGE" \
  zap-baseline.py \
    -t "$TARGET_DOCKER" \
    -r "$REPORT_HTML" \
    -J "$REPORT_JSON" \
    -I \
    -z "-config api.disablekey=true"

echo "✅ Terminé."
echo "➡️ Ouvre: $OUT_DIR/$REPORT_HTML"
