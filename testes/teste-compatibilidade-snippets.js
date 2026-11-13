const assert = require("node:assert/strict");
const { createHash, randomUUID } = require("node:crypto");

const { criarBanco } = require("../src/banco");
const {
  compararHistoricoFonte
} = require("../src/comparador-fontes");

const URL = "https://exemplo.com/produto";
const CONSULTA = "Preço e condições do produto";

const PARAMETROS = {
  query: CONSULTA,
  search_depth: "basic",
  max_results: 5,
  include_answer: false,
  include_published_date: true
};

const resultados = [];

function criarColeta(idVerificacao, conteudo, consulta, parametros, data) {
  return {
    id_coleta: randomUUID(),
    id_verificacao: idVerificacao,
    url_original: URL,
    url_canonica: URL,
    versao_canonicalizacao: "1.0.0",
    tipo_fonte: "tavily_search",
    status_coleta: "SUCCESS",
    conteudo,
    hash_conteudo: createHash("sha256")
      .update(conteudo, "utf8")
      .digest("hex"),
    coletado_em: data,
    id_operacao_busca: randomUUID(),
    id_operacao_extracao: null,
    consulta,
    parametros_busca: parametros,
    parametros_extracao: null
  };
}

function criarEvidencia(id, coleta) {
  return {
    fonte: {
      titulo: `Snippet ${id}`,
      url: URL,
      tipo_fonte: coleta.tipo_fonte,
      conteudo: coleta.conteudo,
      coletado_em: coleta.coletado_em
    },
    coleta: { ...coleta },
    correspondencia: {
      status: "MATCH",
      justificativa: "Registro sintético."
    },
    classificacao: {
      postura: "SUPPORTS",
      justificativa: "Registro sintético."
    },
    atualidade: {
      status: "UNVERIFIABLE",
      motivo: "MISSING_SOURCE_DATE"
    }
  };
}

function salvarVerificacao(banco, numero, consulta, parametros, conteudo, data) {
  const idVerificacao = randomUUID();
  const coleta = criarColeta(
    idVerificacao,
    conteudo,
    consulta,
    parametros,
    data
  );

  banco.salvarVerificacao({
    sistema: "Entrelinhas",
    id_verificacao: idVerificacao,
    texto_original: consulta,
    verificado_em: data,
    total_afirmacoes: 1,
    afirmacoes: [
      {
        id: `afirmacao_snippet_${numero}`,
        texto: conteudo,
        tipo_afirmacao: "informacao",
        evidencias: [criarEvidencia(numero, coleta)]
      }
    ]
  });
}

function executarCenario(nome, segundaConsulta, segundoParametro, esperado) {
  const banco = criarBanco({ caminho: ":memory:" });

  try {
    salvarVerificacao(
      banco,
      1,
      CONSULTA,
      { ...PARAMETROS },
      "O produto custa R$ 49,90.",
      "2026-11-09T10:00:00.000Z"
    );

    salvarVerificacao(
      banco,
      2,
      segundaConsulta,
      { ...PARAMETROS, ...segundoParametro },
      "O produto custa R$ 59,90.",
      "2026-11-09T11:00:00.000Z"
    );

    const resultado = compararHistoricoFonte(banco, URL);
    const aprovado = resultado.status === esperado;

    resultados.push({ nome, esperado, obtido: resultado.status, aprovado });

    console.log(`\n${nome}`);
    console.log("Esperado:", esperado);
    console.log("Obtido:", resultado.status);
    console.log(aprovado ? "APROVADO" : "NÃO APROVADO");
  } catch (erro) {
    resultados.push({
      nome,
      esperado,
      obtido: `ERRO: ${erro.message}`,
      aprovado: false
    });

    console.log(`\n${nome}`);
    console.log("ERRO:", erro.message);
    console.log("NÃO APROVADO");
  } finally {
    banco.fechar();
  }
}

console.log("\n======================================");
console.log("ENTRELINHAS — COMPATIBILIDADE DE SNIPPETS");
console.log("======================================");

executarCenario(
  "1. Mesma consulta e mesmos parâmetros",
  CONSULTA,
  {},
  "CHANGED"
);

executarCenario(
  "2. Consultas diferentes",
  "Avaliações e opiniões sobre o produto",
  { query: "Avaliações e opiniões sobre o produto" },
  "NOT_COMPARABLE"
);

executarCenario(
  "3. Parâmetros de busca diferentes",
  CONSULTA,
  { search_depth: "advanced" },
  "NOT_COMPARABLE"
);

const aprovados = resultados.filter(item => item.aprovado).length;

console.log("\n======================================");
console.log("RESUMO");
console.log("======================================");
console.log(`${aprovados}/${resultados.length} cenários aprovados.`);

if (aprovados !== resultados.length) {
  console.log("Há incompatibilidades que precisam ser corrigidas.");
  process.exitCode = 1;
} else {
  console.log("Todos os cenários passaram.");
}
