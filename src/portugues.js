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
      texto: (m[0] + (periodo ? periodo[0] : "")).trim(),
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

// Resumo das nuances de uma afirmação, para a interface e para o modelo.
function analisarNuances(texto) {
  const { idioma, confianca } = detectarIdioma(texto);
  const valores = extrairValores(texto);
  const datas = idioma === "pt" ? extrairDatasPt(texto) : [];
  const temporais = extrairExpressoesTemporais(texto);
  const notas = [];
  for (const v of valores) {
    if (v.qualificador && v.tipo !== "QUANTIDADE") {
      notas.push(`"${v.texto}" is qualified as ${v.qualificador.rotulo}: a source with a different exact value can still be compatible.`);
    }
    if (v.tipo === "QUANTIDADE") {
      notas.push(`"${v.texto}" means ${v.valor.toLocaleString("en-US")}${v.qualificador ? ` (${v.qualificador.rotulo})` : ""}.`);
      continue;
    }
    if (v.tipo === "MONETARIO" && v.moeda === "BRL") {
      notas.push(`"${v.texto}" uses Brazilian number format: BRL ${v.valor.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${v.periodo ? (v.periodo === "MENSAL" ? " per month" : " per year") : ""}.`);
    }
  }
  for (const d of datas) notas.push(`"${d.texto}" is a Portuguese date: ${d.data}${d.precisao === "MES" ? " (month precision)" : ""}.`);
  for (const e of temporais) notas.push(`"${e.texto}": ${e.rotulo}.`);
  return { idioma, confianca_idioma: confianca, valores, datas, expressoes_temporais: temporais, notas };
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
  compararValores,
  converterNumero
};
