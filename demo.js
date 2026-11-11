require("dotenv").config();

const { parseArgs } = require("node:util");
const { criarBanco } = require("./src/banco");
const { verificarTexto } = require("./src/verificador");
const { VALIDADE_MAX_DIAS } = require("./src/atualidade");

const USO = `Entrelinhas — demonstração de verificação de uma afirmação

Uso:
  node demo.js [opções] "uma afirmação verificável"

Opções:
  -t, --type <tipo>          preco | versao_api | regulamento | empresa
  -d, --official-domain <d>  domínio oficial; pode repetir
  -h, --help                 mostra esta ajuda

Exemplo:
  node demo.js --type versao_api --official-domain platform.openai.com \\
    "A API oferece o endpoint Chat Completions."

Este comando usa Bifrost e Tavily reais, mas grava somente em SQLite :memory:.
Domínios oficiais configurados geram uma busca Tavily adicional por afirmação.
`;

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      type: { type: "string", short: "t" },
      "official-domain": { type: "string", short: "d", multiple: true },
      help: { type: "boolean", short: "h" }
    },
    allowPositionals: true,
    strict: true
  });

  if (values.help) {
    console.log(USO);
    return;
  }

  const texto = positionals.join(" ").trim();
  if (!texto) {
    console.error("Informe uma afirmação entre aspas. Use --help para ver o exemplo.");
    process.exitCode = 2;
    return;
  }

  if (values.type && !Object.hasOwn(VALIDADE_MAX_DIAS, values.type)) {
    console.error(`Tipo inválido: ${values.type}. Use --help para ver as opções.`);
    process.exitCode = 2;
    return;
  }

  const banco = criarBanco({ caminho: ":memory:" });
  try {
    const tiposPorAfirmacao = values.type
      ? { afirmacao_1: values.type }
      : {};
    const dominiosOficiais = values["official-domain"] ?? [];

    const resultado = await verificarTexto(texto, {
      banco,
      maxEvidencias: 3,
      tiposPorAfirmacao,
      dominiosOficiais
    });

    console.log(`\n${resultado.sintese.veredito}`);
    console.log(resultado.sintese.resumo);

    for (const afirmacao of resultado.afirmacoes) {
      console.log(`\nAfirmação: ${afirmacao.texto}`);
      console.log(`Resultado: ${afirmacao.agregacao.veredito}`);
      console.log(afirmacao.agregacao.resumo);

      for (const evidencia of afirmacao.evidencias) {
        console.log(`\n- ${evidencia.fonte.titulo ?? evidencia.fonte.url}`);
        console.log(`  URL: ${evidencia.fonte.url}`);
        console.log(`  Correspondência: ${evidencia.correspondencia.status}`);
        console.log(`  Postura: ${evidencia.classificacao.postura}`);
        console.log(`  Atualidade: ${evidencia.atualidade.status}`);
        console.log(`  Publicada: ${evidencia.fonte.data_publicacao ?? "não informada"}`);
        console.log(`  Atualizada: ${evidencia.fonte.data_atualizacao ?? "não informada"}`);
        console.log(`  Consultada: ${evidencia.fonte.coletado_em ?? "não informada"}`);
      }
    }

    console.log("\nRastreabilidade:");
    console.log(`- Bifrost: ${resultado.rastreabilidade_modelo.length} chamadas registradas`);
    console.log(`- Tavily: ${resultado.rastreabilidade_pesquisa.length} operações registradas`);
    console.log("- Persistência: SQLite em memória; nada foi gravado em dados/entrelinhas.db.");
  } finally {
    banco.fechar();
  }
}

main().catch(erro => {
  console.error(`Falha na demonstração: ${erro.message}`);
  process.exitCode = 1;
});
