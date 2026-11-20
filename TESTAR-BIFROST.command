#!/bin/bash
# Confere a configuração nova do Bifrost do site público (chave virtual com
# orçamento) ANTES de publicar. Usa chaves falsas: nenhuma chamada paga.
cd "$(dirname "$0")"
PASTA=/tmp/bifrost-teste-config
rm -rf "$PASTA"; mkdir -p "$PASTA"
cp deploy/bifrost-config.json "$PASTA/config.json"
export GROQ_API_KEY=gsk_falsa OPENROUTER_API_KEY=sk-or-falsa BIFROST_VK_PUBLICO=sk-bf-teste-entrelinhas
echo "Ligando um Bifrost de teste na porta 8090..."
npx -y @maximhq/bifrost -app-dir "$PASTA" -host 127.0.0.1 -port 8090 > "$PASTA/log.txt" 2>&1 &
PID=$!
for i in $(seq 1 60); do curl -s -m 2 http://127.0.0.1:8090/health >/dev/null && break; sleep 2; done
echo ""
echo "1) Saude:"; curl -s -m 5 http://127.0.0.1:8090/health; echo ""
echo "2) Chaves virtuais carregadas:"; curl -s -m 5 http://127.0.0.1:8090/api/governance/virtual-keys | grep -o '"name":"[^"]*"' | head -5
echo "3) Chamada com a chave virtual certa (deve falhar so por causa da chave FALSA do provedor):"
curl -s -m 20 http://127.0.0.1:8090/v1/chat/completions -H 'Content-Type: application/json' -H 'x-bf-vk: sk-bf-teste-entrelinhas' \
  -d '{"model":"openrouter/openai/gpt-oss-20b","messages":[{"role":"user","content":"oi"}]}' | head -c 300; echo ""
echo "4) Chamada com chave virtual ERRADA (deve ser recusada pelo Bifrost):"
curl -s -m 20 http://127.0.0.1:8090/v1/chat/completions -H 'Content-Type: application/json' -H 'x-bf-vk: sk-bf-errada' \
  -d '{"model":"openrouter/openai/gpt-oss-20b","messages":[{"role":"user","content":"oi"}]}' | head -c 300; echo ""
echo ""
echo "Ultimas linhas do log:"; tail -15 "$PASTA/log.txt"
kill $PID 2>/dev/null
echo ""
echo "=== PRONTO! Copie tudo desta janela e mande para o Claude. ==="
read -p "Enter para fechar"
