"use strict";
// Regras 1.6.0: um sucessor nomeado (novo papa, nova versão LTS, novo CEO)
// contradiz a afirmação de que o anterior "é o atual". Antes o modelo marcava
// esses casos como insuficientes e eles terminavam sem decisão.
const assert = require("node:assert/strict");
const { INSTRUCOES_LOTE } = require("../src/analise-lote");
const { VERSAO_REGRAS } = require("../src/agregador");

assert.match(INSTRUCOES_LOTE, /SUCCESSOR OR REPLACEMENT/);
assert.match(INSTRUCOES_LOTE, /use CONTRADICTS, not INSUFFICIENT/);
// O limite da regra também precisa estar escrito, para não virar contradição demais.
assert.match(INSTRUCOES_LOTE, /stays INSUFFICIENT/);
assert.match(INSTRUCOES_LOTE, /does not contradict a claim about\s+support of an older one/);
assert.ok(["1.6.0", "1.7.0", "1.8.0", "1.9.0"].includes(VERSAO_REGRAS));
console.log("ok regras 1.6.0: sucessor nomeado contradiz");
// Regras 1.8.0: não deduzir status de datas (caso Node.js 24 "Active LTS").
assert.match(INSTRUCOES_LOTE, /NO INFERENCE/);
assert.match(INSTRUCOES_LOTE, /support until 2028" is INSUFFICIENT/);
console.log("ok regras 1.8.0: status precisa estar escrito na fonte");
