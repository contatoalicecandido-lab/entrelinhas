"use strict";
// Regras 1.7.0: fato histórico com data ("fundou a Nvidia em 1993") não
// envelhece; e cada afirmação precisa se entender sozinha (sem "ele").
const assert = require("node:assert/strict");
const { ehFatoHistorico } = require("../src/fato-historico");
const { avaliarRiscoDesatualizacao } = require("../src/risco-desatualizacao");
const { agregarEvidencias, VERSAO_REGRAS } = require("../src/agregador");
const { INSTRUCOES_DECOMPOSICAO } = require("../src/afirmacoes");
const { INSTRUCOES } = require("../src/resposta-corrigida");

const hoje = new Date("2026-11-14T12:00:00Z");
assert.equal(VERSAO_REGRAS, "1.7.0");

// O que é e o que não é fato histórico.
for (const t of ["He co-founded NVIDIA in 1993.", "A Nvidia foi fundada em 1993.", "Apple launched the iPhone in 2007.", "Node.js 20 was released in 2023.", "Lula foi eleito em 2022."]) {
  assert.equal(ehFatoHistorico(t, hoje), true, t);
}
for (const t of ["He has led the company ever since.", "Jensen Huang founded Nvidia in 1993 and is still CEO.", "Python 3.14 is the newest release, released in 2025.",
  "O salário mínimo de 2025 era R$ 1.518.", "Tim Cook is the CEO of Apple.", "The company launched a plan in 2027.", "Leo XIV is the current pope."]) {
  assert.equal(ehFatoHistorico(t, hoje), false, t);
}

// Triagem: fato histórico tem risco baixo, mesmo sendo "empresa" e citando um ano.
const risco = avaliarRiscoDesatualizacao({ texto: "He co-founded NVIDIA in 1993.", tipo: "empresa", dataReferencia: hoje });
assert.equal(risco.nivel, "LOW");
assert.equal(risco.sensivel_ao_tempo, false);
// O resto continua igual.
assert.equal(avaliarRiscoDesatualizacao({ texto: "Tim Cook is the CEO of Apple.", tipo: "empresa", dataReferencia: hoje }).nivel, "MEDIUM");

// Agregação: com as mesmas fontes reais de uma checagem gravada, uma frase
// histórica ("foi lançado em 2025") não recebe nota nem aviso de idade, e a
// frase sobre o presente continua com nota.
const gravacao = require("../gravacoes/2026-11-14T12-27-56-987Z-node-js-24-is-the-current-active-lts-release.json");
const a0 = gravacao.afirmacoes[0];
const agregar = texto => agregarEvidencias(
  { texto, tipo_afirmacao: a0.tipo_afirmacao, janela_validade: a0.janela_validade, evidencias: a0.evidencias },
  { dominiosOficiais: [], asOf: hoje }
);
const historico = agregar("Node.js 24 was released in 2025.");
assert.equal(historico.atualidade_afirmacao.reason, "HISTORICAL_FACT");
assert.equal(historico.atualidade_afirmacao.score, null);
const presente = agregar(a0.texto);
assert.notEqual(presente.atualidade_afirmacao.reason, "HISTORICAL_FACT");
assert.ok(Number.isFinite(presente.atualidade_afirmacao.score));

// Prompts: pronomes viram nomes; a correção não apaga o que não mudou.
assert.match(INSTRUCOES_DECOMPOSICAO, /se entender sozinha/);
assert.match(INSTRUCOES, /a founder is still a founder/);
console.log("ok regras 1.7.0: fato histórico não envelhece; afirmações sem pronome solto");
