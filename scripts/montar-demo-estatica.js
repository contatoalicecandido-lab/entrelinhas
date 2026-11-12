// Monta a demonstração pública estática em docs/ (GitHub Pages):
// a mesma interface, os exemplos (motor real, fontes fictícias) e gravações de
// checagens REAIS ao vivo (Tavily + Bifrost), reproduzidas sem chaves.
// Uso: node scripts/montar-demo-estatica.js
// Não chama nenhuma API paga e não abre dados/entrelinhas.db.
const fs = require("node:fs");
const path = require("node:path");
const { criarBanco } = require("../src/banco");
const { criarVerificadorExemplo, listarExemplos } = require("../src/modo-exemplo");
const { configuracaoModelos } = require("../src/bifrost");

const RAIZ = path.join(__dirname, "..");
const DOCS = path.join(RAIZ, "docs");
const DADOS = path.join(DOCS, "dados");

function enxugar(resultado) {
  const copia = structuredClone(resultado);
  for (const a of copia.afirmacoes ?? []) {
    for (const e of a.evidencias ?? []) {
      if (typeof e?.fonte?.conteudo === "string" && e.fonte.conteudo.length > 700) e.fonte.conteudo = `${e.fonte.conteudo.slice(0, 700)}…`;
      if (e?.fonte?.normalizacao) delete e.fonte.normalizacao;
      if (e?.coleta && typeof e.coleta === "object") delete e.coleta.conteudo;
    }
  }
  return copia;
}

async function principal() {
  fs.mkdirSync(path.join(DADOS, "exemplos"), { recursive: true });
  fs.mkdirSync(path.join(DADOS, "gravacoes"), { recursive: true });

  // 1. Página: caminhos relativos, script do modo estático, CSP equivalente.
  let html = fs.readFileSync(path.join(RAIZ, "public", "index.html"), "utf8");
  html = html
    .replace('href="/estilo.css"', 'href="estilo.css"')
    .replace('<script src="/app.js" defer></script>', '<script src="estatico.js" defer></script>\n  <script src="app.js" defer></script>')
    .replace('class="marca" href="/"', 'class="marca" href="./"')
    .replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'">`);
  fs.writeFileSync(path.join(DOCS, "index.html"), html);
  for (const f of ["app.js", "estilo.css"]) fs.copyFileSync(path.join(RAIZ, "public", f), path.join(DOCS, f));
  fs.copyFileSync(path.join(__dirname, "estatico.js"), path.join(DOCS, "estatico.js"));
  fs.writeFileSync(path.join(DOCS, ".nojekyll"), "");

  // 2. Exemplos com o motor real e provedores simulados.
  const exemplos = listarExemplos();
  const verificar = criarVerificadorExemplo();
  for (const ex of exemplos) {
    const banco = criarBanco({ caminho: ":memory:" });
    try {
      const r = await verificar(ex.texto, { banco, maxEvidencias: 3, maxAfirmacoes: 6 });
      fs.writeFileSync(path.join(DADOS, "exemplos", `${ex.id}.json`), JSON.stringify({ ...enxugar(r), modo: "exemplo", simulado: true }));
    } finally {
      banco.fechar();
    }
    ex.arquivo = `dados/exemplos/${ex.id}.json`;
  }

  // 3. Gravações reais selecionadas (gravacoes/selecao.json: [{arquivo, rotulo}]).
  const selecao = JSON.parse(fs.readFileSync(path.join(RAIZ, "gravacoes", "selecao.json"), "utf8"));
  const gravacoes = [];
  for (const item of selecao) {
    const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, "gravacoes", item.arquivo), "utf8"));
    const destino = `dados/gravacoes/${item.arquivo}`;
    fs.writeFileSync(path.join(DOCS, destino), JSON.stringify(dados));
    gravacoes.push({ rotulo: item.rotulo, texto: dados.texto_original, arquivo: destino, data: dados.gravado_em ?? dados.verificado_em });
  }

  const status = {
    modo_real_disponivel: true,
    estatico: true,
    exemplos,
    gravacoes,
    limites: { caracteres: 4000, afirmacoes: 6, evidencias_por_afirmacao: 5, dominios: 5 },
    tipos: ["preco", "versao_api", "regulamento", "empresa"],
    bifrost: configuracaoModelos()
  };
  fs.writeFileSync(path.join(DADOS, "status.json"), JSON.stringify(status, null, 1));
  console.log(`docs/ pronto: ${exemplos.length} exemplos, ${gravacoes.length} gravações reais.`);
}

principal().catch(e => { console.error(e); process.exit(1); });
