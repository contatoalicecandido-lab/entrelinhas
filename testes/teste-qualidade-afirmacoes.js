
require("dotenv").config();

const {
  decomporEmAfirmacoes
} = require("../src/afirmacoes");

const casos = [
  {
    nome: "Múltiplas afirmações independentes",
    texto: "A empresa lançou um aplicativo em março, abriu duas filiais e contratou 30 funcionários.",
    quantidadeEsperada: 3
  },
  {
    nome: "Valores, datas e unidades",
    texto: "O plano custa R$ 49,90 por mês e foi atualizado em 15 de outubro de 2026.",
    quantidadeEsperada: 2
  },
  {
    nome: "Preço condicionado ao vencimento",
    texto: "O plano custa R$ 49,90 por mês para pagamentos realizados até o vencimento.",
    quantidadeEsperada: 1,
    deveConter: ["R$ 49,90", "vencimento"]
  },
  {
    nome: "Desconto condicionado à forma de pagamento",
    texto: "O produto custa R$ 100,00, com desconto de 10% para pagamentos via Pix.",
    quantidadeEsperada: 1,
    deveConter: ["10%", "Pix"]
  },
  {
    nome: "Promoção com prazo de validade",
    texto: "A assinatura custa R$ 29,90 por mês durante os três primeiros meses.",
    quantidadeEsperada: 1,
    deveConter: ["R$ 29,90", "três primeiros meses"]
  },
  {
    nome: "Opinião",
    texto: "Acredito que este seja o melhor aplicativo do mercado.",
    quantidadeEsperada: 0
  },
  {
    nome: "Sem afirmações verificáveis",
    texto: "Olá! Obrigado pela ajuda. Até amanhã!",
    quantidadeEsperada: 0
  }
];

async function main() {
  let aprovados = 0;
  let reprovados = 0;

  console.log("\n==================================");
  console.log("ENTRELINHAS — TESTE DE QUALIDADE");
  console.log("==================================");

  for (const caso of casos) {
    console.log(`\n--- ${caso.nome} ---`);
    console.log("Texto:", caso.texto);

    try {
      const resultado = await decomporEmAfirmacoes(caso.texto);

      resultado.forEach((afirmacao, indice) => {
        console.log(`${indice + 1}. ${afirmacao.texto}`);
      });

      if (resultado.length === 0) {
        console.log("Nenhuma afirmação identificada.");
      }

      const quantidadeCorreta =
        resultado.length === caso.quantidadeEsperada;

      const textoResultado = resultado
        .map(afirmacao => afirmacao.texto.toLowerCase())
        .join(" ");

      const condicoesPreservadas = (caso.deveConter || []).every(
        termo => textoResultado.includes(termo.toLowerCase())
      );

      const passou =
        quantidadeCorreta && condicoesPreservadas;

      if (passou) {
        aprovados++;
        console.log("RESULTADO: PASSOU");
      } else {
        reprovados++;
        console.log("RESULTADO: FALHOU");

        console.log(
          `Quantidade esperada: ${caso.quantidadeEsperada}`
        );

        console.log(
          `Quantidade recebida: ${resultado.length}`
        );

        if (!condicoesPreservadas) {
          console.log(
            "Uma ou mais condições importantes não foram preservadas."
          );
        }
      }

    } catch (erro) {
      reprovados++;
      console.log("RESULTADO: ERRO");
      console.error(erro.message);
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
