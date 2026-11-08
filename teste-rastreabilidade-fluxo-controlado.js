
const assert = require("node:assert/strict");
const Module = require("node:module");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

const { criarBanco } = require("./src/banco");

const bancoTeste = criarBanco({ caminho: ":memory:" });

let totalBuscasTavily = 0;
let totalExtracoesTavily = 0;

function criarMetadadosModelo(opcoes, etapa, idAfirmacao = null, url = null) {
  return {
    id_chamada: randomUUID(),
    id_requisicao_enviada: randomUUID(),
    id_verificacao: opcoes.idVerificacao,
    etapa,
    id_afirmacao: idAfirmacao,
    url_evidencia: url,
    tentativa: 1,
    provedor: "groq-simulado",
    modelo_solicitado: "modelo-teste",
    modelo_resolvido: "modelo-teste",
    id_bifrost: randomUUID(),
    id_trace: randomUUID(),
    status_http: 200,
    status: "SUCESSO",
    registrada_em: new Date().toISOString()
  };
}

function criarMetadadosPesquisa(
  opcoes,
  etapa,
  consulta,
  url = null,
  dataPublicacao = null
) {
  return {
    id_operacao: randomUUID(),
    id_verificacao: opcoes.idVerificacao,
    id_afirmacao: opcoes.idAfirmacao,
    provedor: "tavily",
    etapa,
    consulta,
    status: "SUCESSO",
    iniciada_em: new Date().toISOString(),
    finalizada_em: new Date().toISOString(),
    duracao_ms: 100,
    request_id: randomUUID(),
    response_time: 0.1,
    quantidade_resultados: 1,
    resultados: url
      ? [{
          resultado_id: randomUUID(),
          titulo: "Fonte simulada",
          url,
          relevancia: 0.95,
          data_publicacao: dataPublicacao
        }]
      : undefined,
    urls_solicitadas: etapa === "EXTRACAO" ? [url] : undefined,
    urls_extraidas: etapa === "EXTRACAO" ? [url] : undefined,
    erro: null
  };
}

const afirmacoesSimuladas = [
  {
    id: "afirmacao_001",
    texto: "A empresa AC Teste foi fundada em 2020."
  },
  {
    id: "afirmacao_002",
    texto: "A empresa AC Teste possui sede em Florianópolis."
  }
];

const evidenciasSimuladas = [
  {
    tipo_fonte: "tavily_extract",
    titulo: "Histórico da AC Teste",
    url: "https://example.com/historico",
    conteudo: "A empresa AC Teste foi fundada em 2020.",
    coletado_em: "2026-11-05T12:00:00.000Z",
    data_publicacao: "2026-11-04",
    data_atualizacao: null,
    relevancia: 0.95
  },
  {
    tipo_fonte: "tavily_extract",
    titulo: "Sobre a AC Teste",
    url: "https://example.com/sobre",
    conteudo: "A empresa AC Teste possui sede em Florianópolis.",
    coletado_em: "2026-11-05T12:00:00.000Z",
    data_publicacao: "2026-11-04",
    data_atualizacao: null,
    relevancia: 0.92
  }
];

const dependenciasSimuladas = {
  "./afirmacoes": {
    async decomporEmAfirmacoes(texto, opcoes) {
      assert.ok(texto.trim());

      opcoes.onMetadata(
        criarMetadadosModelo(opcoes, "DECOMPOSICAO")
      );

      return afirmacoesSimuladas;
    }
  },

  "./tavily": {
    async pesquisarComTavily(pergunta, opcoes) {
      totalBuscasTavily++;

      const indice = afirmacoesSimuladas.findIndex(
        afirmacao => afirmacao.texto === pergunta
      );

      assert.notEqual(indice, -1);
      assert.ok(opcoes.idVerificacao);
      assert.ok(opcoes.idAfirmacao);
      assert.equal(typeof opcoes.onMetadata, "function");

      const evidencia = evidenciasSimuladas[indice];

      opcoes.onMetadata(
        criarMetadadosPesquisa(
          opcoes,
          "BUSCA",
          pergunta,
          evidencia.url,
          evidencia.data_publicacao
        )
      );

      totalExtracoesTavily++;

      opcoes.onMetadata(
        criarMetadadosPesquisa(
          opcoes,
          "EXTRACAO",
          pergunta,
          evidencia.url,
          evidencia.data_publicacao
        )
      );

      return [evidencia];
    }
  },

  "./preparar-evidencia": {
    prepararEvidencia(afirmacao, evidencia) {
      return {
        conteudo_original: evidencia.conteudo,
        conteudo_para_analise: evidencia.conteudo,
        motivo_preparacao: "TESTE_CONTROLADO",
        caracteres_originais: evidencia.conteudo.length
      };
    }
  },

  "./correspondencia": {
    async avaliarCorrespondencia(afirmacao, evidencia, opcoes) {
      opcoes.onMetadata(
        criarMetadadosModelo(
          opcoes,
          "CORRESPONDENCIA",
          opcoes.idAfirmacao,
          opcoes.urlEvidencia
        )
      );

      return {
        status: "MATCH",
        justificativa: "Correspondência simulada para teste."
      };
    }
  },

  "./classificador": {
    async classificarEvidencia(afirmacao, evidencia, opcoes) {
      opcoes.onMetadata(
        criarMetadadosModelo(
          opcoes,
          "CLASSIFICACAO",
          opcoes.idAfirmacao,
          opcoes.urlEvidencia
        )
      );

      return {
        postura: "SUPPORTS",
        justificativa: "A evidência simulada apoia a afirmação."
      };
    }
  },

  "./banco": {
    criarBanco() {
      return bancoTeste;
    }
  }
};

const carregarModuloOriginal = Module._load;

Module._load = function(request, parent, isMain) {
  const arquivoVerificador = path.join(
    __dirname,
    "src",
    "verificador.js"
  );

  if (
    parent &&
    parent.filename === arquivoVerificador &&
    Object.hasOwn(dependenciasSimuladas, request)
  ) {
    return dependenciasSimuladas[request];
  }

  return carregarModuloOriginal.call(this, request, parent, isMain);
};

async function executarTeste() {
  try {
    console.log("1. Carregando verificador com dependências simuladas...");

    const { verificarTexto } = require("./src/verificador");

    console.log("2. Executando verificação controlada...");

    const resultado = await verificarTexto(
      "A AC Teste foi fundada em 2020 e possui sede em Florianópolis.",
      {
        maxEvidencias: 1,
        dataReferencia: new Date("2026-11-05T12:00:00.000Z"),
        tiposPorAfirmacao: {
          afirmacao_001: "empresa",
          afirmacao_002: "empresa"
        }
      }
    );

    console.log("3. Conferindo o resultado...");

    assert.equal(resultado.sistema, "Entrelinhas");
    assert.ok(resultado.id_verificacao);
    assert.equal(resultado.total_afirmacoes, 2);
    assert.equal(resultado.afirmacoes.length, 2);
    assert.equal(totalBuscasTavily, 2);
    assert.equal(totalExtracoesTavily, 2);

    for (const afirmacao of resultado.afirmacoes) {
      assert.equal(afirmacao.evidencias.length, 1);

      const evidencia = afirmacao.evidencias[0];

      assert.equal(evidencia.correspondencia.status, "MATCH");
      assert.equal(evidencia.classificacao.postura, "SUPPORTS");
      assert.equal(evidencia.atualidade.status, "FRESH");

      assert.equal(evidencia.fonte.data_publicacao, "2026-11-04");
      assert.equal(evidencia.fonte.data_atualizacao, null);

      assert.equal(
        evidencia.atualidade.data_utilizada,
        "2026-11-04"
      );
    }

    console.log("4. Conferindo rastreabilidade do Bifrost...");

    const rastreabilidadeModelo = resultado.rastreabilidade_modelo;

    assert.equal(rastreabilidadeModelo.length, 5);

    const etapasModelo = rastreabilidadeModelo.map(item => item.etapa);

    assert.equal(
      etapasModelo.filter(etapa => etapa === "DECOMPOSICAO").length,
      1
    );

    assert.equal(
      etapasModelo.filter(etapa => etapa === "CORRESPONDENCIA").length,
      2
    );

    assert.equal(
      etapasModelo.filter(etapa => etapa === "CLASSIFICACAO").length,
      2
    );

    for (const chamada of rastreabilidadeModelo) {
      assert.equal(chamada.id_verificacao, resultado.id_verificacao);
      assert.ok(chamada.id_bifrost);
      assert.ok(chamada.id_trace);
      assert.ok(chamada.id_chamada);
      assert.equal(chamada.status, "SUCESSO");
    }

    console.log("5. Conferindo rastreabilidade da Tavily...");

    const rastreabilidadePesquisa = resultado.rastreabilidade_pesquisa;

    assert.equal(rastreabilidadePesquisa.length, 4);

    const etapasPesquisa = rastreabilidadePesquisa.map(
      item => item.etapa
    );

    assert.equal(
      etapasPesquisa.filter(etapa => etapa === "BUSCA").length,
      2
    );

    assert.equal(
      etapasPesquisa.filter(etapa => etapa === "EXTRACAO").length,
      2
    );

    for (const pesquisa of rastreabilidadePesquisa) {
      assert.ok(pesquisa.id_operacao);
      assert.equal(pesquisa.id_verificacao, resultado.id_verificacao);
      assert.ok(pesquisa.id_afirmacao);
      assert.equal(pesquisa.provedor, "tavily");
      assert.equal(pesquisa.status, "SUCESSO");
      assert.ok(pesquisa.request_id);
      assert.ok(pesquisa.consulta);

      assert.equal(
        pesquisa.resultados[0].data_publicacao,
        "2026-11-04"
      );
    }

    console.log("6. Conferindo persistência no SQLite em memória...");

    const recuperado = bancoTeste.obterVerificacao(
      resultado.id_verificacao
    );

    assert.ok(recuperado);

    assert.equal(
      recuperado.id_verificacao,
      resultado.id_verificacao
    );

    assert.deepEqual(
      recuperado.rastreabilidade_modelo,
      rastreabilidadeModelo
    );

    assert.deepEqual(
      recuperado.rastreabilidade_pesquisa,
      JSON.parse(JSON.stringify(rastreabilidadePesquisa))
    );

    for (let i = 0; i < recuperado.afirmacoes.length; i++) {
      const evidenciaOriginal =
        resultado.afirmacoes[i].evidencias[0];

      const evidenciaRecuperada =
        recuperado.afirmacoes[i].evidencias[0];

      assert.equal(
        evidenciaRecuperada.fonte.data_publicacao,
        evidenciaOriginal.fonte.data_publicacao
      );

      assert.equal(
        evidenciaRecuperada.fonte.data_atualizacao,
        evidenciaOriginal.fonte.data_atualizacao
      );

      assert.equal(
        evidenciaRecuperada.atualidade.status,
        evidenciaOriginal.atualidade.status
      );
    }

    const historico = bancoTeste.listarHistoricoFonte(
      "https://example.com/historico"
    );

    assert.equal(historico.length, 1);
    assert.equal(historico[0].data_publicacao, "2026-11-04");
    assert.equal(historico[0].data_atualizacao, null);

    console.log("\nRESULTADO: TESTE DE FLUXO CONTROLADO APROVADO!");
    console.log("Afirmações processadas:", resultado.total_afirmacoes);
    console.log("Buscas Tavily simuladas:", totalBuscasTavily);
    console.log("Extrações Tavily simuladas:", totalExtracoesTavily);
    console.log("Chamadas de modelo simuladas:", rastreabilidadeModelo.length);
    console.log("Registros de pesquisa:", rastreabilidadePesquisa.length);
    console.log("Datas de publicação preservadas: SIM");
    console.log("Atualidade avaliada com a data da fonte: SIM");
    console.log("Datas preservadas no SQLite: SIM");
    console.log("Histórico de fontes preservado: SIM");
    console.log("Banco real: não utilizado");
    console.log("APIs externas: nenhuma chamada realizada.");

  } catch (erro) {
    console.error("\nTESTE FALHOU:");
    console.error(erro);
    process.exitCode = 1;

  } finally {
    bancoTeste.fechar();
    Module._load = carregarModuloOriginal;
  }
}

executarTeste();
