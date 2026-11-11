const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const { criarBanco } = require("./src/banco");
const { compararHistoricoFonte } = require("./src/comparador-fontes");

const URL = "https://exemplo.test/pagina";
const CONSULTA = "Verificar informação da página";
const PARAMETROS_BUSCA = {
  query: CONSULTA,
  search_depth: "basic",
  max_results: 5,
  include_answer: false,
  include_published_date: true
};

function criarColeta({
  idVerificacao,
  conteudo,
  data,
  tipo = "tavily_extract",
  url = URL,
  urlCanonica = URL,
  incluirColeta = true
}) {
  const coleta = {
    id_coleta: randomUUID(),
    id_verificacao: idVerificacao,
    url_original: url,
    url_canonica: urlCanonica,
    versao_canonicalizacao: "1.0.0",
    tipo_fonte: tipo,
    status_coleta: "SUCCESS",
    conteudo,
    coletado_em: data,
    consulta: CONSULTA,
    parametros_busca: { ...PARAMETROS_BUSCA },
    parametros_extracao: tipo === "tavily_extract"
      ? { urls: [url], extract_depth: "basic", format: "markdown" }
      : null
  };

  return incluirColeta ? coleta : null;
}

function salvarSnapshot(banco, {
  conteudo,
  data,
  tipo = "tavily_extract",
  url = URL,
  urlCanonica = URL,
  incluirColeta = true
}) {
  const idVerificacao = randomUUID();
  const coleta = criarColeta({
    idVerificacao,
    conteudo,
    data,
    tipo,
    url,
    urlCanonica,
    incluirColeta
  });

  return banco.salvarVerificacao({
    id_verificacao: idVerificacao,
    texto_original: CONSULTA,
    verificado_em: data,
    total_afirmacoes: 1,
    afirmacoes: [{
      id: randomUUID(),
      texto: CONSULTA,
      evidencias: [{
        fonte: {
          titulo: "Página de teste",
          url,
          tipo_fonte: tipo,
          conteudo,
          coletado_em: data
        },
        ...(coleta ? { coleta } : {}),
        correspondencia: { status: "MATCH", justificativa: "Fixture." },
        classificacao: { postura: "SUPPORTS", justificativa: "Fixture." },
        atualidade: { status: "UNVERIFIABLE", motivo: "TEST_FIXTURE" }
      }]
    }]
  });
}

function novoBanco() {
  return criarBanco({ caminho: ":memory:" });
}

function executarCenario(nome, funcao) {
  const banco = novoBanco();
  try {
    funcao(banco);
    console.log(`PASSOU: ${nome}`);
    return true;
  } catch (erro) {
    console.error(`FALHOU: ${nome}`);
    console.error(erro.message);
    return false;
  } finally {
    banco.fechar();
  }
}

const resultados = [];

// Critério 3: uma verificação sem evidência/aquisição não cria versão da página.
resultados.push(executarCenario(
  "critério 3: nova verificação sem aquisição não cria versão da página",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "Snapshot coletado uma única vez.",
      data: "2026-11-01T10:00:00.000Z"
    });

    banco.salvarVerificacao({
      id_verificacao: randomUUID(),
      texto_original: "Nova verificação sem coleta",
      verificado_em: "2026-11-02T10:00:00.000Z",
      total_afirmacoes: 1,
      afirmacoes: [{ id: randomUUID(), texto: "Sem evidência", evidencias: [] }]
    });

    assert.equal(banco.listarHistoricoFonte(URL).length, 1);
    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "NEW");
    assert.equal(resultado.total_coletas, 1);
    assert.equal(banco.listarComparacoesFonte(URL).length, 0);
  }
));

// Critério 4: evidências simultâneas na mesma verificação não são versões.
resultados.push(executarCenario(
  "critério 4: duas aquisições da mesma verificação não são comparadas entre si",
  banco => {
    const idVerificacao = randomUUID();
    const data = "2026-11-01T10:00:00.000Z";
    const coletas = [
      criarColeta({
        idVerificacao,
        conteudo: "Primeiro conteúdo da verificação.",
        data
      }),
      criarColeta({
        idVerificacao,
        conteudo: "Segundo conteúdo da mesma verificação.",
        data
      })
    ];

    banco.salvarVerificacao({
      id_verificacao: idVerificacao,
      texto_original: CONSULTA,
      verificado_em: data,
      total_afirmacoes: 1,
      afirmacoes: [{
        id: randomUUID(),
        texto: CONSULTA,
        evidencias: coletas.map(coleta => ({
          fonte: {
            titulo: "Página de teste",
            url: URL,
            tipo_fonte: "tavily_extract",
            conteudo: coleta.conteudo,
            coletado_em: data
          },
          coleta,
          correspondencia: { status: "MATCH", justificativa: "Fixture." },
          classificacao: { postura: "SUPPORTS", justificativa: "Fixture." },
          atualidade: { status: "UNVERIFIABLE", motivo: "TEST_FIXTURE" }
        }))
      }]
    });

    const historico = banco.listarHistoricoFonte(URL);
    assert.equal(historico.length, 2);
    assert.equal(new Set(historico.map(item => item.id_verificacao)).size, 1);
    assert.equal(new Set(historico.map(item => item.coleta.id_coleta)).size, 2);

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "NEW");
    assert.equal(resultado.total_coletas, 1);
    assert.equal(banco.listarComparacoesFonte(URL).length, 0);
  }
));

// Critério 7: extração versus extração compatível.
resultados.push(executarCenario(
  "critério 7: extrações compatíveis e conteúdo igual retornam UNCHANGED",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "A página apresenta a informação original.",
      data: "2026-11-01T10:00:00.000Z"
    });
    salvarSnapshot(banco, {
      conteudo: "A página apresenta a informação original.",
      data: "2026-11-02T10:00:00.000Z"
    });

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "UNCHANGED");
    assert.equal(resultado.persistencia?.status, "PERSISTED");
    const comparacoes = banco.listarComparacoesFonte(URL);
    assert.equal(comparacoes.length, 1);
    assert.equal(comparacoes[0].versao_algoritmo, "1.2.0");
  }
));

resultados.push(executarCenario(
  "critério 7: extrações compatíveis e conteúdo diferente retornam CHANGED",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "O preço é R$ 49,90.",
      data: "2026-11-01T10:00:00.000Z"
    });
    salvarSnapshot(banco, {
      conteudo: "O preço é R$ 59,90.",
      data: "2026-11-02T10:00:00.000Z"
    });

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "CHANGED");
    assert.equal(resultado.persistencia?.status, "PERSISTED");
    assert.ok(resultado.hash_anterior);
    assert.ok(resultado.hash_atual);
    assert.match(resultado.hash_anterior, /^[a-f0-9]{64}$/);
    assert.match(resultado.hash_atual, /^[a-f0-9]{64}$/);
    assert.equal(resultado.detalhamento.algoritmo, "LCS");
    const comparacoes = banco.listarComparacoesFonte(URL);
    assert.equal(comparacoes.length, 1);
    assert.equal(comparacoes[0].versao_algoritmo, "1.2.0");
  }
));

// Critérios 17 e 18: conteúdo igual ou diferente não supera data inválida.
resultados.push(executarCenario(
  "critério 17: conteúdo igual com data inválida retorna NOT_COMPARABLE",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "Conteúdo idêntico.",
      data: "2026-11-01T10:00:00.000Z"
    });
    salvarSnapshot(banco, {
      conteudo: "Conteúdo idêntico.",
      data: "data-invalida"
    });

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "NOT_COMPARABLE");
    assert.equal(resultado.persistencia?.status, "NOT_PERSISTED");
    assert.equal(banco.listarComparacoesFonte(URL).length, 0);
  }
));

resultados.push(executarCenario(
  "critério 18: conteúdo diferente com data inválida retorna NOT_COMPARABLE",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "Conteúdo anterior.",
      data: "2026-11-01T10:00:00.000Z"
    });
    salvarSnapshot(banco, {
      conteudo: "Conteúdo posterior diferente.",
      data: "data-invalida"
    });

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "NOT_COMPARABLE");
    assert.equal(resultado.persistencia?.status, "NOT_PERSISTED");
    assert.equal(banco.listarComparacoesFonte(URL).length, 0);
  }
));

// Critério 10: mudança de snippet não prova mudança da página original.
resultados.push(executarCenario(
  "critério 10: CHANGED em snippets limita a conclusão ao conteúdo coletado",
  banco => {
    salvarSnapshot(banco, {
      tipo: "tavily_search",
      conteudo: "O snippet informa preço de R$ 49,90.",
      data: "2026-11-01T10:00:00.000Z"
    });
    salvarSnapshot(banco, {
      tipo: "tavily_search",
      conteudo: "O snippet informa preço de R$ 59,90.",
      data: "2026-11-02T10:00:00.000Z"
    });

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "CHANGED");
    assert.equal(resultado.tipo_fonte, "tavily_search");
    assert.match(resultado.justificativa, /não confirma.*alteração na página original/i);

    const comparacoes = banco.listarComparacoesFonte(URL);
    assert.equal(comparacoes.length, 1);
    assert.equal(comparacoes[0].status, "CHANGED");
    assert.match(
      comparacoes[0].resultado.justificativa,
      /não confirma.*alteração na página original/i
    );
  }
));

// Critério 12: URL canônica divergente deve bloquear a comparação.
resultados.push(executarCenario(
  "critério 12: URLs canônicas incompatíveis retornam NOT_COMPARABLE",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "Conteúdo da página A.",
      data: "2026-11-01T10:00:00.000Z",
      urlCanonica: "https://exemplo.test/pagina-a"
    });
    salvarSnapshot(banco, {
      conteudo: "Conteúdo da página B.",
      data: "2026-11-02T10:00:00.000Z",
      urlCanonica: "https://exemplo.test/pagina-b"
    });

    const resultado = compararHistoricoFonte(banco, URL);
    console.log(
      `Observado: status=${resultado.status}; persistência=${resultado.persistencia?.status ?? "N/A"}; comparações persistidas=${banco.listarComparacoesFonte(URL).length}`
    );
    assert.equal(resultado.status, "NOT_COMPARABLE");
    assert.equal(resultado.persistencia?.status, "NOT_PERSISTED");
    assert.equal(banco.listarComparacoesFonte(URL).length, 0);
    assert.equal(resultado.persistencia_impacto, undefined);
  }
));

resultados.push(executarCenario(
  "critério 12: mesma URL canônica permite comparação temporal",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "Conteúdo da primeira aquisição.",
      data: "2026-11-01T10:00:00.000Z",
      urlCanonica: "https://exemplo.test/pagina-compativel"
    });
    salvarSnapshot(banco, {
      conteudo: "Conteúdo da segunda aquisição.",
      data: "2026-11-02T10:00:00.000Z",
      urlCanonica: "https://exemplo.test/pagina-compativel"
    });

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "CHANGED");
    assert.equal(resultado.persistencia?.status, "PERSISTED");
    assert.equal(banco.listarComparacoesFonte(URL).length, 1);
  }
));

resultados.push(executarCenario(
  "critério 12: canonização equivalente permite comparação",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "Conteúdo anterior.",
      data: "2026-11-01T10:00:00.000Z",
      urlCanonica: "HTTPS://EXEMPLO.TEST/pagina"
    });
    salvarSnapshot(banco, {
      conteudo: "Conteúdo atual.",
      data: "2026-11-02T10:00:00.000Z",
      urlCanonica: "https://exemplo.test/pagina"
    });

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "CHANGED");
    assert.equal(resultado.persistencia?.status, "PERSISTED");
    assert.equal(banco.listarComparacoesFonte(URL).length, 1);
  }
));

resultados.push(executarCenario(
  "critério 12: URL canônica com protocolo inválido bloqueia comparação",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "Conteúdo anterior.",
      data: "2026-11-01T10:00:00.000Z",
      urlCanonica: "https://exemplo.test/pagina"
    });
    salvarSnapshot(banco, {
      conteudo: "Conteúdo atual.",
      data: "2026-11-02T10:00:00.000Z",
      urlCanonica: "javascript:alert(1)"
    });

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "NOT_COMPARABLE");
    assert.equal(resultado.persistencia?.status, "NOT_PERSISTED");
    assert.equal(banco.listarComparacoesFonte(URL).length, 0);
  }
));

// Critério 13: registros legados sem coleta continuam acessíveis sem ID inventado.
resultados.push(executarCenario(
  "critério 13: histórico legado permanece sem id_coleta inventado",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "Registro legado original.",
      data: "2026-11-01T10:00:00.000Z",
      incluirColeta: false
    });
    salvarSnapshot(banco, {
      conteudo: "Registro legado preservado.",
      data: "2026-11-02T10:00:00.000Z",
      incluirColeta: false
    });

    const historico = banco.listarHistoricoFonte(URL);
    assert.equal(historico.length, 2);
    assert.ok(historico.every(registro => registro.coleta === null));
    assert.ok(historico.every(registro => !("id_coleta" in registro)));
    assert.ok(historico.every(registro => registro.fonte.conteudo));

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "CHANGED");
    assert.equal(resultado.persistencia?.status, "PERSISTED");
    assert.equal(banco.listarComparacoesFonte(URL).length, 1);
    assert.ok(historico.every(registro => registro.coleta === null));
  }
));

resultados.push(executarCenario(
  "histórico legado misturado com coleta nova não é comparado sem identidade compatível",
  banco => {
    salvarSnapshot(banco, {
      conteudo: "Registro legado.",
      data: "2026-11-01T10:00:00.000Z",
      incluirColeta: false
    });
    salvarSnapshot(banco, {
      conteudo: "Registro com coleta.",
      data: "2026-11-02T10:00:00.000Z",
      urlCanonica: URL
    });

    const resultado = compararHistoricoFonte(banco, URL);
    assert.equal(resultado.status, "NOT_COMPARABLE");
    assert.equal(resultado.persistencia?.status, "NOT_PERSISTED");
    assert.equal(banco.listarComparacoesFonte(URL).length, 0);
  }
));

const aprovados = resultados.filter(Boolean).length;
console.log(`\nResultado: ${aprovados}/${resultados.length} cenários aprovados.`);

if (aprovados !== resultados.length) {
  process.exitCode = 1;
}
