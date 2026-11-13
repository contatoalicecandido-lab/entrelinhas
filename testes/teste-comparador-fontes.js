
const assert = require("node:assert/strict");

const { criarBanco } = require("../src/banco");

const {
  compararHistoricoFonte,
  calcularDiferencas
} = require("../src/comparador-fontes");

const banco = criarBanco({ caminho: ":memory:" });
const url = "https://exemplo.com/produto";

let contadorData = 0;
let totalTestes = 0;

function proximaData() {
  contadorData++;

  return `2026-11-${String(contadorData).padStart(2, "0")}T10:00:00.000Z`;
}

function criarVerificacao(conteudo) {
  const data = proximaData();

  return {
    sistema: "Entrelinhas",
    texto_original: conteudo,
    verificado_em: data,
    total_afirmacoes: 1,
    afirmacoes: [
      {
        id: "afirmacao_1",
        texto: conteudo,
        tipo_afirmacao: "preco",
        erro_busca: null,
        evidencias: [
          {
            fonte: {
              titulo: "Página do produto",
              url,
              tipo_fonte: "tavily_extract",
              conteudo,
              coletado_em: data,
              data_publicacao: null,
              data_atualizacao: null,
              relevancia: 0.95
            },
            correspondencia: {
              status: "MATCH",
              justificativa: "Mesmo produto."
            },
            classificacao: {
              postura: "SUPPORTS",
              justificativa: "Informação compatível."
            },
            atualidade: {
              status: "UNVERIFIABLE",
              motivo: "MISSING_SOURCE_DATE"
            }
          }
        ]
      }
    ]
  };
}

function salvarColeta(conteudo) {
  banco.salvarVerificacao(criarVerificacao(conteudo));
}

function executarTeste(nome, funcao) {
  totalTestes++;

  try {
    funcao();
    console.log(`✔ ${nome}`);
  } catch (erro) {
    console.error(`✖ ${nome}`);
    throw erro;
  }
}

try {
  console.log("\n======================================");
  console.log("ENTRELINHAS — TESTES DE COMPARAÇÃO");
  console.log("======================================");

  executarTeste("Primeira coleta retorna NEW", () => {
    salvarColeta("O produto custa R$ 49,90.");
    assert.equal(compararHistoricoFonte(banco, url).status, "NEW");
  });

  executarTeste("Conteúdo igual retorna UNCHANGED", () => {
    salvarColeta("O produto custa R$ 49,90.");
    assert.equal(compararHistoricoFonte(banco, url).status, "UNCHANGED");
  });

  executarTeste("Alteração de preço retorna CHANGED", () => {
    salvarColeta("O produto custa R$ 59,90.");
    assert.equal(compararHistoricoFonte(banco, url).status, "CHANGED");
  });

  executarTeste("Diferenças de espaçamento não geram mudança", () => {
    const resultado = calcularDiferencas(
      "O produto custa R$ 49,90.",
      "O produto   custa R$ 49,90."
    );
    assert.equal(resultado.status, "COMPLETO");
  });

  executarTeste("Alteração de data é detectada", () => {
    const resultado = calcularDiferencas(
      "Oferta válida até 30 de novembro de 2026.",
      "Oferta válida até 15 de dezembro de 2026."
    );
    assert.ok(resultado.trechos_removidos.length > 0);
    assert.ok(resultado.trechos_adicionados.length > 0);
  });

  executarTeste("Alteração de condição é detectada", () => {
    const resultado = calcularDiferencas(
      "Preço válido para pagamento até o vencimento.",
      "Preço válido para qualquer data de pagamento."
    );
    assert.ok(resultado.trechos_removidos.length > 0);
    assert.ok(resultado.trechos_adicionados.length > 0);
  });

  executarTeste("Alteração de ressalva é detectada", () => {
    const resultado = calcularDiferencas(
      "Válido somente para novos clientes.",
      "Válido para todos os clientes."
    );
    assert.ok(resultado.trechos_removidos.length > 0);
    assert.ok(resultado.trechos_adicionados.length > 0);
  });

  executarTeste("Equivalência Unicode é preservada", () => {
    const resultado = calcularDiferencas(
      "Informação sobre o produto.",
      "Informac\u0327a\u0303o sobre o produto."
    );
    assert.equal(resultado.status, "COMPLETO");
  });

  executarTeste("Limite de comparação é respeitado", () => {
    const textoGrande = Array(1201).fill("conteudo").join(" ");
    const resultado = calcularDiferencas(
      textoGrande,
      textoGrande + " adicional"
    );
    assert.equal(resultado.status, "NOT_COMPUTED_LIMIT");
  });

  executarTeste("Exportações do módulo estão disponíveis", () => {
    assert.equal(typeof compararHistoricoFonte, "function");
    assert.equal(typeof calcularDiferencas, "function");
  });

  console.log("\n======================================");
  console.log("RESULTADO FINAL");
  console.log("======================================");
  console.log(`TESTES EXECUTADOS: ${totalTestes}`);
  console.log("STATUS: TODOS PASSARAM");

} catch (erro) {
  console.error("\nFALHA NOS TESTES:", erro.message);
  process.exitCode = 1;

} finally {
  banco.fechar();
}
