// Modo público (para hospedar na nuvem): aceita o próprio endereço público,
// recusa outros hosts e outros sites, e limita as checagens reais por pessoa
// e por dia. Sem rede: porta aleatória em 127.0.0.1.
process.env.ENTRELINHAS_PUBLICO = "1";
process.env.ENTRELINHAS_HOST_PUBLICO = "entrelinhas.example.com";
process.env.ENTRELINHAS_LIMITE_IP_DIA = "2";
process.env.ENTRELINHAS_LIMITE_DIA = "3";
process.env.TAVILY_API_KEY = "";
process.env.BIFROST_KEY = "";
const assert = require("node:assert/strict");
const http = require("node:http");
const { criarServidor, reservarCota, devolverCota, situacaoCota } = require("../servidor");

function pedir(porta, { host, metodo = "GET", caminho = "/api/status", corpo, cabecalhos = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: porta, method: metodo, path: caminho, headers: { Host: host, ...cabecalhos } }, res => {
      let dados = ""; res.on("data", c => { dados += c; }); res.on("end", () => resolve({ status: res.statusCode, corpo: dados }));
    });
    req.on("error", reject);
    if (corpo) req.write(corpo);
    req.end();
  });
}

async function main() {
  const servidor = criarServidor();
  await new Promise(r => servidor.listen(0, "127.0.0.1", r));
  const porta = servidor.address().port;
  try {
    const ok = await pedir(porta, { host: "entrelinhas.example.com" });
    assert.equal(ok.status, 200);
    const status = JSON.parse(ok.corpo);
    assert.equal(status.publico, true);
    assert.equal(status.cota.por_pessoa, 2);
    assert.equal(status.limites.afirmacoes, 3, "no modo público, até 3 afirmações por checagem");
    assert.equal((await pedir(porta, { host: "outro-site.com" })).status, 421, "host desconhecido é recusado");
    const outroSite = await pedir(porta, { host: "entrelinhas.example.com", metodo: "POST", caminho: "/api/verificar",
      corpo: "{}", cabecalhos: { "Content-Type": "application/json", Origin: "https://site-malicioso.com" } });
    assert.equal(outroSite.status, 403, "POST vindo de outro site é recusado");
    console.log("PASSOU: modo público aceita só o próprio endereço e recusa outros sites");

    // Cota: 2 por pessoa, 3 no total por dia; falha do provedor devolve a cota.
    const pessoa = ip => ({ headers: { "x-forwarded-for": `${ip}, 10.0.0.1` }, socket: {} });
    assert.equal(reservarCota(pessoa("1.1.1.1")), null);
    assert.equal(reservarCota(pessoa("1.1.1.1")), null);
    assert.match(reservarCota(pessoa("1.1.1.1")), /used your 2 live checks/);
    devolverCota(pessoa("1.1.1.1"));
    assert.equal(situacaoCota(pessoa("1.1.1.1")).restantes_hoje_para_voce, 1, "falha devolve a checagem");
    assert.equal(reservarCota(pessoa("2.2.2.2")), null);
    assert.equal(reservarCota(pessoa("1.1.1.1")), null);
    assert.match(reservarCota(pessoa("3.3.3.3")), /today's limit/, "limite total do dia");
    console.log("PASSOU: cota por pessoa e por dia; falha do provedor não gasta a cota");
  } finally {
    servidor.close();
  }
}
main().catch(e => { console.error("FALHOU:", e); process.exitCode = 1; });
