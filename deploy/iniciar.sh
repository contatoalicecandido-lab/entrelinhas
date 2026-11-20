#!/usr/bin/env bash
# Inicia o Entrelinhas na nuvem: um Bifrost privado (só dentro do servidor,
# na porta 8080) e o Entrelinhas em modo público na porta que a hospedagem der.
set -euo pipefail
cd "$(dirname "$0")/.."

PASTA_BIFROST="${BIFROST_APP_DIR:-/tmp/bifrost}"
mkdir -p "$PASTA_BIFROST"
cp deploy/bifrost-config.json "$PASTA_BIFROST/config.json"
rm -f "$PASTA_BIFROST/config.db"

# Chave virtual do site público no Bifrost (governança): orçamento diário e
# limite de chamadas por hora. É criada a cada início e só existe aqui dentro.
export BIFROST_VK_PUBLICO="${BIFROST_VK_PUBLICO:-sk-bf-$(node -e 'process.stdout.write(require("crypto").randomBytes(16).toString("hex"))')}"

echo "Iniciando o Bifrost (gateway de IA) em 127.0.0.1:8080..."
npx -y @maximhq/bifrost -app-dir "$PASTA_BIFROST" -host 127.0.0.1 -port 8080 &
BIFROST_PID=$!

# Espera o Bifrost responder (até 6 minutos: a primeira vez baixa o programa e
# monta o catálogo de modelos, o que no plano grátis do Render pode passar de 2 min).
# Se o Bifrost cair antes, mostra o código de saída em vez de esperar à toa.
BIFROST_PID="$BIFROST_PID" node -e '
const fim = Date.now() + 360000;
const pid = Number(process.env.BIFROST_PID);
const vivo = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
(async function esperar() {
  let ultimoAviso = Date.now();
  while (Date.now() < fim) {
    try { const r = await fetch("http://127.0.0.1:8080/health"); if (r.ok) { console.log("Bifrost pronto."); return; } } catch {}
    if (!vivo()) { console.error("O Bifrost parou antes de ficar pronto (veja as linhas acima)."); process.exit(1); }
    if (Date.now() - ultimoAviso > 30000) { console.log("Ainda esperando o Bifrost..."); ultimoAviso = Date.now(); }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.error("O Bifrost não respondeu em 6 minutos."); process.exit(1);
})();'

export ENTRELINHAS_PUBLICO=1
export BIFROST_URL="${BIFROST_URL:-http://127.0.0.1:8080}"
export BIFROST_KEY="$BIFROST_VK_PUBLICO"
export BIFROST_VK_ROTULO="entrelinhas-public-site: US$ 2 a day, 300 calls an hour"
trap 'kill $BIFROST_PID 2>/dev/null || true' EXIT
node servidor.js
