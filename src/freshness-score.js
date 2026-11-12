const { validarData } = require("./atualidade");

const ALGORITHM_ID = "CLAIM_FRESHNESS_SCORE";
const ALGORITHM_VERSION = "1.1.0";
const VALID_STATUSES = new Set(["FRESH", "STALE", "UNVERIFIABLE"]);
const VALID_POSTURES = new Set(["SUPPORTS", "CONTRADICTS"]);

function parseSourceDate(value) {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  if (!validISODateOrTimestamp(value, day)) return null;
  return day;
}

function validISODateOrTimestamp(value, day) {
  if (value === day) return validarData(day);
  const format = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
  if (!format.test(value) || !validarData(day)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

function freshnessForClaim(evidence, { claimType, validityDays, asOf }) {
  if (!VALID_POSTURES.has(evidence.postura)) return null;
  if (!VALID_STATUSES.has(evidence.temporalStatus)) return null;
  if (evidence.temporalStatus === "UNVERIFIABLE") return null;
  if (evidence.match !== true) return null;
  if (typeof evidence.domain !== "string" || !evidence.domain) return null;

  const publication = evidence.publicationDate;
  const update = evidence.updateDate;
  const publicationPresent = publication !== null && publication !== undefined;
  const updatePresent = update !== null && update !== undefined;
  if (!publicationPresent && !updatePresent) return null;

  const published = publicationPresent ? parseSourceDate(publication) : null;
  const updated = updatePresent ? parseSourceDate(update) : null;
  if ((publicationPresent && !published) || (updatePresent && !updated)) return null;
  if (published && updated && updated < published) return null;

  const selectedDate = updated || published;
  // A page-level date is not proof that the specific claim attribute was updated.
  if (evidence.dateScope !== "ATTRIBUTE") return null;

  const ageDays = Math.floor((asOf.getTime() - Date.parse(`${selectedDate}T00:00:00Z`)) / 86400000);
  if (ageDays < 0 || !Number.isFinite(ageDays)) return null;

  const score = Math.max(0, Math.min(100, 100 * Math.pow(2, -ageDays / (validityDays / 2))));
  // Recompute the categorical temporal state from the same date, reference
  // instant, and policy used by the numeric index; do not trust a stale label.
  const status = ageDays > validityDays ? "STALE" : "FRESH";
  return {
    score,
    selectedDate,
    ageDays,
    status,
    posture: evidence.postura,
    domain: evidence.domain,
    dependencyGroup: evidence.dependencyGroup ?? evidence.domain,
    evidenceId: evidence.evidenceId ?? null,
    official: evidence.official === true
  };
}

function calculateClaimFreshnessScore(evidences, options = {}) {
  if (!Array.isArray(evidences)) throw new TypeError("evidences precisa ser uma lista.");
  const { claimType, validityDays, asOf = new Date() } = options;
  if (!Number.isInteger(validityDays) || validityDays <= 0) {
    if (validityDays !== null && validityDays !== undefined) {
      throw new TypeError("validityDays precisa ser um inteiro positivo.");
    }
  }
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) {
    throw new TypeError("asOf precisa ser uma data válida.");
  }

  if (validityDays === null || validityDays === undefined) {
    return {
      score: null,
      status: "UNVERIFIABLE",
      confidence: "INSUFFICIENT",
      algorithm_id: ALGORITHM_ID,
      algorithm_version: ALGORITHM_VERSION,
      policy_id: `${claimType ?? "unknown"}:NO_VALIDITY_POLICY`,
      as_of: asOf.toISOString(),
      evidence_summary: { received: evidences.length, eligible: 0, independent_domains: 0, excluded: evidences.length },
      drivers: [{ code: "UNKNOWN_CLAIM_TYPE" }],
      limitations: ["Não existe uma janela temporal definida para esta categoria de afirmação."]
    };
  }

  const eligible = evidences.map(item => freshnessForClaim(item, { claimType, validityDays, asOf })).filter(Boolean);
  const byDomain = new Map();
  for (const item of eligible) {
    const prior = byDomain.get(item.dependencyGroup);
    // One dependency cluster is one unit; copies across domains cannot inflate the score.
    if (!prior || item.score > prior.score) byDomain.set(item.dependencyGroup, item);
  }
  const groups = [...byDomain.values()];
  const excluded = evidences.length - eligible.length;

  if (!groups.length) {
    return {
      score: null,
      status: "UNVERIFIABLE",
      confidence: "INSUFFICIENT",
      algorithm_id: ALGORITHM_ID,
      algorithm_version: ALGORITHM_VERSION,
      policy_id: `${claimType}:${validityDays}d:v1`,
      as_of: asOf.toISOString(),
      evidence_summary: { received: evidences.length, eligible: 0, independent_domains: 0, excluded },
      drivers: [{ code: "NO_ATTRIBUTE_DATED_EVIDENCE" }],
      limitations: ["Não há evidência com data verificável ligada ao atributo desta afirmação."]
    };
  }

  const score = groups.reduce((sum, item) => sum + item.score, 0) / groups.length;
  const hasSupport = groups.some(item => item.posture === "SUPPORTS");
  const hasContradiction = groups.some(item => item.posture === "CONTRADICTS");
  const hasStale = groups.some(item => item.status === "STALE");
  const hasFresh = groups.some(item => item.status === "FRESH");
  const mixed = (hasSupport && hasContradiction) || (hasStale && hasFresh);
  const status = mixed ? "MIXED" : hasFresh ? "FRESH" : "STALE";

  const drivers = groups.map(item => ({
    code: item.status === "FRESH" ? "ATTRIBUTE_DATED_FRESH_EVIDENCE" : "ATTRIBUTE_DATED_STALE_EVIDENCE",
    evidence_id: item.evidenceId,
    date: item.selectedDate,
    age_days: item.ageDays,
    posture: item.posture,
    domain: item.domain,
    dependency_group: item.dependencyGroup
  }));
  if (mixed) drivers.push({ code: "MATERIAL_EVIDENCE_DISAGREEMENT" });
  if (excluded) drivers.push({ code: "EVIDENCE_EXCLUDED_FROM_TEMPORAL_SCORE", count: excluded });

  return {
    score: Math.round(score),
    status,
    confidence: groups.length >= 2 && !mixed && excluded === 0 ? "ADEQUATE" : "LIMITED",
    algorithm_id: ALGORITHM_ID,
    algorithm_version: ALGORITHM_VERSION,
    policy_id: `${claimType}:${validityDays}d:v1`,
    as_of: asOf.toISOString(),
    evidence_summary: {
      received: evidences.length,
      eligible: eligible.length,
      independent_domains: groups.length,
      fresh: groups.filter(item => item.status === "FRESH").length,
      stale: groups.filter(item => item.status === "STALE").length,
      excluded
    },
    drivers,
    limitations: [
      "Índice temporal determinístico; não é probabilidade de verdade.",
      "Datas de página sem vínculo explícito ao atributo foram excluídas."
    ]
  };
}

module.exports = { calculateClaimFreshnessScore, ALGORITHM_ID, ALGORITHM_VERSION };
