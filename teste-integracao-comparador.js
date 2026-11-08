const assert = require("node:assert/strict");

const { criarBanco } = require("./src/banco");
const {
  compararHistoricoFonte
} = require("./src/comparador-fontes");

const banco = criarBanco({ caminho: ":memory:" });

const url = "https://exemplo.com/plano";

let totalTestes = 0;
let contadorColetas = 0;

function proximaData() {
  contadorColetas++;

  return new Date(
    Date.UTC(2026, 10, 3, 10, contadorColetas)
  ).toISOString();
}

function criarVerificacao(conteudo, data, numero) {
  return {
    sistema: "Entrelinhas",
    texto_original: conteudo,
    verificado_em: data,
    total_afirmacoes: 1,
    afirmacoes: [
      {
        id: `afirmacao_${numero}`,
        texto: conteudo,
        tipo_afirmacao: "informacao",
        erro_busca: null,
        evidencias: [
          {
            fonte: {
              titulo: "Página de teste",
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
          }
        ]
      }
    ]
  };
}

function executarTeste(nome, funcao) {
  totalTestes++;
  funcao();
  console.log(`✔ ${nome}`);
}

function salvarVersao(conteudo) {
  const data = proximaData();

  banco.salvarVerificacao(
    criarVerificacao(conteudo, data, contadorColetas)
  );
}

function compararVersoes(antigo, atual) {
  salvarVersao(antigo);
  salvarVersao(atual);

  return compararHistoricoFonte(banco, url);
}

try {
  console.log("\n======================================");
  console.log("ENTRELINHAS — TESTES DE CONTEXTO");
  console.log("======================================");

  executarTeste("Detecta alteração de preço", () => {
    const resultado = compararVersoes(
      "Plano básico custa R$ 49,90 por mês.",
      "Plano básico custa R$ 59,90 por mês."
    );

    assert.equal(resultado.status, "CHANGED");
    assert.ok(
      resultado.detalhamento.trechos_removidos.includes("49,90")
    );
    assert.ok(
      resultado.detalhamento.trechos_adicionados.includes("59,90")
    );
  });

  executarTeste("Detecta alteração de prazo", () => {
    const resultado = compararVersoes(
      "Oferta válida até 30 de novembro de 2026.",
      "Oferta válida até 15 de dezembro de 2026."
    );

    assert.equal(resultado.status, "CHANGED");
    assert.ok(resultado.detalhamento.trechos_removidos.length > 0);
    assert.ok(resultado.detalhamento.trechos_adicionados.length > 0);
  });

  executarTeste("Detecta alteração de condição", () => {
    const resultado = compararVersoes(
      "Preço válido somente para pagamento via Pix.",
      "Preço válido somente para pagamento via cartão."
    );

    assert.equal(resultado.status, "CHANGED");
    assert.ok(resultado.detalhamento.trechos_removidos.length > 0);
    assert.ok(resultado.detalhamento.trechos_adicionados.length > 0);
  });

  executarTeste("Detecta remoção de negação", () => {
    const resultado = compararVersoes(
      "O plano não inclui suporte prioritário.",
      "O plano inclui suporte prioritário."
    );

    assert.equal(resultado.status, "CHANGED");
    assert.ok(
      resultado.detalhamento.trechos_removidos.includes("não")
    );
  });

  executarTeste("Detecta alteração de ressalva", () => {
    const resultado = compararVersoes(
      "Benefício válido somente para novos clientes.",
      "Benefício válido para todos os clientes."
    );

    assert.equal(resultado.status, "CHANGED");
    assert.ok(resultado.detalhamento.trechos_removidos.length > 0);
  });

  executarTeste("Mantém conteúdo integral no histórico", () => {
    const historico = banco.listarHistoricoFonte(url);

    assert.equal(historico.length, 10);

    assert.ok(
      historico.some(item =>
        item.conteudo.includes("não inclui suporte prioritário")
      )
    );
  });

  console.log("\n======================================");
  console.log("RESULTADO FINAL");
  console.log("======================================");
  console.log(`TESTES EXECUTADOS: ${totalTestes}`);
  console.log("STATUS: TODOS PASSARAM");

} catch (erro) {
  console.error("\nTESTE NÃO APROVADO:", erro.message);
  process.exitCode = 1;

} finally {
  banco.fechar();
}