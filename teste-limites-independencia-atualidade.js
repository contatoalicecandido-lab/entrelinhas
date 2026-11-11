const assert = require("node:assert/strict");
const { agregarEvidencias } = require("./src/agregador");
const { avaliarAtualidade } = require("./src/atualidade");

function evid({ dominio, postura, dataAtualizacao = "2026-11-10", justificativa }) {
  return {
    fonte: {
      titulo: "Fixture sintética",
      url: `https://${dominio}/fonte`,
      tipo_fonte: "tavily_extract",
      data_publicacao: "2025-01-01",
      data_atualizacao: dataAtualizacao
    },
    correspondencia: { status: "MATCH" },
    classificacao: {
      postura,
      justificativa: justificativa ?? "Conteúdo sintético igual copiado de uma nota de agência."
    },
    atualidade: { status: "FRESH" }
  };
}

function main() {
  // Reprodução de limitação: três domínios com a mesma origem textual
  // são tratados como três fontes independentes pelo agrupamento atual.
  const republicacao = agregarEvidencias({
    texto: "A afirmação sintética é verdadeira.",
    evidencias: [
      evid({ dominio: "site-a.example", postura: "SUPPORTS" }),
      evid({ dominio: "site-b.example", postura: "SUPPORTS" }),
      evid({ dominio: "site-c.example", postura: "CONTRADICTS", justificativa: "Análise independente em desacordo." })
    ]
  });
  assert.equal(republicacao.veredito, "CONFLITO");
  assert.equal(republicacao.fontes_independentes, 3);
  console.log("LACUNA REPRODUZIDA: três domínios são contados como independentes, mesmo com duas republicações textualmente idênticas.");
  console.log(`Observado: veredito=${republicacao.veredito}; fontes_independentes=${republicacao.fontes_independentes}.`);

  // Reprodução de limitação: o campo de data da página é tratado como
  // data atual da evidência, sem indicar qual atributo foi atualizado.
  const atualidade = avaliarAtualidade({
    tipo_fonte: "tavily_extract",
    data_publicacao: "2025-01-01",
    data_atualizacao: "2026-11-10"
  }, "preco", new Date("2026-11-11T12:00:00.000Z"));
  assert.equal(atualidade.status, "FRESH");

  const preco = agregarEvidencias({
    texto: "O plano custa R$ 49,90.",
    evidencias: [{
      ...evid({ dominio: "operadora.example", postura: "SUPPORTS" }),
      fonte: {
        ...evid({ dominio: "operadora.example", postura: "SUPPORTS" }).fonte,
        data_atualizacao: "2026-11-10"
      },
      atualidade
    }]
  }, { dominiosOficiais: ["operadora.example"] });

  assert.equal(preco.veredito, "ATUAL");
  console.log("LACUNA REPRODUZIDA: atualização recente da página, sem escopo do campo atualizado, é tratada como atualidade do preço.");
  console.log(`Observado: atualidade=${atualidade.status}; veredito=${preco.veredito}.`);
  console.log("Fixtures sintéticas. Nenhuma rede, banco ou chamada de modelo foi utilizada.");
}

main();
