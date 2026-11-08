
require("dotenv").config();

const {
  avaliarCorrespondencia
} = require("./src/correspondencia");

const casos = [
  {
    nome: "Mesmo plano e mesmo fornecedor",
    afirmacao:
      "O plano residencial de 200 Mega da Megabitplay custa R$ 49,90.",
    evidencia:
      "A Megabitplay oferece internet residencial de 200 Mega por R$ 49,90 mensais.",
    esperado: "MATCH"
  },
  {
    nome: "Mesmo plano, preço diferente",
    afirmacao:
      "O plano residencial de 200 Mega da Megabitplay custa R$ 49,90.",
    evidencia:
      "A Megabitplay oferece internet residencial de 200 Mega por R$ 59,90 mensais.",
    esperado: "MATCH"
  },
  {
    nome: "Estimativa geral do mercado",
    afirmacao:
      "O plano residencial de 200 Mega da Megabitplay custa R$ 49,90.",
    evidencia:
      "Os preços de internet residencial no Brasil variam entre R$ 79 e R$ 129 por mês.",
    esperado: "RELATED_INSUFFICIENT"
  },
  {
    nome: "Outra operadora",
    afirmacao:
      "O plano residencial de 200 Mega da Megabitplay custa R$ 49,90.",
    evidencia:
      "A operadora OutraFibra oferece um plano residencial de 200 Mega por R$ 49,90.",
    esperado: "UNRELATED"
  },
  {
    nome: "Mesma empresa, plano não identificado",
    afirmacao:
      "O plano residencial de 200 Mega da Megabitplay custa R$ 49,90.",
    evidencia:
      "A Megabitplay oferece diversos planos de internet residencial com preços promocionais.",
    esperado: "RELATED_INSUFFICIENT"
  },
  {
    nome: "Assunto sem relação",
    afirmacao:
      "O plano residencial de 200 Mega da Megabitplay custa R$ 49,90.",
    evidencia:
      "O aplicativo de edição de imagens recebeu uma nova atualização de interface.",
    esperado: "UNRELATED"
  }
];

function aguardar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  let aprovados = 0;
  let reprovados = 0;

  console.log("\n==================================");
  console.log("ENTRELINHAS — TESTE DE CORRESPONDÊNCIA");
  console.log("==================================");

  for (let indice = 0; indice < casos.length; indice++) {
    const caso = casos[indice];

    console.log(`\n--- ${caso.nome} ---`);
    console.log("Esperado:", caso.esperado);

    try {
      const resultado = await avaliarCorrespondencia(
        caso.afirmacao,
        caso.evidencia
      );

      console.log("Recebido:", resultado.status);
      console.log("Justificativa:", resultado.justificativa);

      if (resultado.status === caso.esperado) {
        aprovados++;
        console.log("RESULTADO: PASSOU");
      } else {
        reprovados++;
        console.log("RESULTADO: FALHOU");
      }

    } catch (erro) {
      reprovados++;
      console.log("RESULTADO: ERRO");
      console.error(erro.message);
    }

    // Intervalo para reduzir a concentração de chamadas ao modelo.
    if (indice < casos.length - 1) {
      await aguardar(8000);
    }
  }

  console.log("\n==================================");
  console.log("RESUMO DOS TESTES");
  console.log("==================================");
  console.log("Total:", casos.length);
  console.log("Aprovados:", aprovados);
  console.log("Reprovados:", reprovados);
  console.log("==================================");
}

main();
