// Testa a interface web (servidor.js) no modo exemplo.
// Porta aleatória em 127.0.0.1, sem chaves, sem rede externa, SQLite :memory:.
process.env.TAVILY_API_KEY = "";
process.env.BIFROST_KEY = "";
const assert = require("node:assert/strict");
const { criarServidor } = require("./servidor");
const { TEXTO_EXEMPLO } = require("./src/modo-exemplo");

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
    assert.match(await pagina.text(), /class="marca-nome">entrelinhas</);
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

    const travessia = await fetch(`${base}/%2e%2e/.env`);
    assert.equal(travessia.status, 404);
    ok("não serve arquivos fora da lista permitida");
  } finally {
    servidor.close();
  }
  console.log(`Resultado: ${casos}/${casos} casos da interface web passaram. Sem rede externa e sem banco em disco.`);
}

main().catch(erro => { console.error("FALHOU:", erro); process.exitCode = 1; });
