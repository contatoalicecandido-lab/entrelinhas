
const { criarBanco } = require("./src/banco");

const banco = criarBanco({ caminho: ":memory:" });

try {
  const idEsperado = "verificacao-teste-rastreabilidade-001";

  const rastreabilidadeEsperada = [
    {
      id_chamada: "chamada-teste-001",
      id_requisicao_enviada: "requisicao-teste-001",
      id_verificacao: idEsperado,
      etapa: "CLASSIFICACAO",
      id_afirmacao: "afirmacao_1",
      url_evidencia: "https://nodejs.org/",
      tentativa: 1,
      provedor: "groq",
      modelo_solicitado: "groq/openai/gpt-oss-20b",
      modelo_resolvido: "openai/gpt-oss-20b",
      modelo_original: "openai/gpt-oss-20b",
      id_bifrost: "bifrost-teste-001",
      id_trace: "trace-teste-001",
      indice_fallback: null,
      latencia_upstream_ms: 120,
      status_http: 200,
      status: "SUCESSO",
      registrada_em: new Date().toISOString()
    }
  ];

  const exemplo = {
    sistema: "Entrelinhas",
    id_verificacao: idEsperado,
    texto_original: "A versão estável do Node.js é a 24.",
    verificado_em: new Date().toISOString(),
    total_afirmacoes: 1,
    rastreabilidade_modelo: rastreabilidadeEsperada,
    afirmacoes: [
      {
        id: "afirmacao_1",
        texto: "A versão estável do Node.js é a 24.",
        tipo_afirmacao: "versao_api",
        erro_busca: null,
        evidencias: [
          {
            fonte: {
              titulo: "Documentação do Node.js",
              url: "https://nodejs.org/",
              tipo_fonte: "tavily_search",
              conteudo: "Informação de exemplo para o teste.",
              coletado_em: new Date().toISOString(),
              data_publicacao: null,
              data_atualizacao: null,
              relevancia: 0.95,
              metadados_provedor: {
                resultado_id: "teste-001",
                request_id: "request-teste"
              }
            },
            preparacao: {
              motivo_preparacao: "CONTEUDO_COMPLETO"
            },
            correspondencia: {
              status: "MATCH",
              justificativa: "A fonte trata do mesmo objeto."
            },
            classificacao: {
              postura: "SUPPORTS",
              justificativa: "A fonte apresenta informação compatível."
            },
            atualidade: {
              status: "UNVERIFIABLE",
              motivo: "MISSING_SOURCE_DATE"
            }
          }
        ]
      }
    ]
  };

  console.log("\n1. Salvando uma verificação...");

  const id = banco.salvarVerificacao(exemplo);

  console.log("ID gerado:", id);

  console.log("\n2. Listando verificações...");

  const lista = banco.listarVerificacoes();

  console.log("Verificações encontradas:", lista.length);
  console.log("Texto:", lista[0].texto_original);

  console.log("\n3. Recuperando a verificação completa...");

  const recuperada = banco.obterVerificacao(id);

  console.log("ID recuperado:", recuperada.id_verificacao);
  console.log(
    "Afirmações recuperadas:",
    recuperada.afirmacoes.length
  );
  console.log(
    "Evidências recuperadas:",
    recuperada.afirmacoes[0].evidencias.length
  );
  console.log(
    "Postura recuperada:",
    recuperada.afirmacoes[0].evidencias[0].classificacao.postura
  );

  console.log("\n4. Conferindo rastreabilidade...");

  const rastreabilidadeRecuperada =
    recuperada.rastreabilidade_modelo;

  console.log(
    "Chamadas recuperadas:",
    rastreabilidadeRecuperada?.length ?? 0
  );

  console.log(
    "ID Bifrost recuperado:",
    rastreabilidadeRecuperada?.[0]?.id_bifrost
  );

  console.log(
    "Etapa recuperada:",
    rastreabilidadeRecuperada?.[0]?.etapa
  );

  if (
    lista.length !== 1 ||
    id !== idEsperado ||
    recuperada.id_verificacao !== idEsperado ||
    recuperada.afirmacoes[0].evidencias.length !== 1 ||
    !Array.isArray(rastreabilidadeRecuperada) ||
    rastreabilidadeRecuperada.length !== 1 ||
    rastreabilidadeRecuperada[0].id_bifrost !== "bifrost-teste-001" ||
    rastreabilidadeRecuperada[0].etapa !== "CLASSIFICACAO"
  ) {
    throw new Error(
      "O teste de persistência da rastreabilidade falhou."
    );
  }

  console.log("\nTESTE DO BANCO E DA RASTREABILIDADE APROVADO!");

} catch (erro) {
  console.error("\nERRO NO TESTE:", erro.message);
  process.exitCode = 1;

} finally {
  banco.fechar();
}
