const assert = require("node:assert/strict");
const { clusterizarDependencias } = require("./src/independencia-fontes");

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
