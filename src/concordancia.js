// Concordância entre fontes: o quanto fontes INDEPENDENTES e de TIPOS
// diferentes concordam com a afirmação. É a medida principal de
// "quão verídica parece a afirmação" no Entrelinhas; a atualidade (data)
// é uma dimensão separada.
//
// Não é probabilidade de verdade. Cópias e páginas do mesmo domínio já foram
// agrupadas antes (um grupo = uma voz), e cada tipo de fonte tem um peso
// para que vários blogs não valham mais do que uma fonte oficial.

// Prioridade: fontes oficiais e científicas, depois notícias, depois
// referências. Blogs e fóruns quase não pesam: servem para mostrar o que
// circula (e muitas vezes é exatamente o que precisa ser checado).
const PESOS = { OFICIAL: 3, ACADEMICO: 3, NOTICIA: 2, REFERENCIA: 1.5, OUTRO: 1, BLOG_FORUM: 0.25 };
const ALGORITMO = "SOURCE_AGREEMENT_INDEX";
const VERSAO = "1.1.0";

function pesoDoGrupo(grupo) {
  // O grupo vale pelo seu tipo de fonte mais forte. Se o modelo tomou posição
  // sem nenhuma citação conferida no texto da fonte, o voto vale metade.
  const peso = Math.max(...grupo.evidencias.map(e => PESOS[e.categoria_fonte] ?? PESOS.OUTRO));
  const semCitacao = grupo.evidencias.every(e => e.citacao_verificada === false);
  return semCitacao ? peso / 2 : peso;
}

function tipoDoGrupo(grupo) {
  return grupo.evidencias
    .map(e => e.categoria_fonte ?? "OUTRO")
    .sort((a, b) => (PESOS[b] ?? 1) - (PESOS[a] ?? 1))[0];
}

/**
 * @param {Array} grupos grupos independentes produzidos pelo agregador
 * @returns {object} índice 0–100 (ou null), força da cobertura e detalhamento
 */
function calcularConcordancia(grupos) {
  const base = { algorithm_id: ALGORITMO, algorithm_version: VERSAO, weights: PESOS };
  const votos = grupos
    .filter(g => g.postura === "SUPPORTS" || g.postura === "CONTRADICTS" || g.postura === "CONFLITO")
    .map(g => ({ postura: g.postura, peso: pesoDoGrupo(g), tipo: tipoDoGrupo(g), dominio: g.dominio, oficial: Boolean(g.oficial) }));

  const apoio = votos.filter(v => v.postura === "SUPPORTS");
  const contra = votos.filter(v => v.postura === "CONTRADICTS");
  const divididos = votos.filter(v => v.postura === "CONFLITO");
  const pesoApoio = apoio.reduce((s, v) => s + v.peso, 0);
  const pesoContra = contra.reduce((s, v) => s + v.peso, 0);
  // Um grupo dividido (mesmo site dizendo coisas diferentes) pesa metade para cada lado.
  const pesoDividido = divididos.reduce((s, v) => s + v.peso / 2, 0);
  const total = pesoApoio + pesoContra + 2 * pesoDividido;

  const tipos = [...new Set(votos.map(v => v.tipo))];
  const independentes = votos.length;
  // Fonte com autoridade própria: oficial (governo, órgão, site da entidade)
  // ou científica. Com uma confirmação independente de outro tipo, já é forte.
  const autoridade = v => v.oficial || v.tipo === "OFICIAL" || v.tipo === "ACADEMICO";
  const apoioComAutoridade = apoio.filter(autoridade).length;
  let cobertura;
  if (independentes >= 3 && tipos.length >= 2) cobertura = "STRONG";
  else if (independentes >= 2 && tipos.length >= 2 && votos.some(autoridade)) cobertura = "STRONG";
  else if (independentes >= 2) cobertura = "MODERATE";
  else if (independentes === 1) cobertura = "WEAK";
  else cobertura = "NONE";

  const porTipo = {};
  for (const v of votos) {
    porTipo[v.tipo] ??= { supports: 0, contradicts: 0, split: 0 };
    if (v.postura === "SUPPORTS") porTipo[v.tipo].supports += 1;
    else if (v.postura === "CONTRADICTS") porTipo[v.tipo].contradicts += 1;
    else porTipo[v.tipo].split += 1;
  }

  return {
    ...base,
    score: total > 0 ? Math.round((100 * (pesoApoio + pesoDividido)) / total) : null,
    coverage: cobertura,
    independent_sources: independentes,
    source_types: tipos,
    supporting: apoio.length,
    support_weight: Math.round(pesoApoio * 100) / 100,
    contradict_weight: Math.round(pesoContra * 100) / 100,
    authoritative_supporting: apoioComAutoridade,
    contradicting: contra.length,
    split: divididos.length,
    by_type: porTipo,
    limitations: [
      "Agreement between sources is not a probability of truth: sources can share the same mistake.",
      "Copies and pages from the same site count once; independence is approximated by domain and text similarity."
    ]
  };
}

// Afirmação corroborada: nenhuma voz contradiz, e apoiam (a) três ou mais
// fontes independentes de tipos diferentes, ou (b) uma fonte oficial ou
// científica mais uma confirmação independente de outro tipo.
// Usado quando não há fonte oficial com data ligada ao fato.
function estaCorroborada(concordancia) {
  if (concordancia.coverage !== "STRONG" || concordancia.contradicting !== 0 || concordancia.split !== 0) return false;
  // Três vozes fracas (sites quaisquer, blogs) não bastam: o apoio precisa
  // pesar pelo menos o mesmo que uma fonte oficial mais uma notícia.
  if (Number.isFinite(concordancia.support_weight) && concordancia.support_weight < 4) return false;
  if (concordancia.supporting >= 3) return true;
  return concordancia.supporting >= 2 && (concordancia.authoritative_supporting ?? 0) >= 1 && concordancia.source_types.length >= 2;
}

module.exports = { calcularConcordancia, estaCorroborada, PESOS };
