#!/usr/bin/env bash
# Inicia o Entrelinhas na nuvem: um Bifrost privado (só dentro do servidor,
# na porta 8080) e o Entrelinhas em modo público na porta que a hospedagem der.
set -uo pipefail
cd "$(dirname "$0")/.."

PASTA_BIFROST="${BIFROST_APP_DIR:-/tmp/bifrost}"
mkdir -p "$PASTA_BIFROST"

# Chave virtual do site público no Bifrost (governança): orçamento diário e
# limite de chamadas por hora. É criada a cada início e só existe aqui dentro.
export BIFROST_VK_PUBLICO="${BIFROST_VK_PUBLICO:-sk-bf-$(node -e 'process.stdout.write(require("crypto").randomBytes(16).toString("hex"))')}"

# Sobe o Bifrost e espera ficar pronto (até LIMITE segundos: a primeira vez baixa
# o programa e monta o catálogo de modelos). Devolve 1 se ele cair ou travar.
iniciar_bifrost() {
  local LIMITE="$1"
  rm -f "$PASTA_BIFROST"/config.db*
  npx -y @maximhq/bifrost -app-dir "$PASTA_BIFROST" -host 127.0.0.1 -port 8080 &
  BIFROST_PID=$!
  LIMITE="$LIMITE" BIFROST_PID="$BIFROST_PID" node -e '
  const fim = Date.now() + Number(process.env.LIMITE) * 1000;
  const pid = Number(process.env.BIFROST_PID);
  const vivo = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
  (async function esperar() {
    let ultimoAviso = Date.now();
    while (Date.now() < fim) {
      try { const r = await fetch("http://127.0.0.1:8080/health", { signal: AbortSignal.timeout(5000) }); if (r.ok) { console.log("Bifrost pronto."); return; } } catch {}
      if (!vivo()) { console.error("O Bifrost parou antes de ficar pronto (veja as linhas acima)."); process.exit(1); }
      if (Date.now() - ultimoAviso > 30000) { console.log("Ainda esperando o Bifrost..."); ultimoAviso = Date.now(); }
      await new Promise(r => setTimeout(r, 2000));
    }
    console.error("O Bifrost não respondeu a tempo."); process.exit(1);
  })();'
  local ok=$?
  if [ $ok -ne 0 ]; then
    # Para o npx e também o programa do Bifrost que ele abriu, para liberar a porta.
    kill "$BIFROST_PID" 2>/dev/null || true
    pkill -f "bin/bifrost-htt[p]" 2>/dev/null || true
    sleep 3
    pkill -9 -f "bin/bifrost-htt[p]" 2>/dev/null || true
  fi
  return $ok
}

# 1ª tentativa: com governança (chave virtual com orçamento), que guarda a
# configuração num SQLite. No disco do plano grátis do Render o Bifrost às vezes
# morre ou trava com "database is locked" ao montar a tabela de preços (visto em
# 20 nov). O Render desiste se nenhuma porta abrir em uns 13 minutos, então a
# espera aqui é curta.
cp deploy/bifrost-config.json "$PASTA_BIFROST/config.json"
GOVERNANCA=1
echo "Iniciando o Bifrost (gateway de IA) com governança em 127.0.0.1:8080..."
if ! iniciar_bifrost 240; then
  # 2ª tentativa: só pelo arquivo, sem banco e sem chave virtual, para o site
  # continuar no ar. O painel do site deixa claro que está sem orçamento.
  echo "Governança indisponível neste início; subindo o Bifrost só com o arquivo de configuração."
  node -e '
    const fs = require("fs"); const p = process.argv[1];
    const c = JSON.parse(fs.readFileSync("deploy/bifrost-config.json", "utf8"));
    delete c.governance; c.config_store = { enabled: false };
    fs.writeFileSync(p, JSON.stringify(c, null, 2));' "$PASTA_BIFROST/config.json"
  GOVERNANCA=0
  iniciar_bifrost 300 || { echo "O Bifrost não subiu nem sem governança."; exit 1; }
fi

export ENTRELINHAS_PUBLICO=1
export BIFROST_URL="${BIFROST_URL:-http://127.0.0.1:8080}"
if [ "$GOVERNANCA" = 1 ]; then
  export BIFROST_KEY="$BIFROST_VK_PUBLICO"
  export BIFROST_VK_ROTULO="entrelinhas-public-site: US$ 2 a day, 300 calls an hour"
else
  export BIFROST_KEY="${BIFROST_KEY:-none}"
  export BIFROST_VK_ROTULO="none this time: governance did not start, site limits still apply"
fi
trap 'kill $BIFROST_PID 2>/dev/null || true' EXIT
node servidor.js
