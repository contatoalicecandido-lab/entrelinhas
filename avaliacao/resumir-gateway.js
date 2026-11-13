// Conta o papel do Bifrost numa rodada de casos reais, a partir das gravações.
// Cada checagem ao vivo feita com ENTRELINHAS_GRAVAR=1 salva em gravacoes/ o
// resumo do gateway: chamadas ao modelo, quantas o modelo reserva respondeu e
// quantas voltaram com resposta inválida (refeitas pelo Entrelinhas).
// Uso: node avaliacao/resumir-gateway.js 2026-11-13T13
const fs = require("node:fs");
const path = require("node:path");

const prefixo = process.argv[2] ?? "2026-11-13T13";
const pasta = path.join(__dirname, "..", "gravacoes");
const arquivos = fs.readdirSync(pasta).filter(f => f.startsWith(prefixo) && f.endsWith(".json")).sort();

const linhas = arquivos.map(arquivo => {
  const g = JSON.parse(fs.readFileSync(path.join(pasta, arquivo), "utf8")).gateway ?? {};
  return {
    arquivo,
    chamadas: g.chamadas ?? 0,
    respostas_de_reserva: g.respostas_de_reserva ?? 0,
    respostas_invalidas_refeitas: g.falhas ?? 0,
    queda_simulada: Boolean(g.queda_simulada),
    respostas_por_modelo: g.respostas_por_modelo ?? []
  };
});
const soma = k => linhas.reduce((t, l) => t + l[k], 0);
const resumo = {
  rodada: prefixo,
  checagens: linhas.length,
  chamadas_ao_modelo: soma("chamadas"),
  respondidas_por_modelo_reserva: soma("respostas_de_reserva"),
  respostas_invalidas_refeitas: soma("respostas_invalidas_refeitas"),
  quedas_simuladas: linhas.filter(l => l.queda_simulada).length
};

if (require.main === module) {
  const destino = path.join(__dirname, `gateway-casos-reais-${prefixo.slice(0, 10)}.json`);
  fs.writeFileSync(destino, JSON.stringify({ resumo, linhas }, null, 2));
  console.log(resumo, `\nSalvo em ${destino}`);
}
module.exports = { resumo, linhas };
