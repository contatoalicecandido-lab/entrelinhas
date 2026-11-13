// Resolve a categoria temporal de uma afirmação (preco, versao_api,
// regulamento, empresa). A categoria define a janela de validade usada
// pela avaliação de atualidade e pelo índice temporal.
//
// Precedência:
//   1. CONFIGURADO — informado pela aplicação (tiposPorAfirmacao).
//   2. MODELO      — sugerido pelo modelo na decomposição, se válido.
//   3. HEURISTICA  — regras determinísticas por palavras-chave.
//   4. null        — sem categoria; a atualidade fica UNVERIFIABLE.
const { VALIDADE_MAX_DIAS } = require("./atualidade");

const CATEGORIAS = Object.keys(VALIDADE_MAX_DIAS);

// Ordem importa: a primeira regra que casar vence.
const REGRAS = [
  {
    tipo: "preco",
    padrao: /(R\$|US\$|\$\s?\d|€\s?\d|£\s?\d|\d\s?(reais|dólares|dolares|euros)\b|\bpre[çc]os?\b|\bcusta(m|r)?\b|\bcost(s)?\b|\bpric(e|es|ing)\b|\bmensalidade\b|\bassinatura\b|\bper month\b|\bpor m[eê]s\b|\/m[eê]s\b|\btarifa\b|\bfee(s)?\b|\bde gra[çc]a\b|\bgr[aá]tis\b|\bgratuit[oa]s?\b|\bfree of charge\b|\bfor free\b|\bis free\b)/i
  },
  {
    tipo: "versao_api",
    padrao: /(\bAPIs?\b|\bendpoints?\b|\bSDK\b|\bvers[aã]o\s+\d|\bversion\s+\d|\bv\d+(\.\d+)*\b|\bdeprecat|\bdescontinuad|\brelease\b|\blan[çc]amento da vers[aã]o|\bbiblioteca\b|\blibrary\b|\bmodel(o)? (gpt|claude|gemini|llama)|\bnode(\.js)?\s+\d)/i
  },
  {
    tipo: "regulamento",
    padrao: /(\blei\b|\bleis\b|\bdecreto\b|\bregulament|\bregula[çc][aã]o\b|\bregulation\b|\bnorma\b|\bresolu[çc][aã]o\b|\bportaria\b|\bLGPD\b|\bGDPR\b|\bAI Act\b|\bcompliance\b|\bobrigat[óo]ri|\bmandatory\b|\blegisla|\blaw\b|\bANPD\b|\bANATEL\b|\bBACEN\b|\bBanco Central\b|\bsal[aá]rio m[ií]nimo\b|\bselic\b|\bipca\b|\bal[ií]quota\b|\bimposto\b|\binss\b|\birpf\b|\bsimples nacional\b|\bmei\b|\bclt\b|\bentra(ou)? em vigor\b|\brevogad[ao]\b)/i
  },
  {
    tipo: "empresa",
    padrao: /(\bCEO\b|\bCTO\b|\bCFO\b|\bfundador|\bfounder|\bfundad[ao] em\b|\bfounded\b|\bsede\b|\bheadquarter|\bfuncion[áa]rios\b|\bemployees\b|\badquiri|\bacquir|\bfus[aã]o\b|\bmerger\b|\bempresa\b|\bcompany\b|\bstartup\b|\bvaluation\b|\bavaliad[ao] em\b|\bIPO\b|\bfaturamento\b|\brevenue\b)/i
  }
];

function tipoValido(tipo) {
  return typeof tipo === "string" && CATEGORIAS.includes(tipo);
}

// Valores definidos por regra oficial no Brasil (salário mínimo, Selic,
// alíquotas): mesmo com "R$", são regulamento, não preço de mercado.
const VALOR_REGULADO_BR = /\b(sal[aá]rio m[ií]nimo|selic|al[ií]quota|teto do inss|faixa de isen[cç][aã]o|imposto de renda)\b/i;

// Regras de políticas públicas (quem tem direito, o que o SUS oferece, o que
// um órgão aprovou ou recomenda): mudam por decisão oficial, como regulamento.
const POLITICA_PUBLICA = /(\bSUS\b|\bAnvisa\b|\bMinist[ée]rio d[ao]s? \w+|\bcalend[áa]rio (vacinal|de vacina)|\bvacina[çc][ãa]o\b.*\b(gratuit|p[úu]blic|posto)|\bquem (tem direito|pode tomar|pode receber)\b|\bBolsa Fam[íi]lia\b|\bFGTS\b|\bINSS\b|\bbenef[íi]cio\b|\bFDA[- ]approved\b|\bapproved by the FDA\b|\bCDC recommends\b|\beligib(le|ility)\b)/i;

function inferirTipoPorRegras(texto) {
  if (typeof texto !== "string" || !texto.trim()) return null;
  if (VALOR_REGULADO_BR.test(texto)) return "regulamento";
  if (POLITICA_PUBLICA.test(texto)) return "regulamento";
  for (const regra of REGRAS) {
    if (regra.padrao.test(texto)) return regra.tipo;
  }
  return null;
}

/**
 * @returns {{ tipo: string|null, origem: "CONFIGURADO"|"MODELO"|"HEURISTICA"|null }}
 * Lança erro apenas quando a aplicação configurou um tipo inválido.
 */
function resolverTipoAfirmacao(afirmacao, tiposPorAfirmacao = {}, opcoes = {}) {
  const configurado = tiposPorAfirmacao[afirmacao.id];
  if (configurado) {
    if (!tipoValido(configurado)) {
      throw new Error(`Tipo de afirmação inválido para ${afirmacao.id}: ${configurado}`);
    }
    return { tipo: configurado, origem: "CONFIGURADO" };
  }

  if (opcoes.inferirTipo === false) {
    return { tipo: null, origem: null };
  }

  if (tipoValido(afirmacao.categoria_sugerida)) {
    return { tipo: afirmacao.categoria_sugerida, origem: "MODELO" };
  }

  const heuristico = inferirTipoPorRegras(afirmacao.texto);
  if (heuristico) return { tipo: heuristico, origem: "HEURISTICA" };

  return { tipo: null, origem: null };
}

module.exports = {
  CATEGORIAS,
  tipoValido,
  inferirTipoPorRegras,
  resolverTipoAfirmacao
};
