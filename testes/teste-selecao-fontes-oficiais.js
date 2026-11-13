const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { criarBanco } = require("../src/banco");

const ARQUIVO_VERIFICADOR = path.join(
  path.join(__dirname, ".."),
  "src",
  "verificador.js"
);

function criarFonte(url, titulo) {
  return {
    tipo_fonte: "tavily_extract",
    titulo,
    url,
    conteudo: "A fonte confirma a afirmação controlada.",
    coletado_em: "2026-11-11T10:00:00.000Z",
    data_publicacao: "2026-11-10",
    data_atualizacao: null,
    // Política 1.2.0: data explicitamente vinculada ao atributo verificado.
    escopo_data: "ATTRIBUTE",
    relevancia: 0.99
  };
}

function carregarVerificador(fontes) {
  delete require.cache[ARQUIVO_VERIFICADOR];
  const carregarOriginal = Module._load;
  const simuladas = {
    "./afirmacoes": {
      async decomporEmAfirmacoes() {
        return [{ id: "afirmacao_1", texto: "A afirmação de teste é correta." }];
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
      async avaliarCorrespondencia() {
        return {
          status: "MATCH",
          justificativa: "Correspondência simulada."
        };
      }
    },
    "./classificador": {
      async classificarEvidencia() {
        return {
          postura: "SUPPORTS",
          justificativa: "A evidência sintética apoia a afirmação."
        };
      }
    }
  };

  Module._load = function(request, parent, isMain) {
    if (
      parent?.filename === ARQUIVO_VERIFICADOR &&
      Object.hasOwn(simuladas, request)
    ) {
      return simuladas[request];
    }
    return carregarOriginal.call(this, request, parent, isMain);
  };

  try {
    return require(ARQUIVO_VERIFICADOR).verificarTexto;
  } finally {
    Module._load = carregarOriginal;
  }
}

async function main() {
  const banco = criarBanco({ caminho: ":memory:" });
  try {
    const fontes = [
      criarFonte("https://noticias.test/fato", "Fonte secundária"),
      criarFonte("https://docs.example.com/fato", "Fonte oficial"),
      criarFonte("https://outro.test/fato", "Outra fonte secundária")
    ];
    const verificarTexto = carregarVerificador(fontes);

    const resultado = await verificarTexto("A afirmação de teste é correta.", {
      banco,
      maxEvidencias: 1,
      dataReferencia: new Date("2026-11-11T12:00:00.000Z"),
      tiposPorAfirmacao: { afirmacao_1: "empresa" },
      dominiosOficiais: ["example.com"]
    });

    assert.equal(resultado.afirmacoes[0].evidencias.length, 1);
    assert.equal(
      resultado.afirmacoes[0].evidencias[0].fonte.url,
      "https://docs.example.com/fato"
    );
    assert.equal(resultado.afirmacoes[0].agregacao.veredito, "ATUAL");
    console.log("PASSOU: fonte oficial configurada é priorizada dentro do limite de evidências.");

    const semDominioOficial = carregarVerificador(fontes);
    const resultadoSemPrioridade = await semDominioOficial(
      "A afirmação de teste é correta.",
      {
        banco,
        maxEvidencias: 1,
        dataReferencia: new Date("2026-11-11T12:00:00.000Z"),
        tiposPorAfirmacao: { afirmacao_1: "empresa" }
      }
    );
    assert.equal(
      resultadoSemPrioridade.afirmacoes[0].evidencias[0].fonte.url,
      "https://noticias.test/fato"
    );
    console.log("PASSOU: sem domínios oficiais, a ordem original da busca é preservada.");
    console.log("Nenhuma rede ou banco de produção foi utilizado.");
  } finally {
    banco.fechar();
  }
}

main().catch(erro => {
  console.error("FALHOU:", erro);
  process.exitCode = 1;
});
