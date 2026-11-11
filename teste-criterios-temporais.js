const assert = require("node:assert/strict");
const { createHash, randomUUID } = require("node:crypto");

const { criarBanco } = require("./src/banco");
const {
  compararHistoricoFonte
} = require("./src/comparador-fontes");

const URL = "https://exemplo.com/produto";

function criarColeta(idVerificacao, conteudo) {
  return {
    id_coleta: randomUUID(),
    id_verificacao: idVerificacao,
    url_original: URL,
    url_canonica: URL,
    versao_canonicalizacao: "1.0.0",
    tipo_fonte: "tavily_extract",
    status_coleta: "SUCCESS",
    conteudo,
    hash_conteudo: createHash("sha256")
      .update(conteudo, "utf8")
      .digest("hex"),
    coletado_em: "2026-11-09T10:00:00.000Z",
    id_operacao_busca: randomUUID(),
    id_operacao_extracao: randomUUID(),
    consulta: "Verificar informações do produto",
    parametros_busca: {
      query: "Verificar informações do produto",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_published_date: true
    },
    parametros_extracao: {
      urls: [URL],
      extract_depth: "basic",
      format: "markdown"
    }
  };
}

function criarEvidencia(id, coleta) {
  return {
    fonte: {
      titulo: `Evidência ${id}`,
      url: URL,
      tipo_fonte: coleta.tipo_fonte,
      conteudo: coleta.conteudo,
      coletado_em: coleta.coletado_em
    },
    coleta: { ...coleta },
    correspondencia: {
      status: "MATCH",
      justificativa: "Registro sintético."
    },
    classificacao: {
      postura: "SUPPORTS",
      justificativa: "Registro sintético."
    },
    atualidade: {
      status: "UNVERIFIABLE",
      motivo: "MISSING_SOURCE_DATE"
    }
  };
}

function executarTeste() {
  const banco = criarBanco({ caminho: ":memory:" });

  try {
    console.log("\n======================================");
    console.log("ENTRELINHAS — CRITÉRIOS TEMPORAIS");
    console.log("======================================");

    // CENÁRIO 1:
    // Três evidências vinculadas à mesma aquisição.

    const idVerificacao1 = randomUUID();
    const conteudo1 = "O produto custa R$ 49,90.";
    const coleta1 = criarColeta(idVerificacao1, conteudo1);

    console.log("\n1. Salvando três evidências da mesma coleta...");

    banco.salvarVerificacao({
      sistema: "Entrelinhas",
      id_verificacao: idVerificacao1,
      texto_original: "Verificar preço do produto.",
      verificado_em: "2026-11-09T10:05:00.000Z",
      total_afirmacoes: 1,
      afirmacoes: [
        {
          id: "afirmacao_teste_1",
          texto: conteudo1,
          tipo_afirmacao: "preco",
          evidencias: [
            criarEvidencia("1", coleta1),
            criarEvidencia("2", coleta1),
            criarEvidencia("3", coleta1)
          ]
        }
      ]
    });

    const historicoInicial = banco.listarHistoricoFonte(URL);

    assert.equal(historicoInicial.length, 3);

    const idsColeta = historicoInicial.map(
      item => item.coleta?.id_coleta
    );

    assert.ok(idsColeta.every(Boolean));

    assert.deepEqual(
      [...new Set(idsColeta)],
      [coleta1.id_coleta]
    );

    console.log("OK: as três evidências preservaram o mesmo id_coleta.");

    // CENÁRIO 2:
    // Uma única aquisição não pode ser comparada consigo mesma.

    console.log("\n2. Verificando se a mesma aquisição retorna NEW...");

    const resultadoInicial = compararHistoricoFonte(banco, URL);

    console.log("Status retornado:", resultadoInicial.status);

    assert.equal(
      resultadoInicial.status,
      "NEW",
      "Uma única aquisição não deve ser comparada como evolução temporal."
    );

    console.log("OK: uma aquisição foi reconhecida como NEW.");

    // CENÁRIO 3:
    // Duas verificações diferentes, com aquisições diferentes.

    console.log("\n3. Testando duas aquisições em verificações diferentes...");

    const idVerificacao2 = randomUUID();
    const conteudo2 = "O produto custa R$ 59,90.";
    const coleta2 = criarColeta(idVerificacao2, conteudo2);

    coleta2.coletado_em = "2026-11-09T11:00:00.000Z";

    coleta2.hash_conteudo = createHash("sha256")
      .update(conteudo2, "utf8")
      .digest("hex");

    banco.salvarVerificacao({
      sistema: "Entrelinhas",
      id_verificacao: idVerificacao2,
      texto_original: "Verificar novamente o preço do produto.",
      verificado_em: "2026-11-09T11:05:00.000Z",
      total_afirmacoes: 1,
      afirmacoes: [
        {
          id: "afirmacao_teste_2",
          texto: conteudo2,
          tipo_afirmacao: "preco",
          evidencias: [
            criarEvidencia("4", coleta2)
          ]
        }
      ]
    });

    const resultadoFinal = compararHistoricoFonte(banco, URL);

    console.log("Status retornado:", resultadoFinal.status);

    assert.equal(
      resultadoFinal.status,
      "CHANGED",
      "Duas aquisições válidas de verificações diferentes devem permitir comparação."
    );

    console.log("OK: duas aquisições distintas foram comparadas.");

    console.log("\n======================================");
    console.log("RESULTADO FINAL");
    console.log("======================================");
    console.log("VERIFICAÇÕES REALIZADAS: 3");
    console.log("STATUS: TODOS OS TESTES PASSARAM");

  } finally {
    banco.fechar();
  }
}

try {
  executarTeste();
} catch (erro) {
  console.error("\nTESTE NÃO APROVADO:");
  console.error(erro);
  process.exitCode = 1;
}
