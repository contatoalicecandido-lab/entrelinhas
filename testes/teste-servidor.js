// Testa a interface web (servidor.js) no modo exemplo.
// Porta aleatória em 127.0.0.1, sem chaves, sem rede externa, SQLite :memory:.
process.env.TAVILY_API_KEY = "";
process.env.BIFROST_KEY = "";
const assert = require("node:assert/strict");
const { criarServidor } = require("../servidor");
const { TEXTO_EXEMPLO } = require("../src/modo-exemplo");

async function main() {
  const servidor = criarServidor();
  await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const postar = (corpo, tipo = "application/json") => fetch(`${base}/api/verificar`, {
    method: "POST", headers: { "Content-Type": tipo }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo)
  });
  let casos = 0;
  const ok = nome => { casos += 1; console.log(`PASSOU: ${nome}`); };

  try {
    const pagina = await fetch(`${base}/`);
    assert.equal(pagina.status, 200);
    assert.match(pagina.headers.get("content-security-policy"), /script-src 'self'/);
    assert.match(await pagina.text(), /class="marca-nome">entre<em>linhas\.<\/em></);
    const fonte = await fetch(`${base}/fonts/Geist-Variable.woff2`);
    assert.equal(fonte.status, 200);
    assert.equal(fonte.headers.get("content-type"), "font/woff2");
    ok("página principal servida com Content-Security-Policy");

    const status = await (await fetch(`${base}/api/status`)).json();
    assert.equal(status.modo_real_disponivel, false);
    assert.equal(status.texto_exemplo, TEXTO_EXEMPLO);
    assert.ok(!JSON.stringify(status).match(/tvly-|sk-|KEY=/i));
    ok("status sem chaves: só modo exemplo, sem expor credenciais");

    const resposta = await postar({ texto: TEXTO_EXEMPLO, modo: "exemplo" });
    assert.equal(resposta.status, 200);
    const r = await resposta.json();
    assert.equal(r.simulado, true);
    assert.equal(r.total_afirmacoes, 3);
    const vereditos = r.afirmacoes.map(a => a.agregacao.veredito);
    assert.deepEqual(vereditos, ["ATUAL", "CONTRADITA_POR_FONTE_ATUAL", "CORROBORADA"]);
    assert.equal(r.afirmacoes[0].agregacao.freshness.score, 72);
    assert.equal(r.afirmacoes[2].agregacao.freshness.score, null);
    assert.equal(r.afirmacoes[2].agregacao.concordancia.coverage, "STRONG");
    assert.deepEqual(r.afirmacoes.map(a => a.origem_tipo_afirmacao), ["MODELO", "MODELO", "MODELO"]);
    ok("exemplo em inglês: atual (72), desatualizada por fonte oficial recente, corroborada por várias fontes");

    const pt = status.exemplos.find(e => e.id === "pt");
    const rpt = await (await postar({ texto: pt.texto, modo: "exemplo" })).json();
    assert.deepEqual(rpt.afirmacoes.map(a => a.agregacao.veredito), ["ATUAL", "CONTRADICAO_FRACA"]);
    assert.equal(rpt.afirmacoes[0].nuances.idioma, "pt");
    assert.ok(rpt.afirmacoes[0].nuances.notas.some(t => /lower bound/.test(t)));
    ok("exemplo em português: 'a partir de' compatível com preço maior; 'atualmente cerca de 5 mil' contradito");

    // Um pedido que nunca termina de chegar não pode travar o servidor.
    const net = require("node:net");
    const lento = net.connect(servidor.address().port, "127.0.0.1");
    await new Promise(r => lento.once("connect", r));
    lento.write(`POST /api/verificar HTTP/1.1\r\nHost: 127.0.0.1:${servidor.address().port}\r\nContent-Type: application/json\r\nContent-Length: 500\r\n\r\n{"texto":"`);
    await new Promise(r => setTimeout(r, 150));
    const enquantoLento = await postar({ texto: TEXTO_EXEMPLO, modo: "exemplo" });
    assert.equal(enquantoLento.status, 200, "o pedido lento não ocupa o servidor");
    lento.destroy();
    assert.equal(servidor.requestTimeout, 15000);
    assert.equal(servidor.headersTimeout, 15000);
    ok("pedido lento não trava as checagens; servidor corta pedidos parados em 15 s");

    for (const [nome, corpo, tipo, esperado] of [
      ["texto vazio", { texto: "  " }, undefined, 400],
      ["JSON inválido", "{oops", undefined, 400],
      ["sem Content-Type JSON", "x", "text/plain", 415],
      ["domínio malicioso", { texto: "a", dominiosOficiais: ["javascript:alert(1)"] }, undefined, 400],
      ["texto acima do limite", { texto: "a".repeat(4001) }, undefined, 400],
      ["corpo acima de 32 KB", { texto: "a".repeat(40000) }, undefined, 413],
      ["modo real sem chaves", { texto: "O plano custa R$ 10.", modo: "real" }, undefined, 400],
      ["outro texto no modo exemplo", { texto: "Outro texto qualquer.", modo: "exemplo" }, undefined, 400]
    ]) {
      const resp = await postar(corpo, tipo);
      assert.equal(resp.status, esperado, nome);
      assert.ok((await resp.json()).erro, nome);
      ok(`rejeita ${nome} (${esperado})`);
    }

    // Proteções contra outro site usar o servidor local (banca adversarial).
    const disfarcado = await postar({ texto: "x", modo: "exemplo" }, "text/plain; charset=application/json");
    assert.equal(disfarcado.status, 415, "text/plain disfarçado de JSON é recusado");
    const deFora = await fetch(`${base}/api/verificar`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: "{}" });
    assert.equal(deFora.status, 403, "POST vindo de outro site é recusado");
    const http = require("node:http");
    const hostFalso = await new Promise((resolve, reject) => {
      const r = http.request(`${base}/api/status`, { headers: { Host: "evil.example" } }, resp => { resp.resume(); resolve(resp.statusCode); });
      r.on("error", reject); r.end();
    });
    assert.equal(hostFalso, 421, "Host diferente de 127.0.0.1/localhost é recusado (DNS rebinding)");
    const navegacao = await fetch(`${base}/?text=oi`, { headers: { "Sec-Fetch-Site": "cross-site" } });
    assert.equal(navegacao.status, 200, "abrir a página vindo de outro site (botão de favoritos) continua funcionando");
    ok("recusa JSON disfarçado, POST de outro site e Host falso; botão de favoritos continua funcionando");

    const travessia = await fetch(`${base}/%2e%2e/.env`);
    assert.equal(travessia.status, 404);
    ok("não serve arquivos fora da lista permitida");
  } finally {
    servidor.close();
  }
  console.log(`Resultado: ${casos}/${casos} casos da interface web passaram. Sem rede externa e sem banco em disco.`);
}

main().catch(erro => { console.error("FALHOU:", erro); process.exitCode = 1; });
