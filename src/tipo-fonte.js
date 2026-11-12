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

const REFERENCIA = [
  "wikipedia.org", "britannica.com", "developer.mozilla.org", "w3.org", "ietf.org",
  "rfc-editor.org", "iso.org", "who.int", "worldbank.org", "imf.org", "oecd.org",
  "ibge.gov.br", "scholar.google.com", "arxiv.org", "nature.com", "sciencedirect.com"
];

const BLOG_FORUM = [
  "medium.com", "dev.to", "substack.com", "blogspot.com", "wordpress.com", "hashnode.dev",
  "reddit.com", "quora.com", "stackoverflow.com", "stackexchange.com", "news.ycombinator.com",
  "linkedin.com", "facebook.com", "x.com", "twitter.com", "youtube.com", "tiktok.com",
  "instagram.com", "github.io", "tumblr.com", "brainly.com.br", "reclameaqui.com.br"
];

const ROTULOS = {
  OFICIAL: "Official",
  NOTICIA: "News",
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
  if (pareceGoverno(h)) return { tipo: "OFICIAL", rotulo: ROTULOS.OFICIAL, motivo: "GOVERNMENT_DOMAIN" };
  if (pertence(h, BLOG_FORUM)) return { tipo: "BLOG_FORUM", rotulo: ROTULOS.BLOG_FORUM, motivo: "KNOWN_BLOG_OR_FORUM" };
  if (pertence(h, REFERENCIA)) return { tipo: "REFERENCIA", rotulo: ROTULOS.REFERENCIA, motivo: "KNOWN_REFERENCE" };
  if (pertence(h, NOTICIAS)) return { tipo: "NOTICIA", rotulo: ROTULOS.NOTICIA, motivo: "KNOWN_NEWS_OUTLET" };
  if (opcoes.deBuscaDeNoticias) return { tipo: "NOTICIA", rotulo: ROTULOS.NOTICIA, motivo: "FROM_NEWS_SEARCH" };
  if (/^(blog|community|forum|forums)\./.test(h)) return { tipo: "BLOG_FORUM", rotulo: ROTULOS.BLOG_FORUM, motivo: "BLOG_SUBDOMAIN" };
  return { tipo: "OUTRO", rotulo: ROTULOS.OUTRO, motivo: "UNCLASSIFIED" };
}

module.exports = { classificarFonte, ROTULOS };
