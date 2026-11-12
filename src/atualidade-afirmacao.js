// Nota de atualidade da AFIRMAÇÃO (0–100), sempre que houver fontes datadas
// que se posicionam sobre ela. Responde à pergunta do desafio: "esta
// afirmação ainda vale hoje?".
//
//   nota = recência das evidências × parcela de apoio entre as fontes
//
// - Recência das evidências (0–100): meia-vida pela janela da categoria
//   (preço 30 d, versão 90 d, empresa 180 d, regulamento 365 d). Usa a data
//   do FATO citada na fonte quando existe (confiança maior); senão, a data
//   da página (confiança baixa). Sem categoria, janela geral de 180 dias.
// - Parcela de apoio (0–1): peso das fontes que confirmam ÷ peso total
//   (oficial e científica 3, notícia 2, referência 1,5, outro 1, blog 0,25).
//
// Assim: contradita por fontes atuais → nota baixa; confirmada por fontes
// recentes → nota alta; confirmada só por fontes antigas → nota baixa
// ("envelhecendo"). Não é probabilidade de verdade.
const ALGORITHM_ID = "CLAIM_CURRENCY_SCORE";
const ALGORITHM_VERSION = "1.0.0";
const JANELA_GERAL_DIAS = 180;

const NIVEIS = ["LOW", "MEDIUM", "HIGH"];
const rebaixar = nivel => NIVEIS[Math.max(0, NIVEIS.indexOf(nivel) - 1)];

function calcularAtualidadeAfirmacao({ freshness, recenciaPagina, recenciaGeral, concordancia, janelaDias } = {}) {
  const base = {
    algorithm_id: ALGORITHM_ID,
    algorithm_version: ALGORITHM_VERSION,
    formula: "evidence_recency × support_share",
    window_days: Number.isInteger(janelaDias) ? janelaDias : null
  };

  let recencia = null; let fundamento = null; let confianca = null; let dataMaisNova = null;
  if (freshness && Number.isFinite(freshness.score)) {
    recencia = freshness.score;
    fundamento = "FACT_DATE";
    confianca = freshness.confidence === "ADEQUATE" ? "HIGH" : "MEDIUM";
    const datas = (freshness.drivers ?? []).map(d => d.date).filter(Boolean).sort();
    dataMaisNova = datas.at(-1) ?? null;
  } else if (recenciaPagina && Number.isFinite(recenciaPagina.score)) {
    recencia = recenciaPagina.score;
    fundamento = "PAGE_DATE";
    confianca = "LOW";
    dataMaisNova = recenciaPagina.newest_date ?? null;
  } else if (recenciaGeral && Number.isFinite(recenciaGeral.score)) {
    recencia = recenciaGeral.score;
    fundamento = "PAGE_DATE_GENERAL_WINDOW";
    confianca = "LOW";
    dataMaisNova = recenciaGeral.newest_date ?? null;
    base.window_days = JANELA_GERAL_DIAS;
  }

  const temPosicao = concordancia && concordancia.independent_sources > 0 && Number.isFinite(concordancia.score);
  if (!temPosicao) {
    return { ...base, score: null, status: "NOT_SCORED", reason: "NO_SOURCE_TOOK_A_POSITION",
      basis: fundamento, confidence: null, evidence_recency: recencia, support_share: null, newest_date: dataMaisNova };
  }
  const apoio = concordancia.score / 100;
  if (recencia === null) {
    return { ...base, score: null, status: "NOT_SCORED", reason: "NO_SOURCE_DATE",
      basis: null, confidence: null, evidence_recency: null, support_share: apoio, newest_date: null };
  }

  const nota = Math.round(recencia * apoio);
  if (concordancia.coverage === "WEAK" || concordancia.coverage === "NONE") confianca = rebaixar(confianca);

  // Dentro da janela de validade? Ex.: salário mínimo vigente desde 1º de
  // janeiro continua atual em novembro (janela de 365 dias), mesmo com a
  // nota numérica já mais baixa pela meia-vida.
  const janela = base.window_days;
  const referencia = Date.parse(freshness?.as_of ?? recenciaPagina?.as_of ?? recenciaGeral?.as_of ?? "");
  const idadeDias = dataMaisNova && Number.isFinite(referencia)
    ? Math.floor((referencia - Date.parse(`${dataMaisNova}T00:00:00Z`)) / 86400000)
    : null;
  const dentroDaJanela = Number.isInteger(janela) && idadeDias !== null && idadeDias <= janela;

  let status;
  if (concordancia.contradicting > 0 && apoio < 0.5) status = "CONTRADICTED";
  else if (apoio >= 0.75 && (nota >= 70 || dentroDaJanela)) status = "CURRENT";
  else if (apoio >= 0.75) status = "AGING";
  else status = "UNCERTAIN";

  return {
    ...base,
    score: nota,
    status,
    basis: fundamento,
    confidence: confianca,
    evidence_recency: recencia,
    support_share: apoio,
    newest_date: dataMaisNova,
    newest_age_days: idadeDias,
    within_window: dentroDaJanela
  };
}

module.exports = { calcularAtualidadeAfirmacao, ALGORITHM_ID, JANELA_GERAL_DIAS };
