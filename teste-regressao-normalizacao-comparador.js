
const assert = require("node:assert/strict");

const { criarBanco } = require("./src/banco");
const {
  compararHistoricoFonte,
  calcularDiferencas
} = require("./src/comparador-fontes");

const banco = criarBanco({ caminho: ":memory:" });

let contador = 0;
let totalTestes = 0;
let totalFalhas = 0;

function executarTeste(nome, funcao) {
  totalTestes++;

  try {
    funcao();
    console.log(`✔ ${nome}`);
  } catch (erro) {
    totalFalhas++;
    console.error(`✖ ${nome}`);
    console.error(erro.message);
  }
}

function criarVerificacao(conteudo, url) {
  contador++;

  const data =
    `2026-11-${String(contador).padStart(2, "0")}T10:00:00.000Z`;

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

function salvarColeta(conteudo, url) {
  banco.salvarVerificacao(criarVerificacao(conteudo, url));
}

function verificarSemAlteracoes(resultado) {
  assert.equal(resultado.status, "COMPLETO");
  assert.deepEqual(resultado.alteracoes, []);
  assert.deepEqual(resultado.trechos_removidos, []);
  assert.deepEqual(resultado.trechos_adicionados, []);
}

try {
  console.log("\n=== REGRESSÃO DA NORMALIZAÇÃO NO COMPARADOR ===\n");

  executarTeste(
    "Espaços repetidos não geram diferenças no LCS",
    () => {
      const resultado = calcularDiferencas(
        "O produto custa R$ 49,90.",
        "O produto   custa R$ 49,90."
      );

      verificarSemAlteracoes(resultado);
    }
  );

  executarTeste(
    "Tabulações e espaços misturados não geram diferenças",
    () => {
      const resultado = calcularDiferencas(
        "O produto custa R$ 49,90.",
        "O produto\t   custa R$ 49,90."
      );

      verificarSemAlteracoes(resultado);
    }
  );

  executarTeste(
    "Diferenças de pontuação continuam sendo detectadas",
    () => {
      const resultado = calcularDiferencas(
        "O produto custa R$ 49,90.",
        "O produto custa R$ 49,90!"
      );

      assert.equal(resultado.status, "COMPLETO");
      assert.ok(resultado.alteracoes.length > 0);
    }
  );

  executarTeste(
    "Alterações numéricas continuam sendo detectadas",
    () => {
      const resultado = calcularDiferencas(
        "O plano custa R$ 49,90.",
        "O plano custa R$ 59,90."
      );

      assert.equal(resultado.status, "COMPLETO");
      assert.ok(resultado.alteracoes.length > 0);
    }
  );

  executarTeste(
    "Inclusão de negação continua sendo detectada",
    () => {
      const resultado = calcularDiferencas(
        "O uso é permitido.",
        "O uso não é permitido."
      );

      assert.equal(resultado.status, "COMPLETO");
      assert.ok(resultado.alteracoes.length > 0);
    }
  );

  executarTeste(
    "Alteração de quebra de parágrafo continua sendo detectada",
    () => {
      const resultado = calcularDiferencas(
        "Primeiro parágrafo.\nSegundo parágrafo.",
        "Primeiro parágrafo. Segundo parágrafo."
      );

      assert.equal(resultado.status, "COMPLETO");
      assert.ok(resultado.alteracoes.length > 0);
    }
  );

  executarTeste(
    "Histórico classifica mudança exclusiva de espaços como UNCHANGED",
    () => {
      const url = "https://exemplo.com/regressao-espacos";

      salvarColeta("O produto custa R$ 49,90.", url);
      salvarColeta("O produto   custa R$ 49,90.", url);

      const resultado = compararHistoricoFonte(banco, url);

      assert.equal(resultado.status, "UNCHANGED");
      assert.equal(
        resultado.hash_anterior,
        resultado.hash_atual
      );
    }
  );

  executarTeste(
    "Histórico continua detectando alteração real de preço",
    () => {
      const url = "https://exemplo.com/regressao-preco";

      salvarColeta("O plano custa R$ 49,90.", url);
      salvarColeta("O plano custa R$ 59,90.", url);

      const resultado = compararHistoricoFonte(banco, url);

      assert.equal(resultado.status, "CHANGED");
      assert.notEqual(
        resultado.hash_anterior,
        resultado.hash_atual
      );
      assert.equal(resultado.detalhamento.status, "COMPLETO");
      assert.ok(resultado.detalhamento.alteracoes.length > 0);
    }
  );

  console.log("\n=== RESULTADO ===");
  console.log(`Testes executados: ${totalTestes}`);
  console.log(`Aprovados: ${totalTestes - totalFalhas}`);
  console.log(`Falhas: ${totalFalhas}`);

  if (totalFalhas > 0) {
    process.exitCode = 1;
  } else {
    console.log("\nTODOS OS TESTES PASSARAM.");
  }
} catch (erro) {
  console.error("\nErro inesperado na execução:");
  console.error(erro);
  process.exitCode = 1;
} finally {
  banco.fechar();
}
