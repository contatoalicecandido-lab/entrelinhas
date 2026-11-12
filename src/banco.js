
const { DatabaseSync } = require("node:sqlite");
const { randomUUID, createHash } = require("node:crypto");
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


  // Migração v1: separa os registros de aquisição das evidências.
  function executarMigracoes() {
    const versaoAtual = banco.prepare("PRAGMA user_version").get().user_version;

    if (versaoAtual > 1) {
      throw new Error(
        `O banco possui uma versão de esquema (${versaoAtual}) mais nova que esta aplicação suporta.`
      );
    }

    banco.exec("BEGIN IMMEDIATE");

    try {
      banco.exec(`
        CREATE TABLE IF NOT EXISTS coletas (
          id TEXT PRIMARY KEY,
          id_verificacao TEXT NOT NULL,
          url_original TEXT NOT NULL,
          url_canonica TEXT NOT NULL,
          versao_canonicalizacao TEXT NOT NULL,
          tipo_fonte TEXT NOT NULL
            CHECK (tipo_fonte IN ('tavily_search', 'tavily_extract')),
          status_coleta TEXT NOT NULL
            CHECK (status_coleta IN ('SUCCESS', 'PARTIAL', 'FAILED')),
          conteudo TEXT,
          hash_conteudo TEXT,
          coletado_em TEXT NOT NULL,
          id_operacao_busca TEXT,
          id_operacao_extracao TEXT,
          consulta TEXT,
          parametros_busca_json TEXT,
          parametros_extracao_json TEXT,
          metadados_json TEXT,
          FOREIGN KEY (id_verificacao)
            REFERENCES verificacoes(id)
            ON DELETE CASCADE
        );
      `);

      const colunas = banco.prepare("PRAGMA table_info(evidencias)").all();
      if (!colunas.some((coluna) => coluna.name === "id_coleta")) {
        banco.exec(`
          ALTER TABLE evidencias
          ADD COLUMN id_coleta TEXT
          REFERENCES coletas(id)
          ON DELETE SET NULL
        `);
      }

      banco.exec(`
        CREATE INDEX IF NOT EXISTS idx_coletas_verificacao
          ON coletas(id_verificacao);
        CREATE INDEX IF NOT EXISTS idx_coletas_url_canonica
          ON coletas(url_canonica);
        CREATE INDEX IF NOT EXISTS idx_evidencias_coleta
          ON evidencias(id_coleta);

        CREATE TRIGGER IF NOT EXISTS trg_evidencias_coleta_insert
        BEFORE INSERT ON evidencias
        WHEN NEW.id_coleta IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM coletas c
            INNER JOIN afirmacoes a ON a.id = NEW.afirmacao_id
            WHERE c.id = NEW.id_coleta
              AND c.id_verificacao = a.verificacao_id
          )
        BEGIN
          SELECT RAISE(ABORT, 'A coleta não pertence à verificação da evidência.');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_evidencias_coleta_update
        BEFORE UPDATE OF id_coleta, afirmacao_id ON evidencias
        WHEN NEW.id_coleta IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM coletas c
            INNER JOIN afirmacoes a ON a.id = NEW.afirmacao_id
            WHERE c.id = NEW.id_coleta
              AND c.id_verificacao = a.verificacao_id
          )
        BEGIN
          SELECT RAISE(ABORT, 'A coleta não pertence à verificação da evidência.');
        END;
      `);

      banco.exec("PRAGMA user_version = 1");
      banco.exec("COMMIT");
    } catch (erro) {
      banco.exec("ROLLBACK");
      throw erro;
    }
  }

  executarMigracoes();

  function calcularHashConteudo(conteudo) {
    if (typeof conteudo !== "string") return null;
    return createHash("sha256").update(conteudo, "utf8").digest("hex");
  }

  function prepararColeta(coleta, idVerificacao) {
    if (!coleta || typeof coleta !== "object") return null;

    const obrigatorios = [
      ["id_coleta", coleta.id_coleta],
      ["url_original", coleta.url_original],
      ["url_canonica", coleta.url_canonica],
      ["versao_canonicalizacao", coleta.versao_canonicalizacao],
      ["coletado_em", coleta.coletado_em]
    ];

    for (const [campo, valor] of obrigatorios) {
      if (typeof valor !== "string" || !valor.trim()) {
        throw new Error(`Campo obrigatório da coleta inválido: ${campo}.`);
      }
    }

    if (!["tavily_search", "tavily_extract"].includes(coleta.tipo_fonte)) {
      throw new Error("O tipo de fonte da coleta é inválido.");
    }

    if (!["SUCCESS", "PARTIAL", "FAILED"].includes(coleta.status_coleta)) {
      throw new Error("O status da coleta é inválido.");
    }

    if (
      coleta.id_verificacao != null &&
      coleta.id_verificacao !== idVerificacao
    ) {
      throw new Error("A coleta não pertence à verificação que está sendo salva.");
    }

    const conteudo = typeof coleta.conteudo === "string"
      ? coleta.conteudo
      : null;
    const hashCalculado = calcularHashConteudo(conteudo);

    if (
      coleta.hash_conteudo &&
      hashCalculado &&
      coleta.hash_conteudo !== hashCalculado
    ) {
      throw new Error("O hash informado para a coleta não corresponde ao conteúdo.");
    }

    return {
      id: coleta.id_coleta,
      id_verificacao: idVerificacao,
      url_original: coleta.url_original,
      url_canonica: coleta.url_canonica,
      versao_canonicalizacao: coleta.versao_canonicalizacao,
      tipo_fonte: coleta.tipo_fonte,
      status_coleta: coleta.status_coleta,
      conteudo,
      hash_conteudo: coleta.hash_conteudo ?? hashCalculado,
      coletado_em: coleta.coletado_em,
      id_operacao_busca: coleta.id_operacao_busca ?? null,
      id_operacao_extracao: coleta.id_operacao_extracao ?? null,
      consulta: coleta.consulta ?? null,
      parametros_busca_json: coleta.parametros_busca == null
        ? null : JSON.stringify(coleta.parametros_busca),
      parametros_extracao_json: coleta.parametros_extracao == null
        ? null : JSON.stringify(coleta.parametros_extracao),
      metadados_json: coleta.metadados == null
        ? null : JSON.stringify(coleta.metadados)
    };
  }

  function inserirColeta(coleta) {
    banco.prepare(`
      INSERT INTO coletas (
        id, id_verificacao, url_original, url_canonica,
        versao_canonicalizacao, tipo_fonte, status_coleta,
        conteudo, hash_conteudo, coletado_em,
        id_operacao_busca, id_operacao_extracao, consulta,
        parametros_busca_json, parametros_extracao_json, metadados_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      coleta.id,
      coleta.id_verificacao,
      coleta.url_original,
      coleta.url_canonica,
      coleta.versao_canonicalizacao,
      coleta.tipo_fonte,
      coleta.status_coleta,
      coleta.conteudo,
      coleta.hash_conteudo,
      coleta.coletado_em,
      coleta.id_operacao_busca,
      coleta.id_operacao_extracao,
      coleta.consulta,
      coleta.parametros_busca_json,
      coleta.parametros_extracao_json,
      coleta.metadados_json
    );
  }

  function converterColeta(registro) {
    if (!registro.coleta_id) return null;

    return {
      id_coleta: registro.coleta_id,
      id_verificacao: registro.coleta_id_verificacao,
      url_original: registro.coleta_url_original,
      url_canonica: registro.coleta_url_canonica,
      versao_canonicalizacao: registro.coleta_versao_canonicalizacao,
      tipo_fonte: registro.coleta_tipo_fonte,
      status_coleta: registro.coleta_status_coleta,
      conteudo: registro.coleta_conteudo,
      hash_conteudo: registro.coleta_hash_conteudo,
      coletado_em: registro.coleta_coletado_em,
      id_operacao_busca: registro.coleta_id_operacao_busca,
      id_operacao_extracao: registro.coleta_id_operacao_extracao,
      consulta: registro.coleta_consulta,
      parametros_busca: registro.coleta_parametros_busca_json == null
        ? null : JSON.parse(registro.coleta_parametros_busca_json),
      parametros_extracao: registro.coleta_parametros_extracao_json == null
        ? null : JSON.parse(registro.coleta_parametros_extracao_json),
      metadados: registro.coleta_metadados_json == null
        ? null : JSON.parse(registro.coleta_metadados_json)
    };
  }

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

    // Retentativa idempotente (critério 5): repetir a gravação do MESMO
    // resultado devolve sucesso sem duplicar nada; reutilizar o mesmo ID com
    // conteúdo diferente é recusado, para nunca sobrescrever um histórico.
    const existente = banco
      .prepare("SELECT resultado_json FROM verificacoes WHERE id = ?")
      .get(idVerificacao);
    if (existente) {
      if (existente.resultado_json === JSON.stringify(resultadoCompleto)) {
        return idVerificacao;
      }
      throw new Error(
        `A verificação ${idVerificacao} já foi gravada com outro conteúdo; a gravação foi recusada para preservar o histórico.`
      );
    }

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
          atualidade_json,
          id_coleta
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const coletasInseridas = new Map();

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
          const coleta = prepararColeta(evidencia.coleta, idVerificacao);

          if (coleta) {
            const existente = coletasInseridas.get(coleta.id);

            if (existente) {
              if (existente !== coleta.id_verificacao) {
                throw new Error("O ID da coleta foi reutilizado em outra verificação.");
              }
            } else {
              inserirColeta(coleta);
              coletasInseridas.set(coleta.id, coleta.id_verificacao);
            }
          }

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
            JSON.stringify(evidencia.atualidade ?? null),
            coleta?.id ?? null
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
        e.atualidade_json,
        c.id AS coleta_id,
        c.id_verificacao AS coleta_id_verificacao,
        c.url_original AS coleta_url_original,
        c.url_canonica AS coleta_url_canonica,
        c.versao_canonicalizacao AS coleta_versao_canonicalizacao,
        c.tipo_fonte AS coleta_tipo_fonte,
        c.status_coleta AS coleta_status_coleta,
        c.conteudo AS coleta_conteudo,
        c.hash_conteudo AS coleta_hash_conteudo,
        c.coletado_em AS coleta_coletado_em,
        c.id_operacao_busca AS coleta_id_operacao_busca,
        c.id_operacao_extracao AS coleta_id_operacao_extracao,
        c.consulta AS coleta_consulta,
        c.parametros_busca_json AS coleta_parametros_busca_json,
        c.parametros_extracao_json AS coleta_parametros_extracao_json,
        c.metadados_json AS coleta_metadados_json
      FROM evidencias e
      INNER JOIN afirmacoes a
        ON a.id = e.afirmacao_id
      INNER JOIN verificacoes v
        ON v.id = a.verificacao_id
      LEFT JOIN coletas c
        ON c.id = e.id_coleta
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
      ),
      coleta: converterColeta(registro)
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
