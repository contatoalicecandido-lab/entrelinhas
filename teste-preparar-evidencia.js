
const {
  prepararEvidencia,
  LIMITE_CARACTERES
} = require("./src/preparar-evidencia");

function verificar(nome, condicao) {
  console.log(`${nome}: ${condicao ? "PASSOU" : "FALHOU"}`);
  return condicao;
}

function criarInformacoesIrrelevantes(inicio, fim) {
  return Array.from(
    { length: fim - inicio },
    (_, indice) =>
      `Informação geral número ${inicio + indice + 1}: a empresa oferece atendimento, instalação, suporte técnico e serviços adicionais para seus clientes.`
  );
}

function testarReducao() {
  console.log("\n======================================");
  console.log("TESTE 1 — REDUÇÃO DE EVIDÊNCIA");
  console.log("======================================\n");

  const afirmacao =
    "O plano da Megabitplay de 200 Mega custa R$ 49,90 por mês para pagamentos até o vencimento.";

  const evidencia = {
    titulo: "Planos de internet residencial",
    url: "https://exemplo.com/planos",
    conteudo: [
      ...criarInformacoesIrrelevantes(0, 20),

      "A Megabitplay oferece o plano residencial de 200 Mega.",
      "O preço anunciado é de R$ 49,90 por mês para pagamentos realizados até o vencimento.",

      ...criarInformacoesIrrelevantes(20, 40),

      "O preço promocional de R$ 49,90 é válido somente até 30 de novembro de 2026.",

      ...criarInformacoesIrrelevantes(40, 60),

      "Após o vencimento, o valor mensal passa a ser R$ 59,90.",

      ...criarInformacoesIrrelevantes(60, 80),

      "A empresa também oferece um plano de 500 Mega por R$ 89,90 mensais.",

      ...criarInformacoesIrrelevantes(80, 100)
    ].join("\n\n")
  };

  const resultado = prepararEvidencia(afirmacao, evidencia);
  const conteudo = resultado.conteudo_para_analise;

  const verificacoes = [
    verificar("Redução aplicada", resultado.reducao_aplicada),
    verificar("Plano de 200 Mega preservado", conteudo.includes("200 Mega")),
    verificar("Preço de R$ 49,90 preservado", conteudo.includes("R$ 49,90")),
    verificar("Condição de vencimento preservada", conteudo.includes("vencimento")),
    verificar("Data de validade preservada", conteudo.includes("30 de novembro de 2026")),
    verificar("Preço após vencimento preservado", conteudo.includes("R$ 59,90")),
    verificar("Outro plano preservado", conteudo.includes("500 Mega")),
    verificar(
      "Conteúdo original preservado",
      resultado.conteudo_original === evidencia.conteudo.trim()
    ),
    verificar(
      "Limite respeitado",
      resultado.caracteres_preparados <= LIMITE_CARACTERES
    )
  ];

  console.log("\nCaracteres originais:", resultado.caracteres_originais);
  console.log("Caracteres preparados:", resultado.caracteres_preparados);
  console.log("Motivo:", resultado.motivo_preparacao);

  console.log(
    `\nResultado do teste 1: ${verificacoes.every(Boolean) ? "APROVADO" : "REPROVADO"}`
  );

  console.log("\nConteúdo preparado:\n");
  console.log(conteudo);

  return verificacoes.every(Boolean);
}

function testarFallback() {
  console.log("\n======================================");
  console.log("TESTE 2 — AUSÊNCIA DE CORRESPONDÊNCIA");
  console.log("======================================\n");

  const afirmacao =
    "A plataforma oferece integração com calendário corporativo.";

  const evidencia = {
    titulo: "Informações gerais",
    url: "https://exemplo.com/informacoes",
    conteudo: criarInformacoesIrrelevantes(0, 100).join("\n\n")
  };

  const resultado = prepararEvidencia(afirmacao, evidencia);

  const conteudoOriginal = evidencia.conteudo.trim();

  const verificacoes = [
    verificar(
      "Fallback acionado",
      resultado.motivo_preparacao === "FALLBACK_SEM_CORRESPONDENCIA_LEXICAL"
    ),
    verificar(
      "Conteúdo original enviado integralmente",
      resultado.conteudo_para_analise.includes(conteudoOriginal)
    ),
    verificar(
      "Redução não aplicada",
      resultado.reducao_aplicada === false
    ),
    verificar(
      "Conteúdo original preservado",
      resultado.conteudo_original === conteudoOriginal
    ),
    verificar(
      "Conteúdo pode ultrapassar o limite",
      resultado.caracteres_preparados > LIMITE_CARACTERES
    )
  ];

  console.log("\nCaracteres originais:", resultado.caracteres_originais);
  console.log("Caracteres preparados:", resultado.caracteres_preparados);
  console.log("Limite:", LIMITE_CARACTERES);
  console.log("Motivo:", resultado.motivo_preparacao);

  console.log(
    `\nResultado do teste 2: ${verificacoes.every(Boolean) ? "APROVADO" : "REPROVADO"}`
  );

  return verificacoes.every(Boolean);
}

function main() {
  console.log("\n======================================");
  console.log("ENTRELINHAS — TESTES DE PREPARAÇÃO");
  console.log("======================================");

  const testeReducao = testarReducao();
  const testeFallback = testarFallback();

  console.log("\n======================================");
  console.log("RESULTADO FINAL");
  console.log("======================================");

  console.log("Teste de redução:", testeReducao ? "PASSOU" : "FALHOU");
  console.log("Teste de fallback:", testeFallback ? "PASSOU" : "FALHOU");

  if (testeReducao && testeFallback) {
    console.log("\nTODOS OS TESTES PASSARAM!");
  } else {
    console.log("\nATENÇÃO: EXISTEM TESTES QUE FALHARAM.");
    process.exitCode = 1;
  }
}

main();
