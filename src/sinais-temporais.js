const https = require("node:https");
const { lookup } = require("node:dns/promises");
const { isIP } = require("node:net");

const MAX_HTML_BYTES = 1024 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 2;

function isPublicIPv4(value) {
  const parts = String(value ?? "").split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 88 && parts[2] === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && parts[2] === 100))) ||
    (a === 203 && b === 0 && parts[2] === 113));
}

function expandIPv6(value) {
  const address = String(value ?? "").toLowerCase().split("%")[0];
  if (isIP(address) !== 6) return null;
  const halves = address.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(":") : [];
  const zeros = 8 - left.length - right.length;
  if (zeros < 0 || (halves.length === 1 && zeros !== 0)) return null;
  return [...left, ...Array(zeros).fill("0"), ...right].map(part => Number.parseInt(part || "0", 16));
}

function isPublicIPv6(value) {
  const words = expandIPv6(value);
  if (!words || words.length !== 8) return false;
  const first = words[0];
  // IANA currently assigns global unicast from 2000::/3. Block registered
  // special-use subranges that are not ordinary globally reachable hosts.
  if (first < 0x2000 || first > 0x3fff) return false;
  if (first === 0x2001 && (words[1] <= 0x01ff || words[1] === 0x0db8)) return false; // IETF assignments and documentation
  if (first === 0x2002) return false; // 6to4 embeds IPv4 routing semantics
  if (first === 0x3fff && (words[1] & 0xf000) === 0) return false; // documentation
  return true;
}

function validarUrlFonte(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return { ok: false, motivo: "HTTPS_REQUIRED" };
    if (url.username || url.password) return { ok: false, motivo: "CREDENTIALS_NOT_ALLOWED" };
    if (url.port && url.port !== "443") return { ok: false, motivo: "NON_STANDARD_PORT" };
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
      return { ok: false, motivo: "LOCAL_HOST_NOT_ALLOWED" };
    }
    const unwrappedHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
    const family = isIP(unwrappedHost);
    if (family === 4 && !isPublicIPv4(unwrappedHost)) return { ok: false, motivo: "NON_PUBLIC_IP" };
    if (family === 6 && !isPublicIPv6(unwrappedHost)) return { ok: false, motivo: "NON_PUBLIC_IP" };
    return { ok: true, url };
  } catch { return { ok: false, motivo: "INVALID_URL" }; }
}

function normalizarData(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const date = new Date(`${raw}T00:00:00Z`);
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== raw ? null : raw;
  }
  const timestampDate = raw.match(/^(\d{4}-\d{2}-\d{2})[Tt ]/);
  if (timestampDate && !normalizarData(timestampDate[1])) return null;
  const numeric = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (numeric) {
    const [, day, month, year] = numeric;
    const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const d = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
  }
  const pt = raw.toLocaleLowerCase("pt-BR").match(/^(\d{1,2})\s+de\s+([\p{L}]+)\s+de\s+(\d{4})$/u);
  if (pt) {
    const months = { janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
      julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
    const month = months[pt[2]];
    if (!month) return null;
    return normalizarData(`${pt[1]}/${month}/${pt[3]}`);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) return null;
  // Preserve date-only strings and normalize timestamp/header formats to UTC date.
  return parsed.toISOString().slice(0, 10);
}

function parseAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function unescapeHtml(value) {
  return String(value).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function textoVisivel(html) {
  return unescapeHtml(String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

function walkJsonLd(value, callback) {
  if (Array.isArray(value)) { for (const item of value) walkJsonLd(item, callback); return; }
  if (!value || typeof value !== "object") return;
  callback(value);
  for (const child of Object.values(value)) walkJsonLd(child, callback);
}

function extrairDatasVisiveisDePagina(html) {
  const text = textoVisivel(html);
  const date = "(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{4}|\\d{1,2}\\s+de\\s+[\\p{L}]+\\s+de\\s+\\d{4}|[\\p{L}]{3,9}\\.?\\s+\\d{1,2},?\\s+\\d{4})";
  const pattern = new RegExp(`\\b(page\\s+last\\s+updated|last\\s+updated|updated|atualizado(?:\\s+em)?|published|publicado(?:\\s+em)?|modified|modificado(?:\\s+em)?)\\b\\s*:?\\s*(${date})`, "giu");
  const signals = [];
  for (const match of text.matchAll(pattern)) {
    const normalized = normalizarData(match[2]);
    signals.push({ signal_type: "VISIBLE_PAGE_DATE", field: match[1], value_original: match[2],
      value_normalized: normalized, scope: "PAGE", source: "VISIBLE_PAGE_LABEL",
      parse_status: normalized ? "PARSED" : "INVALID_DATE" });
  }
  return [...new Map(signals.map(signal => [`${signal.field.toLowerCase()}|${signal.value_original}`, signal])).values()];
}

function extrairDatasDeObservacao(html) {
  const text = textoVisivel(html);
  const date = "(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{4}|\\d{1,2}\\s+de\\s+[\\p{L}]+\\s+de\\s+\\d{4})";
  const pattern = new RegExp(`\\b(pre[cç]os?|valores?)\\s+(?:das?\\s+p[aá]ginas?\\s+oficiais\\s*,?\\s*)?(?:consultad[oa]s?|verificad[oa]s?|conferid[oa]s?|pesquisad[oa]s?)\\s+em\\s+(${date})`, "giu");
  const signals = [];
  for (const match of text.matchAll(pattern)) {
    const normalized = normalizarData(match[2]);
    signals.push({ signal_type: "PRICE_OBSERVATION_DATE", field: match[1], value_original: match[2],
      value_normalized: normalized, scope: "OBSERVATION", source: "VISIBLE_PRICE_OBSERVATION",
      match_basis: "date_declared_for_price_observation_not_price_change",
      parse_status: normalized ? "PARSED" : "INVALID_DATE" });
  }
  return signals;
}

function claimMatchesSentence(claim, context, claimType) {
  const normalize = value => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
  const c = normalize(claim), t = normalize(context);
  if (!c || !t) return false;
  const numbers = c.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const contextNumbers = t.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (numbers.length && !numbers.every(number => contextNumbers.includes(number))) return false;
  const tokens = c.split(/[^\p{L}\p{N}]+/u).filter(token => token.length >= 4);
  const entities = tokens.filter(token => !["para", "com", "por", "plano", "preco", "valor", "mensal", "custa", "sobre"].includes(token));
  const required = entities.length ? entities : tokens;
  return required.length > 0 && required.some(token => t.includes(token));
}

function extrairDatasDeAtributo(html, claim, claimType) {
  const text = textoVisivel(html);
  const date = "(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{4}|\\d{1,2}\\s+de\\s+[\\p{L}]+\\s+de\\s+\\d{4})";
  const subject = "(?:pre[cç]o|valor|tarifa|vers[aã]o(?:\\s+da\\s+api)?|regulamento|regra|pol[ií]tica)";
  const subjectAfterDate = "(?:pre[cç]o|valor|tarifa|vers[aã]o(?:\\s+da\\s+api)?|regulamento|regra|pol[ií]tica)";
  const verb = "(?:atualizad[oa]s?|revisad[oa]s?|alterad[oa]s?|publicad[oa]s?|lan[cç]ad[oa]s?)";
  const patterns = [
    new RegExp(`\\b${subject}\\b[^.!?\\n]{0,120}?\\b${verb}\\b\\s+(?:em|no dia|desde)\\s+(${date})`, "giu"),
    // Reverse ordering is intentionally narrower: a generic page heading
    // such as "Updated ... Plan" must not masquerade as an attribute date.
    new RegExp(`\\b${verb}\\b\\s+(?:em|no dia|desde)\\s+(${date})[^.!?\\n]{0,80}?\\b${subjectAfterDate}\\b`, "giu")
  ];
  const signals = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1];
      const normalized = normalizarData(raw);
      const start = Math.max(0, match.index - 120);
      const context = text.slice(start, Math.min(text.length, match.index + match[0].length + 120));
      const linked = claimMatchesSentence(claim, context, claimType);
      signals.push({
        signal_type: "EXPLICIT_ATTRIBUTE_UPDATE_DATE",
        field: "visible_text_date",
        value_original: raw,
        value_normalized: normalized,
        scope: linked && normalized ? "ATTRIBUTE" : "UNKNOWN",
        source: "VISIBLE_TEXT",
        match_basis: linked ? "claim_value_or_entity_in_local_context" : "attribute_cue_without_exact_claim_match",
        context: context.slice(0, 300),
        parse_status: normalized ? "PARSED" : "INVALID_DATE"
      });
    }
  }
  const unique = new Map();
  for (const signal of signals) unique.set(`${signal.value_normalized ?? signal.value_original}|${signal.scope}|${signal.source}`, signal);
  return [...unique.values()];
}

function extrairSinaisTemporais({ html = "", headers = {}, claim = "", claimType = null, pageUrl = null } = {}) {
  const sinais = [];
  const headerEntries = typeof Headers !== "undefined" && headers instanceof Headers ? [...headers.entries()] : Object.entries(headers ?? {});
  const headerMap = new Map(headerEntries.map(([key, value]) => [String(key).toLowerCase(), value]));

  const lastModified = headerMap.get("last-modified");
  if (lastModified) sinais.push({
    signal_type: "HTTP_LAST_MODIFIED", field: "Last-Modified", value_original: lastModified,
    value_normalized: normalizarData(lastModified), scope: "PAGE", source: "HTTP_HEADER"
  });

  const htmlSource = String(html ?? "").slice(0, MAX_HTML_BYTES);
  for (const tag of htmlSource.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    if (String(attrs.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") && attrs.href) {
      try {
        sinais.push({ signal_type: "HTML_CANONICAL_URL", field: "rel=canonical",
        value_original: new URL(attrs.href, pageUrl ?? undefined).toString(), scope: "PAGE", source: "HTML_LINK" });
      } catch {
        sinais.push({ signal_type: "HTML_CANONICAL_URL_INVALID", field: "rel=canonical",
          value_original: attrs.href, scope: "UNKNOWN", source: "HTML_LINK" });
      }
    }
  }
  for (const tag of htmlSource.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    const key = String(attrs.property ?? attrs.name ?? attrs.itemprop ?? "").toLowerCase();
    const value = attrs.content;
    if (!value) continue;
    const descriptors = {
      "article:published_time": ["ARTICLE_PUBLISHED_TIME", "PAGE"],
      "article:modified_time": ["ARTICLE_MODIFIED_TIME", "PAGE"],
      "article:expiration_time": ["ARTICLE_EXPIRATION_TIME", "PAGE"],
      "datepublished": ["SCHEMA_DATE_PUBLISHED", "DOCUMENT"],
      "datemodified": ["SCHEMA_DATE_MODIFIED", "DOCUMENT"],
      "datecreated": ["SCHEMA_DATE_CREATED", "DOCUMENT"],
      "pricevaliduntil": ["SCHEMA_PRICE_VALID_UNTIL", "OFFER"]
    };
    if (descriptors[key]) {
      const [signalType, scope] = descriptors[key];
      sinais.push({ signal_type: signalType, field: key, value_original: value,
        value_normalized: normalizarData(value), valid_through: key === "pricevaliduntil" ? normalizarData(value) : undefined,
        scope, source: "HTML_META" });
    }
  }

  for (const script of htmlSource.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script\s*>/gi) ?? []) {
    const body = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script\s*>$/i, "").trim();
    try {
      const json = JSON.parse(body);
      walkJsonLd(json, object => {
        const types = Array.isArray(object["@type"]) ? object["@type"] : [object["@type"]];
        const typeNames = types.filter(Boolean).map(x => String(x).split(/[\/#]/).pop().toLowerCase());
        for (const field of ["datePublished", "dateModified", "dateCreated"]) {
          if (typeof object[field] === "string") sinais.push({
            signal_type: `SCHEMA_${field.replace(/[A-Z]/g, c => `_${c}`).toUpperCase()}`,
            field, value_original: object[field], value_normalized: normalizarData(object[field]),
            scope: typeNames.includes("offer") ? "OFFER" : "DOCUMENT", source: "JSON_LD",
            schema_type: typeNames
          });
        }
        if (typeof object.priceValidUntil === "string") sinais.push({
          signal_type: "SCHEMA_PRICE_VALID_UNTIL", field: "priceValidUntil",
          value_original: object.priceValidUntil, value_normalized: normalizarData(object.priceValidUntil),
          valid_through: normalizarData(object.priceValidUntil), scope: "OFFER", source: "JSON_LD",
          schema_type: typeNames, offer_name: object.name ?? null, price: object.price ?? null,
          price_currency: object.priceCurrency ?? null
        });
      });
    } catch {
      sinais.push({ signal_type: "JSON_LD_PARSE_ERROR", field: "application/ld+json", scope: "UNKNOWN", source: "JSON_LD" });
    }
  }

  for (const timeTag of htmlSource.match(/<time\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(timeTag);
    if (attrs.datetime) sinais.push({ signal_type: "HTML_TIME_DATETIME", field: "datetime",
      value_original: attrs.datetime, value_normalized: normalizarData(attrs.datetime),
      scope: "PAGE", source: "HTML_TIME_ELEMENT" });
  }

  sinais.push(...extrairDatasVisiveisDePagina(htmlSource));
  sinais.push(...extrairDatasDeObservacao(htmlSource));
  sinais.push(...extrairDatasDeAtributo(htmlSource, claim, claimType));
  const unique = new Map();
  for (const signal of sinais) {
    const key = [signal.signal_type, signal.field, signal.value_original, signal.scope,
      signal.source, signal.offer_name ?? "", signal.price ?? "", signal.price_currency ?? ""].join("|");
    if (!unique.has(key)) unique.set(key, signal);
  }
  return [...unique.values()];
}

function requestPinnedHttps(url, address, family, options = {}) {
  return new Promise((resolve, reject) => {
    const pinnedLookup = (_hostname, lookupOptions, callback) => {
      if (lookupOptions?.all) callback(null, [{ address, family }]);
      else callback(null, address, family);
    };
    const request = https.request(url, {
      method: "GET", lookup: pinnedLookup,
      servername: isIP(url.hostname.replace(/^\[|\]$/g, "")) ? undefined : url.hostname,
      headers: { "User-Agent": "Entrelinhas/1.0 (+source-metadata; bounded read-only fetch)", "Accept": "text/html,application/xhtml+xml", "Accept-Encoding": "identity" }
    }, response => {
      const chunks = [];
      let size = 0;
      const length = Number(response.headers["content-length"]);
      if (Number.isFinite(length) && length > MAX_HTML_BYTES) {
        response.destroy(new Error("SOURCE_BODY_TOO_LARGE"));
        reject(new Error("SOURCE_BODY_TOO_LARGE"));
        return;
      }
      response.on("data", chunk => {
        size += chunk.length;
        if (size > MAX_HTML_BYTES) {
          response.destroy(new Error("SOURCE_BODY_TOO_LARGE"));
          request.destroy(new Error("SOURCE_BODY_TOO_LARGE"));
          reject(new Error("SOURCE_BODY_TOO_LARGE"));
        } else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers,
        body: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", reject);
    });
    request.setTimeout(options.timeoutMs ?? TIMEOUT_MS, () => request.destroy(new Error("SOURCE_TIMEOUT")));
    request.on("error", reject);
    request.end();
  });
}

async function obterMetadadosPagina(urlOriginal, options = {}) {
  let current = urlOriginal;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validation = validarUrlFonte(current);
    if (!validation.ok) return { status: "SKIPPED", reason: validation.motivo, signals: [] };
    const url = validation.url;
    const literalHost = url.hostname.replace(/^\[|\]$/g, "");
    const literalFamily = isIP(literalHost);
    let answers;
    try {
      answers = literalFamily
        ? [{ address: literalHost, family: literalFamily }]
        : options.resolver
          ? await options.resolver(url.hostname)
          : await lookup(url.hostname, { family: 0, all: true, verbatim: true });
    } catch (error) {
      return { status: "UNAVAILABLE", reason: "DNS_LOOKUP_FAILED", detail: error.code ?? error.message, signals: [] };
    }
    const candidates = Array.isArray(answers) ? answers : [answers];
    const publicAddress = candidates.find(item => item.family === 4
      ? isPublicIPv4(item.address)
      : item.family === 6 && isPublicIPv6(item.address));
    if (!publicAddress) return { status: "SKIPPED", reason: "NO_PUBLIC_ADDRESS", signals: [] };

    let response;
    try {
      response = options.request
        ? await options.request({ url, address: publicAddress.address, family: publicAddress.family,
          timeoutMs: options.timeoutMs ?? TIMEOUT_MS, maxBytes: MAX_HTML_BYTES })
        : await requestPinnedHttps(url, publicAddress.address, publicAddress.family, options);
    } catch (error) {
      return { status: "UNAVAILABLE", reason: error.message === "SOURCE_BODY_TOO_LARGE" ? "BODY_TOO_LARGE" : "FETCH_FAILED", detail: error.message, signals: [] };
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers?.location ?? response.headers?.Location;
      if (!location || hop === maxRedirects) return { status: "SKIPPED", reason: "REDIRECT_LIMIT", signals: [] };
      current = new URL(location, url).toString();
      continue;
    }
    if (response.status !== 200) return { status: "UNAVAILABLE", reason: `HTTP_${response.status}`, signals: [] };
    const headers = response.headers ?? {};
    const contentType = String(headers["content-type"] ?? headers["Content-Type"] ?? "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return { status: "SKIPPED", reason: "NOT_HTML", signals: [] };
    }
    const signals = extrairSinaisTemporais({ html: response.body ?? "", headers, claim: options.claim, claimType: options.claimType, pageUrl: url.toString() });
    return { status: "SUCCESS", final_url: url.toString(), captured_at: new Date().toISOString(), signals };
  }
  return { status: "SKIPPED", reason: "REDIRECT_LIMIT", signals: [] };
}

module.exports = {
  isPublicIPv4,
  isPublicIPv6,
  validarUrlFonte,
  normalizarData,
  extrairSinaisTemporais,
  obterMetadadosPagina,
  MAX_HTML_BYTES,
  TIMEOUT_MS
};
