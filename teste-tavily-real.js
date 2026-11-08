
require("dotenv").config();

const assert = require("node:assert/strict");
const { pesquisarComTavily } = require("./src/tavily");

async function main() {
  console.log("\nENTRELINHAS — TESTE REAL DA TAVILY\n");

  assert.ok(
    process.env.TAVILY_API_KEY,
    "TAVILY_API_KEY não encontrada no .env."
  );

  const registros = [];

  const pergunta =
    "Qual é a data de lançamento da versão mais recente do Node.js?";

  console.log("1. Executando busca e extração reais...");
  console.log("Consulta:", pergunta);

  const evidencias = await pesquisarComTavily(pergunta, {
    idVerificacao: "teste_tavily_real_001",
    idAfirmacao: "afirmacao_teste_001",

    onMetadata: async (registro) => {
      registros.push(registro);

      console.log("\nOPERAÇÃO REGISTRADA:");
      console.log("Etapa:", registro.etapa);
      console.log("Status:", registro.status);
      console.log("Request ID:", registro.request_id);
      console.log("Response time:", registro.response_time);
      console.log("Duração:", registro.duracao_ms, "ms");
      console.log(
        "Quantidade de resultados:",
        registro.quantidade_resultados
      );
    }
  });

  console.log("\n2. Conferindo rastreabilidade...");

  const busca = registros.find(
    registro => registro.etapa === "BUSCA"
  );

  const extracao = registros.find(
    registro => registro.etapa === "EXTRACAO"
  );

  assert.ok(busca, "Registro de busca não encontrado.");
  assert.ok(extracao, "Registro de extração não encontrado.");

  assert.equal(busca.provedor, "tavily");
  assert.equal(busca.status, "SUCESSO");
  assert.ok(busca.request_id);

  assert.equal(extracao.provedor, "tavily");
  assert.ok(
    ["SUCESSO", "ERRO", "IGNORADA"].includes(extracao.status)
  );

  assert.equal(
    busca.id_verificacao,
    "teste_tavily_real_001"
  );

  assert.equal(
    extracao.id_verificacao,
    "teste_tavily_real_001"
  );

  assert.equal(
    busca.id_afirmacao,
    "afirmacao_teste_001"
  );

  assert.equal(
    extracao.id_afirmacao,
    "afirmacao_teste_001"
  );

  console.log("\n3. Conferindo evidências retornadas...");

  assert.ok(Array.isArray(evidencias));

  console.log("Evidências:", evidencias.length);
  console.log("Busca:", busca.status);
  console.log("Extração:", extracao.status);
  console.log("URLs solicitadas:", extracao.urls_solicitadas);
  console.log("URLs extraídas:", extracao.urls_extraidas);

  console.log("\n4. Conferindo datas de publicação...");

  let datasEncontradas = 0;

  for (const evidencia of evidencias) {
    if (evidencia.data_publicacao) {
      datasEncontradas++;
    }

    console.log("\nFonte:", evidencia.titulo);
    console.log("URL:", evidencia.url);
    console.log(
      "Data de publicação:",
      evidencia.data_publicacao ?? "Não identificada"
    );
    console.log(
      "Data de atualização:",
      evidencia.data_atualizacao ?? "Não disponível"
    );
  }

  console.log("\nFontes com data de publicação:", datasEncontradas);
  console.log("Total de fontes:", evidencias.length);

  console.log("\nRESULTADO: TESTE REAL DA TAVILY APROVADO!");
  console.log("API externa utilizada: Tavily");
  console.log("Datas de publicação inspecionadas.");
  console.log("Bifrost/Groq: não utilizados.");
  console.log("SQLite: não utilizado.");
}

main().catch(erro => {
  console.error("\nTESTE FALHOU:");
  console.error(erro.message);
  process.exitCode = 1;
});
