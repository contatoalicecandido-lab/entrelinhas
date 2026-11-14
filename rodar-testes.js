// Executa toda a suíte offline do Entrelinhas e mostra um resumo.
// Todos estes testes usam fetch simulado e SQLite :memory:.
// Nenhum deles chama Tavily/Bifrost reais nem abre dados/entrelinhas.db.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const TESTES = [
  "testes/teste-atualidade.js",
  "testes/teste-regras-1-4-0.js",
  "testes/teste-regras-1-6-0.js",
  "testes/teste-regras-1-7-0.js",
  "testes/teste-prazo.js",
  "testes/teste-servidor-publico.js",
  "testes/teste-evidencia.js",
  "testes/teste-preparar-evidencia.js",
  "testes/teste-integracao-persistencia-comparador.js",
  "testes/teste-rastreabilidade-fluxo-controlado.js",
  "testes/teste-freshness-score.js",
  "testes/teste-sinais-temporais.js",
  "testes/teste-independencia-fontes.js",
  "avaliacao/teste-trechos-paginas-publicas.js",
  "testes/teste-agregador.js",
  "testes/teste-limites-independencia-atualidade.js",
  "testes/teste-tavily-coletas-simulado.js",
  "avaliacao/teste-avaliacao-rotulada-v1.js",
  "testes/teste-auditoria-temporal-criterios-7-10-12-13.js",
  "testes/teste-criterios-temporais.js",
  "testes/teste-compatibilidade-snippets.js",
  "testes/teste-snippet-vs-extracao.js",
  "testes/teste-datas-temporais.js",
  "testes/teste-nao-comparavel-sem-impacto.js",
  "testes/teste-coletas.js",
  "testes/teste-historico-fonte.js",
  "testes/teste-comparador-fontes.js",
  "testes/teste-contexto-comparador.js",
  "testes/teste-integracao-comparador.js",
  "testes/teste-regressao-normalizacao-comparador.js",
  "testes/teste-normalizar-fonte.js",
  "testes/teste-integracao-normalizacao.js",
  "testes/teste-persistencia-comparacoes.js",
  "testes/teste-avaliador-impacto.js",
  "testes/teste-falsos-positivos-impacto.js",
  "testes/teste-integracao-impacto.js",
  "testes/teste-banco.js",
  "testes/teste-rastreabilidade-bifrost.js",
  "testes/teste-robustez-local.js",
  "testes/teste-politica-agregacao-adversarial.js",
  "testes/teste-integracao-sintese-controlada.js",
  "testes/teste-selecao-fontes-oficiais.js",
  "testes/teste-tavily-busca-oficial.js",
  "testes/teste-politica-fontes-e-datas.js",
  "testes/teste-tipo-afirmacao.js",
  "testes/teste-servidor.js",
  "testes/teste-recencia-pagina.js",
  "testes/teste-classificador-data.js",
  "testes/teste-portugues.js",
  "testes/teste-tavily-diversidade.js",
  "testes/teste-concordancia.js",
  "testes/teste-analise-lote.js",
  "testes/teste-correcoes-ao-vivo.js",
  "testes/teste-atualidade-afirmacao.js",
  "testes/teste-bifrost-gateway.js",
  "testes/teste-risco-desatualizacao.js",
  "testes/teste-resposta-corrigida.js"
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
