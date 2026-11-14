// Sinalização ANTES da verificação (requisito 2 do desafio): quais afirmações
// podem ter ficado desatualizadas, e por quê. Regras determinísticas, sem IA:
//   - categoria temporal: preço e versão de software mudam rápido; empresa e
//     liderança, em meses; leis e regras oficiais, em cerca de um ano;
//   - marcas de tempo no texto: "atualmente", "ainda", "currently", "latest",
//     "até 2025", um ano explícito (que envelhece).
const { VALIDADE_MAX_DIAS } = require("./atualidade");
const { ehFatoHistorico } = require("./fato-historico");

const BASE = {
  preco: { nivel: "HIGH", motivo: "Prices change often" },
  versao_api: { nivel: "HIGH", motivo: "Software versions and support dates change often" },
  empresa: { nivel: "MEDIUM", motivo: "Company facts and leadership change within months" },
  regulamento: { nivel: "MEDIUM", motivo: "Laws and official rules change, usually yearly" }
};

const PRESENTE_EN = /\b(currently|still|now|today|latest|newest|current(ly)?|as of|at the moment|right now|this year|recent(ly)?)\b/i;
const NIVEIS = ["LOW", "MEDIUM", "HIGH"];
const subir = nivel => NIVEIS[Math.min(NIVEIS.length - 1, NIVEIS.indexOf(nivel) + 1)];

function avaliarRiscoDesatualizacao({ texto = "", tipo = null, janela = null, nuances = null, dataReferencia = new Date() } = {}) {
  const motivos = [];
  let nivel;
  if (ehFatoHistorico(texto, dataReferencia)) {
    return { nivel: "LOW", sensivel_ao_tempo: false, motivos: ["A past event with a date: it does not go out of date"] };
  }
  if (janela?.origem === "ENTITY") {
    // Valor oficial com janela própria. Muda rápido (Selic, inflação): risco
    // alto. Muda uma vez por ano (salário mínimo): risco médio.
    nivel = janela.dias <= 90 ? "HIGH" : "MEDIUM";
    motivos.push(`${janela.motivo[0].toUpperCase()}${janela.motivo.slice(1)} (checked against a ${janela.dias}-day window)`);
  } else if (tipo && BASE[tipo]) {
    nivel = BASE[tipo].nivel;
    motivos.push(`${BASE[tipo].motivo} (checked against a ${VALIDADE_MAX_DIAS[tipo]}-day window)`);
  } else {
    nivel = "LOW";
    motivos.push("Not a price, version, company or regulation fact");
  }

  const presentePt = (nuances?.expressoes_temporais ?? []).some(e => e.tipo === "PRESENTE");
  if (presentePt || PRESENTE_EN.test(texto)) {
    motivos.push("Claims to be true right now (\"currently\", \"still\", \"latest\"…)");
    if (nivel !== "HIGH") nivel = subir(nivel);
  }

  const anoAtual = dataReferencia.getUTCFullYear();
  const anos = [...String(texto).matchAll(/\b(19|20)\d{2}\b/g)].map(m => Number(m[0]));
  const anoPassado = anos.find(a => a < anoAtual);
  if (anoPassado) {
    motivos.push(`Mentions ${anoPassado}, which is in the past`);
    if (nivel !== "HIGH") nivel = subir(nivel);
  }

  if ((nuances?.mudancas ?? []).length > 0) {
    motivos.push("Describes a change (\"no longer\", \"came into force\"…)");
  }

  return { nivel, sensivel_ao_tempo: nivel !== "LOW", motivos };
}

module.exports = { avaliarRiscoDesatualizacao };
