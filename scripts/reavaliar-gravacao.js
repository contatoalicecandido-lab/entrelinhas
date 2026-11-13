// Reavalia uma checagem gravada com as REGRAS ATUAIS, sem nenhuma chamada
// nova: usa só o que a gravação guarda (as fontes, o que o modelo disse de
// cada uma, as citações conferidas, as datas e a data da checagem).
// Refaz: tipo de cada fonte, datas do fato, janela de validade, atualidade
// de cada fonte, independência, concordância, veredito e notas.
// Não refaz: a busca, a leitura das fontes pelo modelo e o texto da resposta
// corrigida (ficam exatamente como foram gravados).
const { classificarFonte } = require("../src/tipo-fonte");
const { avaliarAtualidade, janelaDeValidade } = require("../src/atualidade");
const { agregarEvidencias, VERSAO_REGRAS } = require("../src/agregador");
const { inferirTipoPorRegras } = require("../src/tipo-afirmacao");
const { avaliarRiscoDesatualizacao } = require("../src/risco-desatualizacao");

function reavaliarGravacao(dados) {
  const asOf = new Date(dados.verificado_em ?? dados.gravado_em ?? Date.now());
  const mudancas = [];
  for (const a of dados.afirmacoes ?? []) {
    const antes = a.agregacao?.veredito ?? null;
    if (!a.tipo_afirmacao) {
      const tipo = inferirTipoPorRegras(a.texto);
      if (tipo) { a.tipo_afirmacao = tipo; a.origem_tipo_afirmacao = "HEURISTICA"; }
    }
    a.janela_validade = janelaDeValidade(a.tipo_afirmacao, a.texto);
    a.risco_desatualizacao = avaliarRiscoDesatualizacao({ texto: a.texto, tipo: a.tipo_afirmacao, janela: a.janela_validade, nuances: a.nuances, dataReferencia: asOf });
    for (const e of a.evidencias ?? []) {
      const fonte = e.fonte ?? {};
      const deNoticias = (fonte.metadados_provedor?.buscas ?? []).some(b => String(b.modo_busca).startsWith("NOTICIAS"));
      fonte.categoria_fonte = classificarFonte(fonte.url, { dominiosOficiais: a.dominios_oficiais_usados ?? [], afirmacao: a.texto, deBuscaDeNoticias: deNoticias }).tipo;
      const publicada = /^\d{4}-\d{2}-\d{2}/.test(String(fonte.data_publicacao ?? "")) ? String(fonte.data_publicacao).slice(0, 10) : null;
      if (fonte.data_fato?.data && publicada && fonte.data_fato.data < publicada) {
        fonte.data_atualizacao = publicada;
        fonte.data_fato.confirmada_em = publicada;
      }
      if (e.preparacao && e.preparacao.metodo_analise === "LOTE") e.preparacao.citacao_verificada = Boolean(e.preparacao.citacao_chave);
      e.atualidade = avaliarAtualidade(fonte, a.tipo_afirmacao, asOf, a.janela_validade?.dias);
    }
    a.agregacao = agregarEvidencias(
      { texto: a.texto, tipo_afirmacao: a.tipo_afirmacao, janela_validade: a.janela_validade, evidencias: a.evidencias },
      { dominiosOficiais: a.dominios_oficiais_usados ?? [], asOf }
    );
    if (antes !== a.agregacao.veredito) mudancas.push({ afirmacao: a.texto, antes, depois: a.agregacao.veredito });
  }
  dados.reavaliacao = {
    regras: VERSAO_REGRAS,
    nota: "Re-scored with the current rules from the evidence stored in this recording, with no new searches or model calls. The updated answer text is the one generated at recording time.",
    vereditos_alterados: mudancas
  };
  return dados;
}

module.exports = { reavaliarGravacao };

if (require.main === module) {
  const fs = require("node:fs");
  for (const arquivo of process.argv.slice(2)) {
    const d = reavaliarGravacao(JSON.parse(fs.readFileSync(arquivo, "utf8")));
    console.log(arquivo.split("/").pop().slice(0, 60));
    for (const a of d.afirmacoes) {
      const ag = a.agregacao;
      console.log(`   ${ag.veredito.padEnd(26)} conc ${String(ag.concordancia?.score).padEnd(4)} fresh ${String(ag.atualidade_afirmacao?.score).padEnd(4)} ${ag.atualidade_afirmacao?.status ?? ""} w${ag.atualidade_afirmacao?.window_days ?? ""} | ${a.texto.slice(0, 50)}`);
    }
    if (d.reavaliacao.vereditos_alterados.length) console.log("   MUDOU:", JSON.stringify(d.reavaliacao.vereditos_alterados));
  }
}
