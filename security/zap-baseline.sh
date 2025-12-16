#!/usr/bin/env bash
set -euo pipefail
TARGET=${1:-https://localhost:8443}
REPORT=security/zap-report-$(date +%Y%m%d%H%M).html

docker run --rm -v $(pwd)/security:/zap/wrk:rw -u $(id -u):$(id -g) owasp/zap2docker-stable \
  zap-baseline.py -t "$TARGET" -r "$(basename $REPORT)" -z "-config api.disablekey=true"

echo "ZAP baseline terminé. Rapport: $REPORT"
