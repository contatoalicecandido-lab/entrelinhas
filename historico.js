
const { criarBanco } = require("./src/banco");

function formatarData(data) {
  if (!data) {
    return "Data não disponível";
  }

  const dataFormatada = new Date(data);

  if (Number.isNaN(dataFormatada.getTime())) {
    return data;
  }

  return dataFormatada.toLocaleString("pt-BR");
}

function formatarJson(valor) {
  if (!valor) {
    return null;
  }

  if (typeof valor === "string") {
    try {
      return JSON.parse(valor);
    } catch {
      return null;
    }
  }

  return valor;
}

function exibirLista(banco) {
  const verificacoes = banco.listarVerificacoes(50);

  console.log("\n======================================");
  console.log("ENTRELINHAS — HISTÓRICO");
  console.log("======================================");

  if (verificacoes.length === 0) {
    console.log("\nNenhuma verificação encontrada.");
    return;
  }

  console.log(`\nVerificações encontradas: ${verificacoes.length}`);

  verificacoes.forEach((verificacao, indice) => {
    console.log(`\n${indice + 1}. ${verificacao.texto_original}`);
    console.log("ID:", verificacao.id);
    console.log("Data:", formatarData(verificacao.verificado_em));
    console.log("Afirmações:", verificacao.total_afirmacoes);
  });

  console.log("\n--------------------------------------");
  console.log("Para abrir uma verificação, execute:");
  console.log("node historico.js ID_DA_VERIFICACAO");
  console.log("--------------------------------------");
}

function exibirEvidencias(afirmacao) {
  const evidencias = afirmacao.evidencias ?? [];

  console.log("\nTotal de evidências:", evidencias.length);

  evidencias.forEach((evidencia, indice) => {
    const fonte = evidencia.fonte ?? {};

    console.log(`\n--- Evidência ${indice + 1} ---`);

    console.log("ID da evidência:", evidencia.id_evidencia ?? "Não disponível");
    console.log("Título:", fonte.titulo ?? "Não disponível");
    console.log("URL:", fonte.url ?? "Não disponível");
    console.log("Tipo de fonte:", fonte.tipo_fonte ?? "Não disponível");
    console.log("Coletado em:", formatarData(fonte.coletado_em));
    console.log("Publicado em:", fonte.data_publicacao ?? "Não informado");
    console.log("Atualizado em:", fonte.data_atualizacao ?? "Não informado");
    console.log("Relevância da busca:", fonte.relevancia ?? "Não disponível");

    console.log(
      "Correspondência:",
      evidencia.correspondencia?.status ?? "Não disponível"
    );

    console.log(
      "Justificativa da correspondência:",
      evidencia.correspondencia?.justificativa ?? "Não disponível"
    );

    console.log(
      "Classificação:",
      evidencia.classificacao?.postura ?? "Não disponível"
    );

    console.log(
      "Justificativa da classificação:",
      evidencia.classificacao?.justificativa ?? "Não disponível"
    );

    console.log(
      "Atualidade:",
      evidencia.atualidade?.status ?? "Não disponível"
    );

    console.log(
      "Motivo da atualidade:",
      evidencia.atualidade?.motivo ?? "Não informado"
    );
  });
}

function exibirComparacoes(banco, url) {
  if (typeof banco.listarComparacoesFonte !== "function") {
    console.log("\nConsulta de comparações não disponível neste banco.");
    return;
  }

  const comparacoes = banco.listarComparacoesFonte(url);

  console.log("\n--------------------------------------");
  console.log("COMPARAÇÕES ENTRE COLETAS");
  console.log("--------------------------------------");

  if (!comparacoes || comparacoes.length === 0) {
    console.log("Nenhuma comparação persistida para esta fonte.");
    return;
  }

  console.log(`Comparações encontradas: ${comparacoes.length}`);

  comparacoes.forEach((registro, indice) => {
    const resultado = formatarJson(
      registro.resultado_json ?? registro.resultado
    );

    console.log(`\n--- Comparação ${indice + 1} ---`);

    console.log("ID:", registro.id_comparacao ?? registro.id);
    console.log("URL:", registro.url ?? url);
    console.log("Algoritmo:", registro.algoritmo ?? "Não disponível");
    console.log(
      "Versão do algoritmo:",
      registro.versao_algoritmo ?? "Não disponível"
    );

    console.log(
      "Evidência anterior:",
      registro.id_evidencia_anterior ?? "Não disponível"
    );

    console.log(
      "Evidência atual:",
      registro.id_evidencia_atual ?? "Não disponível"
    );

    if (!resultado) {
      console.log("Resultado original: não foi possível interpretar.");
      return;
    }

    console.log("Status:", resultado.status);
    console.log("Justificativa:", resultado.justificativa ?? "Não disponível");

    console.log(
      "Coleta anterior:",
      formatarData(resultado.coleta_anterior)
    );

    console.log(
      "Coleta atual:",
      formatarData(resultado.ultima_coleta)
    );

    console.log("\nHASHES");

    console.log("Anterior:", resultado.hash_anterior ?? "Não disponível");
    console.log("Atual:", resultado.hash_atual ?? "Não disponível");

    const detalhamento = resultado.detalhamento;

    if (!detalhamento) {
      return;
    }

    console.log("\nDETALHAMENTO TEXTUAL");
    console.log("Status:", detalhamento.status);

    if (detalhamento.justificativa) {
      console.log("Justificativa:", detalhamento.justificativa);
    }

    if (detalhamento.status === "NOT_COMPUTED_LIMIT") {
      console.log(
        "A comparação detalhada não foi executada devido ao limite de tokens."
      );
      return;
    }

    console.log("\nTrechos removidos:");

    if (detalhamento.trechos_removidos?.length) {
      detalhamento.trechos_removidos.forEach(trecho => {
        console.log("-", trecho);
      });
    } else {
      console.log("Nenhum.");
    }

    console.log("\nTrechos adicionados:");

    if (detalhamento.trechos_adicionados?.length) {
      detalhamento.trechos_adicionados.forEach(trecho => {
        console.log("+", trecho);
      });
    } else {
      console.log("Nenhum.");
    }

    console.log("\nALTERAÇÕES CONTEXTUALIZADAS");

    if (!detalhamento.alteracoes?.length) {
      console.log("Nenhuma alteração detalhada disponível.");
      return;
    }

    detalhamento.alteracoes.forEach((alteracao, indiceAlteracao) => {
      console.log(`\nAlteração ${indiceAlteracao + 1}`);

      console.log(
        "Trecho anterior:",
        alteracao.trecho_anterior_contextualizado ?? "Não disponível"
      );

      console.log(
        "Trecho atual:",
        alteracao.trecho_atual_contextualizado ?? "Não disponível"
      );
    });
  });
}

function exibirAvaliacoesImpacto(banco, url) {
  if (typeof banco.listarComparacoesFonte !== "function") {
    return;
  }

  if (typeof banco.listarAvaliacoesImpacto !== "function") {
    console.log("\nConsulta de avaliações estimadas não disponível.");
    return;
  }

  const comparacoes = banco.listarComparacoesFonte(url);

  console.log("\n--------------------------------------");
  console.log("AVALIAÇÕES ESTIMADAS");
  console.log("--------------------------------------");

  if (!comparacoes || comparacoes.length === 0) {
    console.log("Nenhuma comparação disponível para avaliação.");
    return;
  }

  let totalAvaliacoes = 0;

  comparacoes.forEach(comparacao => {
    const idComparacao =
      comparacao.id_comparacao ?? comparacao.id;

    if (idComparacao === undefined || idComparacao === null) {
      return;
    }

    const avaliacoes =
      banco.listarAvaliacoesImpacto(idComparacao);

    if (!avaliacoes || avaliacoes.length === 0) {
      return;
    }

    avaliacoes.forEach((registro, indice) => {
      totalAvaliacoes++;

      const avaliacao = formatarJson(
        registro.avaliacao_json ?? registro.resultado_json
      );

      console.log(`\n--- Avaliação ${totalAvaliacoes} ---`);

      console.log("ID da comparação:", idComparacao);
      console.log(
        "Versão da regra:",
        registro.versao_regra ?? "Não disponível"
      );

      if (!avaliacao) {
        console.log("Não foi possível interpretar os dados da avaliação.");
        return;
      }

      console.log(
        "Natureza:",
        "Estimativa heurística, não evidência de impacto real."
      );

      console.log(
        "Nível estimado:",
        avaliacao.nivel_estimado ??
        avaliacao.nivel ??
        "Indeterminado"
      );

      console.log(
        "Sinais detectados:",
        JSON.stringify(
          avaliacao.sinais_detectados ?? [],
          null,
          2
        )
      );

      console.log(
        "Justificativa:",
        avaliacao.justificativa ??
        avaliacao.motivos ??
        "Não disponível"
      );

      console.log(
        "Limites:",
        avaliacao.limites ??
        "A classificação é heurística e depende das regras implementadas."
      );

      console.log(
        "Avaliado em:",
        formatarData(
          avaliacao.avaliado_em ?? registro.avaliado_em
        )
      );
    });
  });

  if (totalAvaliacoes === 0) {
    console.log("Nenhuma avaliação estimada registrada para esta fonte.");
  }
}

function exibirDetalhes(banco, id) {
  const verificacao = banco.obterVerificacao(id);

  if (!verificacao) {
    console.log("\nVerificação não encontrada.");
    return;
  }

  console.log("\n======================================");
  console.log("ENTRELINHAS — DETALHES DA VERIFICAÇÃO");
  console.log("======================================");

  console.log("\nID:", verificacao.id_verificacao);
  console.log("Texto original:", verificacao.texto_original);
  console.log("Verificado em:", formatarData(verificacao.verificado_em));
  console.log("Total de afirmações:", verificacao.total_afirmacoes);

  const urls = new Set();

  verificacao.afirmacoes.forEach((afirmacao, indice) => {
    console.log("\n======================================");
    console.log(`AFIRMAÇÃO ${indice + 1}`);
    console.log("======================================");

    console.log("ID:", afirmacao.id);
    console.log("Texto:", afirmacao.texto);
    console.log("Tipo:", afirmacao.tipo_afirmacao ?? "Não classificado");
    console.log("Erro de busca:", afirmacao.erro_busca ?? "Nenhum");

    exibirEvidencias(afirmacao);

    (afirmacao.evidencias ?? []).forEach(evidencia => {
      const url = evidencia.fonte?.url;

      if (url) {
        urls.add(url);
      }
    });
  });

  urls.forEach(url => {
    exibirComparacoes(banco, url);
    exibirAvaliacoesImpacto(banco, url);
  });

  console.log("\n======================================");
  console.log("FIM DOS DETALHES");
  console.log("======================================");
}

function main() {
  const banco = criarBanco();

  try {
    const id = process.argv[2];

    if (id) {
      exibirDetalhes(banco, id);
    } else {
      exibirLista(banco);
    }

  } catch (erro) {
    console.error("\nErro ao consultar o histórico:", erro.message);
    process.exitCode = 1;

  } finally {
    banco.fechar();
  }
}

main();
