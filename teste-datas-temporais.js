const assert = require("node:assert/strict");
const { randomUUID, createHash } = require("node:crypto");

const { criarBanco } = require("./src/banco");
const { compararHistoricoFonte } = require("./src/comparador-fontes");

const URL = "https://exemplo.com/artigo";

function criarColeta(idVerificacao, conteudo, data) {
  return {
    id_coleta: randomUUID(),
    id_verificacao: idVerificacao,
    url_original: URL,
    url_canonica: URL,
    versao_canonicalizacao: "1.0.0",
    tipo_fonte: "tavily_extract",
    status_coleta: "SUCCESS",
    conteudo,
    hash_conteudo: createHash("sha256").update(conteudo).digest("hex"),
    coletado_em: data,
    id_operacao_busca: randomUUID(),
    id_operacao_extracao: randomUUID(),
    consulta: "teste temporal",
    parametros_busca: {},
    parametros_extracao: {}
  };
}

function criarResultado(idVerificacao, coleta, dataVerificacao) {
  return {
    id_verificacao: idVerificacao,
    texto_original: "Verificar informação do artigo",
    verificado_em: dataVerificacao,
    afirmacoes: [
      {
        id: randomUUID(),
        texto: "O artigo apresenta uma informação.",
        tipo_afirmacao: "FACTUAL",
        evidencias: [
          {
            fonte: {
              titulo: "Artigo de teste",
              url: URL,
              tipo_fonte: "tavily_extract",
              conteudo: coleta.conteudo,
              coletado_em: coleta.coletado_em,
              relevancia: 0.9
            },
            coleta
          }
        ]
      }
    ]
  };
}

function criarRegistroSimulado(idVerificacao, conteudo, data) {
  const coleta = criarColeta(idVerificacao, conteudo, data);

  return {
    id_verificacao: idVerificacao,
    id_evidencia: randomUUID(),
    url: URL,
    coletado_em: data,
    conteudo,
    fonte: {
      titulo: "Artigo de teste",
      url: URL,
      tipo_fonte: "tavily_extract",
      conteudo,
      coletado_em: data,
      relevancia: 0.9
    },
    coleta
  };
}

function testarComHistoricoSimulado(nome, primeiraData, segundaData, statusEsperado) {
  const historico = [
    criarRegistroSimulado(
      randomUUID(),
      "Conteúdo original do artigo.",
      primeiraData
    ),
    criarRegistroSimulado(
      randomUUID(),
      "Conteúdo atualizado do artigo.",
      segundaData
    )
  ];

  const bancoSimulado = {
    listarHistoricoFonte(url) {
      assert.equal(url, URL);
      return historico;
    }
  };

  console.log(`\n${nome}`);
  console.log(`Evidências simuladas: ${historico.length}`);

  const resultado = compararHistoricoFonte(bancoSimulado, URL);

  console.log(`Esperado: ${statusEsperado}`);
  console.log(`Obtido: ${resultado.status}`);

  assert.equal(resultado.status, statusEsperado);
  console.log("OK: comportamento esperado.");
}

function testarComBancoRealEmMemoria(nome, primeiraData, segundaData, statusEsperado) {
  const banco = criarBanco({ caminho: ":memory:" });

  try {
    const idPrimeira = randomUUID();
    const idSegunda = randomUUID();

    const primeiraColeta = criarColeta(
      idPrimeira,
      "Conteúdo original do artigo.",
      primeiraData
    );

    const segundaColeta = criarColeta(
      idSegunda,
      "Conteúdo atualizado do artigo.",
      segundaData
    );

    banco.salvarVerificacao(
      criarResultado(idPrimeira, primeiraColeta, "2026-11-01T10:00:00.000Z")
    );

    banco.salvarVerificacao(
      criarResultado(idSegunda, segundaColeta, "2026-11-02T10:00:00.000Z")
    );

    const historico = banco.listarHistoricoFonte(URL);

    console.log(`\n${nome}`);
    console.log(`Evidências encontradas: ${historico.length}`);

    assert.equal(historico.length, 2);

    const resultado = compararHistoricoFonte(banco, URL);

    console.log(`Esperado: ${statusEsperado}`);
    console.log(`Obtido: ${resultado.status}`);

    assert.equal(resultado.status, statusEsperado);
    console.log("OK: comportamento esperado.");
  } finally {
    banco.fechar?.();
  }
}

function executar() {
  console.log("======================================");
  console.log("ENTRELINHAS — TESTES DE DATAS TEMPORAIS");
  console.log("======================================");

  const testes = [
    {
      nome: "1. Data da segunda coleta inválida",
      executar: () => testarComBancoRealEmMemoria(
        "1. Data da segunda coleta inválida",
        "2026-11-01T10:00:00.000Z",
        "data-invalida",
        "NOT_COMPARABLE"
      )
    },
    {
      nome: "2. Data da segunda coleta ausente",
      executar: () => testarComHistoricoSimulado(
        "2. Data da segunda coleta ausente",
        "2026-11-01T10:00:00.000Z",
        null,
        "NOT_COMPARABLE"
      )
    },
    {
      nome: "3. Segunda coleta anterior à primeira",
      executar: () => testarComBancoRealEmMemoria(
        "3. Segunda coleta anterior à primeira",
        "2026-11-02T10:00:00.000Z",
        "2026-11-01T10:00:00.000Z",
        "NOT_COMPARABLE"
      )
    }
  ];

  let aprovados = 0;
  let falhas = 0;

  for (const teste of testes) {
    try {
      teste.executar();
      aprovados++;
    } catch (erro) {
      falhas++;
      console.log(`FALHOU: ${erro.message}`);
    }
  }

  console.log("\n======================================");
  console.log("RESULTADO FINAL");
  console.log("======================================");
  console.log(`TESTES: ${testes.length}`);
  console.log(`APROVADOS: ${aprovados}`);
  console.log(`FALHAS: ${falhas}`);

  if (falhas > 0) {
    console.log("STATUS: EXISTEM COMPORTAMENTOS A CORRIGIR");
    process.exitCode = 1;
  } else {
    console.log("STATUS: TODOS OS TESTES PASSARAM");
  }
}

executar();
