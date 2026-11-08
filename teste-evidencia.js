
const test = require("node:test");
const assert = require("node:assert/strict");

const { validarEvidencia } = require("./src/evidencia");

function criarEvidenciaValida() {
  return {
    url: "https://nodejs.org/en/about/previous-releases",
    titulo: "Node.js Releases",
    conteudo: "Informações oficiais sobre as versões do Node.js.",
    tipo_fonte: "tavily_extract",
    coletado_em: "2026-11-02T15:00:00.000Z",
    relevancia: 0.95,
    data_publicacao: null,
    data_atualizacao: null
  };
}

test("aceita uma evidência válida", () => {
  const resultado = validarEvidencia(criarEvidenciaValida());

  assert.equal(resultado.valida, true);
  assert.deepEqual(resultado.erros, []);
});

test("aceita evidência sem data de publicação", () => {
  const evidencia = criarEvidenciaValida();

  const resultado = validarEvidencia(evidencia);

  assert.equal(resultado.valida, true);
});

test("rejeita evidência sem URL", () => {
  const evidencia = criarEvidenciaValida();
  evidencia.url = "";

  const resultado = validarEvidencia(evidencia);

  assert.equal(resultado.valida, false);
  assert.ok(resultado.erros.includes("URL ausente ou inválida."));
});

test("rejeita URL com protocolo não permitido", () => {
  const evidencia = criarEvidenciaValida();
  evidencia.url = "file:///documento";

  const resultado = validarEvidencia(evidencia);

  assert.equal(resultado.valida, false);
  assert.ok(resultado.erros.includes("A URL precisa usar HTTP ou HTTPS."));
});

test("rejeita tipo de fonte desconhecido", () => {
  const evidencia = criarEvidenciaValida();
  evidencia.tipo_fonte = "fonte_desconhecida";

  const resultado = validarEvidencia(evidencia);

  assert.equal(resultado.valida, false);
  assert.ok(resultado.erros.includes("Tipo de fonte desconhecido."));
});

test("rejeita data de coleta inválida", () => {
  const evidencia = criarEvidenciaValida();
  evidencia.coletado_em = "data-invalida";

  const resultado = validarEvidencia(evidencia);

  assert.equal(resultado.valida, false);
  assert.ok(resultado.erros.includes("Data de coleta ausente ou inválida."));
});

test("rejeita relevância fora do intervalo permitido", () => {
  const evidencia = criarEvidenciaValida();
  evidencia.relevancia = 1.5;

  const resultado = validarEvidencia(evidencia);

  assert.equal(resultado.valida, false);
  assert.ok(resultado.erros.includes("Relevância precisa ser um número entre 0 e 1."));
});

test("rejeita conteúdo vazio", () => {
  const evidencia = criarEvidenciaValida();
  evidencia.conteudo = "   ";

  const resultado = validarEvidencia(evidencia);

  assert.equal(resultado.valida, false);
  assert.ok(resultado.erros.includes("Conteúdo ausente ou inválido."));
});

test("rejeita entrada que não seja um objeto", () => {
  const resultado = validarEvidencia(null);

  assert.equal(resultado.valida, false);
});


const { validarDataISO } = require("./src/evidencia");

test("aceita data ISO com fuso horário UTC", () => {
  assert.equal(validarDataISO("2026-11-02T15:00:00.000Z"), true);
});

test("aceita data ISO com fuso horário explícito", () => {
  assert.equal(validarDataISO("2026-11-02T12:00:00-03:00"), true);
});

test("rejeita data inexistente", () => {
  assert.equal(validarDataISO("2026-02-30T12:00:00Z"), false);
});

test("rejeita horário inválido", () => {
  assert.equal(validarDataISO("2026-11-02T25:00:00Z"), false);
});

test("rejeita data sem fuso horário", () => {
  assert.equal(validarDataISO("2026-11-02T15:00:00"), false);
});

test("rejeita texto que não representa uma data", () => {
  assert.equal(validarDataISO("ontem"), false);
});
