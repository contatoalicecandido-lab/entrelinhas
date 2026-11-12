// Classifica o TIPO de uma fonte para medir diversidade e pesar a
// concordância entre fontes. Determinístico, por domínio e origem da busca.
// O tipo não é uma nota de autoridade: uma notícia pode estar errada e um
// blog pode estar certo. Serve para mostrar de onde vem a evidência e para
// evitar que muitas fontes fracas iguais pesem como fontes independentes fortes.

const NOTICIAS = [
  // internacionais
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com", "theguardian.com",
  "washingtonpost.com", "wsj.com", "ft.com", "bloomberg.com", "cnbc.com", "cnn.com",
  "economist.com", "forbes.com", "axios.com", "techcrunch.com", "theverge.com",
  "wired.com", "arstechnica.com", "zdnet.com", "engadget.com", "venturebeat.com",
  "theinformation.com", "businessinsider.com", "politico.com", "npr.org", "aljazeera.com",
  // brasileiras
  "g1.globo.com", "globo.com", "oglobo.globo.com", "valor.globo.com", "folha.uol.com.br",
  "uol.com.br", "estadao.com.br", "cnnbrasil.com.br", "exame.com", "infomoney.com.br",
  "agenciabrasil.ebc.com.br", "poder360.com.br", "metropoles.com", "terra.com.br",
  "veja.abril.com.br", "tecmundo.com.br", "olhardigital.com.br", "canaltech.com.br",
  "tecnoblog.net", "nexojornal.com.br", "bbc.com/portuguese", "jota.info", "conjur.com.br"
];

// Ciência: artigos revisados, bases acadêmicas e universidades.
const ACADEMICO = [
  "scholar.google.com", "arxiv.org", "nature.com", "science.org", "sciencedirect.com", "springer.com",
  "link.springer.com", "wiley.com", "onlinelibrary.wiley.com", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov",
  "nih.gov", "thelancet.com", "nejm.org", "bmj.com", "jamanetwork.com", "cell.com", "plos.org",
  "frontiersin.org", "mdpi.com", "acm.org", "dl.acm.org", "ieee.org", "ieeexplore.ieee.org",
  "semanticscholar.org", "researchgate.net", "ssrn.com", "jstor.org", "cochranelibrary.com",
  "scielo.org", "scielo.br", "periodicos.capes.gov.br", "fapesp.br", "revistapesquisa.fapesp.br", "fiocruz.br"
];
const SUFIXOS_ACADEMICOS = [/\.edu$/, /\.edu\.[a-z]{2}$/, /\.ac\.[a-z]{2}$/, /(^|\.)(usp|unicamp|ufsc|ufrj|ufmg|ufrgs|unb|unesp|ufpr|ufpe|ufba|ufc|puc-?rio|pucsp|fgv)\.br$/];

const REFERENCIA = [
  "wikipedia.org", "britannica.com", "developer.mozilla.org", "w3.org", "ietf.org",
  "rfc-editor.org", "iso.org", "who.int", "worldbank.org", "imf.org", "oecd.org",
  "ibge.gov.br", "endoflife.date", "snopes.com", "factcheck.org", "politifact.com",
  "lupa.uol.com.br", "aosfatos.org", "e-farsas.com", "boatos.org"
];

const BLOG_FORUM = [
  "medium.com", "dev.to", "substack.com", "blogspot.com", "wordpress.com", "hashnode.dev",
  "reddit.com", "quora.com", "stackoverflow.com", "stackexchange.com", "news.ycombinator.com",
  "linkedin.com", "facebook.com", "x.com", "twitter.com", "youtube.com", "tiktok.com",
  "instagram.com", "github.io", "tumblr.com", "brainly.com.br", "reclameaqui.com.br"
];

// Produtos cujo site oficial não tem o nome do produto no domínio.
const ENTIDADES = {
  chatgpt: ["openai.com"], openai: ["openai.com"], dalle: ["openai.com"], sora: ["openai.com"],
  gemini: ["google.com", "blog.google"], bard: ["google.com"], android: ["android.com", "google.com"],
  claude: ["anthropic.com", "claude.ai"], anthropic: ["anthropic.com"],
  copilot: ["microsoft.com", "github.com"], windows: ["microsoft.com"], azure: ["microsoft.com", "azure.com"],
  iphone: ["apple.com"], ipad: ["apple.com"], macos: ["apple.com"], ios: ["apple.com"],
  whatsapp: ["whatsapp.com", "meta.com"], instagram: ["instagram.com", "meta.com"], facebook: ["facebook.com", "meta.com"],
  llama: ["meta.com", "llama.com"], aws: ["amazon.com", "aws.amazon.com"], kindle: ["amazon.com"],
  pix: ["bcb.gov.br"], selic: ["bcb.gov.br"], lgpd: ["gov.br"], sus: ["gov.br"]
};

// Sufixos que não identificam a organização (para achar o "nome" do site).
const SUFIXOS = new Set(["com", "org", "net", "io", "dev", "co", "ai", "app", "br", "uk", "us", "eu", "pt", "gov", "edu", "info", "tech", "www", "docs", "help", "support", "developer", "developers", "blog", "news", "status", "platform", "api"]);

function nomeDoSite(h) {
  const partes = h.split(".").filter(p => !SUFIXOS.has(p));
  return partes.length ? partes[partes.length - 1] : null;
}

function compacto(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// O site oficial da entidade citada: nodejs.org para "Node.js", openai.com
// para "ChatGPT", nubank.com.br para "Nubank".
function ehSiteDaEntidade(h, afirmacao) {
  if (!afirmacao) return false;
  const texto = compacto(afirmacao);
  for (const [termo, dominios] of Object.entries(ENTIDADES)) {
    if (texto.includes(termo) && dominios.some(d => h === d || h.endsWith(`.${d}`))) return true;
  }
  const nome = nomeDoSite(h);
  return Boolean(nome && nome.length >= 4 && texto.includes(nome));
}

const ROTULOS = {
  OFICIAL: "Official",
  NOTICIA: "News",
  ACADEMICO: "Scientific",
  REFERENCIA: "Reference",
  BLOG_FORUM: "Blog / forum",
  OUTRO: "Other website"
};

function host(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function pertence(h, lista) {
  return lista.some(d => !d.includes("/") && (h === d || h.endsWith(`.${d}`)));
}

function pareceGoverno(h) {
  return /(^|\.)gov(\.[a-z]{2})?$/.test(h) || /\.gov\./.test(h) || /(^|\.)(jus|leg|mil)\.br$/.test(h) ||
    /(^|\.)europa\.eu$/.test(h) || /(^|\.)gob\.[a-z]{2}$/.test(h);
}

/**
 * @param {string} url
 * @param {{ dominiosOficiais?: string[], deBuscaDeNoticias?: boolean }} opcoes
 * @returns {{ tipo: string, rotulo: string, motivo: string }}
 */
function classificarFonte(url, opcoes = {}) {
  const h = host(url);
  if (!h) return { tipo: "OUTRO", rotulo: ROTULOS.OUTRO, motivo: "INVALID_URL" };
  const oficiais = (opcoes.dominiosOficiais ?? []).map(d => String(d).toLowerCase().replace(/^www\./, ""));
  if (oficiais.some(d => h === d || h.endsWith(`.${d}`))) {
    return { tipo: "OFICIAL", rotulo: ROTULOS.OFICIAL, motivo: "CONFIGURED_OFFICIAL_DOMAIN" };
  }
  if (pertence(h, ACADEMICO) || SUFIXOS_ACADEMICOS.some(re => re.test(h))) {
    return { tipo: "ACADEMICO", rotulo: ROTULOS.ACADEMICO, motivo: "ACADEMIC_SOURCE" };
  }
  if (pareceGoverno(h)) return { tipo: "OFICIAL", rotulo: ROTULOS.OFICIAL, motivo: "GOVERNMENT_DOMAIN" };
  if (!pertence(h, BLOG_FORUM) && !pertence(h, NOTICIAS) && ehSiteDaEntidade(h, opcoes.afirmacao)) {
    return { tipo: "OFICIAL", rotulo: ROTULOS.OFICIAL, motivo: "ENTITY_OWN_DOMAIN" };
  }
  if (pertence(h, BLOG_FORUM)) return { tipo: "BLOG_FORUM", rotulo: ROTULOS.BLOG_FORUM, motivo: "KNOWN_BLOG_OR_FORUM" };
  if (pertence(h, REFERENCIA)) return { tipo: "REFERENCIA", rotulo: ROTULOS.REFERENCIA, motivo: "KNOWN_REFERENCE" };
  if (pertence(h, NOTICIAS)) return { tipo: "NOTICIA", rotulo: ROTULOS.NOTICIA, motivo: "KNOWN_NEWS_OUTLET" };
  if (opcoes.deBuscaDeNoticias) return { tipo: "NOTICIA", rotulo: ROTULOS.NOTICIA, motivo: "FROM_NEWS_SEARCH" };
  if (/^(blog|community|forum|forums)\./.test(h)) return { tipo: "BLOG_FORUM", rotulo: ROTULOS.BLOG_FORUM, motivo: "BLOG_SUBDOMAIN" };
  return { tipo: "OUTRO", rotulo: ROTULOS.OUTRO, motivo: "UNCLASSIFIED" };
}

// Afirmações que pedem evidência científica (saúde, ciência, pesquisa).
const PISTAS_CIENCIA = /\b(estudos?|pesquisas?|cientistas?|cient[ií]fic[ao]s?|comprovad[ao]|study|studies|research|scientists?|scientific|proven|vacinas?|vaccines?|c[aâ]ncer|cancer|sa[uú]de|health|doen[cç]as?|disease|tratamento|treatment|rem[eé]dio|medicamento|drug|v[ií]rus|virus|clima|climate|aquecimento global|global warming|dieta|diet|nutri|sono|sleep|c[eé]rebro|brain|gen[eé]tic|evolu[cç][aã]o|evolution|efic[aá]cia|efficacy|causa|causes|risco|risk)\b/i;

function pedeEvidenciaCientifica(texto) {
  return PISTAS_CIENCIA.test(String(texto ?? ""));
}

module.exports = { classificarFonte, ehSiteDaEntidade, pedeEvidenciaCientifica, ROTULOS, ACADEMICO };
