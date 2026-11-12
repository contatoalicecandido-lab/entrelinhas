
const assert = require("node:assert/strict");

const {
  agregarEvidencias,
  normalizarDominio
} = require("./src/agregador");

let testes = 0;
let falhas = 0;

function testar(nome, funcao) {
  testes++;

  try {
    funcao();
    console.log(`OK ${testes}: ${nome}`);
  } catch (erro) {
    falhas++;
    console.error(`FALHOU ${testes}: ${nome}`);
    console.error(`   ${erro.message}`);
  }
}

function criarEvidencia({
  url = "https://exemplo.com.br/pagina",
  postura = "SUPPORTS",
  correspondencia = "MATCH",
  atualidade = "UNVERIFIABLE",
  publicacao = null,
  atualizacao = null
} = {}) {
  return {
    fonte: {
      titulo: "Fonte de teste",
      url,
      tipo_fonte: "tavily_extract",
      data_publicacao: publicacao,
      data_atualizacao: atualizacao,
      escopo_data: "ATTRIBUTE"
    },
    correspondencia: {
      status: correspondencia
    },
    classificacao: {
      postura,
      justificativa: "Resultado de teste."
    },
    atualidade: {
      status: atualidade
    }
  };
}

function criarAfirmacao(evidencias) {
  return {
    texto: "A afirmação utilizada no teste.",
    evidencias
  };
}

function opcoesOficiais(...dominios) {
  return {
    dominiosOficiais: dominios
  };
}

// ==================================================
// TESTES EXISTENTES
// ==================================================

testar("Normaliza domínio removendo www", () => {
  assert.equal(
    normalizarDominio("https://www.exemplo.com.br/pagina"),
    "exemplo.com.br"
  );
});

testar("Não considera fonte sem data como atual", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia()
    ]),
    opcoesOficiais("exemplo.com.br")
  );

  assert.equal(resultado.veredito, "SUPORTE_FRACO");
  assert.equal(resultado.fontes[0].atual, false);
});

testar("Não considera fonte não oficial como atual", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        url: "https://blog-exemplo.com/artigo",
        atualidade: "FRESH",
        publicacao: "2026-11-01T10:00:00Z"
      })
    ])
  );

  assert.equal(resultado.veredito, "SUPORTE_FRACO");
});

testar("Reconhece apoio de fonte oficial atual", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        atualidade: "FRESH",
        publicacao: "2026-11-01T10:00:00Z"
      })
    ]),
    opcoesOficiais("exemplo.com.br")
  );

  assert.equal(resultado.veredito, "ATUAL");
});

testar("Reconhece contradição de fonte oficial atual", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        postura: "CONTRADICTS",
        atualidade: "FRESH",
        publicacao: "2026-11-01T10:00:00Z"
      })
    ]),
    opcoesOficiais("exemplo.com.br")
  );

  assert.equal(
    resultado.veredito,
    "CONTRADITA_POR_FONTE_ATUAL"
  );
});

testar("Não conta duas páginas do mesmo domínio como fontes independentes", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        url: "https://exemplo.com.br/pagina-1"
      }),
      criarEvidencia({
        url: "https://www.exemplo.com.br/pagina-2"
      })
    ])
  );

  assert.equal(resultado.total_evidencias_utilizaveis, 2);
  assert.equal(resultado.fontes_independentes, 1);
});

testar("Identifica conflito entre fontes independentes", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        url: "https://fonte-a.com/artigo",
        postura: "SUPPORTS"
      }),
      criarEvidencia({
        url: "https://fonte-b.com/artigo",
        postura: "CONTRADICTS"
      })
    ])
  );

  assert.equal(resultado.veredito, "CONFLITO");
});

testar("Ignora evidência sem correspondência MATCH", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        correspondencia: "RELATED_INSUFFICIENT"
      })
    ])
  );

  assert.equal(resultado.veredito, "NAO_VERIFICAVEL");
  assert.equal(resultado.total_evidencias_utilizaveis, 0);
});

testar("Não transforma contradição de fonte fraca em veredito definitivo", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        postura: "CONTRADICTS"
      })
    ])
  );

  assert.equal(resultado.veredito, "NAO_VERIFICAVEL");
});

testar("Score é heurístico e fica entre 0 e 100", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia()
    ])
  );

  assert.equal(
    resultado.score_qualidade_evidencia.natureza,
    "HEURISTICA"
  );

  assert.ok(
    resultado.score_qualidade_evidencia.valor >= 0 &&
    resultado.score_qualidade_evidencia.valor <= 100
  );
});

testar("Rejeita cadastro de domínio oficial inválido", () => {
  assert.throws(() => {
    agregarEvidencias(
      criarAfirmacao([]),
      {
        dominiosOficiais: ["não é um domínio válido"]
      }
    );
  });
});

// ==================================================
// NOVOS TESTES DE ROBUSTEZ
// ==================================================

testar("Identifica conflito entre evidências contraditórias do mesmo domínio", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        url: "https://exemplo.com.br/pagina-1",
        postura: "SUPPORTS",
        atualidade: "FRESH",
        publicacao: "2026-11-04"
      }),
      criarEvidencia({
        url: "https://exemplo.com.br/pagina-2",
        postura: "CONTRADICTS",
        atualidade: "FRESH",
        publicacao: "2026-11-04"
      })
    ]),
    opcoesOficiais("exemplo.com.br")
  );

  assert.equal(resultado.fontes_independentes, 1);
  assert.equal(resultado.veredito, "CONFLITO");
});

testar("Fonte oficial atual prevalece sobre contradição antiga", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        url: "https://exemplo.com.br/informacao-atual",
        postura: "SUPPORTS",
        atualidade: "FRESH",
        publicacao: "2026-11-04"
      }),
      criarEvidencia({
        url: "https://fonte-antiga.com/informacao",
        postura: "CONTRADICTS",
        atualidade: "STALE",
        publicacao: "2024-01-10"
      })
    ]),
    opcoesOficiais("exemplo.com.br")
  );

  assert.equal(resultado.veredito, "ATUAL");

  assert.ok(
    resultado.limitacoes.some(
      limitacao =>
        limitacao.toLowerCase().includes("antiga") ||
        limitacao.toLowerCase().includes("desatualizada")
    )
  );
});

testar("Reconhece conflito entre fontes oficiais atuais independentes", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        url: "https://fonte-a.com/artigo",
        postura: "SUPPORTS",
        atualidade: "FRESH",
        publicacao: "2026-11-04"
      }),
      criarEvidencia({
        url: "https://fonte-b.com/artigo",
        postura: "CONTRADICTS",
        atualidade: "FRESH",
        publicacao: "2026-11-04"
      })
    ]),
    opcoesOficiais("fonte-a.com", "fonte-b.com")
  );

  assert.equal(resultado.fontes_independentes, 2);
  assert.equal(resultado.veredito, "CONFLITO");
});

testar("Não aceita data de calendário impossível como verificável", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        postura: "SUPPORTS",
        atualidade: "FRESH",
        publicacao: "2026-02-31"
      })
    ]),
    opcoesOficiais("exemplo.com.br")
  );

  assert.equal(resultado.fontes[0].atual, false);
  assert.equal(resultado.veredito, "SUPORTE_FRACO");
});

testar("Expõe datas de publicação e atualização no resumo final da fonte", () => {
  const resultado = agregarEvidencias(
    criarAfirmacao([
      criarEvidencia({
        atualidade: "FRESH",
        publicacao: "2026-11-04",
        atualizacao: "2026-11-05"
      })
    ]),
    opcoesOficiais("exemplo.com.br")
  );

  const fonte = resultado.fontes[0];

  assert.ok(fonte.evidencias);
  assert.equal(fonte.evidencias.length, 1);
  assert.equal(
    fonte.evidencias[0].data_publicacao,
    "2026-11-04"
  );
  assert.equal(
    fonte.evidencias[0].data_atualizacao,
    "2026-11-05"
  );
});

// ==================================================
// RESULTADO
// ==================================================

console.log("\n======================================");
console.log("ENTRELINHAS — TESTES DO AGREGADOR");
console.log("======================================");
console.log("TOTAL:", testes);
console.log("APROVADOS:", testes - falhas);
console.log("FALHAS:", falhas);

if (falhas > 0) {
  console.error("\nFORAM IDENTIFICADOS PROBLEMAS NO AGREGADOR.");
  process.exitCode = 1;
} else {
  console.log("\nTODOS OS TESTES DO AGREGADOR PASSARAM!");
}
