"use strict";
// Auditoria de página: a empresa cola o link da própria central de ajuda, FAQ
// ou página de preços, e o Entrelinhas confere os fatos dela contra fontes de
// hoje. A Tavily tem dois papéis: o Extract lê a página auditada e a busca
// confere cada fato no resto da web (sem contar a própria página como prova).
const { extrairConteudo } = require("./tavily");

const LIMITE_TEXTO_PAGINA = 6000;

// Só http(s), host público com ponto, sem usuário/senha, sem IP de rede local.
function validarUrlPublica(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto || texto.length > 500) return null;
  let u;
  try { u = new URL(texto); } catch { return null; }
  if (!["http:", "https:"].includes(u.protocol)) return null;
  if (u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) return null;
  u.hash = "";
  return u.toString();
}

// Tira do texto extraído o que não é conteúdo: links, imagens, menus repetidos.
function limparTextoPagina(markdown) {
  const linhas = String(markdown ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>|]+/g, " ")
    .split(/\n+/)
    .map(l => l.replace(/\s+/g, " ").trim())
    // Linhas muito curtas costumam ser itens de menu ("Home", "Login").
    .filter(l => l.length >= 25);
  const vistas = new Set();
  const unicas = linhas.filter(l => (vistas.has(l) ? false : (vistas.add(l), true)));
  return unicas.join("\n");
}

async function lerPaginaParaAuditoria(url, opcoes = {}) {
  const urlValida = validarUrlPublica(url);
  if (!urlValida) throw new Error("This link is not a public web page (use http or https).");
  const { resultados, erro, registro } = await extrairConteudo([urlValida], "page audit", opcoes);
  if (erro) throw new Error("Could not read this page. Check the link and try again.");
  const pagina = resultados[0];
  const texto = limparTextoPagina(pagina?.raw_content ?? pagina?.content ?? "");
  if (texto.length < 80) throw new Error("This page has too little text to check.");
  const cortado = texto.length > LIMITE_TEXTO_PAGINA;
  return {
    url: urlValida,
    titulo: pagina?.title ?? null,
    texto: cortado ? texto.slice(0, LIMITE_TEXTO_PAGINA) : texto,
    caracteres_lidos: Math.min(texto.length, LIMITE_TEXTO_PAGINA),
    cortado,
    registro
  };
}

module.exports = { validarUrlPublica, limparTextoPagina, lerPaginaParaAuditoria, LIMITE_TEXTO_PAGINA };
