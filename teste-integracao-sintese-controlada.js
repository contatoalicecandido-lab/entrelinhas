const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { criarBanco } = require("./src/banco");

const URL_A = "https://fonte-a.example/fato";
const URL_B = "https://fonte-b.example/fato";

function fonte(url, conteudo) {
  return {
    tipo_fonte: "tavily_extract",
    titulo: `Fonte ${url}`,
    url,
    conteudo,
    coletado_em: "2026-11-11T10:00:00.000Z",
    data_publicacao: "2026-11-10",
    data_atualizacao: null,
    relevancia: 0.9
  };
}

function carregarVerificador(fontes, statusCorrespondenciaPorUrl) {
  const arquivo = path.join(__dirname, "src", "verificador.js");
  delete require.cache[arquivo];
  const carregarOriginal = Module._load;
  let classificacoes = 0;
  let indiceCorrespondencia = 0;

  const simuladas = {
    "./afirmacoes": {
      async decomporEmAfirmacoes() {
        return [{ id: "afirmacao_1", texto: "A afirmação sintética é correta." }];
      }
    },
    "./tavily": {
      async pesquisarComTavily() {
        return fontes;
      }
    },
    "./preparar-evidencia": {
      prepararEvidencia(afirmacao, evidencia) {
        return {
          conteudo_original: evidencia.conteudo,
          conteudo_para_analise: evidencia.conteudo,
          motivo_preparacao: "FIXTURE_CONTROLADA",
          caracteres_originais: evidencia.conteudo.length
        };
      }
    },
    "./correspondencia": {
      async avaliarCorrespondencia(afirmacao, evidencia) {
        const url = fontes[indiceCorrespondencia]?.url;
        indiceCorrespondencia++;
        return {
          status: statusCorrespondenciaPorUrl[url] ?? "MATCH",
          justificativa: "Fixture de correspondência controlada."
        };
      }
    },
    "./classificador": {
      async classificarEvidencia(afirmacao, evidencia) {
        classificacoes++;
        return {
          postura: evidencia.includes("contradiz") ? "CONTRADICTS" : "SUPPORTS",
          justificativa: "Classificação sintética por fixture."
        };
      }
    }
  };

  Module._load = function(request, parent, isMain) {
    if (parent?.filename === arquivo && Object.hasOwn(simuladas, request)) {
      return simuladas[request];
    }
    return carregarOriginal.call(this, request, parent, isMain);
  };

  try {
    return {
      verificarTexto: require(arquivo).verificarTexto,
      totalClassificacoes: () => classificacoes
    };
  } finally {
    Module._load = carregarOriginal;
  }
}

async function main() {
  const banco = criarBanco({ caminho: ":memory:" });
  try {
    const verificadorConflito = carregarVerificador([
      fonte(URL_A, "A fonte apoia a afirmação sintética."),
      fonte(URL_B, "A fonte contradiz a afirmação sintética.")
    ], {});

    const conflito = await verificadorConflito.verificarTexto(
      "Resposta sintética de uma IA.",
      {
        banco,
        dataReferencia: new Date("2026-11-11T12:00:00.000Z"),
        tiposPorAfirmacao: { afirmacao_1: "empresa" }
      }
    );

    assert.equal(conflito.afirmacoes[0].agregacao.veredito, "CONFLITO");
    assert.equal(conflito.sintese.veredito, "CONFLITO");
    assert.match(conflito.sintese.resumo, /posições divergentes/i);
    assert.equal(conflito.afirmacoes[0].agregacao.fontes.length, 2);
    assert.deepEqual(
      new Set(conflito.afirmacoes[0].agregacao.fontes.flatMap(grupo => grupo.urls)),
      new Set([URL_A, URL_B])
    );

    const recuperado = banco.obterVerificacao(conflito.id_verificacao);
    assert.equal(recuperado.sintese.veredito, "CONFLITO");
    assert.equal(recuperado.afirmacoes[0].agregacao.veredito, "CONFLITO");
    console.log("PASSOU: conflito entre fontes é sintetizado, cita URLs e persiste em SQLite em memória.");

    const somenteRelacionada = carregarVerificador(
      [fonte(URL_A, "Conteúdo relacionado, sem identificar o objeto específico.")],
      { [URL_A]: "RELATED_INSUFFICIENT" }
    );

    const inconclusivo = await somenteRelacionada.verificarTexto(
      "Resposta ampla sintética sobre vários impactos.",
      {
        banco,
        dataReferencia: new Date("2026-11-11T12:00:00.000Z"),
        tiposPorAfirmacao: { afirmacao_1: "empresa" }
      }
    );

    assert.equal(inconclusivo.afirmacoes[0].agregacao.veredito, "NAO_VERIFICAVEL");
    assert.match(inconclusivo.sintese.resumo, /não foi possível verificar/i);
    assert.equal(somenteRelacionada.totalClassificacoes(), 0);
    assert.equal(inconclusivo.afirmacoes[0].agregacao.total_evidencias_utilizaveis, 0);
    console.log("PASSOU: evidência apenas relacionada produz não verificável e não chama o classificador.");

    console.log("Nenhuma chamada de rede ou banco de produção foi usada.");
  } finally {
    banco.fechar();
  }
}

main().catch(erro => {
  console.error("FALHOU:", erro);
  process.exitCode = 1;
});
