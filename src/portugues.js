// Nuances do português (pt-BR) para verificação de afirmações.
//
// O português muda o sentido de uma afirmação de formas que um comparador
// ingênuo erra:
//   - "R$ 1.234,56": o ponto separa milhares e a vírgula, os decimais;
//   - "a partir de R$ 49,90" é preço mínimo, não preço exato;
//   - "até 50% de desconto" é limite superior;
//   - "cerca de", "mais de", "pelo menos" mudam o que conta como compatível;
//   - "12 de novembro de 2026", "nov/2026", "12/11/2026" (dia/mês);
//   - "R$ 2 bi", "1,5 mil" usam escalas por extenso.
// Este módulo é determinístico: não chama modelo nem rede.

const STOPWORDS_PT = new Set("a o os as um uma de da do das dos em no na nos nas que para com por não nao é e ao aos à às pela pelo pelas pelos seu sua mais está esta são sao foi ser tem também tambem já ja ainda atual custa partir até ate cerca".split(" "));
const STOPWORDS_EN = new Set("the a an of in on for to and is are was were be it its with by as at from this that still current costs cost price supports offers".split(" "));

function semAcento(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function detectarIdioma(texto) {
  const palavras = String(texto ?? "").toLowerCase().match(/[a-zà-ÿç]+/g) ?? [];
  if (palavras.length === 0) return { idioma: "desconhecido", confianca: 0 };
  let pt = 0;
  let en = 0;
  for (const p of palavras) {
    if (STOPWORDS_PT.has(p)) pt += 1;
    if (STOPWORDS_EN.has(p)) en += 1;
    if (/[ãõçáéíóúâêô]/.test(p)) pt += 1.5;
  }
  if (/R\$\s?\d/.test(texto)) pt += 2;
  const total = pt + en;
  if (total === 0) return { idioma: "desconhecido", confianca: 0 };
  const idioma = pt >= en ? "pt" : "en";
  return { idioma, confianca: Math.round((Math.max(pt, en) / total) * 100) / 100 };
}

const MOEDAS = [
  { padrao: "R\\$", codigo: "BRL" },
  { padrao: "US\\$|U\\$", codigo: "USD" },
  { padrao: "€", codigo: "EUR" },
  { padrao: "£", codigo: "GBP" },
  { padrao: "\\$", codigo: "USD" }
];

const ESCALAS = {
  mil: 1e3, k: 1e3, thousand: 1e3,
  mi: 1e6, milhao: 1e6, milhoes: 1e6, million: 1e6, mn: 1e6,
  bi: 1e9, bilhao: 1e9, bilhoes: 1e9, billion: 1e9, bn: 1e9,
  tri: 1e12, trilhao: 1e12, trilhoes: 1e12, trillion: 1e12
};

// Converte um número escrito em pt-BR ("1.234,56", "49,90", "1.500")
// ou en ("1,234.56", "49.90") para Number, usando o formato indicado.
function converterNumero(bruto, formato) {
  const s = String(bruto).trim();
  if (formato === "pt") {
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+(,\d+)?$/.test(s)) {
      return Number(s.replace(/\./g, "").replace(",", "."));
    }
  } else {
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) || /^\d+(\.\d+)?$/.test(s)) {
      return Number(s.replace(/,/g, ""));
    }
  }
  return null;
}

// Decide o formato numérico de um trecho: vírgula decimal ("49,90") indica pt.
function inferirFormatoNumerico(bruto, idiomaTexto) {
  if (/,\d{1,2}$/.test(bruto)) return "pt";
  if (/\.\d{1,2}$/.test(bruto)) return "en";
  if (/^\d{1,3}(\.\d{3})+$/.test(bruto)) return idiomaTexto === "en" ? "en" : "pt";
  if (/^\d{1,3}(,\d{3})+$/.test(bruto)) return "en";
  return idiomaTexto === "en" ? "en" : "pt";
}

const QUALIFICADORES = [
  { tipo: "MINIMO", rotulo: "starting at (lower bound)", padrao: /\b(a partir de|desde|pelo menos|no m[ií]nimo|starting at|from|at least)\s*$/i },
  { tipo: "MAXIMO", rotulo: "up to (upper bound)", padrao: /\b(at[eé]|no m[aá]ximo|up to|at most)\s*$/i },
  { tipo: "APROXIMADO", rotulo: "approximately", padrao: /\b(cerca de|aproximadamente|em torno de|por volta de|quase|about|around|approximately|roughly|nearly)\s*$/i },
  { tipo: "ACIMA", rotulo: "more than", padrao: /\b(mais de|acima de|more than|over)\s*$/i },
  { tipo: "ABAIXO", rotulo: "less than", padrao: /\b(menos de|abaixo de|less than|under)\s*$/i },
  { tipo: "PROMOCIONAL", rotulo: "promotional / limited", padrao: /\b(por apenas|por s[oó]|apenas|s[oó])\s*$/i }
];

function qualificadorAntes(texto, indice) {
  const antes = texto.slice(Math.max(0, indice - 28), indice);
  for (const q of QUALIFICADORES) {
    if (q.padrao.test(antes)) return { tipo: q.tipo, rotulo: q.rotulo };
  }
  return null;
}

const PERIODO_DEPOIS = /^\s*(\/\s?m[eê]s|por m[eê]s|ao m[eê]s|mensais|\/mo\b|per month|a month|\/\s?ano|por ano|ao ano|anuais|per year|\/yr\b)/i;

// Extrai valores monetários, percentuais e números com escala.
function extrairValores(texto) {
  const original = String(texto ?? "");
  const idiomaTexto = detectarIdioma(original).idioma;
  const valores = [];
  const moedaRe = MOEDAS.map(m => m.padrao).join("|");
  const re = new RegExp(`(${moedaRe})\\s?(\\d[\\d.,]*)(?:\\s?(mil|mi|milh[oõ]es|milh[aã]o|bi|bilh[oõ]es|bilh[aã]o|tri|k|mn|bn|million|billion)\\b)?|(\\d[\\d.,]*)\\s?%`, "gi");
  let m;
  while ((m = re.exec(original)) !== null) {
    if (m[4] !== undefined) {
      const formato = inferirFormatoNumerico(m[4], idiomaTexto);
      const numero = converterNumero(m[4], formato);
      if (numero === null) continue;
      valores.push({ tipo: "PERCENTUAL", texto: m[0].trim(), valor: numero, unidade: "%", qualificador: qualificadorAntes(original, m.index) });
      continue;
    }
    const simbolo = m[1];
    const moeda = MOEDAS.find(x => new RegExp(`^(${x.padrao})$`).test(simbolo))?.codigo ?? null;
    const bruto = m[2].replace(/[.,]$/, "");
    const formato = moeda === "BRL" ? "pt" : inferirFormatoNumerico(bruto, idiomaTexto);
    let numero = converterNumero(bruto, formato);
    if (numero === null) continue;
    if (m[3]) numero *= ESCALAS[semAcento(m[3])] ?? 1;
    const depois = original.slice(m.index + m[0].length, m.index + m[0].length + 14);
    const periodo = PERIODO_DEPOIS.exec(depois);
    valores.push({
      tipo: "MONETARIO",
      texto: (m[0] + (periodo ? periodo[0] : "")).trim().replace(/[.,;:]$/, ""),
      valor: Math.round(numero * 100) / 100,
      moeda,
      periodo: periodo ? (/ano|year|yr|anuais/i.test(periodo[0]) ? "ANUAL" : "MENSAL") : null,
      qualificador: qualificadorAntes(original, m.index)
    });
  }
  // Quantidades com escala por extenso, sem moeda: "5 mil funcionários",
  // "1,2 milhão de usuários", "3 bilhões de downloads".
  const reQtd = /(?<![\d$€£])(\d[\d.,]*)\s?(mil|milh[aã]o|milh[oõ]es|bilh[aã]o|bilh[oõ]es|thousand|million|billion)\b/gi;
  while ((m = reQtd.exec(original)) !== null) {
    const antes = original.slice(Math.max(0, m.index - 4), m.index);
    if (/(R\$|US\$|U\$|\$|€|£)\s?$/.test(antes)) continue;
    const formato = inferirFormatoNumerico(m[1], idiomaTexto);
    const numero = converterNumero(m[1].replace(/[.,]$/, ""), formato);
    if (numero === null) continue;
    const total = numero * (ESCALAS[semAcento(m[2])] ?? 1);
    valores.push({ tipo: "QUANTIDADE", texto: m[0].trim(), valor: total, qualificador: qualificadorAntes(original, m.index) });
  }
  return valores;
}

const MESES = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4,
  maio: 5, mai: 5, junho: 6, jun: 6, julho: 7, jul: 7, agosto: 8, ago: 8,
  setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12
};

function dataValida(ano, mes, dia) {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function iso(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, "0")}-${dia ? String(dia).padStart(2, "0") : "01"}`;
}

// Datas em português: "12 de novembro de 2026", "1º de janeiro de 2025",
// "novembro de 2026", "nov/2026", "12/11/2026" (dia/mês/ano).
function extrairDatasPt(texto) {
  const original = String(texto ?? "");
  const t = semAcento(original);
  const datas = [];
  let m;
  const porExtenso = /\b(\d{1,2})(?:º|o)?\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de)?\s+(\d{4})\b/g;
  while ((m = porExtenso.exec(t)) !== null) {
    const dia = Number(m[1]); const mes = MESES[m[2]]; const ano = Number(m[3]);
    if (dataValida(ano, mes, dia)) datas.push({ texto: original.slice(m.index, m.index + m[0].length), data: iso(ano, mes, dia), precisao: "DIA" });
  }
  const mesAno = /\b(?<!\d\s)(?<!de\s)(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:\s+de\s+|\/|\s+)(\d{4})\b/g;
  while ((m = mesAno.exec(t)) !== null) {
    const antes = t.slice(Math.max(0, m.index - 7), m.index);
    if (/\d{1,2}(º|o)?\s+de\s+$/.test(antes)) continue;
    datas.push({ texto: original.slice(m.index, m.index + m[0].length), data: iso(Number(m[2]), MESES[m[1]]), precisao: "MES" });
  }
  const numerica = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  while ((m = numerica.exec(t)) !== null) {
    const dia = Number(m[1]); const mes = Number(m[2]); const ano = Number(m[3]);
    if (dataValida(ano, mes, dia)) datas.push({ texto: m[0], data: iso(ano, mes, dia), precisao: "DIA", formato: "DD/MM/AAAA" });
  }
  return datas;
}

// Expressões de tempo relativo que dependem da data de referência.
const RELATIVOS = [
  [/\b(atualmente|hoje em dia|hoje|no momento|agora|ainda)\b/i, "PRESENTE", "present tense: must hold today"],
  [/\b(recentemente|recém|recem|acaba de|acabou de)\b/i, "RECENTE", "recent event: vague time reference"],
  [/\bh[aá]\s+\d+\s+(dias?|semanas?|meses|m[eê]s|anos?)\b/i, "RELATIVO", "relative to the publication date"],
  [/\b(este ano|neste ano|este m[eê]s|ano passado|m[eê]s passado|semana passada)\b/i, "RELATIVO", "relative to the publication date"],
  [/\b(currently|nowadays|today|right now|still|as of now)\b/i, "PRESENTE", "present tense: must hold today"],
  [/\b(recently|just launched|just released|last year|this year|last month)\b/i, "RELATIVO", "relative to the publication date"]
];

function extrairExpressoesTemporais(texto) {
  const encontrados = [];
  for (const [re, tipo, rotulo] of RELATIVOS) {
    const m = re.exec(String(texto ?? ""));
    if (m) encontrados.push({ texto: m[0], tipo, rotulo });
  }
  return encontrados;
}

// Condições de compra e de oferta típicas do comércio brasileiro. Mudam se
// um preço "está certo": R$ 99 no Pix não é o mesmo que R$ 99 parcelado.
const CONDICOES = [
  [/\b(no|via|pelo) pix\b/i, "payment by Pix only"],
  [/\b[àa] vista\b/i, "upfront / single payment"],
  [/\bno boleto\b/i, "payment by boleto (bank slip)"],
  [/\b(em at[eé] )?\d{1,2}\s?x\s?(sem juros|com juros)?\b/i, "instalment plan"],
  [/\bsem juros\b/i, "interest-free instalments"],
  [/\bno cart[aã]o\b/i, "card payment"],
  [/\b(no|nos) (primeiro|primeiros|\d+ primeiros) (m[eê]s|meses)\b/i, "introductory period only"],
  [/\b(para|p\/) novos clientes\b/i, "new customers only"],
  [/\bpor tempo limitado\b|\bpromo[cç][aã]o\b|\bblack friday\b/i, "time-limited promotion"],
  [/\bfrete gr[aá]tis\b/i, "free shipping condition"],
  [/\b(na|para a) (regi[aã]o|cidade|capital)\b|\bem s[aã]o paulo\b|\bno rio\b/i, "regional condition"],
  [/\bcom fidelidade\b|\bplano anual\b/i, "commitment / annual plan"]
];

// Expressões que descrevem MUDANÇA ao longo do tempo: o centro de uma
// resposta desatualizada.
const MUDANCAS = [
  [/\bdeixou de\b|\bdeixaram de\b/i, "stopped: the fact used to be true and changed"],
  [/\bn[aã]o [eé] mais\b|\bj[aá] n[aã]o\b|\bn[aã]o existe mais\b/i, "no longer true: a change of state"],
  [/\bpassou a\b|\bpassaram a\b|\bpassa a valer\b/i, "became true from some point in time"],
  [/\bvoltou a\b|\bvoltaram a\b/i, "became true again after a change"],
  [/\bainda n[aã]o\b/i, "not yet: expected to change"],
  [/\bentrou em vigor\b|\bentra em vigor\b|\bvigora\b|\bem vigor\b/i, "legal validity: check the date it takes effect"],
  [/\bfoi (revogad[ao]|extint[ao]|descontinuad[ao]|encerrad[ao]|suspens[ao])\b/i, "ended: revoked, discontinued or closed"],
  [/\bfoi (lan[cç]ad[ao]|aprovad[ao]|sancionad[ao]|anunciad[ao])\b/i, "event: launched, approved or announced at a specific time"],
  [/\b(reajust|aument|reduz|caiu|cair|subiu|subir|sobe|baixou|baixar)/i, "price or value change"]
];

// Mapa de autoridades brasileiras: termos que apontam para a fonte oficial
// que deve ser consultada. Usado para sugerir domínios oficiais automaticamente.
const AUTORIDADES_BR = [
  [/\bselic\b|\bcopom\b|\bregras do pix\b|\bbanco central\b|\bbacen\b|\bc[aâ]mbio oficial\b/i, "bcb.gov.br", "Banco Central do Brasil"],
  [/\blgpd\b|\banpd\b|prote[cç][aã]o de dados/i, "gov.br", "ANPD / gov.br"],
  [/\banatel\b|\btelefonia\b|\bbanda larga\b/i, "anatel.gov.br", "Anatel"],
  [/\bclt\b|\bconsolida[cç][aã]o das leis do trabalho\b|\blei n[ºo°.]?\s?\d|\bdecreto\b|\bmedida provis[oó]ria\b|\bconstitui[cç][aã]o\b/i, "planalto.gov.br", "Presidency legislation portal (Planalto)"],
  [/\bsal[aá]rio m[ií]nimo\b|\binss\b|\baposentadoria\b|\bbolsa fam[ií]lia\b/i, "gov.br", "Federal government (gov.br)"],
  [/\breceita federal\b|\bimposto de renda\b|\birpf\b|\bcnpj\b|\bcpf\b|\bmei\b|\bsimples nacional\b/i, "gov.br", "Receita Federal (gov.br)"],
  [/\bipca\b|\binfla[cç][aã]o oficial\b|\bibge\b|\bdesemprego\b|\bpib\b/i, "ibge.gov.br", "IBGE"],
  [/\bcvm\b|\bb3\b|\ba[cç][oõ]es\b|\bbolsa de valores\b/i, "cvm.gov.br", "CVM"],
  [/\banvisa\b|\bmedicamento\b|\bvacina\b/i, "gov.br", "Anvisa (gov.br)"],
  [/\bstf\b|\bstj\b|\btse\b|\bsupremo\b/i, "jus.br", "Brazilian courts (jus.br)"],
  [/\bprocon\b|\bc[oó]digo de defesa do consumidor\b|\bcdc\b/i, "planalto.gov.br", "Consumer Protection Code (Planalto)"]
];

// Linguagem informal brasileira que aparece em respostas de IA treinadas com
// fóruns, redes sociais e blogs. Não muda o fato, mas muda como ele precisa
// ser lido e buscado.
const GIRIAS_DINHEIRO = [
  // "50 conto", "100 pila", "30 mangos": reais por extenso informal
  { re: /\b(\d[\d.,]*)\s?(contos?|pilas?|mangos?|pratas?)\b/i, fator: 1, rotulo: "slang for reais" },
  // "1 pau", "2 paus", "mil pau": mil reais
  { re: /\b(\d[\d.,]*|um|uma|dois|duas|tr[eê]s)\s?(paus?|bar[aã]o|bar[oõ]es)\b/i, fator: 1000, rotulo: "slang for a thousand reais" },
  // "5k", "10k": milhares
  { re: /\b(\d[\d.,]*)\s?k\b/i, fator: 1000, rotulo: "shorthand for thousands" }
];
const PALAVRAS_NUMERO = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, "três": 3 };

const APROXIMACOES_INFORMAIS = /\b(uns|umas|na faixa de|por volta de|mais ou menos|tipo|coisa de|quase|beirando)\s+(R\$\s?)?\d/i;

const ALIASES = [
  [/\bzap(zap)?\b|\bwhats\b|\bwpp\b/i, "WhatsApp"],
  [/\binsta\b/i, "Instagram"],
  [/\bface\b(?!\s?id)/i, "Facebook"],
  [/\bgpt\b(?!-)/i, "ChatGPT"],
  [/\bnetflixx?\b/i, "Netflix"],
  [/\bbanco central\b|\bbc\b(?=.*\b(juros|selic|pix)\b)/i, "Banco Central do Brasil"],
  [/\bbolsa\b(?=.*\b(a[cç][oõ]es|ibovespa|b3)\b)/i, "B3"],
  [/\bsus\b/i, "SUS (Sistema Único de Saúde)"],
  [/\bfgts\b/i, "FGTS"],
  [/\bmei\b/i, "MEI (Microempreendedor Individual)"]
];

const EXPRESSOES_INFORMAIS = [
  [/\bde gra[cç]a\b|\bgr[aá]tis\b|\bfree\b/i, "free of charge: price is zero"],
  [/\bj[aá] era\b|\bacabou\b|\bmorreu\b|\bsaiu do ar\b|\bfoi pro saco\b/i, "informal: ended / no longer available"],
  [/\bt[aá] rolando\b|\bt[aá] valendo\b|\bt[aá] na pista\b/i, "informal: currently happening / in effect"],
  [/\bvoltou\b|\bt[aá] de volta\b/i, "informal: available again"],
  [/\bt[aá] custando\b|\bt[aá] saindo (a|por)\b|\bsai por\b/i, "informal: current price (present tense)"],
  [/\bcaro pra caramba\b|\bbaratinho\b|\bcarinho\b/i, "subjective price judgment, not a verifiable fact"],
  [/\bdizem que\b|\bparece que\b|\bouvi dizer\b|\bsegundo boatos\b/i, "hedged / hearsay: the claim is not asserted as fact"],
  [/\bt[aá]\b|\bpra\b|\bvc\b|\bq\b|\bn[eé]\b/i, "informal register: read as spoken Brazilian Portuguese"]
];

function lerGirias(texto) {
  const original = String(texto ?? "");
  const valores = [];
  for (const g of GIRIAS_DINHEIRO) {
    const m = g.re.exec(original);
    if (!m) continue;
    const base = PALAVRAS_NUMERO[semAcento(m[1])] ?? converterNumero(m[1].replace(/[.,]$/, ""), "pt");
    if (base === null || base === undefined) continue;
    valores.push({ tipo: "MONETARIO", texto: m[0].trim(), valor: base * g.fator, moeda: "BRL", periodo: null,
      qualificador: qualificadorAntes(original, m.index), informal: true, rotulo: g.rotulo });
  }
  const aliases = [];
  for (const [re, canonico] of ALIASES) {
    const m = re.exec(original);
    if (m && m[0].toLowerCase() !== canonico.toLowerCase()) aliases.push({ texto: m[0], canonico });
  }
  const expressoes = encontrar(EXPRESSOES_INFORMAIS, original);
  const aproximacaoInformal = APROXIMACOES_INFORMAIS.exec(original)?.[1] ?? null;
  return { valores, aliases, expressoes, aproximacaoInformal };
}

// Versão da afirmação para BUSCA: troca apelidos por nomes oficiais
// ("zap" → WhatsApp) e gírias de dinheiro por valores ("50 conto" → R$ 50).
function normalizarParaBusca(texto) {
  let t = String(texto ?? "");
  for (const [re, canonico] of ALIASES) t = t.replace(re, canonico);
  t = t.replace(/\b(\d[\d.,]*)\s?(contos?|pilas?|mangos?|pratas?)\b/gi, "R$ $1");
  t = t.replace(/\b(\d[\d.,]*)\s?(paus?|bar[aã]o|bar[oõ]es)\b/gi, "R$ $1 mil");
  return t;
}

// Português europeu: mesma língua, outras convenções (e às vezes outros fatos).
const PT_PT = /\b(facto|telem[oó]vel|equipa|autocarro|ecr[aã]|utilizador|registo|est(ou|á|amos|ão) a [a-z]+r)\b/i;

const MESES_LISTA = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Tempo coloquial resolvido a partir da data de referência.
function resolverTempoColoquial(texto, referencia = new Date()) {
  const t = semAcento(texto);
  const ano = referencia.getUTCFullYear();
  const mes = referencia.getUTCMonth() + 1;
  const achados = [];
  if (/\b(ano que vem|proximo ano)\b/.test(t)) achados.push({ texto: "ano que vem", resolvido: String(ano + 1), rotulo: `"next year" = ${ano + 1}` });
  if (/\b(ano passado)\b/.test(t)) achados.push({ texto: "ano passado", resolvido: String(ano - 1), rotulo: `"last year" = ${ano - 1}` });
  if (/\b(este ano|neste ano|esse ano)\b/.test(t)) achados.push({ texto: "este ano", resolvido: String(ano), rotulo: `"this year" = ${ano}` });
  if (/\b(mes que vem|proximo mes)\b/.test(t)) {
    const m2 = mes === 12 ? 1 : mes + 1; const a2 = mes === 12 ? ano + 1 : ano;
    achados.push({ texto: "mês que vem", resolvido: iso(a2, m2), rotulo: `"next month" = ${MESES_LISTA[m2 - 1]} ${a2}` });
  }
  const mSemAno = /\b(a partir de|em|desde|ate) (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b(?!\s+(de\s+)?\d{4})/.exec(t);
  if (mSemAno) {
    const alvo = MESES[mSemAno[2]];
    const a2 = alvo >= mes ? ano : ano + 1;
    const original = String(texto).slice(mSemAno.index, mSemAno.index + mSemAno[0].length);
    achados.push({ texto: original, resolvido: iso(a2, alvo), rotulo: `month without a year: read as ${MESES_LISTA[alvo - 1]} ${a2} (nearest)` });
  }
  return achados;
}

function encontrar(lista, texto) {
  const r = [];
  for (const [re, rotulo, extra] of lista) {
    const m = re.exec(String(texto ?? ""));
    if (!m) continue;
    // Evita repetir um trecho já coberto por outra expressão ("12x sem juros" e "sem juros").
    if (r.some(x => x.texto.toLowerCase().includes(m[0].toLowerCase().trim()))) continue;
    r.push({ texto: m[0].trim(), rotulo, extra });
  }
  return r;
}

function sugerirDominiosOficiaisBr(texto) {
  const achados = encontrar(AUTORIDADES_BR.map(([re, dominio, nome]) => [re, dominio, nome]), texto);
  const vistos = new Map();
  for (const a of achados) if (!vistos.has(a.rotulo)) vistos.set(a.rotulo, { dominio: a.rotulo, autoridade: a.extra, termo: a.texto });
  return [...vistos.values()];
}

// Resumo das nuances de uma afirmação, para a interface e para o modelo.
function analisarNuances(texto, opcoes = {}) {
  const { idioma, confianca } = detectarIdioma(texto);
  const valores = extrairValores(texto);
  const datas = idioma === "pt" ? extrairDatasPt(texto) : [];
  const temporais = extrairExpressoesTemporais(texto);
  const referencia = opcoes.dataReferencia instanceof Date ? opcoes.dataReferencia : new Date();
  const condicoes = idioma === "pt" ? encontrar(CONDICOES, texto) : [];
  const mudancas = idioma === "pt" ? encontrar(MUDANCAS, texto) : [];
  const coloquiais = idioma === "pt" ? resolverTempoColoquial(texto, referencia) : [];
  const autoridades = idioma === "pt" ? sugerirDominiosOficiaisBr(texto) : [];
  const variante = idioma === "pt" ? (PT_PT.test(texto) ? "pt-PT" : "pt-BR") : null;
  const girias = idioma === "pt" ? lerGirias(texto) : { valores: [], aliases: [], expressoes: [], aproximacaoInformal: null };
  // Gírias de dinheiro entram como valores normais, marcados como informais.
  for (const v of girias.valores) {
    if (!valores.some(x => x.texto.includes(v.texto) || v.texto.includes(x.texto))) {
      if (girias.aproximacaoInformal && !v.qualificador) v.qualificador = { tipo: "APROXIMADO", rotulo: "approximately" };
      valores.push(v);
    }
  }
  if (girias.aproximacaoInformal) {
    for (const v of valores) if (!v.qualificador) v.qualificador = { tipo: "APROXIMADO", rotulo: "approximately" };
  }
  const consultaBusca = idioma === "pt" ? normalizarParaBusca(texto) : String(texto ?? "");
  const notas = [];
  for (const v of valores) {
    if (v.qualificador && v.tipo !== "QUANTIDADE" && !v.informal) {
      notas.push(`"${v.texto}" is qualified as ${v.qualificador.rotulo}: a source with a different exact value can still be compatible.`);
    }
    if (v.informal) {
      notas.push(`"${v.texto}" is ${v.rotulo}: about BRL ${v.valor.toLocaleString("en-US")}${v.qualificador ? ` (${v.qualificador.rotulo})` : ""}.`);
      continue;
    }
    if (v.tipo === "QUANTIDADE") {
      notas.push(`"${v.texto}" means ${v.valor.toLocaleString("en-US")}${v.qualificador ? ` (${v.qualificador.rotulo})` : ""}.`);
      continue;
    }
    if (v.tipo === "MONETARIO" && v.moeda === "BRL") {
      notas.push(`"${v.texto}" uses Brazilian number format: BRL ${v.valor.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${v.periodo ? (v.periodo === "MENSAL" ? " per month" : " per year") : ""}.`);
    }
  }
  for (const d of datas) {
    let extra = "";
    if (d.formato === "DD/MM/AAAA") {
      const [a, m, dia] = d.data.split("-").map(Number);
      if (dia <= 12 && dia !== m) extra = ` (day/month: ${dia} ${MESES_LISTA[m - 1]}, not ${MESES_LISTA[dia - 1]} ${m})`;
      else extra = ` (day/month: ${dia} ${MESES_LISTA[m - 1]} ${a})`;
    }
    notas.push(`"${d.texto}" is a Portuguese date: ${d.data}${d.precisao === "MES" ? " (month precision)" : ""}${extra}.`);
  }
  for (const c of condicoes) notas.push(`"${c.texto}" is a condition (${c.rotulo}): a source without it, or with another condition, may not confirm the claim.`);
  for (const m of mudancas) notas.push(`"${m.texto}": ${m.rotulo}.`);
  for (const c of coloquiais) notas.push(`"${c.texto}": ${c.rotulo}.`);
  for (const a of autoridades) notas.push(`"${a.termo}" points to a Brazilian authority: ${a.autoridade} (${a.dominio}) is searched as an official source.`);
  for (const a of girias.aliases) notas.push(`"${a.texto}" is an informal name for ${a.canonico}; the search uses the official name.`);
  for (const e of girias.expressoes) notas.push(`"${e.texto}": ${e.rotulo}.`);
  if (girias.aproximacaoInformal) notas.push(`"${girias.aproximacaoInformal}" makes the value approximate.`);
  if (variante === "pt-PT") notas.push("European Portuguese detected: spelling and facts may refer to Portugal, not Brazil.");
  for (const e of temporais) notas.push(`"${e.texto}": ${e.rotulo}.`);
  return {
    idioma, variante, confianca_idioma: confianca, valores, datas, expressoes_temporais: temporais,
    condicoes, mudancas, tempo_coloquial: coloquiais,
    girias: { aliases: girias.aliases, expressoes: girias.expressoes },
    consulta_busca: consultaBusca,
    dominios_oficiais_sugeridos: autoridades.map(a => a.dominio),
    autoridades, notas
  };
}

// Compara um valor da afirmação com os valores de uma evidência, respeitando
// o qualificador. Retorna COMPATIVEL, INCOMPATIVEL ou SEM_VALOR.
function compararValores(valorAfirmacao, valoresEvidencia, tolerancia = 0.02) {
  const candidatos = valoresEvidencia.filter(v =>
    v.tipo === valorAfirmacao.tipo && (v.moeda ?? null) === (valorAfirmacao.moeda ?? null));
  if (candidatos.length === 0) return { status: "SEM_VALOR" };
  const alvo = valorAfirmacao.valor;
  const q = valorAfirmacao.qualificador?.tipo ?? null;
  const ok = v => {
    const x = v.valor;
    switch (q) {
      case "MINIMO": return x >= alvo * (1 - tolerancia);
      case "MAXIMO": return x <= alvo * (1 + tolerancia);
      case "ACIMA": return x > alvo;
      case "ABAIXO": return x < alvo;
      case "APROXIMADO": return Math.abs(x - alvo) <= alvo * 0.1;
      default: return Math.abs(x - alvo) <= Math.max(0.005, alvo * tolerancia);
    }
  };
  const compativel = candidatos.find(ok);
  return compativel
    ? { status: "COMPATIVEL", valor_evidencia: compativel }
    : { status: "INCOMPATIVEL", valores_evidencia: candidatos.slice(0, 3) };
}

module.exports = {
  detectarIdioma,
  extrairValores,
  extrairDatasPt,
  extrairExpressoesTemporais,
  analisarNuances,
  sugerirDominiosOficiaisBr,
  normalizarParaBusca,
  resolverTempoColoquial,
  compararValores,
  converterNumero
};
