
const { avaliarAtualidade } = require("../src/atualidade");

const dataReferencia = new Date("2026-11-02T12:00:00Z");

const casos = [
  {
    nome: "PREÇO — EXATAMENTE 30 DIAS",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2026-10-03" },
    tipo: "preco",
    esperado: "FRESH"
  },
  {
    nome: "PREÇO — 31 DIAS",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2026-10-02" },
    tipo: "preco",
    esperado: "STALE"
  },
  {
    nome: "API — EXATAMENTE 90 DIAS",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2026-08-04" },
    tipo: "versao_api",
    esperado: "FRESH"
  },
  {
    nome: "API — 91 DIAS",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2026-08-03" },
    tipo: "versao_api",
    esperado: "STALE"
  },
  {
    nome: "REGULAMENTO — EXATAMENTE 365 DIAS",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2025-11-02" },
    tipo: "regulamento",
    esperado: "FRESH"
  },
  {
    nome: "REGULAMENTO — 366 DIAS",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2025-11-01" },
    tipo: "regulamento",
    esperado: "STALE"
  },
  {
    nome: "EMPRESA — EXATAMENTE 180 DIAS",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2026-05-06" },
    tipo: "empresa",
    esperado: "FRESH"
  },
  {
    nome: "EMPRESA — 181 DIAS",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2026-05-05" },
    tipo: "empresa",
    esperado: "STALE"
  },
  {
    nome: "TIPO DE AFIRMAÇÃO DESCONHECIDO",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2026-10-20" },
    tipo: "desconhecido",
    esperado: "UNVERIFIABLE"
  },
  {
    nome: "EVIDÊNCIA NULA",
    evidencia: null,
    tipo: "preco",
    esperado: "UNVERIFIABLE"
  },
  {
    nome: "EVIDÊNCIA EM FORMATO INVÁLIDO",
    evidencia: "não é um objeto",
    tipo: "preco",
    esperado: "UNVERIFIABLE"
  },
  {
    nome: "DATA DE REFERÊNCIA INVÁLIDA",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2026-10-20" },
    tipo: "preco",
    dataReferencia: new Date("data inválida"),
    esperado: "UNVERIFIABLE"
  },
  {
    nome: "EVIDÊNCIA SEM DATA",
    evidencia: { tipo_fonte: "tavily_search" },
    tipo: "preco",
    esperado: "UNVERIFIABLE",
    motivoEsperado: "MISSING_SOURCE_DATE"
  },
  {
    nome: "DATA EM FORMATO INVÁLIDO",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "02/10/2026" },
    tipo: "preco",
    esperado: "UNVERIFIABLE",
    motivoEsperado: "INVALID_SOURCE_DATE"
  },
  {
    nome: "DATA INEXISTENTE",
    evidencia: { tipo_fonte: "tavily_search", data_publicacao: "2026-02-30" },
    tipo: "preco",
    esperado: "UNVERIFIABLE",
    motivoEsperado: "INVALID_SOURCE_DATE"
  },
  {
    nome: "PUBLICAÇÃO ANTIGA COM ATUALIZAÇÃO RECENTE",
    evidencia: {
      tipo_fonte: "tavily_search",
      data_publicacao: "2026-01-01",
      data_atualizacao: "2026-10-20"
    },
    tipo: "preco",
    esperado: "FRESH"
  },
  {
    nome: "PUBLICAÇÃO E ATUALIZAÇÃO ANTIGAS",
    evidencia: {
      tipo_fonte: "tavily_search",
      data_publicacao: "2026-08-01",
      data_atualizacao: "2026-09-01"
    },
    tipo: "preco",
    esperado: "STALE"
  },
  {
    nome: "ATUALIZAÇÃO ANTERIOR À PUBLICAÇÃO",
    evidencia: {
      tipo_fonte: "tavily_search",
      data_publicacao: "2026-10-20",
      data_atualizacao: "2026-10-10"
    },
    tipo: "preco",
    esperado: "UNVERIFIABLE",
    motivoEsperado: "UPDATE_BEFORE_PUBLICATION"
  },
  {
    nome: "DATA DE PUBLICAÇÃO NO FUTURO",
    evidencia: {
      tipo_fonte: "tavily_search",
      data_publicacao: "2026-11-03"
    },
    tipo: "preco",
    esperado: "UNVERIFIABLE",
    motivoEsperado: "FUTURE_SOURCE_DATE"
  },
  {
    nome: "TIPO DE FONTE INVÁLIDO",
    evidencia: {
      tipo_fonte: "fonte_desconhecida",
      data_publicacao: "2026-10-20"
    },
    tipo: "preco",
    esperado: "UNVERIFIABLE",
    motivoEsperado: "INVALID_SOURCE_TYPE"
  }
];

function main() {
  let acertos = 0;
  let erros = 0;

  console.log("\nENTRELINHAS — TESTES DE ATUALIDADE\n");

  for (const caso of casos) {
    const resultado = avaliarAtualidade(
      caso.evidencia,
      caso.tipo,
      caso.dataReferencia || dataReferencia
    );

    const posturaCorreta = resultado.status === caso.esperado;

    const motivoCorreto =
      !caso.motivoEsperado ||
      resultado.motivo === caso.motivoEsperado;

    const passou = posturaCorreta && motivoCorreto;

    if (passou) {
      acertos++;
    } else {
      erros++;
    }

    console.log(`\n${caso.nome}`);
    console.log("ESPERADO:", caso.esperado);
    console.log("OBTIDO:", resultado.status);
    console.log("MOTIVO:", resultado.motivo);
    console.log("AVALIAÇÃO:", passou ? "ACERTOU" : "DIVERGIU");
  }

  console.log("\n------------------------------");
  console.log("TOTAL:", casos.length);
  console.log("ACERTOS:", acertos);
  console.log("DIVERGÊNCIAS:", erros);
  console.log("------------------------------");

  if (erros > 0) {
    process.exitCode = 1;
  }
}

main();
