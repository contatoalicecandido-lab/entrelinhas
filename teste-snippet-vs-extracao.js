const assert = require("node:assert/strict");
const { createHash, randomUUID } = require("node:crypto");

const { criarBanco } = require("./src/banco");
const { compararHistoricoFonte } = require("./src/comparador-fontes");

const URL = "https://exemplo.com/produto";
const CONSULTA = "Preço e condições do produto";

const PARAMETROS_BUSCA = {
  query: CONSULTA,
  search_depth: "basic",
  max_results: 5,
  include_answer: false,
  include_published_date: true
};

function criarColeta(tipo, idVerificacao, conteudo, data) {
  return {
    id_coleta: randomUUID(),
    id_verificacao: idVerificacao,
    url_original: URL,
    url_canonica: URL,
    versao_canonicalizacao: "1.0.0",
    tipo_fonte: tipo,
    status_coleta: "SUCCESS",
    conteudo,
    hash_conteudo: createHash("sha256")
      .update(conteudo, "utf8")
      .digest("hex"),
    coletado_em: data,
    id_operacao_busca: randomUUID(),
    id_operacao_extracao:
      tipo === "tavily_extract" ? randomUUID() : null,
    consulta: CONSULTA,
    parametros_busca: { ...PARAMETROS_BUSCA },
    parametros_extracao:
      tipo === "tavily_extract" ? { format: "markdown" } : null
  };
}

function criarEvidencia(coleta) {
  return {
    fonte: {
      titulo: `Fonte ${coleta.tipo_fonte}`,
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

function salvarVerificacao(banco, numero, tipo, conteudo, data) {
  const idVerificacao = randomUUID();
  const coleta = criarColeta(tipo, idVerificacao, conteudo, data);

  banco.salvarVerificacao({
    sistema: "Entrelinhas",
    id_verificacao: idVerificacao,
    texto_original: CONSULTA,
    verificado_em: data,
    total_afirmacoes: 1,
    afirmacoes: [
      {
        id: `afirmacao_${numero}`,
        texto: conteudo,
        tipo_afirmacao: "informacao",
        evidencias: [criarEvidencia(coleta)]
      }
    ]
  });
}

const banco = criarBanco({ caminho: ":memory:" });

try {
  console.log("\n======================================");
  console.log("ENTRELINHAS — SNIPPET VERSUS EXTRAÇÃO");
  console.log("======================================");

  salvarVerificacao(
    banco,
    1,
    "tavily_search",
    "O produto custa R$ 49,90.",
    "2026-11-09T10:00:00.000Z"
  );

  salvarVerificacao(
    banco,
    2,
    "tavily_extract",
    "O produto custa R$ 59,90.",
    "2026-11-09T11:00:00.000Z"
  );

  const resultado = compararHistoricoFonte(banco, URL);

  console.log("\nTipo da primeira coleta: tavily_search");
  console.log("Tipo da segunda coleta: tavily_extract");
  console.log("Status esperado: NOT_COMPARABLE");
  console.log("Status obtido:", resultado.status);
  console.log("Persistência esperada: NOT_PERSISTED");
  console.log(
    "Persistência obtida:",
    resultado.persistencia?.status ?? "NÃO INFORMADA"
  );
  console.log("Justificativa:", resultado.justificativa);

  assert.equal(
    resultado.status,
    "NOT_COMPARABLE",
    "Snippet e extração não devem ser comparados como evolução temporal."
  );

  assert.equal(
    resultado.persistencia?.status,
    "NOT_PERSISTED",
    "Uma comparação incompatível não deve ser persistida."
  );

  console.log("\nRESULTADO: TESTE APROVADO");
  console.log("CRITÉRIO 9: COMPORTAMENTO CONFIRMADO");
} catch (erro) {
  console.error("\nRESULTADO: TESTE NÃO APROVADO");
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  banco.fechar();
}
