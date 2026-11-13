// O classificador recebe a data de referência e tem a regra de prazos vencidos.
// Bifrost simulado; sem rede e sem banco.
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const arquivo = path.join(path.join(__dirname, ".."), "src", "classificador.js");
let perguntaRecebida = null;
let instrucoesRecebidas = null;
const original = Module._load;
Module._load = function (req, parent, isMain) {
  if (parent?.filename === arquivo && req === "./bifrost") {
    return {
      async perguntarAoModelo(pergunta, instrucoes) {
        perguntaRecebida = JSON.parse(pergunta);
        instrucoesRecebidas = instrucoes;
        return JSON.stringify({ postura: "CONTRADICTS", justificativa: "Prazo da evidência já passou." });
      }
    };
  }
  return original.call(this, req, parent, isMain);
};
const { classificarEvidencia } = require(arquivo);
Module._load = original;

(async () => {
  const r = await classificarEvidencia(
    "Node.js 20 is the current Active LTS release.",
    "The 20.x line remains Active LTS until October 2024, then Maintenance until end of life in April 2026.",
    { dataReferencia: new Date("2026-11-12T12:00:00Z") }
  );
  assert.equal(perguntaRecebida.data_referencia, "2026-11-12");
  assert.match(instrucoesRecebidas, /data_referencia/);
  assert.match(instrucoesRecebidas, /anterior à data de referência/);
  assert.equal(r.postura, "CONTRADICTS");
  console.log("PASSOU: a data de referência chega ao modelo junto com a regra de prazos vencidos.");

  await classificarEvidencia("A afirmação.", "A evidência.", {});
  assert.match(perguntaRecebida.data_referencia, /^\d{4}-\d{2}-\d{2}$/);
  console.log("PASSOU: sem data informada, usa a data de hoje.");
  console.log("Resultado: 2/2. Sem rede e sem banco.");
})().catch(erro => { console.error("FALHOU:", erro); process.exitCode = 1; });
