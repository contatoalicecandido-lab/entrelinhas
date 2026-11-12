// Executa toda a suíte offline do Entrelinhas e mostra um resumo.
// Todos estes testes usam fetch simulado e SQLite :memory:.
// Nenhum deles chama Tavily/Bifrost reais nem abre dados/entrelinhas.db.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const TESTES = [
  "teste-atualidade.js",
  "teste-evidencia.js",
  "teste-preparar-evidencia.js",
  "teste-integracao-persistencia-comparador.js",
  "teste-rastreabilidade-fluxo-controlado.js",
  "teste-freshness-score.js",
  "teste-sinais-temporais.js",
  "teste-independencia-fontes.js",
  "avaliacao/teste-trechos-paginas-publicas.js",
  "teste-agregador.js",
  "teste-limites-independencia-atualidade.js",
  "teste-tavily-coletas-simulado.js",
  "avaliacao/teste-avaliacao-rotulada-v1.js",
  "teste-auditoria-temporal-criterios-7-10-12-13.js",
  "teste-criterios-temporais.js",
  "teste-compatibilidade-snippets.js",
  "teste-snippet-vs-extracao.js",
  "teste-datas-temporais.js",
  "teste-nao-comparavel-sem-impacto.js",
  "teste-coletas.js",
  "teste-historico-fonte.js",
  "teste-comparador-fontes.js",
  "teste-contexto-comparador.js",
  "teste-integracao-comparador.js",
  "teste-regressao-normalizacao-comparador.js",
  "teste-normalizar-fonte.js",
  "teste-integracao-normalizacao.js",
  "teste-persistencia-comparacoes.js",
  "teste-avaliador-impacto.js",
  "teste-falsos-positivos-impacto.js",
  "teste-integracao-impacto.js",
  "teste-banco.js",
  "teste-rastreabilidade-bifrost.js",
  "teste-robustez-local.js",
  "teste-politica-agregacao-adversarial.js",
  "teste-integracao-sintese-controlada.js",
  "teste-selecao-fontes-oficiais.js",
  "teste-tavily-busca-oficial.js",
  "teste-politica-fontes-e-datas.js",
  "teste-tipo-afirmacao.js",
  "teste-servidor.js",
  "teste-recencia-pagina.js",
  "teste-classificador-data.js",
  "teste-portugues.js",
  "teste-tavily-diversidade.js",
  "teste-concordancia.js",
  "teste-analise-lote.js"
];

const extras = process.argv.slice(2);
const lista = TESTES.concat(extras);

// Garante que nenhum teste use credenciais reais por engano.
const ambiente = { ...process.env, TAVILY_API_KEY: "", BIFROST_KEY: "", ENTRELINHAS_TESTE: "1" };

const falhas = [];
for (const arquivo of lista) {
  const resultado = spawnSync(process.execPath, ["--no-warnings", arquivo], {
    cwd: __dirname,
    env: ambiente,
    encoding: "utf8",
    timeout: 60_000
  });
  const saida = `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`;
  const falhou = resultado.status !== 0 || /\bFALHOU\b|AssertionError/.test(saida);
  console.log(`${falhou ? "FALHOU " : "ok     "} ${arquivo}`);
  if (falhou) falhas.push({ arquivo, saida });
}

console.log(`\n${lista.length - falhas.length}/${lista.length} arquivos de teste passaram.`);
for (const { arquivo, saida } of falhas) {
  console.log(`\n----- ${arquivo} -----\n${saida.slice(-3000)}`);
}
process.exitCode = falhas.length ? 1 : 0;
