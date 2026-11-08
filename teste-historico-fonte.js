
const { criarBanco } = require("./src/banco");

const banco = criarBanco({ caminho: ":memory:" });

try {
  const url = "https://exemplo.com/produto";

  const verificacao = {
    sistema: "Entrelinhas",
    texto_original: "O produto custa R$ 49,90.",
    verificado_em: "2026-11-01T10:00:00.000Z",
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
              conteudo: "O produto custa R$ 49,90.",
              coletado_em: "2026-11-01T10:00:00.000Z",
              data_publicacao: null,
              data_atualizacao: null,
              relevancia: 0.95
            },
            correspondencia: {
              status: "MATCH",
              justificativa: "Mesmo produto."
            },
            classificacao: {
              postura: "SUPPORTS",
              justificativa: "Preço compatível."
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

  banco.salvarVerificacao(verificacao);

  const historico = banco.listarHistoricoFonte(url);

  console.log("\n======================================");
  console.log("TESTE — HISTÓRICO DE UMA FONTE");
  console.log("======================================");

  console.log("Ocorrências encontradas:", historico.length);

  if (historico.length !== 1) {
    throw new Error("Quantidade de ocorrências incorreta.");
  }

  console.log("URL:", historico[0].url);
  console.log("Afirmação:", historico[0].afirmacao);
  console.log("Conteúdo:", historico[0].conteudo);
  console.log(
    "Classificação:",
    historico[0].classificacao.postura
  );

  console.log("\nTESTE DE HISTÓRICO APROVADO!");

} catch (erro) {
  console.error("\nTESTE NÃO APROVADO:", erro.message);
  process.exitCode = 1;

} finally {
  banco.fechar();
}
