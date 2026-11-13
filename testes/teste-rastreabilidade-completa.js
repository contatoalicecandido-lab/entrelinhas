
require("dotenv").config();

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const { perguntarAoModelo } = require("../src/bifrost");
const { criarBanco } = require("../src/banco");

async function executarTeste() {
  const banco = criarBanco({ caminho: ":memory:" });

  const idVerificacao = randomUUID();
  const metadadosCapturados = [];

  try {
    console.log("1. Executando chamada real ao Bifrost...");

    const resposta = await perguntarAoModelo(
      "Responda somente: INTEGRACAO COMPLETA.",
      "Você é um assistente de teste. Seja breve.",
      {
        idVerificacao,
        etapa: "TESTE_PERSISTENCIA",
        idAfirmacao: "afirmacao_teste_001",
        urlEvidencia: "https://example.com/teste",
        tentativa: 1,
        onMetadata: (dados) => {
          metadadosCapturados.push(dados);
        }
      }
    );

    assert.ok(resposta.trim());
    assert.equal(metadadosCapturados.length, 1);

    console.log("Resposta:", resposta);
    console.log("ID Bifrost:", metadadosCapturados[0].id_bifrost);

    console.log("\n2. Montando registro de teste...");

    const resultado = {
      sistema: "Entrelinhas",
      id_verificacao: idVerificacao,
      texto_original: "Teste de rastreabilidade real do Bifrost.",
      verificado_em: new Date().toISOString(),
      total_afirmacoes: 0,
      afirmacoes: [],
      rastreabilidade_modelo: metadadosCapturados
    };

    console.log("\n3. Salvando no SQLite em memória...");

    const idSalvo = banco.salvarVerificacao(resultado);

    assert.equal(idSalvo, idVerificacao);

    console.log("ID salvo:", idSalvo);

    console.log("\n4. Recuperando registro...");

    const recuperado = banco.obterVerificacao(idSalvo);

    assert.ok(recuperado);

    const metadadosRecuperados =
      recuperado.rastreabilidade_modelo;

    assert.ok(Array.isArray(metadadosRecuperados));
    assert.equal(metadadosRecuperados.length, 1);

    console.log("\n5. Comparando metadados originais e recuperados...");

    const original = metadadosCapturados[0];
    const recuperadoModelo = metadadosRecuperados[0];

    assert.equal(
      recuperado.id_verificacao,
      idVerificacao
    );

    assert.equal(
      recuperadoModelo.id_bifrost,
      original.id_bifrost
    );

    assert.equal(
      recuperadoModelo.id_trace,
      original.id_trace
    );

    assert.equal(
      recuperadoModelo.id_chamada,
      original.id_chamada
    );

    assert.equal(
      recuperadoModelo.etapa,
      "TESTE_PERSISTENCIA"
    );

    assert.equal(
      recuperadoModelo.status,
      "SUCESSO"
    );

    console.log("ID da verificação preservado:", recuperado.id_verificacao);
    console.log("ID Bifrost preservado:", recuperadoModelo.id_bifrost);
    console.log("ID Trace preservado:", recuperadoModelo.id_trace);
    console.log("ID da chamada preservado:", recuperadoModelo.id_chamada);
    console.log("Etapa preservada:", recuperadoModelo.etapa);

    console.log(
      "\nTESTE DE INTEGRAÇÃO REAL COM SQLITE APROVADO!"
    );

  } catch (erro) {
    console.error("\nTESTE FALHOU:", erro.message);
    process.exitCode = 1;

  } finally {
    banco.fechar();
  }
}

executarTeste();
