
const { criarBanco } = require("./src/banco");

const banco = criarBanco({ caminho: ":memory:" });

try {
  const idVerificacao = "verificacao-teste-coletas-001";
  const idColeta = "coleta-teste-001";
  const url = "https://exemplo.com/produto";
  const conteudo = "O produto custa R$ 49,90.";

  const data = new Date().toISOString();

  const exemplo = {
    sistema: "Entrelinhas",
    id_verificacao: idVerificacao,
    texto_original: "O produto custa R$ 49,90.",
    verificado_em: data,
    total_afirmacoes: 1,

    afirmacoes: [
      {
        id: "afirmacao_1",
        texto: "O produto custa R$ 49,90.",
        tipo_afirmacao: "preco",
        erro_busca: null,

        evidencias: [
          {
            fonte: {
              titulo: "Página do produto",
              url,
              tipo_fonte: "tavily_search",
              conteudo,
              coletado_em: data,
              data_publicacao: null,
              data_atualizacao: null,
              relevancia: 0.95,
              metadados_provedor: {
                resultado_id: "resultado-teste-001"
              }
            },

            coleta: {
              id_coleta: idColeta,
              id_verificacao: idVerificacao,
              url_original: url,
              url_canonica: url,
              versao_canonicalizacao: "1.0.0",
              tipo_fonte: "tavily_search",
              status_coleta: "SUCCESS",
              conteudo,
              coletado_em: data,
              id_operacao_busca: "busca-teste-001",
              id_operacao_extracao: null,
              consulta: "preço do produto",
              parametros_busca: {
                max_results: 5
              },
              parametros_extracao: {},
              metadados: {
                provedor: "tavily"
              }
            },

            preparacao: {
              motivo_preparacao: "CONTEUDO_COMPLETO"
            },

            correspondencia: {
              status: "MATCH",
              justificativa: "A fonte trata do mesmo produto."
            },

            classificacao: {
              postura: "SUPPORTS",
              justificativa: "O conteúdo confirma o preço."
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

  console.log("\n1. Salvando verificação com coleta...");

  const id = banco.salvarVerificacao(exemplo);

  console.log("Verificação salva:", id);

  console.log("\n2. Consultando histórico da fonte...");

  const historico = banco.listarHistoricoFonte(url);

  console.log("Ocorrências encontradas:", historico.length);

  if (historico.length !== 1) {
    throw new Error("A ocorrência não foi encontrada no histórico.");
  }

  const registro = historico[0];

  console.log("URL:", registro.url);
  console.log("Postura:", registro.classificacao?.postura);
  console.log("Coleta vinculada:", registro.coleta?.id_coleta);

  console.log("\n3. Conferindo os dados relacionais...");

  const coleta = registro.coleta;

  if (!coleta) {
    throw new Error("A coleta não foi recuperada do SQLite.");
  }

  if (coleta.id_coleta !== idColeta) {
    throw new Error("O ID da coleta não corresponde.");
  }

  if (coleta.id_verificacao !== idVerificacao) {
    throw new Error("A coleta está vinculada à verificação incorreta.");
  }

  if (coleta.url_canonica !== url) {
    throw new Error("A URL canônica não foi preservada.");
  }

  if (coleta.status_coleta !== "SUCCESS") {
    throw new Error("O status da coleta não foi preservado.");
  }

  if (!coleta.hash_conteudo) {
    throw new Error("O hash do conteúdo não foi persistido.");
  }

  console.log("ID da coleta: OK");
  console.log("Vínculo com verificação: OK");
  console.log("URL canônica: OK");
  console.log("Status da coleta: OK");
  console.log("Hash do conteúdo: OK");

  console.log("\n4. Conferindo a separação entre fonte e coleta...");

  const verificacao = banco.obterVerificacao(id);

  const evidencia =
    verificacao.afirmacoes[0].evidencias[0];

  if (!evidencia.fonte || !evidencia.coleta) {
    throw new Error("Fonte ou coleta ausente no resultado recuperado.");
  }

  if (evidencia.fonte.id_coleta !== undefined) {
    throw new Error("O ID da coleta foi misturado ao objeto fonte.");
  }

  console.log("Fonte preservada: OK");
  console.log("Coleta preservada no resultado: OK");

  console.log("\n======================================");
  console.log("RESULTADO FINAL");
  console.log("TESTE DE COLETAS APROVADO!");
  console.log("======================================");

} catch (erro) {
  console.error("\nTESTE DE COLETAS FALHOU:");
  console.error(erro);
  process.exitCode = 1;

} finally {
  banco.fechar();
}
