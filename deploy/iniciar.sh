#!/usr/bin/env bash
# Inicia o Entrelinhas na nuvem: um Bifrost privado (só dentro do servidor,
# na porta 8080) e o Entrelinhas em modo público na porta que a hospedagem der.
set -euo pipefail
cd "$(dirname "$0")/.."

PASTA_BIFROST="${BIFROST_APP_DIR:-/tmp/bifrost}"
mkdir -p "$PASTA_BIFROST"
cp deploy/bifrost-config.json "$PASTA_BIFROST/config.json"

echo "Iniciando o Bifrost (gateway de IA) em 127.0.0.1:8080..."
npx -y @maximhq/bifrost -app-dir "$PASTA_BIFROST" -host 127.0.0.1 -port 8080 &
BIFROST_PID=$!

# Espera o Bifrost responder (até 2 minutos: a primeira vez baixa o programa).
node -e '
const fim = Date.now() + 120000;
(async function esperar() {
  while (Date.now() < fim) {
    try { const r = await fetch("http://127.0.0.1:8080/health"); if (r.ok) { console.log("Bifrost pronto."); return; } } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  console.error("O Bifrost não respondeu em 2 minutos."); process.exit(1);
})();'

export ENTRELINHAS_PUBLICO=1
export BIFROST_URL="${BIFROST_URL:-http://127.0.0.1:8080}"
export BIFROST_KEY="${BIFROST_KEY:-none}"
trap 'kill $BIFROST_PID 2>/dev/null || true' EXIT
node servidor.js
