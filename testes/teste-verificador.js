require("dotenv").config();

const { verificarTexto } = require("../src/verificador");

async function main() {
  const texto = "O Node.js é um ambiente de execução de JavaScript.";

  try {
    console.log("\n==================================");
    console.log("ENTRELINHAS — SEGUNDA COLETA");
    console.log("==================================");

    const resultado = await verificarTexto(texto, {
      maxEvidencias: 3
    });

    console.log("\nRESULTADO DA VERIFICAÇÃO:\n");
    console.log(JSON.stringify(resultado, null, 2));

    console.log("\nID DA NOVA VERIFICAÇÃO:");
    console.log(resultado.id_verificacao);

    console.log("\n==================================");
    console.log("SEGUNDA COLETA CONCLUÍDA!");
    console.log("==================================");

  } catch (erro) {
    console.error("\nERRO:", erro.message);
  }
}

main();