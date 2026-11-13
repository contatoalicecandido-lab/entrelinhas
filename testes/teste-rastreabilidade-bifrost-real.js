
require("dotenv").config();

const assert = require("node:assert/strict");
const { perguntarAoModelo } = require("../src/bifrost");

async function executarTeste() {
  let metadados = null;

  console.log("1. Iniciando chamada real ao Bifrost...");

  try {
    const resposta = await perguntarAoModelo(
      "Responda somente: TESTE APROVADO.",
      "Você é um assistente de teste. Seja breve.",
      {
        idVerificacao: "verificacao-real-teste-001",
        etapa: "TESTE_INTEGRACAO",
        idAfirmacao: "afirmacao-teste-001",
        urlEvidencia: "https://example.com/teste",
        tentativa: 1,
        onMetadata: (dados) => {
          metadados = dados;
        }
      }
    );

    console.log("\n2. Resposta recebida:");
    console.log(resposta);

    console.log("\n3. Metadados reais recebidos:");
    console.log(JSON.stringify(metadados, null, 2));

    assert.ok(metadados, "Callback não recebeu metadados.");

    assert.equal(
      metadados.id_verificacao,
      "verificacao-real-teste-001"
    );

    assert.equal(
      metadados.etapa,
      "TESTE_INTEGRACAO"
    );

    assert.ok(
      metadados.id_bifrost,
      "Bifrost não retornou ID de requisição."
    );

    assert.ok(
      metadados.id_chamada,
      "ID da chamada não foi gerado."
    );

    assert.equal(metadados.status, "SUCESSO");
    assert.equal(metadados.status_http, 200);

    console.log("\nTESTE REAL DE INTEGRAÇÃO BIFROST APROVADO!");

  } catch (erro) {
    console.error("\nTESTE NÃO CONCLUÍDO:", erro.message);
    process.exitCode = 1;
  }
}

executarTeste();
