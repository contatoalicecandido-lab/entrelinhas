// Reaplica as REGRAS ATUAIS às 15 checagens gravadas na rodada de 13 nov,
// sem nenhuma chamada nova (mesmas fontes, mesma leitura do modelo).
// Mostra quanto as regras mudaram o resultado desde a rodada ao vivo.
// Uso: node avaliacao/reavaliar-benchmark.js
const fs = require("node:fs");
const path = require("node:path");
const { reavaliarGravacao } = require("../scripts/reavaliar-gravacao");
const { pontuar, resumir } = require("./rodar-casos-reais");
const { VERSAO_REGRAS } = require("../src/agregador");

const RAIZ = path.join(__dirname, "..");
const { casos } = JSON.parse(fs.readFileSync(path.join(__dirname, "casos-reais-2026-11.json"), "utf8"));
const original = JSON.parse(fs.readFileSync(path.join(__dirname, "resultado-casos-reais-2026-11-13.json"), "utf8")).linhas;
const arquivos = fs.readdirSync(path.join(RAIZ, "gravacoes")).filter(f => f.startsWith("2026-11-13T13-") && f.endsWith(".json")).sort();
if (arquivos.length !== casos.length) throw new Error(`Esperava ${casos.length} gravações, achei ${arquivos.length}.`);

const linhas = casos.map((caso, i) => {
  const dados = reavaliarGravacao(JSON.parse(fs.readFileSync(path.join(RAIZ, "gravacoes", arquivos[i]), "utf8")));
  const a = dados.afirmacoes[0];
  if (original[i].id !== caso.id) throw new Error(`Ordem diferente: ${original[i].id} x ${caso.id}`);
  return {
    id: caso.id,
    esperado: caso.esperado,
    veredito_na_rodada: original[i].veredito,
    veredito_regras_atuais: a.agregacao.veredito,
    nota_atualidade: a.agregacao.atualidade_afirmacao?.score ?? null,
    resultado: pontuar(caso.esperado, a.agregacao.veredito),
    gravacao: `gravacoes/${arquivos[i]}`
  };
});
const saida = {
  gerado_em: new Date().toISOString(),
  regras: VERSAO_REGRAS,
  metodo: "Same recorded evidence as the 13 Nov live run, re-scored with the current rules. No new searches or model calls.",
  resumo: resumir(linhas),
  linhas
};
const destino = path.join(__dirname, "reavaliacao-casos-reais-2026-11-13.json");
fs.writeFileSync(destino, JSON.stringify(saida, null, 2));
console.log(saida.resumo, `\nSalvo em ${destino}`);
