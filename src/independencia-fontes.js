const { createHash } = require("node:crypto");

const SHINGLE_SIZE = 5;
const MIN_NEAR_DUPLICATE_TOKENS = 40;
const MIN_EXACT_DUPLICATE_TOKENS = 10;
const NEAR_DUPLICATE_THRESHOLD = 0.88;

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim().replace(/\s+/g, " ");
}

function fingerprint(value) {
  return createHash("sha256").update(normalizeText(value), "utf8").digest("hex");
}

function tokenize(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

function makeShingles(tokens, size = SHINGLE_SIZE) {
  const shingles = new Set();
  if (tokens.length < size) return shingles;
  for (let i = 0; i <= tokens.length - size; i++) shingles.add(tokens.slice(i, i + size).join(" "));
  return shingles;
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection++;
  return intersection / (left.size + right.size - intersection);
}

function normalizeDomain(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, ""); }
  catch { return null; }
}

function getCanonicalUrl(evidence) {
  if (evidence?.canonical_url) {
    try { return new URL(evidence.canonical_url).toString(); } catch { /* fall through to signals */ }
  }
  const signals = evidence?.sinais_data ?? evidence?.metadados_provedor?.sinais_data ?? [];
  const canonical = signals.find(signal => signal.signal_type === "HTML_CANONICAL_URL" && signal.value_original)?.value_original;
  try { return canonical ? new URL(canonical).toString() : null; } catch { return null; }
}

function clusterizarDependencias(evidencias) {
  if (!Array.isArray(evidencias)) throw new TypeError("evidencias precisa ser uma lista.");
  const parent = evidencias.map((_, index) => index);
  const reason = new Map();
  const find = index => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const union = (left, right, why) => {
    const a = find(left), b = find(right);
    if (a !== b) parent[b] = a;
    reason.set(`${Math.min(left, right)}:${Math.max(left, right)}`, why);
  };

  const facts = evidencias.map(evidence => {
    const content = evidence.conteudo ?? evidence.fonte?.conteudo ?? "";
    const normalized = normalizeText(content);
    const tokens = tokenize(content);
    return {
      domain: normalizeDomain(evidence.url ?? evidence.fonte?.url),
      canonical: getCanonicalUrl(evidence),
      normalized,
      tokenCount: tokens.length,
      hash: normalized ? fingerprint(normalized) : null,
      shingles: makeShingles(tokens)
    };
  });

  for (let i = 0; i < facts.length; i++) {
    for (let j = i + 1; j < facts.length; j++) {
      const a = facts[i], b = facts[j];
      if (a.domain && a.domain === b.domain) { union(i, j, "SAME_DOMAIN"); continue; }
      if (a.canonical && b.canonical && a.canonical === b.canonical) { union(i, j, "SAME_CANONICAL_URL"); continue; }
      if (!a.normalized || !b.normalized) continue;
      if (a.hash === b.hash && a.tokenCount >= MIN_EXACT_DUPLICATE_TOKENS) { union(i, j, "EXACT_CONTENT_HASH"); continue; }
      if (Math.min(a.tokenCount, b.tokenCount) < MIN_NEAR_DUPLICATE_TOKENS) continue;
      const similarity = jaccard(a.shingles, b.shingles);
      if (similarity >= NEAR_DUPLICATE_THRESHOLD) union(i, j, `NEAR_DUPLICATE_JACCARD_${similarity.toFixed(3)}`);
    }
  }

  const roots = [...new Set(evidencias.map((_, index) => find(index)))].sort((a, b) => a - b);
  const ids = new Map(roots.map((root, index) => [root, `source_cluster_${String(index + 1).padStart(3, "0")}`]));
  return evidencias.map((evidence, index) => {
    const root = find(index);
    const linkedReasons = [...reason.entries()]
      .filter(([pair]) => pair.split(":").some(value => Number(value) === index))
      .map(([, value]) => value);
    return {
      ...evidence,
      grupo_dependencia_id: ids.get(root),
      dependencia_detectada: linkedReasons.length > 0,
      motivo_dependencia: linkedReasons[0] ?? "NO_DUPLICATE_SIGNAL_DETECTED_IN_SMALL_RESULT_SET"
    };
  });
}

module.exports = {
  normalizeText,
  fingerprint,
  makeShingles,
  jaccard,
  clusterizarDependencias,
  NEAR_DUPLICATE_THRESHOLD,
  MIN_NEAR_DUPLICATE_TOKENS
};
