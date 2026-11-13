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
// Padrão: os 15 casos de 13 nov. Com CASOS e RESULTADO, reavalia outro conjunto.
const arquivoCasos = process.env.CASOS ? path.resolve(process.env.CASOS) : path.join(__dirname, "casos-reais-2026-11.json");
const arquivoResultado = process.env.RESULTADO ? path.resolve(process.env.RESULTADO) : path.join(__dirname, "resultado-casos-reais-2026-11-13.json");
const { casos } = JSON.parse(fs.readFileSync(arquivoCasos, "utf8"));
const rodada = JSON.parse(fs.readFileSync(arquivoResultado, "utf8"));
const original = new Map(rodada.linhas.map(l => [l.id, l]));
// A gravação de cada caso é a mais recente com o mesmo texto feita ATÉ o fim
// daquela rodada: checagens feitas depois (por exemplo, para conferir uma
// correção) não entram no lugar das originais.
const fimDaRodada = Date.parse(rodada.executado_em) + 60000;
const horaDoArquivo = f => Date.parse(f.slice(0, 24).replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, "T$1:$2:$3.$4Z"));
const norm = t => String(t ?? "").replace(/\s+/g, " ").trim();
const gravacoes = fs.readdirSync(path.join(RAIZ, "gravacoes")).filter(f => /^\d{4}-.*\.json$/.test(f)).sort();
const porTexto = new Map();
for (const f of gravacoes) {
  const d = JSON.parse(fs.readFileSync(path.join(RAIZ, "gravacoes", f), "utf8"));
  if (Number.isFinite(fimDaRodada) && horaDoArquivo(f) > fimDaRodada) continue;
  if (d.afirmacoes?.[0]?.agregacao) porTexto.set(norm(d.texto_original), f);
}

const linhas = casos.map(caso => {
  const arquivo = porTexto.get(norm(caso.texto));
  if (!arquivo) throw new Error(`Sem gravação para ${caso.id}`);
  const dados = reavaliarGravacao(JSON.parse(fs.readFileSync(path.join(RAIZ, "gravacoes", arquivo), "utf8")));
  const a = dados.afirmacoes[0];
  return {
    id: caso.id,
    esperado: caso.esperado,
    veredito_na_rodada: original.get(caso.id)?.veredito ?? null,
    veredito_regras_atuais: a.agregacao.veredito,
    nota_atualidade: a.agregacao.atualidade_afirmacao?.score ?? null,
    resultado: pontuar(caso.esperado, a.agregacao.veredito),
    gravacao: `gravacoes/${arquivo}`
  };
});
const saida = {
  gerado_em: new Date().toISOString(),
  regras: VERSAO_REGRAS,
  metodo: "Same recorded evidence as the live run, re-scored with the current rules. No new searches or model calls.",
  resumo: resumir(linhas),
  linhas
};
const destino = process.env.SAIDA ? path.resolve(process.env.SAIDA) : path.join(__dirname, "reavaliacao-casos-reais-2026-11-13.json");
fs.writeFileSync(destino, JSON.stringify(saida, null, 2));
console.log(saida.resumo, `\nSalvo em ${destino}`);
