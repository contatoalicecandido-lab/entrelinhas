// Prazo da checagem: chamadas externas usam só o tempo que resta e, quando o
// prazo acaba, nada novo é chamado. Assim o servidor nunca fica preso numa
// checagem que já passou do limite. Sem rede.
const assert = require("node:assert/strict");
const { executarComPrazo, tempoRestante, limiteDaChamada } = require("../src/prazo");

async function main() {
  assert.equal(tempoRestante(), Infinity, "fora de uma checagem não há prazo");
  assert.equal(limiteDaChamada(90000), 90000);

  await executarComPrazo(5000, async () => {
    assert.ok(limiteDaChamada(90000) <= 5000, "chamada não passa do prazo da checagem");
    assert.equal(limiteDaChamada(1000), 1000);
  });

  await executarComPrazo(30, async () => {
    await new Promise(r => setTimeout(r, 60));
    assert.throws(() => limiteDaChamada(90000), /Time limit/);
  });
  console.log("PASSOU: prazo limita cada chamada e corta as novas quando acaba");

  // Bifrost: com o prazo esgotado, nem chega a chamar a rede.
  process.env.BIFROST_KEY = process.env.BIFROST_KEY || "teste";
  const original = global.fetch;
  let chamadas = 0;
  global.fetch = async () => { chamadas += 1; throw new Error("não deveria chamar a rede"); };
  try {
    const { perguntarAoModelo } = require("../src/bifrost");
    await executarComPrazo(10, async () => {
      await new Promise(r => setTimeout(r, 30));
      await assert.rejects(() => perguntarAoModelo("pergunta", "instruções", { etapa: "TESTE" }), /Time limit/);
    });
    assert.equal(chamadas, 0);
  } finally {
    global.fetch = original;
  }
  console.log("PASSOU: com o prazo esgotado, o Bifrost não é chamado");
}

main().catch(e => { console.error("FALHOU:", e); process.exitCode = 1; });
