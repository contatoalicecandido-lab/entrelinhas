// Avaliação opt-in: faz GET HTTPS somente aos quatro URLs do corpus anotado.
// Não é chamada por npm test; não usa Tavily/Bifrost nem banco de dados.
const corpus = require("./rotulos-paginas-reais-v1.json");
const { obterMetadadosPagina } = require("../src/sinais-temporais");

async function main() {
  if (!process.argv.includes("--live")) {
    console.log("Execução ao vivo desativada por padrão. Use: node avaliacao/validar-paginas-reais.js --live");
    return;
  }
  const resultados = [];
  for (const caso of corpus.casos) {
    const resultado = await obterMetadadosPagina(caso.url, {
      claim: caso.afirmacao,
      claimType: caso.tipo_afirmacao
    });
    const sinais = resultado.signals ?? [];
    const datasAnotadasEncontradas = caso.datas_declaradas.map(data => ({
      ...data,
      encontrada: sinais.some(sinal => sinal.value_normalized === data.data && data.escopos_aceitaveis.includes(sinal.scope))
    }));
    const datasAtributo = sinais.filter(sinal => sinal.scope === "ATTRIBUTE");
    resultados.push({
      id: caso.id,
      status: resultado.status,
      motivo: resultado.reason ?? null,
      datas_anotadas_encontradas: datasAnotadasEncontradas,
      attribute_detected: datasAtributo,
      signals: sinais.map(({ signal_type, field, value_normalized, scope, source, parse_status }) => ({
        signal_type, field, value_normalized, scope, source, parse_status
      }))
    });
  }

  const itensDisponiveis = resultados.filter(item => item.status === "SUCCESS");
  const datasDisponiveis = itensDisponiveis.flatMap(item => item.datas_anotadas_encontradas);
  const datasCapturadasDisponiveis = datasDisponiveis.filter(item => item.encontrada).length;
  const datasNaoAvaliaveis = resultados.filter(item => item.status !== "SUCCESS")
    .flatMap(item => item.datas_anotadas_encontradas).length;
  const negativosDeAtributoDisponiveis = corpus.casos.filter(caso => !caso.espera_data_attribute)
    .filter(caso => resultados.some(item => item.id === caso.id && item.status === "SUCCESS"));
  const falsosVinculos = negativosDeAtributoDisponiveis.filter(caso =>
    resultados.find(item => item.id === caso.id)?.attribute_detected.length > 0).length;
  console.log(JSON.stringify({
    corpus: corpus.versao,
    anotado_em: corpus.anotado_em,
    captura_datas_declaradas_em_fontes_disponiveis: `${datasCapturadasDisponiveis}/${datasDisponiveis.length}`,
    datas_declaradas_em_fontes_indisponiveis: datasNaoAvaliaveis,
    rotulos_attribute_negativos_avaliados: negativosDeAtributoDisponiveis.length,
    casos_com_falso_attribute: falsosVinculos,
    resultados
  }, null, 2));
  if (resultados.every(item => item.status !== "SUCCESS")) {
    console.error("Nenhuma página foi lida; verifique o acesso de rede/DNS do ambiente antes de interpretar a cobertura.");
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error(`Avaliação interrompida: ${error.message}`);
  process.exitCode = 1;
});
