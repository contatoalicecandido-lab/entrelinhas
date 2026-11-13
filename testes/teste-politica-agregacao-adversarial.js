const assert = require("node:assert/strict");
const { agregarEvidencias } = require("../src/agregador");

const DOMINIOS_OFICIAIS = ["operadora.example"];

function evidencia({
  url,
  postura,
  correspondencia = "MATCH",
  atualidade = "FRESH",
  titulo = "Fonte sintética",
  justificativa = "Fixture controlada.",
  escopoData = "ATTRIBUTE"
}) {
  return {
    fonte: {
      titulo,
      url,
      tipo_fonte: "tavily_extract",
      data_publicacao: "2026-11-10",
      data_atualizacao: null,
      // Política 1.2.0: só uma data vinculada ao atributo torna a evidência "atual".
      escopo_data: escopoData
    },
    correspondencia: { status: correspondencia },
    classificacao: { postura, justificativa },
    atualidade: { status: atualidade }
  };
}

function agregar(lista, texto = "A afirmação sintética deve ser verificada.") {
  return agregarEvidencias(
    { texto, evidencias: lista },
    { dominiosOficiais: DOMINIOS_OFICIAIS }
  );
}

function testar(nome, funcao) {
  funcao();
  console.log(`PASSOU: ${nome}`);
}

testar("dez páginas de um domínio não anulam uma fonte independente contraditória", () => {
  const evidencias = Array.from({ length: 10 }, (_, i) => evidencia({
    url: `https://blog-copiador.example/post-${i + 1}`,
    postura: "SUPPORTS"
  }));
  evidencias.push(evidencia({
    url: "https://analise-independente.example/relatorio",
    postura: "CONTRADICTS"
  }));

  const resultado = agregar(evidencias);
  assert.equal(resultado.veredito, "CONFLITO");
  assert.equal(resultado.fontes_independentes, 2);
  assert.equal(resultado.total_evidencias_utilizaveis, 11);
});

testar("evidência apenas relacionada não decide uma afirmação ampla", () => {
  const resultado = agregar([
    evidencia({
      url: "https://energia.example/artigo",
      postura: "SUPPORTS",
      correspondencia: "RELATED_INSUFFICIENT",
      justificativa: "Aborda consumo de energia, não os demais impactos ambientais alegados."
    })
  ], "Data centers prejudicam a saúde humana e o meio ambiente.");

  assert.equal(resultado.veredito, "NAO_VERIFICAVEL");
  assert.equal(resultado.total_evidencias_utilizaveis, 0);
  assert.ok(resultado.limitacoes.some(texto => /nenhuma evidência utilizável/i.test(texto)));
});

testar("evidência insuficiente não deve virar apoio em uma afirmação composta", () => {
  const resultado = agregar([
    evidencia({
      url: "https://estudo.example/paper",
      postura: "INSUFFICIENT",
      justificativa: "Avalia energia, mas não investiga saúde, água ou impacto local."
    })
  ], "Data centers causam danos à saúde, consomem água e aumentam emissões.");

  assert.equal(resultado.veredito, "NAO_VERIFICAVEL");
  assert.equal(resultado.total_evidencias_utilizaveis, 0);
});

testar("uma fonte oficial atual pode superar contradições antigas e o relatório expõe essa limitação", () => {
  const resultado = agregar([
    evidencia({
      url: "https://operadora.example/planos",
      postura: "SUPPORTS",
      atualidade: "FRESH",
      justificativa: "Página oficial atual lista o preço para as condições descritas."
    }),
    evidencia({
      url: "https://arquivo-noticias.example/2024/preco",
      postura: "CONTRADICTS",
      atualidade: "STALE",
      justificativa: "Matéria antiga menciona preço anterior."
    })
  ], "O plano custa R$ 49,90 nas condições indicadas.");

  assert.equal(resultado.veredito, "ATUAL");
  assert.ok(resultado.limitacoes.some(texto => /contraditória antiga/i.test(texto)));
});

testar("conflito entre posições dentro do mesmo domínio não desaparece ao agrupar", () => {
  const resultado = agregar([
    evidencia({ url: "https://relatorio.example/a", postura: "SUPPORTS" }),
    evidencia({ url: "https://relatorio.example/b", postura: "CONTRADICTS" })
  ]);

  assert.equal(resultado.veredito, "CONFLITO");
  assert.equal(resultado.fontes_independentes, 1);
  assert.equal(resultado.fontes[0].postura, "CONFLITO");
});

console.log("Resultado: 5/5 cenários passaram. Fixtures sintéticas; nenhuma rede ou banco usados.");
