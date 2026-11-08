require("dotenv").config();

const { perguntarAoModelo } = require("./src/bifrost");
const { pesquisarComTavily } = require("./src/tavily");

async function main() {
  const pergunta = "Qual é a versão estável mais recente do Node.js?";

  try {
    console.log("\n==================================");
    console.log("ENTRELINHAS — TESTE DE INTEGRAÇÃO");
    console.log("==================================");

    console.log("\n1. Consultando modelo via Bifrost...");

    const respostaModelo = await perguntarAoModelo(pergunta);

    console.log("\nRESPOSTA DO MODELO:");
    console.log(respostaModelo);

    console.log("\n2. Pesquisando evidências com Tavily...");

    const evidencias = await pesquisarComTavily(pergunta);

    console.log("\nEVIDÊNCIAS ENCONTRADAS:");

    evidencias.forEach((evidencia, indice) => {
      console.log(`\n${indice + 1}. ${evidencia.titulo}`);
      console.log("URL:", evidencia.url);
      console.log("Tipo:", evidencia.tipo_fonte);
      console.log("Coletado em:", evidencia.coletado_em);
      console.log("Publicado em:", evidencia.data_publicacao);
      console.log("Atualizado em:", evidencia.data_atualizacao);
      console.log("Relevância da busca:", evidencia.relevancia);
      console.log(
        "ID do resultado:",
        evidencia.metadados_provedor.resultado_id
      );
      console.log(
        "Request ID:",
        evidencia.metadados_provedor.request_id
      );
    });

    console.log("\n==================================");
    console.log("TESTE DE INTEGRAÇÃO CONCLUÍDO!");
    console.log("==================================");

  } catch (erro) {
    console.error("\nERRO NA INTEGRAÇÃO:", erro.message);
  }
}

main();