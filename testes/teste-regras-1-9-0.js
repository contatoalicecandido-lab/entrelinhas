"use strict";
// Regras 1.9.0: grandes redações contam como notícia, e organismos
// internacionais (.int, un.org) como fonte oficial. Antes caíam em "outro
// site" e uma afirmação verdadeira não chegava a "confirmada".
const assert = require("node:assert/strict");
const { classificarFonte } = require("../src/tipo-fonte");
const tipo = u => classificarFonte(u, {}).tipo;
assert.equal(tipo("https://www.cbsnews.com/news/x"), "NOTICIA");
assert.equal(tipo("https://finance.yahoo.com/news/x"), "NOTICIA");
assert.equal(tipo("https://economictimes.indiatimes.com/x"), "NOTICIA");
assert.equal(tipo("https://www.un.org/sg/en/about"), "OFICIAL");
assert.equal(tipo("https://www.nato.int/cps/en"), "OFICIAL");
// Imitações continuam fora.
assert.equal(tipo("https://un.org.noticias-hoje.com/x"), "OUTRO");
assert.equal(tipo("https://cbsnews.com.example.net/x"), "OUTRO");
assert.equal(tipo("https://meusite.int.br/x"), "OUTRO");
console.log("ok regras 1.9.0: redações e organismos internacionais");
