
const assert = require("node:assert/strict");
const Module = require("node:module");
const { randomUUID, createHash } = require("node:crypto");
const path = require("node:path");

const { criarBanco } = require("../src/banco");

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
    escopo_data: "ATTRIBUTE",
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
    escopo_data: "ATTRIBUTE",
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
      assert.deepEqual(opcoes.dominiosOficiais, ["example.com"]);
      assert.equal(typeof opcoes.onMetadata, "function");

      const fonte = evidenciasSimuladas[indice];

      const metadadosBusca = criarMetadadosPesquisa(
        opcoes,
        "BUSCA",
        pergunta,
        fonte.url,
        fonte.data_publicacao
      );

      opcoes.onMetadata(metadadosBusca);

      totalExtracoesTavily++;

      const metadadosExtracao = criarMetadadosPesquisa(
        opcoes,
        "EXTRACAO",
        pergunta,
        fonte.url,
        fonte.data_publicacao
      );

      opcoes.onMetadata(metadadosExtracao);

      const coleta = {
        id_coleta: randomUUID(),
        id_verificacao: opcoes.idVerificacao,
        url_original: fonte.url,
        url_canonica: fonte.url,
        versao_canonicalizacao: "1.0.0",
        tipo_fonte: fonte.tipo_fonte,
        status_coleta: "SUCCESS",
        conteudo: fonte.conteudo,
        hash_conteudo: createHash("sha256")
          .update(fonte.conteudo, "utf8")
          .digest("hex"),
        coletado_em: fonte.coletado_em,
        id_operacao_busca: metadadosBusca.id_operacao,
        id_operacao_extracao: metadadosExtracao.id_operacao,
        consulta: pergunta,
        parametros_busca: {
          query: pergunta,
          search_depth: "basic",
          max_results: 5,
          include_answer: false,
          include_published_date: true
        },
        parametros_extracao: {
          urls: [fonte.url],
          extract_depth: "basic",
          format: "markdown",
          include_images: false
        },
        metadados_provedor: {
          provedor: "tavily",
          resultado_id: metadadosBusca.resultados[0].resultado_id,
          relevancia: fonte.relevancia
        }
      };

      return [{
        ...fonte,
        coleta
      }];
    }
  },

  "./preparar-evidencia": {
    prepararEvidencia(afirmacao, evidencia) {
      // A preparação deve receber somente a fonte.
      assert.equal(Object.hasOwn(evidencia, "coleta"), false);

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
    path.join(__dirname, ".."),
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

    const { verificarTexto } = require("../src/verificador");

    console.log("2. Executando verificação controlada...");

    const resultado = await verificarTexto(
      "A AC Teste foi fundada em 2020 e possui sede em Florianópolis.",
      {
        maxEvidencias: 1,
        dataReferencia: new Date("2026-11-05T12:00:00.000Z"),
        tiposPorAfirmacao: {
          afirmacao_001: "empresa",
          afirmacao_002: "empresa"
        },
        dominiosOficiais: ["example.com"]
      }
    );

    console.log("3. Conferindo o resultado...");

    assert.equal(resultado.sistema, "Entrelinhas");
    assert.ok(resultado.id_verificacao);
    assert.equal(resultado.total_afirmacoes, 2);
    assert.equal(resultado.afirmacoes.length, 2);
    assert.equal(resultado.sintese.veredito, "MULTIPLAS_AFIRMACOES");
    assert.equal(resultado.sintese.contagem_vereditos.ATUAL, 2);
    assert.match(resultado.sintese.resumo, /2 afirmações/);
    assert.equal(totalBuscasTavily, 2);
    assert.equal(totalExtracoesTavily, 2);

    for (let i = 0; i < resultado.afirmacoes.length; i++) {
      const afirmacao = resultado.afirmacoes[i];

      assert.equal(afirmacao.evidencias.length, 1);

      const evidencia = afirmacao.evidencias[0];
      const fonteEsperada = evidenciasSimuladas[i];

      assert.equal(evidencia.correspondencia.status, "MATCH");
      assert.equal(evidencia.classificacao.postura, "SUPPORTS");
      assert.equal(evidencia.atualidade.status, "FRESH");
      assert.equal(afirmacao.agregacao.veredito, "ATUAL");
      assert.match(afirmacao.agregacao.resumo, /fonte oficial atual/i);
      assert.equal(afirmacao.agregacao.fontes.length, 1);
      assert.equal(afirmacao.agregacao.fontes[0].urls[0], fonteEsperada.url);

      // A fonte permanece separada dos dados de coleta.

      assert.equal(Object.hasOwn(evidencia.fonte, "coleta"), false);
      assert.equal(evidencia.fonte.url, fonteEsperada.url);
      assert.equal(evidencia.fonte.data_publicacao, "2026-11-04");
      assert.equal(evidencia.fonte.data_atualizacao, null);

      // A coleta permanece como objeto independente.

      assert.ok(evidencia.coleta);
      assert.ok(evidencia.coleta.id_coleta);
      assert.equal(
        evidencia.coleta.id_verificacao,
        resultado.id_verificacao
      );
      assert.equal(evidencia.coleta.url_original, fonteEsperada.url);
      assert.equal(evidencia.coleta.url_canonica, fonteEsperada.url);
      assert.equal(evidencia.coleta.status_coleta, "SUCCESS");
      assert.equal(evidencia.coleta.conteudo, fonteEsperada.conteudo);
      assert.equal(evidencia.coleta.tipo_fonte, "tavily_extract");
      assert.equal(evidencia.coleta.id_operacao_busca != null, true);
      assert.equal(evidencia.coleta.id_operacao_extracao != null, true);
      assert.equal(evidencia.coleta.hash_conteudo.length, 64);

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

    // Confere se os IDs de operação da coleta correspondem
    // às operações registradas na rastreabilidade da Tavily.

    for (const afirmacao of resultado.afirmacoes) {
      const coleta = afirmacao.evidencias[0].coleta;

      assert.ok(
        rastreabilidadePesquisa.some(
          item =>
            item.id_operacao === coleta.id_operacao_busca &&
            item.etapa === "BUSCA"
        )
      );

      assert.ok(
        rastreabilidadePesquisa.some(
          item =>
            item.id_operacao === coleta.id_operacao_extracao &&
            item.etapa === "EXTRACAO"
        )
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
    assert.deepEqual(recuperado.sintese, resultado.sintese);

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
        Object.hasOwn(evidenciaRecuperada.fonte, "coleta"),
        false
      );

      assert.deepEqual(
        evidenciaRecuperada.coleta,
        JSON.parse(JSON.stringify(evidenciaOriginal.coleta))
      );

      assert.equal(
        evidenciaRecuperada.coleta.id_coleta,
        evidenciaOriginal.coleta.id_coleta
      );

      assert.equal(
        evidenciaRecuperada.atualidade.status,
        evidenciaOriginal.atualidade.status
      );
      assert.deepEqual(
        recuperado.afirmacoes[i].agregacao,
        resultado.afirmacoes[i].agregacao
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
    console.log("Fonte e coleta separadas: SIM");
    console.log("IDs de coleta vinculados às operações: SIM");
    console.log("Coleta preservada no resultado recuperado: SIM");
    console.log("Datas de publicação preservadas: SIM");
    console.log("Atualidade avaliada com a data da fonte: SIM");
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
