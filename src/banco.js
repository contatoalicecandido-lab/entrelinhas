
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function criarBanco(opcoes = {}) {
  const caminho = opcoes.caminho ?? path.join(
    __dirname,
    "..",
    "dados",
    "entrelinhas.db"
  );

  if (caminho !== ":memory:") {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
  }

  const banco = new DatabaseSync(caminho);

  banco.exec("PRAGMA foreign_keys = ON");

  banco.exec(`
    CREATE TABLE IF NOT EXISTS verificacoes (
      id TEXT PRIMARY KEY,
      texto_original TEXT NOT NULL,
      verificado_em TEXT NOT NULL,
      total_afirmacoes INTEGER NOT NULL,
      resultado_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS afirmacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      verificacao_id TEXT NOT NULL,
      id_afirmacao TEXT NOT NULL,
      texto TEXT NOT NULL,
      tipo_afirmacao TEXT,
      erro_busca TEXT,
      FOREIGN KEY (verificacao_id)
        REFERENCES verificacoes(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      afirmacao_id INTEGER NOT NULL,
      titulo TEXT,
      url TEXT,
      tipo_fonte TEXT,
      conteudo TEXT,
      coletado_em TEXT,
      data_publicacao TEXT,
      data_atualizacao TEXT,
      relevancia REAL,
      fonte_json TEXT NOT NULL,
      preparacao_json TEXT,
      correspondencia_json TEXT,
      classificacao_json TEXT,
      atualidade_json TEXT,
      FOREIGN KEY (afirmacao_id)
        REFERENCES afirmacoes(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comparacoes_fontes (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      id_evidencia_anterior INTEGER NOT NULL,
      id_evidencia_atual INTEGER NOT NULL,
      algoritmo TEXT NOT NULL,
      versao_algoritmo TEXT NOT NULL,
      status TEXT NOT NULL,
      hash_anterior TEXT,
      hash_atual TEXT,
      resultado_json TEXT NOT NULL,
      comparado_em TEXT NOT NULL,

      FOREIGN KEY (id_evidencia_anterior)
        REFERENCES evidencias(id),

      FOREIGN KEY (id_evidencia_atual)
        REFERENCES evidencias(id),

      UNIQUE (
        id_evidencia_anterior,
        id_evidencia_atual,
        versao_algoritmo
      )
    );

    CREATE TABLE IF NOT EXISTS avaliacoes_impacto (
      id TEXT PRIMARY KEY,
      comparacao_id TEXT NOT NULL,
      metodo TEXT NOT NULL,
      versao_regra TEXT NOT NULL,
      status TEXT NOT NULL,
      nivel_estimado TEXT NOT NULL,
      avaliacao_json TEXT NOT NULL,
      avaliado_em TEXT NOT NULL,

      FOREIGN KEY (comparacao_id)
        REFERENCES comparacoes_fontes(id)
        ON DELETE CASCADE,

      UNIQUE (comparacao_id, versao_regra)
    );

    CREATE INDEX IF NOT EXISTS idx_afirmacoes_verificacao
      ON afirmacoes(verificacao_id);

    CREATE INDEX IF NOT EXISTS idx_evidencias_afirmacao
      ON evidencias(afirmacao_id);

    CREATE INDEX IF NOT EXISTS idx_evidencias_url
      ON evidencias(url);

    CREATE INDEX IF NOT EXISTS idx_comparacoes_url
      ON comparacoes_fontes(url);

    CREATE INDEX IF NOT EXISTS idx_avaliacoes_comparacao
      ON avaliacoes_impacto(comparacao_id);
  `);

  function salvarVerificacao(resultado) {
    if (
      !resultado ||
      typeof resultado !== "object" ||
      !Array.isArray(resultado.afirmacoes)
    ) {
      throw new Error("O resultado da verificação é inválido.");
    }

    const idVerificacao = resultado.id_verificacao ?? randomUUID();

    const resultadoCompleto = {
      ...resultado,
      id_verificacao: idVerificacao
    };

    banco.exec("BEGIN");

    try {
      banco.prepare(`
        INSERT INTO verificacoes (
          id,
          texto_original,
          verificado_em,
          total_afirmacoes,
          resultado_json
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        idVerificacao,
        resultadoCompleto.texto_original ?? "",
        resultadoCompleto.verificado_em ?? new Date().toISOString(),
        resultadoCompleto.afirmacoes.length,
        JSON.stringify(resultadoCompleto)
      );

      const inserirAfirmacao = banco.prepare(`
        INSERT INTO afirmacoes (
          verificacao_id,
          id_afirmacao,
          texto,
          tipo_afirmacao,
          erro_busca
        ) VALUES (?, ?, ?, ?, ?)
      `);

      const inserirEvidencia = banco.prepare(`
        INSERT INTO evidencias (
          afirmacao_id,
          titulo,
          url,
          tipo_fonte,
          conteudo,
          coletado_em,
          data_publicacao,
          data_atualizacao,
          relevancia,
          fonte_json,
          preparacao_json,
          correspondencia_json,
          classificacao_json,
          atualidade_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const afirmacao of resultadoCompleto.afirmacoes) {
        const afirmacaoInserida = inserirAfirmacao.run(
          idVerificacao,
          afirmacao.id ?? "",
          afirmacao.texto ?? "",
          afirmacao.tipo_afirmacao ?? null,
          afirmacao.erro_busca ?? null
        );

        const idAfirmacaoBanco = Number(
          afirmacaoInserida.lastInsertRowid
        );

        for (const evidencia of afirmacao.evidencias ?? []) {
          const fonte = evidencia.fonte ?? {};

          inserirEvidencia.run(
            idAfirmacaoBanco,
            fonte.titulo ?? null,
            fonte.url ?? null,
            fonte.tipo_fonte ?? null,
            fonte.conteudo ?? null,
            fonte.coletado_em ?? null,
            fonte.data_publicacao ?? null,
            fonte.data_atualizacao ?? null,
            fonte.relevancia ?? null,
            JSON.stringify(fonte),
            JSON.stringify(evidencia.preparacao ?? null),
            JSON.stringify(evidencia.correspondencia ?? null),
            JSON.stringify(evidencia.classificacao ?? null),
            JSON.stringify(evidencia.atualidade ?? null)
          );
        }
      }

      banco.exec("COMMIT");

      return idVerificacao;

    } catch (erro) {
      banco.exec("ROLLBACK");
      throw erro;
    }
  }

  function listarVerificacoes(limite = 20) {
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new Error("O limite precisa ser um inteiro entre 1 e 100.");
    }

    return banco.prepare(`
      SELECT
        id,
        texto_original,
        verificado_em,
        total_afirmacoes
      FROM verificacoes
      ORDER BY verificado_em DESC
      LIMIT ?
    `).all(limite);
  }

  function obterVerificacao(id) {
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error("O ID da verificação é inválido.");
    }

    const registro = banco.prepare(`
      SELECT resultado_json
      FROM verificacoes
      WHERE id = ?
    `).get(id);

    if (!registro) {
      return null;
    }

    const resultado = JSON.parse(registro.resultado_json);

    const evidenciasBanco = banco.prepare(`
      SELECT
        e.id AS id_evidencia,
        a.id_afirmacao,
        e.url
      FROM evidencias e
      INNER JOIN afirmacoes a
        ON a.id = e.afirmacao_id
      WHERE a.verificacao_id = ?
      ORDER BY e.id ASC
    `).all(id);

    const evidenciasPorChave = new Map();

    for (const evidencia of evidenciasBanco) {
      const chave = `${evidencia.id_afirmacao}::${evidencia.url}`;

      if (!evidenciasPorChave.has(chave)) {
        evidenciasPorChave.set(chave, []);
      }

      evidenciasPorChave.get(chave).push(evidencia.id_evidencia);
    }

    for (const afirmacao of resultado.afirmacoes ?? []) {
      for (const evidencia of afirmacao.evidencias ?? []) {
        const url = evidencia.fonte?.url;
        const chave = `${afirmacao.id}::${url}`;
        const ids = evidenciasPorChave.get(chave);

        if (ids?.length) {
          evidencia.id_evidencia = ids.shift();
        }
      }
    }

    return resultado;
  }

  function listarHistoricoFonte(url) {
    if (
      typeof url !== "string" ||
      !/^https?:\/\//i.test(url.trim())
    ) {
      throw new Error("A URL da fonte é inválida.");
    }

    const registros = banco.prepare(`
      SELECT
        e.id AS id_evidencia,
        v.id AS id_verificacao,
        v.texto_original,
        v.verificado_em,
        a.texto AS afirmacao,
        e.titulo,
        e.url,
        e.tipo_fonte,
        e.conteudo,
        e.coletado_em,
        e.data_publicacao,
        e.data_atualizacao,
        e.relevancia,
        e.fonte_json,
        e.correspondencia_json,
        e.classificacao_json,
        e.atualidade_json
      FROM evidencias e
      INNER JOIN afirmacoes a
        ON a.id = e.afirmacao_id
      INNER JOIN verificacoes v
        ON v.id = a.verificacao_id
      WHERE e.url = ?
      ORDER BY v.verificado_em ASC, e.id ASC
    `).all(url.trim());

    return registros.map(registro => ({
      ...registro,
      fonte: JSON.parse(registro.fonte_json),
      correspondencia: JSON.parse(
        registro.correspondencia_json ?? "null"
      ),
      classificacao: JSON.parse(
        registro.classificacao_json ?? "null"
      ),
      atualidade: JSON.parse(
        registro.atualidade_json ?? "null"
      )
    }));
  }

  function salvarComparacao(dados) {
    if (!dados || typeof dados !== "object") {
      throw new Error("Os dados da comparação são inválidos.");
    }

    const {
      url,
      id_evidencia_anterior,
      id_evidencia_atual,
      algoritmo,
      versao_algoritmo,
      resultado
    } = dados;

    if (
      typeof url !== "string" ||
      !/^https?:\/\//i.test(url.trim())
    ) {
      throw new Error("A URL da comparação é inválida.");
    }

    if (
      !Number.isInteger(id_evidencia_anterior) ||
      !Number.isInteger(id_evidencia_atual) ||
      id_evidencia_anterior === id_evidencia_atual
    ) {
      throw new Error("Os IDs das evidências são inválidos.");
    }

    if (
      typeof algoritmo !== "string" ||
      !algoritmo.trim() ||
      typeof versao_algoritmo !== "string" ||
      !versao_algoritmo.trim()
    ) {
      throw new Error("O algoritmo e sua versão são obrigatórios.");
    }

    if (!resultado || typeof resultado !== "object") {
      throw new Error("O resultado da comparação é inválido.");
    }

    const evidencias = banco.prepare(`
      SELECT id, url
      FROM evidencias
      WHERE id IN (?, ?)
    `).all(id_evidencia_anterior, id_evidencia_atual);

    if (evidencias.length !== 2) {
      throw new Error("Uma ou ambas as evidências não foram encontradas.");
    }

    if (evidencias.some(evidencia => evidencia.url !== url.trim())) {
      throw new Error(
        "As evidências não pertencem à URL informada."
      );
    }

    const existente = banco.prepare(`
      SELECT id
      FROM comparacoes_fontes
      WHERE id_evidencia_anterior = ?
        AND id_evidencia_atual = ?
        AND versao_algoritmo = ?
    `).get(
      id_evidencia_anterior,
      id_evidencia_atual,
      versao_algoritmo.trim()
    );

    if (existente) {
      return existente.id;
    }

    const id = randomUUID();

    banco.prepare(`
      INSERT INTO comparacoes_fontes (
        id,
        url,
        id_evidencia_anterior,
        id_evidencia_atual,
        algoritmo,
        versao_algoritmo,
        status,
        hash_anterior,
        hash_atual,
        resultado_json,
        comparado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      url.trim(),
      id_evidencia_anterior,
      id_evidencia_atual,
      algoritmo.trim(),
      versao_algoritmo.trim(),
      resultado.status ?? "INDETERMINADO",
      resultado.hash_anterior ?? null,
      resultado.hash_atual ?? null,
      JSON.stringify(resultado),
      new Date().toISOString()
    );

    return id;
  }

  function salvarAvaliacaoImpacto(dados) {
    if (!dados || typeof dados !== "object") {
      throw new Error("Os dados da avaliação são inválidos.");
    }

    const {
      comparacao_id,
      metodo,
      versao_regra,
      avaliacao
    } = dados;

    if (
      typeof comparacao_id !== "string" ||
      !comparacao_id.trim()
    ) {
      throw new Error("O ID da comparação é inválido.");
    }

    if (
      typeof metodo !== "string" ||
      !metodo.trim() ||
      typeof versao_regra !== "string" ||
      !versao_regra.trim()
    ) {
      throw new Error("O método e a versão da regra são obrigatórios.");
    }

    if (!avaliacao || typeof avaliacao !== "object") {
      throw new Error("A avaliação de impacto é inválida.");
    }

    const comparacao = banco.prepare(`
      SELECT id
      FROM comparacoes_fontes
      WHERE id = ?
    `).get(comparacao_id.trim());

    if (!comparacao) {
      throw new Error("A comparação informada não foi encontrada.");
    }

    const existente = banco.prepare(`
      SELECT id
      FROM avaliacoes_impacto
      WHERE comparacao_id = ?
        AND versao_regra = ?
    `).get(comparacao_id.trim(), versao_regra.trim());

    if (existente) {
      return existente.id;
    }

    const id = randomUUID();

    banco.prepare(`
      INSERT INTO avaliacoes_impacto (
        id,
        comparacao_id,
        metodo,
        versao_regra,
        status,
        nivel_estimado,
        avaliacao_json,
        avaliado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      comparacao_id.trim(),
      metodo.trim(),
      versao_regra.trim(),
      avaliacao.status ?? "INDETERMINADO",
      avaliacao.nivel ?? "INDETERMINADO",
      JSON.stringify(avaliacao),
      new Date().toISOString()
    );

    return id;
  }

  function listarComparacoesFonte(url) {
    if (
      typeof url !== "string" ||
      !/^https?:\/\//i.test(url.trim())
    ) {
      throw new Error("A URL da fonte é inválida.");
    }

    const registros = banco.prepare(`
      SELECT *
      FROM comparacoes_fontes
      WHERE url = ?
      ORDER BY comparado_em ASC
    `).all(url.trim());

    return registros.map(registro => ({
      ...registro,
      resultado: JSON.parse(registro.resultado_json)
    }));
  }

  function listarAvaliacoesImpacto(comparacaoId) {
    if (
      typeof comparacaoId !== "string" ||
      !comparacaoId.trim()
    ) {
      throw new Error("O ID da comparação é inválido.");
    }

    const registros = banco.prepare(`
      SELECT *
      FROM avaliacoes_impacto
      WHERE comparacao_id = ?
      ORDER BY avaliado_em ASC
    `).all(comparacaoId.trim());

    return registros.map(registro => ({
      ...registro,
      avaliacao: JSON.parse(registro.avaliacao_json)
    }));
  }

  function fechar() {
    banco.close();
  }

  return {
    salvarVerificacao,
    listarVerificacoes,
    obterVerificacao,
    listarHistoricoFonte,
    salvarComparacao,
    salvarAvaliacaoImpacto,
    listarComparacoesFonte,
    listarAvaliacoesImpacto,
    fechar
  };
}

module.exports = {
  criarBanco
};
