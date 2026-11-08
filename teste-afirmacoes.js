
require("dotenv").config();

const { decomporEmAfirmacoes } = require("./src/afirmacoes");

async function main() {
  const texto = `
    A empresa lançou uma nova versão do aplicativo em outubro
    e reduziu o preço da assinatura em 20%.
  `;

  try {
    console.log("\nENTRELINHAS — TESTE DE DECOMPOSIÇÃO\n");

    const afirmacoes = await decomporEmAfirmacoes(texto);

    console.log("AFIRMAÇÕES IDENTIFICADAS:");

    afirmacoes.forEach((afirmacao, indice) => {
      console.log(`\n${indice + 1}. ${afirmacao.texto}`);
      console.log("ID:", afirmacao.id);
    });

    console.log("\nTotal:", afirmacoes.length);

  } catch (erro) {
    console.error("\nERRO:", erro.message);
  }
}

main();
