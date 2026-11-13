// Linha de base: o que o modelo SOZINHO diz sobre os mesmos casos, sem busca,
// sem fontes e sem as regras do Entrelinhas. Serve para medir o ganho real do
// Entrelinhas sobre "só perguntar à IA".
// Requer o Bifrost rodando e BIFROST_KEY no .env (não usa a Tavily).
// Uso: node avaliacao/linha-de-base.js            (os 15 casos de 13 nov)
//      CASOS=avaliacao/casos-novos-2026-11-13.json node avaliacao/linha-de-base.js
require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const { perguntarAoModelo } = require("../src/bifrost");

const arquivo = process.env.CASOS ? path.resolve(process.env.CASOS) : path.join(__dirname, "casos-reais-2026-11.json");
const { casos } = JSON.parse(fs.readFileSync(arquivo, "utf8"));
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 8000);
const hoje = new Date().toISOString().slice(0, 10);

const INSTRUCOES = `Today is ${hoje}. You receive one claim taken from an AI answer.
Say whether it is still true today. Answer ONLY with JSON: {"answer": "TRUE" | "OUTDATED" | "UNSURE"}.`;

function pontuar(esperado, resposta) {
  const quer = esperado === "ATUAL" ? "TRUE" : "OUTDATED";
  if (resposta === quer) return "ACERTO";
  if (resposta === "UNSURE") return "SEM_DECISAO";
  return esperado === "DESATUALIZADA" ? "ERRO_GRAVE" : "ERRO";
}

async function principal() {
  const linhas = [];
  for (const caso of casos) {
    let resposta = null; let erro = null;
    try {
      const texto = await perguntarAoModelo(caso.texto, INSTRUCOES, { etapa: "LINHA_DE_BASE" });
      resposta = (/"answer"\s*:\s*"(TRUE|OUTDATED|UNSURE)"/i.exec(String(texto))?.[1] ?? "UNSURE").toUpperCase();
    } catch (e) {
      erro = e.message;
    }
    const linha = { id: caso.id, esperado: caso.esperado, resposta, resultado: erro ? "FALHA_EXECUCAO" : pontuar(caso.esperado, resposta), erro };
    linhas.push(linha);
    console.log(`${linha.resultado.padEnd(14)} ${caso.id.padEnd(24)} esperado ${caso.esperado.padEnd(13)} modelo ${resposta}`);
    if (caso !== casos.at(-1)) await new Promise(r => setTimeout(r, PAUSA_MS));
  }
  const validas = linhas.filter(l => l.resultado !== "FALHA_EXECUCAO");
  const conta = r => validas.filter(l => l.resultado === r).length;
  const resumo = {
    total: validas.length,
    acertos: conta("ACERTO"),
    sem_decisao: conta("SEM_DECISAO"),
    erros: conta("ERRO"),
    erros_graves_confirmou_desatualizada: conta("ERRO_GRAVE"),
    acuracia_estrita: validas.length ? +(conta("ACERTO") / validas.length).toFixed(3) : null
  };
  const nomeBase = process.env.CASOS ? path.basename(process.env.CASOS, ".json") : "casos-reais";
  const destino = path.join(__dirname, `linha-de-base-${nomeBase}-${hoje}.json`);
  fs.writeFileSync(destino, JSON.stringify({ executado_em: new Date().toISOString(), metodo: "modelo sozinho via Bifrost, sem busca", resumo, linhas }, null, 2));
  console.log("\n", resumo, `\nSalvo em ${destino}`);
}

if (require.main === module) principal().catch(e => { console.error(e); process.exit(1); });
module.exports = { pontuar };
