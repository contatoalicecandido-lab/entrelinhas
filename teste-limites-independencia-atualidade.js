const assert = require("node:assert/strict");
const { agregarEvidencias } = require("./src/agregador");
const { avaliarAtualidade } = require("./src/atualidade");

const TEXTO_REPUBLICADO = "A empresa publicou hoje o novo preço do plano premium por quarenta e nove reais mensais. A oferta inclui suporte técnico, armazenamento adicional, acesso para toda equipe e renovação automática do contrato.";

function evid({ dominio, postura, dataAtualizacao = "2026-11-10", justificativa, conteudo = TEXTO_REPUBLICADO }) {
  return {
    fonte: {
      titulo: "Fixture sintética",
      url: `https://${dominio}/fonte`,
      tipo_fonte: "tavily_extract",
      data_publicacao: "2025-01-01",
      data_atualizacao: dataAtualizacao,
      escopo_data: "PAGE",
      conteudo
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
  // Três domínios publicam o mesmo texto; cópias conflitantes não devem
  // ser apresentadas como evidência editorialmente independente.
  const republicacao = agregarEvidencias({
    texto: "A afirmação sintética é verdadeira.",
    evidencias: [
      evid({ dominio: "site-a.example", postura: "SUPPORTS" }),
      evid({ dominio: "site-b.example", postura: "SUPPORTS" }),
      evid({ dominio: "site-c.example", postura: "CONTRADICTS", justificativa: "Análise independente em desacordo." })
    ]
  });
  assert.equal(republicacao.veredito, "CONFLITO");
  assert.equal(republicacao.fontes_independentes, 1);
  assert.equal(republicacao.dependencia_detectada, 3);
  assert.equal(republicacao.conclusao_factual.status, "CONFLITO");
  assert.ok(republicacao.limitacoes.some(item => item.includes("duplicado/quase duplicado")));
  console.log("REGRESSÃO PASSOU: republicações em domínios diferentes formam um único grupo de dependência.");
  console.log(`Observado: veredito=${republicacao.veredito}; fontes_independentes=${republicacao.fontes_independentes}.`);

  // Regressão adversarial: a data recente da página não deve ser promovida
  // a data do preço nem produzir uma conclusão de atualidade.
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

  assert.equal(preco.veredito, "SUPORTE_FRACO");
  assert.equal(preco.freshness.status, "UNVERIFIABLE");
  assert.equal(preco.freshness.score, null);
  console.log("REGRESSÃO PASSOU: atualização recente da página não prova atualização do preço.");
  console.log(`Observado: data da página=${atualidade.status}; veredito=${preco.veredito}; freshness=${preco.freshness.status}.`);
  console.log("Fixtures sintéticas. Nenhuma rede, banco ou chamada de modelo foi utilizada.");
}

main();
