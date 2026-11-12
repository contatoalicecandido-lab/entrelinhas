// Concordância entre fontes: o quanto fontes INDEPENDENTES e de TIPOS
// diferentes concordam com a afirmação. É a medida principal de
// "quão verídica parece a afirmação" no Entrelinhas; a atualidade (data)
// é uma dimensão separada.
//
// Não é probabilidade de verdade. Cópias e páginas do mesmo domínio já foram
// agrupadas antes (um grupo = uma voz), e cada tipo de fonte tem um peso
// para que vários blogs não valham mais do que uma fonte oficial.

const PESOS = { OFICIAL: 3, REFERENCIA: 2, NOTICIA: 2, OUTRO: 1, BLOG_FORUM: 0.5 };
const ALGORITMO = "SOURCE_AGREEMENT_INDEX";
const VERSAO = "1.0.0";

function pesoDoGrupo(grupo) {
  // O grupo vale pelo seu tipo de fonte mais forte.
  return Math.max(...grupo.evidencias.map(e => PESOS[e.categoria_fonte] ?? PESOS.OUTRO));
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
  let cobertura;
  if (independentes >= 3 && tipos.length >= 2) cobertura = "STRONG";
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
    contradicting: contra.length,
    split: divididos.length,
    by_type: porTipo,
    limitations: [
      "Agreement between sources is not a probability of truth: sources can share the same mistake.",
      "Copies and pages from the same site count once; independence is approximated by domain and text similarity."
    ]
  };
}

// Afirmação corroborada: várias vozes independentes, de tipos diferentes,
// apoiam e nenhuma contradiz. Usado quando não há fonte oficial com data.
function estaCorroborada(concordancia) {
  return concordancia.coverage === "STRONG" &&
    concordancia.contradicting === 0 &&
    concordancia.split === 0 &&
    concordancia.supporting >= 3;
}

module.exports = { calcularConcordancia, estaCorroborada, PESOS };
