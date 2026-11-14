// Mede o acerto do Entrelinhas em casos reais com resposta conhecida.
// Requer o servidor em modo real: `PORT=3001 npm run web` (Tavily + Bifrost).
// Uso: node avaliacao/rodar-casos-reais.js [http://127.0.0.1:3001]
// Gasta créditos da Tavily e tokens do modelo. Não abre o banco original.
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.argv[2] ?? "http://127.0.0.1:3001";
// Pausa entre casos: o plano gratuito do Groq limita tokens por minuto.
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 45000);
// Outro arquivo de casos pode ser passado em CASOS=avaliacao/casos-novos.json
const arquivo = process.env.CASOS ? path.resolve(process.env.CASOS) : path.join(__dirname, "casos-reais-2026-11.json");
const todosOsCasos = JSON.parse(fs.readFileSync(arquivo, "utf8")).casos;
// IDS=a,b roda só alguns casos (por exemplo, para conferir uma correção).
const ids = process.env.IDS ? new Set(process.env.IDS.split(",").map(x => x.trim())) : null;
const casos = ids ? todosOsCasos.filter(c => ids.has(c.id)) : todosOsCasos;

const APOIA = new Set(["ATUAL", "CORROBORADA"]);
const CONTRA = new Set(["CONTRADITA_POR_FONTE_ATUAL", "CONTRADICAO_FRACA"]);

function pontuar(esperado, veredito) {
  if (esperado === "ATUAL") {
    if (APOIA.has(veredito)) return "ACERTO";
    if (veredito === "SUPORTE_FRACO") return "PARCIAL";
    if (CONTRA.has(veredito)) return "ERRO";
    return "SEM_DECISAO";
  }
  if (CONTRA.has(veredito)) return "ACERTO";
  if (veredito === "CONFLITO") return "PARCIAL";
  if (APOIA.has(veredito) || veredito === "SUPORTE_FRACO") return "ERRO_GRAVE";
  return "SEM_DECISAO";
}

function resumir(linhas) {
  const n = linhas.length;
  const conta = r => linhas.filter(l => l.resultado === r).length;
  return {
    total: n,
    acertos: conta("ACERTO"),
    parciais: conta("PARCIAL"),
    sem_decisao: conta("SEM_DECISAO"),
    erros: conta("ERRO"),
    erros_graves_confirmou_desatualizada: conta("ERRO_GRAVE"),
    acuracia_estrita: n ? +(conta("ACERTO") / n).toFixed(3) : null,
    direcao_correta: n ? +((conta("ACERTO") + conta("PARCIAL")) / n).toFixed(3) : null
  };
}

// Quanto esperar quando o provedor diz "try again in 6m20s" (limite de uso).
function esperaPedida(mensagem) {
  const m = /try again in (?:(\d+)m)?([\d.]+)s/i.exec(String(mensagem));
  if (!m) return null;
  return Math.ceil(((Number(m[1] ?? 0) * 60) + Number(m[2])) * 1000) + 5000;
}

// Arquivo de resultado: o nome dos casos sem data repetida, mais a data de hoje.
const nomeBase = process.env.CASOS ? path.basename(process.env.CASOS, ".json").replace(/-\d{4}-\d{2}-\d{2}$/, "") : "casos-reais";
const destino = process.env.RESULTADO ? path.resolve(process.env.RESULTADO) : path.join(__dirname, `resultado-${nomeBase}-${new Date().toISOString().slice(0, 10)}.json`);
const ESPERA_MAXIMA_MS = Number(process.env.ESPERA_MAXIMA_MS ?? 15 * 60 * 1000);
const semIdOrganizacao = texto => String(texto ?? "").replace(/org_[A-Za-z0-9]+/g, "org_<redacted>");

async function verificarCaso(caso) {
  const inicio = Date.now();
  let veredito = null; let erro = null; let nota = null; let gateway = null;
  try {
    const r = await fetch(`${BASE}/api/verificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: caso.texto, modo: "real", dominiosOficiais: [] })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro ?? `HTTP ${r.status}`);
    const a = d.afirmacoes?.[0];
    veredito = a?.agregacao?.veredito ?? "NAO_VERIFICAVEL";
    nota = a?.agregacao?.atualidade_afirmacao?.score ?? null;
    gateway = d.gateway ? { chamadas: d.gateway.chamadas, respondidas_por_reserva: d.gateway.respostas_de_reserva, respostas_invalidas_refeitas: d.gateway.falhas } : null;
  } catch (e) {
    erro = semIdOrganizacao(e.message);
  }
  return { id: caso.id, esperado: caso.esperado, veredito, nota_atualidade: nota, resultado: erro ? "FALHA_EXECUCAO" : pontuar(caso.esperado, veredito), segundos: Math.round((Date.now() - inicio) / 1000), gateway, erro };
}

async function principal() {
  // Retoma uma rodada anterior do mesmo dia: casos que já deram resultado não
  // são refeitos (não gastam cota de novo); só os que falharam por limite.
  const anteriores = new Map();
  if (fs.existsSync(destino)) {
    for (const l of JSON.parse(fs.readFileSync(destino, "utf8")).linhas ?? []) {
      if (l.resultado !== "FALHA_EXECUCAO") anteriores.set(l.id, l);
    }
    if (anteriores.size) console.log(`Retomando: ${anteriores.size} caso(s) já feitos não serão refeitos.`);
  }
  const linhas = [];
  for (const caso of casos) {
    if (anteriores.has(caso.id)) {
      const l = anteriores.get(caso.id);
      linhas.push(l);
      console.log(`${l.resultado.padEnd(14)} ${caso.id.padEnd(22)} (já feito)`);
      continue;
    }
    let linha = await verificarCaso(caso);
    for (let tentativa = 2; linha.resultado === "FALHA_EXECUCAO" && tentativa <= 4; tentativa += 1) {
      const espera = esperaPedida(linha.erro) ?? (/limite|limit|240 s|already running/i.test(linha.erro) ? 120000 : null);
      if (!espera || espera > ESPERA_MAXIMA_MS) break;
      console.log(`Limite de uso do modelo. Esperando ${Math.round(espera / 1000)} s e tentando de novo (${tentativa}/4)...`);
      await new Promise(r => setTimeout(r, espera));
      linha = await verificarCaso(caso);
    }
    linhas.push(linha);
    console.log(`${linha.resultado.padEnd(14)} ${caso.id.padEnd(22)} esperado ${caso.esperado.padEnd(13)} veredito ${linha.veredito} (${linha.segundos}s)`);
    fs.writeFileSync(destino, JSON.stringify({ executado_em: new Date().toISOString(), servidor: BASE, parcial: true, linhas }, null, 2));
    if (caso !== casos.at(-1)) await new Promise(r => setTimeout(r, PAUSA_MS));
  }
  const resumo = resumir(linhas.filter(l => l.resultado !== "FALHA_EXECUCAO"));
  resumo.falhas_execucao = linhas.filter(l => l.resultado === "FALHA_EXECUCAO").length;
  const comGateway = linhas.filter(l => l.gateway);
  resumo.gateway = comGateway.length ? {
    chamadas_ao_modelo: comGateway.reduce((t, l) => t + l.gateway.chamadas, 0),
    respondidas_por_modelo_reserva: comGateway.reduce((t, l) => t + l.gateway.respondidas_por_reserva, 0),
    respostas_invalidas_refeitas: comGateway.reduce((t, l) => t + l.gateway.respostas_invalidas_refeitas, 0)
  } : null;
  const saida = { executado_em: new Date().toISOString(), servidor: BASE, resumo, linhas };
  fs.writeFileSync(destino, JSON.stringify(saida, null, 2));
  console.log("\n", resumo, `\nResultado salvo em ${destino}`);
}

if (require.main === module) principal().catch(e => { console.error(e); process.exit(1); });
module.exports = { pontuar, resumir };
