"use strict";
// Fato histórico: um acontecimento no passado, com ano ("fundou a Nvidia em
// 1993", "was born in 1963"). Ele não envelhece: uma fonte antiga prova tanto
// quanto uma nova. Por isso não recebe nota de atualidade nem aviso de idade.
// Conservador de propósito: só vale com verbo de acontecimento, um ano já
// passado e nenhuma marca de "hoje", "desde" ou "até".
const VERBO_EN = /\b(co-?founded|founded|was established|established|was born|born|launched|released|introduced|invented|was created|created|died|passed away|signed|opened|acquired|bought|merged|won|was elected|elected|announced|began|started|built|discovered|published|debuted|was founded)\b/i;
const VERBO_PT = /(^|[^\p{L}])(cofundou|co-fundou|fundou|foi fundad[oa]|fundad[oa] em|nasceu|lançou|foi lançad[oa]|lançad[oa] em|criou|foi criad[oa]|morreu|faleceu|assinou|foi assinad[oa]|inaugurou|foi inaugurad[oa]|adquiriu|comprou|venceu|ganhou|foi eleit[oa]|anunciou|começou|descobriu|publicou|estreou)(?=[^\p{L}]|$)/iu;
const PRESENTE_OU_DURACAO = /\b(currently|still|now|today|latest|newest|current|since|ever since|until|as of|right now|is|are|has|have)\b|(^|[^\p{L}])(atualmente|ainda|hoje|atual|vigente|desde|até|é|são|tem|têm|está|estão|mais recente|últim[oa]s?)(?=[^\p{L}]|$)/iu;

function ehFatoHistorico(texto, dataReferencia = new Date()) {
  const t = String(texto ?? "");
  if (!t.trim()) return false;
  if (!(VERBO_EN.test(t) || VERBO_PT.test(t))) return false;
  if (PRESENTE_OU_DURACAO.test(t)) return false;
  const anoAtual = (dataReferencia instanceof Date && !Number.isNaN(dataReferencia.getTime()) ? dataReferencia : new Date()).getUTCFullYear();
  const anos = [...t.matchAll(/\b(1[5-9]\d{2}|20\d{2})\b/g)].map(m => Number(m[1]));
  return anos.length > 0 && anos.every(a => a < anoAtual);
}

module.exports = { ehFatoHistorico };
