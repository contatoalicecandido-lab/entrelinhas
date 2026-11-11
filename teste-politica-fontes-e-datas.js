const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { criarBanco } = require("./src/banco");
const { agregarEvidencias } = require("./src/agregador");

const ARQUIVO_VERIFICADOR = path.join(__dirname, "src", "verificador.js");

function carregarVerificador(dominiosCapturados) {
  delete require.cache[ARQUIVO_VERIFICADOR];
  const carregarOriginal = Module._load;
  const simuladas = {
    "./afirmacoes": {
      async decomporEmAfirmacoes() {
        return [
          { id: "afirmacao_1", texto: "A API possui este endpoint." },
          { id: "afirmacao_2", texto: "Este regulamento está em vigor." }
        ];
      }
    },
    "./tavily": {
      async pesquisarComTavily(pergunta, opcoes) {
        dominiosCapturados.push([...opcoes.dominiosOficiais]);
        const dominio = opcoes.dominiosOficiais[0];
        return [{
          tipo_fonte: "tavily_extract",
          titulo: "Fonte sintética",
          url: `https://${dominio}/referencia`,
          conteudo: "A fonte confirma a afirmação sintética.",
          coletado_em: "2026-11-11T12:00:00.000Z",
          data_publicacao: "2026-11-10",
          data_atualizacao: null,
          relevancia: 0.9
        }];
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
        return { status: "MATCH", justificativa: "Correspondência simulada." };
      }
    },
    "./classificador": {
      async classificarEvidencia() {
        return { postura: "SUPPORTS", justificativa: "Apoio sintético." };
      }
    }
  };

  Module._load = function(request, parent, isMain) {
    if (parent?.filename === ARQUIVO_VERIFICADOR && Object.hasOwn(simuladas, request)) {
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
  const dominiosCapturados = [];
  const banco = criarBanco({ caminho: ":memory:" });
  try {
    const verificarTexto = carregarVerificador(dominiosCapturados);
    const resultado = await verificarTexto("Duas afirmações sintéticas.", {
      banco,
      dataReferencia: new Date("2026-11-11T12:00:00.000Z"),
      tiposPorAfirmacao: {
        afirmacao_1: "versao_api",
        afirmacao_2: "regulamento"
      },
      dominiosOficiais: ["default.example"],
      dominiosOficiaisPorTipo: {
        versao_api: ["platform.openai.com"],
        regulamento: ["europa.eu"]
      },
      dominiosOficiaisPorAfirmacao: {
        afirmacao_2: ["gov.br"]
      }
    });

    assert.deepEqual(dominiosCapturados, [
      ["platform.openai.com"],
      ["gov.br"]
    ]);
    assert.deepEqual(resultado.afirmacoes[0].dominios_oficiais_usados, ["platform.openai.com"]);
    assert.deepEqual(resultado.afirmacoes[1].dominios_oficiais_usados, ["gov.br"]);
    assert.equal(resultado.afirmacoes[0].agregacao.fontes[0].oficial, true);
    assert.equal(resultado.afirmacoes[1].agregacao.fontes[0].oficial, true);
    assert.ok(banco.obterVerificacao(resultado.id_verificacao));
    console.log("PASSOU: domínios oficiais podem variar por tipo e por afirmação específica; persistidos no SQLite em memória.");

    const agregacaoSemDataFonte = agregarEvidencias({
      texto: "A documentação declara que o endpoint existe.",
      evidencias: [{
        fonte: {
          tipo_fonte: "tavily_extract",
          titulo: "Documentação oficial",
          url: "https://platform.openai.com/docs/reference",
          conteudo: "Endpoint documentado.",
          coletado_em: "2026-11-11T12:34:00.000Z",
          data_publicacao: null,
          data_atualizacao: null
        },
        correspondencia: { status: "MATCH" },
        classificacao: { postura: "SUPPORTS", justificativa: "Fixture." },
        atualidade: { status: "UNVERIFIABLE", motivo: "MISSING_SOURCE_DATE" }
      }]
    }, { dominiosOficiais: ["platform.openai.com"] });

    assert.equal(agregacaoSemDataFonte.veredito, "SUPORTE_FRACO");
    assert.match(agregacaoSemDataFonte.resumo, /data da consulta informa quando a página foi observada/i);
    const referencia = agregacaoSemDataFonte.fontes[0].evidencias[0];
    assert.equal(referencia.consultado_em, "2026-11-11T12:34:00.000Z");
    assert.equal(referencia.status_datas_declaradas, "AUSENTE");
    assert.equal(referencia.data_publicacao, null);
    assert.ok(agregacaoSemDataFonte.limitacoes.some(texto => /não substitui/i.test(texto)));
    console.log("PASSOU: data de consulta é exibida separada e não substitui data de publicação/atualização.");

    await assert.rejects(
      verificarTexto("Teste de configuração inválida.", {
        banco,
        dominiosOficiaisPorTipo: []
      }),
      /dominiosOficiaisPorTipo precisa ser um objeto/
    );
    console.log("PASSOU: estrutura inválida de domínios por tipo é rejeitada antes de executar o fluxo.");
    console.log("Nenhuma rede ou banco de produção foi utilizado.");
  } finally {
    banco.fechar();
  }
}

main().catch(erro => {
  console.error("FALHOU:", erro);
  process.exitCode = 1;
});
