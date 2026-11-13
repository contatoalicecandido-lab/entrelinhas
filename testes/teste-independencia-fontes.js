const assert = require("node:assert/strict");
const { clusterizarDependencias } = require("../src/independencia-fontes");

const texto = "A companhia anunciou nesta terça feira uma nova plataforma digital para pequenas empresas com pagamentos instantâneos, suporte integral durante todos os dias, ferramentas administrativas, relatórios financeiros detalhados e integração com parceiros comerciais em todo o país. O comunicado apresenta ainda depoimentos de clientes, disponibilidade em dispositivos móveis, opções de acessibilidade, suporte para diferentes idiomas e orientações sobre segurança, privacidade, transparência e atendimento ao consumidor. A organização também informou que a implantação ocorrerá gradualmente em capitais e municípios, com acompanhamento mensal de indicadores, treinamento das equipes responsáveis, atendimento por canais digitais e publicação de novas orientações conforme a expansão da iniciativa.";

function fonte(host, conteudo, extras = {}) {
  return { url: `https://${host}/artigo`, conteudo, ...extras };
}

const fontes = clusterizarDependencias([
  fonte("noticias-a.example", texto),
  fonte("noticias-b.example", texto),
  fonte("noticias-c.example", texto.replace("plataforma", "sistema")),
  fonte("outro.example", "Uma investigação científica diferente examinou dados climáticos independentes, métodos experimentais distintos e resultados publicados por pesquisadores universitários."),
  fonte("mesmo-dominio.example", "Uma reportagem com conteúdo totalmente diferente sobre outro tema sem semelhança lexical relevante."),
  fonte("mesmo-dominio.example", "Outro artigo inteiramente separado com novas palavras sobre assunto diferente.")
]);
assert.equal(fontes[0].grupo_dependencia_id, fontes[1].grupo_dependencia_id);
assert.equal(fontes[1].grupo_dependencia_id, fontes[2].grupo_dependencia_id);
assert.notEqual(fontes[0].grupo_dependencia_id, fontes[3].grupo_dependencia_id);
assert.equal(fontes[4].grupo_dependencia_id, fontes[5].grupo_dependencia_id, "mesmo domínio sempre representa uma unidade conservadora");
assert.equal(fontes[0].motivo_dependencia, "EXACT_CONTENT_HASH");
assert.ok(fontes[2].motivo_dependencia.startsWith("NEAR_DUPLICATE_JACCARD_") || fontes[2].motivo_dependencia === "EXACT_CONTENT_HASH");

const canonical = clusterizarDependencias([
  fonte("site-a.example", "Texto curto de uma oferta.", { sinais_data: [{ signal_type: "HTML_CANONICAL_URL", value_original: "https://origem.example/post/1" }] }),
  fonte("site-b.example", "Outro texto curto republicado.", { sinais_data: [{ signal_type: "HTML_CANONICAL_URL", value_original: "https://origem.example/post/1" }] })
]);
assert.equal(canonical[0].grupo_dependencia_id, canonical[1].grupo_dependencia_id);
assert.equal(canonical[0].motivo_dependencia, "SAME_CANONICAL_URL");

const boilerplate = clusterizarDependencias([
  fonte("boiler-a.example", "Leia mais no site oficial para receber novas atualizações."),
  fonte("boiler-b.example", "Leia mais no site oficial para receber novas atualizações.")
]);
assert.notEqual(boilerplate[0].grupo_dependencia_id, boilerplate[1].grupo_dependencia_id, "texto curto genérico não basta para colapsar domínios diferentes");
console.log("PASSOU: hash exato, near-duplicate, domínio, canonical URL e limites conservadores para textos curtos.");

// Banca adversarial (13 nov): subdomínios, cópias com menus diferentes, cópias curtas.
{
  const assert = require("node:assert/strict");
  const { clusterizarDependencias } = require("../src/independencia-fontes");
  const { classificarFonte } = require("../src/tipo-fonte");
  const { ehResultadoUtil } = require("../src/tavily");
  const grupo = lista => new Set(clusterizarDependencias(lista).map(e => e.grupo_dependencia_id)).size;

  assert.equal(grupo([{ url: "https://help.openai.com/a", conteudo: "x" }, { url: "https://openai.com/b", conteudo: "y" }]), 1, "subdomínios do mesmo dono = uma voz");
  assert.equal(grupo([{ url: "https://g1.globo.com/a", conteudo: "x" }, { url: "https://oglobo.globo.com/b", conteudo: "y" }]), 1);

  const materia = Array.from({ length: 150 }, (_, i) => `palavra${i % 37} termo${i}`).join(" ");
  const menu = n => Array.from({ length: 60 }, (_, i) => `menu${n}item${i}`).join(" ");
  const portais = [1, 2, 3, 4].map(n => ({ url: `https://portal${n}.com.br/noticia`, conteudo: `${menu(n)} ${materia} ${menu(n + 10)}` }));
  assert.equal(grupo(portais), 1, "mesma matéria com menus diferentes = uma voz");

  const curta = "O plano padrão da Netflix no Brasil passou a custar cinquenta e um reais e noventa centavos por mês a partir de outubro segundo a empresa que anunciou o reajuste para todos os assinantes do país hoje";
  const copias = [1, 2, 3, 4].map(n => ({ url: `https://site${n}.com/x`, conteudo: n === 4 ? curta.replace("empresa", "companhia") : curta }));
  assert.equal(grupo(copias), 1, "cópias curtas com uma palavra trocada = uma voz");

  const textoDiferente = n => Array.from({ length: 80 }, (_, i) => `assunto${n}w${i}`).join(" ");
  assert.equal(grupo([1, 2, 3].map(n => ({ url: `https://s${n}.com/x`, conteudo: textoDiferente(n) }))), 3, "textos diferentes continuam independentes");

  const tipo = (url, afirmacao) => classificarFonte(url, { afirmacao }).tipo;
  assert.notEqual(tipo("https://salariominimo.com.br/x", "O salário mínimo em 2026 é de R$ 1.621."), "OFICIAL");
  assert.notEqual(tipo("https://taxaselic.com.br/x", "A taxa Selic está em 15%."), "OFICIAL");
  assert.notEqual(tipo("https://chatgptplus.app/x", "ChatGPT Plus costs $20 per month."), "OFICIAL");
  assert.equal(tipo("https://community.openai.com/t/1", "ChatGPT Plus costs $20 per month."), "BLOG_FORUM");
  assert.equal(tipo("https://openai.com/chatgpt/pricing", "ChatGPT Plus costs $20 per month."), "OFICIAL");
  assert.equal(tipo("https://nodejs.org/en/about", "Node.js 20 is the current LTS."), "OFICIAL");
  assert.notEqual(classificarFonte("https://aiformortals.co/blog/x", { deBuscaDeNoticias: true }).tipo, "NOTICIA", "blog da busca de notícias não vira notícia");
  assert.equal(classificarFonte("https://exemplo.com.br/2026/10/15/netflix", { deBuscaDeNoticias: true }).tipo, "NOTICIA");
  assert.equal(ehResultadoUtil({ url: "https://duckduckgo.com/?q=chatgpt+plus", score: 0.9 }), false, "página de buscador não é fonte");
  console.log("PASSOU: subdomínios, cópias com menus e cópias curtas agrupados; sites de nome parecido e fóruns não viram oficiais; buscadores fora");
}
