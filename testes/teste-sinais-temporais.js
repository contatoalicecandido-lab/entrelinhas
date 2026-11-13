const assert = require("node:assert/strict");
const {
  isPublicIPv4, isPublicIPv6, validarUrlFonte, normalizarData, extrairSinaisTemporais, obterMetadadosPagina
} = require("../src/sinais-temporais");

async function main() {
  assert.equal(normalizarData("2026-11-10T23:10:00-03:00"), "2026-11-11");
  assert.equal(normalizarData("10/11/2026"), "2026-11-10");
  assert.equal(normalizarData("10 de novembro de 2026"), "2026-11-10");
  assert.equal(normalizarData("31/02/2026"), null);
  assert.equal(normalizarData("2026-02-31T10:00:00Z"), null);
  assert.equal(isPublicIPv4("8.8.8.8"), true);
  for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.1.1", "192.168.1.1", "192.0.2.4", "198.51.100.3", "203.0.113.8", "224.0.0.1"]) {
    assert.equal(isPublicIPv4(ip), false, `${ip} deve ser bloqueado`);
  }
  assert.equal(isPublicIPv6("2001:4860:4860::8888"), true);
  for (const ip of ["::", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1", "2002::1", "3fff::1"]) {
    assert.equal(isPublicIPv6(ip), false, `${ip} deve ser bloqueado`);
  }
  assert.equal(validarUrlFonte("http://example.com").motivo, "HTTPS_REQUIRED");
  assert.equal(validarUrlFonte("https://localhost").motivo, "LOCAL_HOST_NOT_ALLOWED");
  assert.equal(validarUrlFonte("https://127.0.0.1").motivo, "NON_PUBLIC_IP");
  assert.equal(validarUrlFonte("https://[::1]").motivo, "NON_PUBLIC_IP");
  assert.equal(validarUrlFonte("https://example.com:8443").motivo, "NON_STANDARD_PORT");
  assert.equal(validarUrlFonte("https://example.com/path").ok, true);

  const html = `<!doctype html><html><head>
    <link rel="canonical" href="https://shop.example/plano-alpha">
    <meta property="article:modified_time" content="2026-11-10T10:00:00Z">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Offer","name":"Plano Alpha","price":"49.90","priceCurrency":"BRL","priceValidUntil":"2026-12-01","dateModified":"2026-11-09"}</script>
    </head><body><p>Plano Alpha custa R$ 49,90 por mês. Preço do Plano Alpha atualizado em 10/11/2026.</p></body></html>`;
  const signals = extrairSinaisTemporais({
    html,
    headers: { "last-modified": "Tue, 10 Nov 2026 10:00:00 GMT" },
    claim: "O Plano Alpha custa R$ 49,90 por mês.",
    claimType: "preco"
  });
  assert.ok(signals.some(signal => signal.signal_type === "HTTP_LAST_MODIFIED" && signal.scope === "PAGE"));
  assert.ok(signals.some(signal => signal.signal_type === "ARTICLE_MODIFIED_TIME" && signal.scope === "PAGE"));
  assert.ok(signals.some(signal => signal.signal_type === "SCHEMA_DATE_MODIFIED" && signal.scope === "OFFER"));
  assert.ok(signals.some(signal => signal.signal_type === "SCHEMA_PRICE_VALID_UNTIL" && signal.scope === "OFFER"));
  assert.ok(signals.some(signal => signal.signal_type === "HTML_CANONICAL_URL" && signal.value_original === "https://shop.example/plano-alpha"));
  assert.ok(signals.some(signal => signal.signal_type === "EXPLICIT_ATTRIBUTE_UPDATE_DATE" && signal.scope === "ATTRIBUTE" && signal.value_normalized === "2026-11-10"));

  const unrelated = extrairSinaisTemporais({
    html: "<p>Preço do Plano Beta atualizado em 10/11/2026.</p>",
    claim: "O Plano Alpha custa R$ 49,90 por mês.", claimType: "preco"
  });
  assert.ok(unrelated.some(signal => signal.signal_type === "EXPLICIT_ATTRIBUTE_UPDATE_DATE" && signal.scope === "UNKNOWN"));
  assert.ok(!unrelated.some(signal => signal.scope === "ATTRIBUTE"));

  const genericPageUpdate = extrairSinaisTemporais({
    html: "<h1>Contratação e troca de plano</h1><p>Atualizado em 01/10/2026 09:39</p><p>Como troco meu plano?</p>",
    claim: "Os preços dos planos variam de R$ 140 a R$ 200 por mês.", claimType: "preco"
  });
  assert.ok(genericPageUpdate.some(signal => signal.signal_type === "VISIBLE_PAGE_DATE" && signal.scope === "PAGE"));
  assert.ok(!genericPageUpdate.some(signal => signal.signal_type === "EXPLICIT_ATTRIBUTE_UPDATE_DATE"),
    "rótulo genérico de página não deve gerar um candidato artificial de data de atributo");

  const duplicateSchema = '<script type="application/ld+json">{"@type":"NewsArticle","dateModified":"2026-11-10"}</script>'.repeat(2);
  const dedupedSchema = extrairSinaisTemporais({ html: duplicateSchema });
  assert.equal(dedupedSchema.filter(signal => signal.signal_type === "SCHEMA_DATE_MODIFIED").length, 1);

  let requests = 0;
  const fetched = await obterMetadadosPagina("https://shop.example/plano-alpha", {
    resolver: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async ({ url, address, maxBytes }) => {
      requests++;
      assert.equal(url.hostname, "shop.example");
      assert.equal(address, "93.184.216.34");
      assert.ok(maxBytes <= 1024 * 1024);
      return { status: 200, headers: { "content-type": "text/html", "last-modified": "Tue, 10 Nov 2026 10:00:00 GMT" }, body: html };
    },
    claim: "O Plano Alpha custa R$ 49,90 por mês.", claimType: "preco"
  });
  assert.equal(fetched.status, "SUCCESS");
  assert.equal(requests, 1);

  requests = 0;
  const unsafeRedirect = await obterMetadadosPagina("https://shop.example/start", {
    resolver: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async () => { requests++; return { status: 302, headers: { location: "http://127.0.0.1/admin" } }; }
  });
  assert.equal(unsafeRedirect.status, "SKIPPED");
  assert.equal(unsafeRedirect.reason, "HTTPS_REQUIRED");
  assert.equal(requests, 1, "redirecionamento inseguro não pode receber uma segunda chamada");

  requests = 0;
  const privateDns = await obterMetadadosPagina("https://private.example/", {
    resolver: async () => [{ address: "10.0.0.4", family: 4 }, { address: "127.0.0.1", family: 4 }],
    request: async () => { requests++; throw new Error("não deve chamar request"); }
  });
  assert.equal(privateDns.reason, "NO_PUBLIC_ADDRESS");
  assert.equal(requests, 0);

  const ipv6 = await obterMetadadosPagina("https://ipv6.example/", {
    resolver: async () => [{ address: "fe80::1", family: 6 }, { address: "2001:4860:4860::8888", family: 6 }],
    request: async ({ address, family }) => {
      requests++;
      assert.equal(address, "2001:4860:4860::8888");
      assert.equal(family, 6);
      return { status: 200, headers: { "content-type": "text/html" }, body: "<p>Sem data informada.</p>" };
    }
  });
  assert.equal(ipv6.status, "SUCCESS");
  assert.equal(requests, 1);
  console.log("PASSOU: parsers, escopos, vínculo de atributo, limites HTTPS/DNS IPv4/IPv6 e redirecionamento revalidado. Rede totalmente simulada.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
