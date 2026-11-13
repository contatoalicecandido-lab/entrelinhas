// Domínio registrável ("a organização por trás do site"): help.openai.com e
// openai.com são o mesmo dono; g1.globo.com e oglobo.globo.com também. Usado
// para que subdomínios não contem como fontes independentes.
// Sem lista pública completa de sufixos (Public Suffix List): cobre os
// sufixos de dois níveis mais comuns nas buscas do Entrelinhas.
const SUFIXOS_DOIS_NIVEIS = new Set([
  "com.br", "gov.br", "org.br", "net.br", "edu.br", "jus.br", "leg.br", "mp.br", "mil.br", "art.br", "blog.br", "ind.br", "inf.br",
  "co.uk", "org.uk", "gov.uk", "ac.uk", "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
  "com.au", "net.au", "org.au", "gov.au", "edu.au", "com.mx", "gob.mx", "com.ar", "gob.ar",
  "co.in", "gov.in", "ac.in", "co.nz", "govt.nz", "com.pt", "gov.pt", "co.za", "gov.za", "com.cn", "gov.cn"
]);

// Hospedagens em que cada subdomínio é de um autor diferente.
const MULTIAUTOR = new Set(["github.io", "blogspot.com", "wordpress.com", "substack.com", "medium.com", "tumblr.com", "hashnode.dev", "vercel.app", "netlify.app", "pages.dev"]);

function hostDe(url) {
  try {
    const entrada = String(url).includes("://") ? String(url) : `https://${url}`;
    return new URL(entrada).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}

function dominioRegistravel(urlOuHost) {
  const host = hostDe(urlOuHost);
  if (!host) return null;
  if (/^\d+(\.\d+){3}$/.test(host) || !host.includes(".")) return host;
  const partes = host.split(".");
  const doisUltimos = partes.slice(-2).join(".");
  if (MULTIAUTOR.has(doisUltimos)) return partes.length > 2 ? partes.slice(-3).join(".") : doisUltimos;
  if (SUFIXOS_DOIS_NIVEIS.has(doisUltimos)) return partes.slice(-3).join(".");
  return doisUltimos;
}

// Páginas de resultado de buscadores não são fontes.
function ehPaginaDeBuscador(url) {
  const host = hostDe(url);
  if (!host) return false;
  if (/(^|\.)duckduckgo\.com$|(^|\.)search\.yahoo\.com$|(^|\.)yandex\.\w+$|(^|\.)search\.brave\.com$|(^|\.)startpage\.com$|(^|\.)ecosia\.org$/.test(host)) return true;
  try {
    const caminho = new URL(String(url)).pathname;
    return /(^|\.)(google|bing)\.\w+(\.\w+)?$/.test(host) && /^\/search\b/.test(caminho);
  } catch {
    return false;
  }
}

module.exports = { dominioRegistravel, hostDe, ehPaginaDeBuscador };
