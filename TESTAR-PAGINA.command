#!/bin/bash
# Auditoria de página ao vivo: o Entrelinhas lê a página de exemplo com a
# Tavily e confere os fatos dela. A checagem fica gravada para a demonstração.
cd "$(dirname "$0")"
mkdir -p logs
echo ""
echo "=== 1 de 3: conferindo o Bifrost ==="
if ! curl -s -m 3 http://localhost:8080/health >/dev/null; then
  echo "Bifrost desligado. Ligando..."
  npx -y @maximhq/bifrost > /tmp/bifrost-local.log 2>&1 &
  for i in $(seq 1 40); do curl -s -m 2 http://localhost:8080/health >/dev/null && break; sleep 2; done
fi
curl -s -m 3 http://localhost:8080/health >/dev/null && echo "Bifrost ok." || { echo "Nao consegui ligar o Bifrost. Avise o Claude."; read -p "Enter para fechar"; exit 1; }
echo ""
echo "=== 2 de 3: ligando o Entrelinhas ==="
lsof -ti:3001 | xargs kill 2>/dev/null; sleep 2
ENTRELINHAS_GRAVAR=1 PORT=3001 node servidor.js > logs/servidor-teste.log 2>&1 &
SERVIDOR=$!
sleep 5
echo ""
echo "=== 3 de 3: auditando a pagina de exemplo (uns 2 minutos) ==="
curl -s -m 280 -X POST http://127.0.0.1:3001/api/verificar -H 'Content-Type: application/json' \
  -d '{"url":"https://contatoalicecandido-lab.github.io/entrelinhas/pagina-exemplo.html","modo":"real"}' \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const r=JSON.parse(d);if(r.erro){console.log("Erro:",r.erro);return}for(const a of r.afirmacoes)console.log("-",a.agregacao?.veredito,"|",a.texto)}catch(e){console.log(d.slice(0,500))}})'
kill $SERVIDOR 2>/dev/null
echo ""
echo "=== PRONTO! Pode avisar o Claude. ==="
read -p "Enter para fechar"
