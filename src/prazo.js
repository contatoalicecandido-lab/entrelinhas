// Prazo de uma checagem inteira. Cada chamada externa (Tavily, Bifrost) usa
// só o tempo que ainda resta, então uma checagem nunca passa do limite do
// servidor: quando o tempo acaba, as chamadas em andamento são canceladas e o
// servidor fica livre para a próxima checagem.
const { AsyncLocalStorage } = require("node:async_hooks");

const contexto = new AsyncLocalStorage();

function executarComPrazo(ms, funcao) {
  return contexto.run({ prazo: Date.now() + ms }, funcao);
}

// Milissegundos que ainda restam (Infinity fora de uma checagem com prazo).
function tempoRestante() {
  const prazo = contexto.getStore()?.prazo;
  return Number.isFinite(prazo) ? prazo - Date.now() : Infinity;
}

function erroDePrazo() {
  return Object.assign(new Error("Time limit for this check reached; the remaining calls were cancelled."), { codigo: "PRAZO_ESGOTADO" });
}

// Tempo limite de uma chamada: o menor entre o dela e o que resta da checagem.
function limiteDaChamada(msDaChamada) {
  const resta = tempoRestante();
  if (resta <= 0) throw erroDePrazo();
  return Math.max(1, Math.min(msDaChamada, resta));
}

module.exports = { executarComPrazo, tempoRestante, limiteDaChamada, erroDePrazo };
