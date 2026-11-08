
const casosBenchmark = [
  {
    id: "B001",
    categoria: "SUPPORTS",
    afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês.",
    evidencia: "A Megabitplay oferece o plano residencial de 200 Mega pelo valor mensal de R$ 49,90.",
    correspondencia_esperada: "MATCH",
    postura_esperada: "SUPPORTS"
  },
  {
    id: "B002",
    categoria: "CONTRADICTS",
    afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês.",
    evidencia: "A Megabitplay informa que seu plano residencial de 200 Mega custa R$ 69,90 por mês.",
    correspondencia_esperada: "MATCH",
    postura_esperada: "CONTRADICTS"
  },
  {
    id: "B003",
    categoria: "INSUFFICIENT",
    afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês.",
    evidencia: "A Megabitplay oferece planos residenciais de internet com diferentes velocidades e condições comerciais.",
    correspondencia_esperada: "RELATED_INSUFFICIENT",
    postura_esperada: "INSUFFICIENT"
  },
  {
    id: "B004",
    categoria: "IRRELEVANT",
    afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês.",
    evidencia: "O Node.js é um ambiente de execução JavaScript construído sobre o motor V8.",
    correspondencia_esperada: "UNRELATED",
    postura_esperada: "IRRELEVANT"
  },
  {
    id: "B005",
    categoria: "OUTRA_EMPRESA",
    afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês.",
    evidencia: "A empresa Panda Fibra oferece um plano de 200 Mega por R$ 49,90 mensais.",
    correspondencia_esperada: "UNRELATED",
    postura_esperada: "IRRELEVANT"
  },
  {
    id: "B006",
    categoria: "CONDICAO_PAGAMENTO",
    afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês para pagamentos até o vencimento.",
    evidencia: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês quando o pagamento é realizado até a data de vencimento. Após essa data, o preço passa a R$ 59,90.",
    correspondencia_esperada: "MATCH",
    postura_esperada: "SUPPORTS"
  },
  {
    id: "B007",
    categoria: "CONDICAO_OMITIDA",
    afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês independentemente da data de pagamento.",
    evidencia: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês para pagamentos realizados até o vencimento. Após o vencimento, o valor é R$ 59,90.",
    correspondencia_esperada: "MATCH",
    postura_esperada: "CONTRADICTS"
  },
  {
    id: "B008",
    categoria: "PROMOCAO",
    afirmacao: "A promoção do plano de 200 Mega da Megabitplay por R$ 49,90 é válida até 30 de novembro de 2026.",
    evidencia: "A oferta promocional da Megabitplay para o plano de 200 Mega, por R$ 49,90 mensais, é válida até 30 de novembro de 2026.",
    correspondencia_esperada: "MATCH",
    postura_esperada: "SUPPORTS"
  },
  {
    id: "B009",
    categoria: "NEGACAO",
    afirmacao: "A Megabitplay não cobra taxa de instalação no plano de 200 Mega.",
    evidencia: "A Megabitplay informa que o plano de 200 Mega possui taxa de instalação de R$ 80,00.",
    correspondencia_esperada: "MATCH",
    postura_esperada: "CONTRADICTS"
  },
  {
  id: "B010",
  categoria: "SUPPORTS_COM_FONTE_INDIVIDUAL",
  afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês.",
  evidencia: "A página comercial da Megabitplay informa que o plano de 200 Mega custa R$ 49,90 por mês.",
  correspondencia_esperada: "MATCH",
  postura_esperada: "SUPPORTS"
  },
  {
    id: "B011",
    categoria: "PRECO_GENERICO",
    afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês.",
    evidencia: "Uma pesquisa de mercado estima que planos de internet de 200 Mega no Brasil custam entre R$ 70,00 e R$ 120,00 por mês.",
    correspondencia_esperada: "RELATED_INSUFFICIENT",
    postura_esperada: "INSUFFICIENT"
  },
  {
    id: "B012",
    categoria: "PRODUTO_DIFERENTE",
    afirmacao: "O plano de 200 Mega da Megabitplay custa R$ 49,90 por mês.",
    evidencia: "A Megabitplay oferece um plano de 500 Mega por R$ 89,90 mensais.",
    correspondencia_esperada: "RELATED_INSUFFICIENT",
    postura_esperada: "INSUFFICIENT"
  }
];

module.exports = casosBenchmark;
