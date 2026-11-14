// Interface web local do Entrelinhas.
//
//   npm run web            -> modo real (Tavily + Bifrost) se as chaves existirem
//   npm run web:exemplo    -> só o modo exemplo (sem chaves, sem custo)
//
// Segurança: escuta apenas em 127.0.0.1, aceita uma verificação por vez,
// limita tamanho do texto e do corpo, usa SQLite :memory: (nunca grava em
// dados/entrelinhas.db) e nunca devolve credenciais ao navegador.
require("dotenv").config({ quiet: true });

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { executarComPrazo } = require("./src/prazo");
const { criarBanco } = require("./src/banco");
const {
  TEXTO_EXEMPLO,
  DOMINIOS_OFICIAIS_EXEMPLO,
  criarVerificadorExemplo,
  listarExemplos
} = require("./src/modo-exemplo");

const SO_EXEMPLO = process.argv.includes("--exemplo");
const PORTA = Number(process.env.PORT) || 3000;
const HOST = "127.0.0.1";
const LIMITE_CORPO_BYTES = 32 * 1024;
const LIMITE_TEXTO = 4000;
const MAX_AFIRMACOES = 6;
// O modo real lê até 5 fontes diversas por afirmação (oficial, notícia,
// referência, outros sites, blogs) e as analisa numa única chamada ao modelo
// por afirmação. Ajustável com ENTRELINHAS_MAX_FONTES (1 a 6).
const MAX_EVIDENCIAS_REAL = (() => {
  const valor = Number(process.env.ENTRELINHAS_MAX_FONTES);
  return Number.isInteger(valor) && valor >= 1 && valor <= 6 ? valor : 5;
})();
const MAX_EVIDENCIAS_EXEMPLO = 3;
const MAX_DOMINIOS = 5;
const TIPOS = ["preco", "versao_api", "regulamento", "empresa"];

const chavesConfiguradas = Boolean(process.env.TAVILY_API_KEY) && Boolean(process.env.BIFROST_KEY);
const modoRealDisponivel = !SO_EXEMPLO && chavesConfiguradas;

const ARQUIVOS_PUBLICOS = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/estilo.css": ["estilo.css", "text/css; charset=utf-8"],
  "/fonts/Geist-Variable.woff2": ["fonts/Geist-Variable.woff2", "font/woff2"],
  "/fonts/GeistMono-Variable.woff2": ["fonts/GeistMono-Variable.woff2", "font/woff2"],
  "/fonts/instrument-serif-latin-400-italic.woff2": ["fonts/instrument-serif-latin-400-italic.woff2", "font/woff2"],
  "/fonts/instrument-serif-latin-400-normal.woff2": ["fonts/instrument-serif-latin-400-normal.woff2", "font/woff2"],
  "/logos/bifrost.png": ["logos/bifrost.png", "image/png"]
};

const CABECALHOS_SEGURANCA = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store"
};

let ocupado = false;
const TEMPO_MAXIMO_VERIFICACAO_MS = Number(process.env.ENTRELINHAS_TEMPO_MAXIMO_MS) > 0
  ? Number(process.env.ENTRELINHAS_TEMPO_MAXIMO_MS) : 240000;

function responderJson(res, status, corpo) {
  res.writeHead(status, { ...CABECALHOS_SEGURANCA, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    let excedeu = false;
    const partes = [];
    req.on("data", parte => {
      tamanho += parte.length;
      if (tamanho > LIMITE_CORPO_BYTES) {
        // Continua lendo (e descartando) para conseguir responder 413.
        excedeu = true;
        partes.length = 0;
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => {
      if (excedeu) {
        reject(Object.assign(new Error("Request too large."), { status: 413 }));
        return;
      }
      resolve(Buffer.concat(partes).toString("utf8"));
    });
    req.on("error", reject);
  });
}

function erroDeEntrada(mensagem) {
  return Object.assign(new Error(mensagem), { status: 400 });
}

function validarDominio(valor) {
  const dominio = String(valor).trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(dominio)) {
    throw erroDeEntrada(`Invalid domain: ${String(valor).slice(0, 80)}`);
  }
  return dominio;
}

function validarPedido(dados) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw erroDeEntrada("Invalid request format.");
  }
  const texto = typeof dados.texto === "string" ? dados.texto.trim() : "";
  if (!texto) throw erroDeEntrada("Paste an AI answer to check.");
  if (texto.length > LIMITE_TEXTO) {
    throw erroDeEntrada(`The text is longer than ${LIMITE_TEXTO} characters. Send a shorter part.`);
  }
  const modo = dados.modo === "real" ? "real" : "exemplo";
  const listaDominios = Array.isArray(dados.dominiosOficiais) ? dados.dominiosOficiais : [];
  if (listaDominios.length > MAX_DOMINIOS) {
    throw erroDeEntrada(`Use at most ${MAX_DOMINIOS} trusted sites.`);
  }
  const dominiosOficiais = [...new Set(listaDominios.filter(d => String(d).trim()).map(validarDominio))];
  const tipo = dados.tipo && TIPOS.includes(dados.tipo) ? dados.tipo : null;
  // Demonstração de failover do Bifrost: só faz sentido no modo real.
  const simularQuedaModelo = modo === "real" && dados.simularQuedaModelo === true;
  return { texto, modo, dominiosOficiais, tipo, simularQuedaModelo };
}

// Reduz o tamanho da resposta enviada ao navegador. A verificação completa,
// com todo o conteúdo coletado, continua no resultado salvo no SQLite.
function prepararParaNavegador(resultado, modo) {
  const copia = structuredClone(resultado);
  for (const afirmacao of copia.afirmacoes ?? []) {
    for (const evidencia of afirmacao.evidencias ?? []) {
      const conteudo = evidencia?.fonte?.conteudo;
      if (typeof conteudo === "string" && conteudo.length > 700) {
        evidencia.fonte.conteudo = `${conteudo.slice(0, 700)}…`;
      }
      // Textos completos (coleta e normalização) ficam só no SQLite: uma única
      // página extraída pode ter vários MB e a interface não os exibe.
      if (evidencia?.fonte?.normalizacao) delete evidencia.fonte.normalizacao;
      if (evidencia?.coleta && typeof evidencia.coleta === "object") {
        delete evidencia.coleta.conteudo;
      }
    }
  }
  copia.modo = modo;
  copia.simulado = modo === "exemplo";
  copia.gateway = resumirGateway(copia.rastreabilidade_modelo ?? [], modo);
  return copia;
}

// Resumo do papel do Bifrost nesta verificação: quantas chamadas, quais
// modelos responderam, quantas vezes um modelo reserva assumiu, tokens.
function resumirGateway(chamadas, modo) {
  const servidos = new Map();
  let tokens = 0; let comTokens = false; let reservas = 0; let falhas = 0; let latencia = 0; let comLatencia = 0;
  for (const c of chamadas) {
    if (c.status !== "SUCESSO") {
      if (/^(ERRO|TIMEOUT|RESPOSTA_INVALIDA)/.test(String(c.status))) falhas += 1;
      continue;
    }
    const modelo = c.servido_por?.modelo
      ? `${c.servido_por.provedor ? `${c.servido_por.provedor}/` : ""}${c.servido_por.modelo}`.replace(/^([^/]+)\/\1\//, "$1/")
      : (c.modelo_resolvido ?? c.modelo_solicitado ?? "unknown");
    servidos.set(modelo, (servidos.get(modelo) ?? 0) + 1);
    if (c.foi_fallback === true) reservas += 1;
    if (Number.isFinite(c.tokens?.total)) { tokens += c.tokens.total; comTokens = true; }
    if (Number.isFinite(c.latencia_upstream_ms)) { latencia += c.latencia_upstream_ms; comLatencia += 1; }
  }
  const primeira = chamadas[0] ?? {};
  return {
    gateway: modo === "exemplo" ? "simulated" : "bifrost",
    chamadas: chamadas.length,
    falhas,
    cadeia_modelos: primeira.cadeia_modelos ?? [],
    queda_simulada: chamadas.some(c => c.queda_simulada === true),
    respostas_por_modelo: [...servidos].map(([modelo, n]) => ({ modelo, chamadas: n })),
    respostas_de_reserva: reservas,
    tokens_total: comTokens ? tokens : null,
    latencia_media_ms: comLatencia ? Math.round(latencia / comLatencia) : null
  };
}

async function executarVerificacao(pedido) {
  const banco = criarBanco({ caminho: ":memory:" });
  try {
    const opcoesComuns = {
      banco,
      maxEvidencias: pedido.modo === "exemplo" ? MAX_EVIDENCIAS_EXEMPLO : MAX_EVIDENCIAS_REAL,
      maxAfirmacoes: MAX_AFIRMACOES
    };

    if (pedido.modo === "exemplo") {
      const verificarExemplo = criarVerificadorExemplo();
      return prepararParaNavegador(await verificarExemplo(pedido.texto, opcoesComuns), "exemplo");
    }

    if (!modoRealDisponivel) {
      throw erroDeEntrada("Live checks are not available: set TAVILY_API_KEY and BIFROST_KEY in .env and run `npm run web`.");
    }

    // Carregado só no modo real, para não exigir credenciais no modo exemplo.
    const { verificarTexto } = require("./src/verificador");
    const tiposPorAfirmacao = pedido.tipo ? { afirmacao_1: pedido.tipo } : {};
    const { executarComContextoGateway } = require("./src/bifrost");
    const resultado = await executarComContextoGateway({ simularQuedaPrincipal: pedido.simularQuedaModelo }, () => verificarTexto(pedido.texto, {
      ...opcoesComuns,
      dominiosOficiais: pedido.dominiosOficiais,
      tiposPorAfirmacao,
      analiseEmLote: true,
      incluirNoticias: true,
      fontesDiversas: true,
      paisAutomatico: true,
      cienciaAutomatica: true,
      respostaCorrigida: true
    }));
    return prepararParaNavegador(resultado, "real");
  } finally {
    banco.fechar();
  }
}

// Gravações de checagens reais, para a demonstração pública (docs/), que as
// reproduz sem chaves. Só com ENTRELINHAS_GRAVAR=1. Nada de credenciais vai
// para o arquivo; identificadores de organização do provedor são removidos.
function gravarVerificacao(resultado) {
  try {
    const pasta = path.join(__dirname, "gravacoes");
    fs.mkdirSync(pasta, { recursive: true });
    const slug = String(resultado.texto_original ?? "verificacao")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    const nome = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug}.json`;
    const texto = JSON.stringify({ ...resultado, gravado_em: new Date().toISOString() }, null, 1)
      .replace(/org_[A-Za-z0-9]+/g, "org_<redacted>");
    fs.writeFileSync(path.join(pasta, nome), texto);
    console.log(`[gravação] ${nome}`);
  } catch (erro) {
    console.warn("Não foi possível gravar a verificação:", erro.message);
  }
}

// Mensagem de erro para o navegador: curta, em inglês, sem o corpo bruto do
// provedor (que pode trazer identificadores da conta). O detalhe fica no log.
function mensagemPublica(erro, status) {
  const texto = String(erro?.message ?? "");
  if (status !== 502) return texto;
  if (/429|rate.?limit|limite/i.test(texto)) {
    const espera = /try again in ([\dhms.]+)/i.exec(texto)?.[1];
    return `The AI model hit its usage limit (rate limit).${espera ? ` Try again in ${espera}.` : " Try again in a few minutes."}`;
  }
  return "An external service (search or AI model) failed. Details are in the server log; try again in a few minutes.";
}

async function tratarVerificacao(req, res) {
  // Só JSON de verdade: "text/plain; charset=application/json" passaria num
  // includes() e é o tipo que um site malicioso consegue mandar sem licença.
  const tipoMidia = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (tipoMidia !== "application/json") {
    return responderJson(res, 415, { erro: "Send JSON (Content-Type: application/json)." });
  }
  if (ocupado) {
    return responderJson(res, 429, { erro: "A check is already running. Wait for it to finish." });
  }
  // Lê o pedido ANTES de ocupar o servidor: um pedido que nunca termina de
  // chegar não trava as checagens de ninguém (o servidor corta em 15 s).
  let corpo;
  try {
    corpo = await lerCorpo(req);
  } catch (erro) {
    return responderJson(res, erro.status ?? 400, { erro: erro.message });
  }
  if (ocupado) {
    return responderJson(res, 429, { erro: "A check is already running. Wait for it to finish." });
  }
  ocupado = true;
  let trabalho = null;
  const inicio = Date.now();
  try {
    let dados;
    try { dados = JSON.parse(corpo); } catch { throw erroDeEntrada("Invalid JSON."); }
    const pedido = validarPedido(dados);
    // Tempo máximo de uma verificação inteira: se algo travar lá dentro
    // (rede, provedor), o pedido falha com aviso e o servidor fica livre.
    let temporizador;
    const limite = new Promise((_, rejeitar) => {
      temporizador = setTimeout(() => rejeitar(Object.assign(
        new Error(`The check took longer than ${Math.round(TEMPO_MAXIMO_VERIFICACAO_MS / 1000)} s and was stopped. The providers may be at their usage limit (rate limit); try again in a few minutes.`),
        { status: 504 })), TEMPO_MAXIMO_VERIFICACAO_MS);
    });
    // "ocupado" só volta a falso quando a checagem termina de fato, mesmo
    // depois do tempo limite: assim duas checagens nunca rodam juntas.
    // A checagem recebe um prazo um pouco menor que o limite: quando ele
    // acaba, as chamadas externas em andamento são canceladas, então a
    // checagem termina de verdade e o servidor fica livre logo depois.
    trabalho = executarComPrazo(Math.max(1000, TEMPO_MAXIMO_VERIFICACAO_MS - 3000), () => executarVerificacao(pedido));
    trabalho.catch(() => {}).finally(() => { ocupado = false; });
    const resultado = await Promise.race([trabalho, limite]).finally(() => clearTimeout(temporizador));
    resultado.duracao_ms = Date.now() - inicio;
    if (pedido.modo === "real" && process.env.ENTRELINHAS_GRAVAR === "1") gravarVerificacao(resultado);
    console.log(`[${new Date().toISOString()}] verificação ${pedido.modo}: ${resultado.total_afirmacoes} afirmação(ões) em ${resultado.duracao_ms} ms`);
    responderJson(res, 200, resultado);
  } catch (erro) {
    const status = erro.status ?? 502;
    // Mensagens internas podem citar o provedor; nunca contêm credenciais.
    console.error(`[${new Date().toISOString()}] falha (${status}): ${erro.message}`);
    responderJson(res, status, { erro: mensagemPublica(erro, status) });
  } finally {
    if (!trabalho) ocupado = false;
  }
}

function servirArquivo(res, nome, tipo) {
  const caminho = path.join(__dirname, "public", nome);
  fs.readFile(caminho, (erro, conteudo) => {
    if (erro) return responderJson(res, 404, { erro: "File not found." });
    res.writeHead(200, { ...CABECALHOS_SEGURANCA, "Content-Type": tipo });
    res.end(conteudo);
  });
}

function criarServidor() {
  const servidor = http.createServer((req, res) => {
    // Só aceita pedidos endereçados a este computador (contra DNS rebinding)
    // e, quando o navegador informa a origem, só da própria página (contra
    // um site qualquer disparar checagens e gastar os créditos de quem roda).
    const porta = req.socket?.localPort ?? PORTA;
    const hostsValidos = new Set([`127.0.0.1:${porta}`, `localhost:${porta}`]);
    if (!hostsValidos.has(String(req.headers.host ?? "").toLowerCase())) {
      return responderJson(res, 421, { erro: "This server only answers requests for 127.0.0.1 or localhost." });
    }
    // GET e HEAD só leem a página (o botão de favoritos abre a página vindo de
    // outro site, e isso precisa funcionar); pedidos que fazem algo, não.
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origem = req.headers.origin;
      if (origem && !hostsValidos.has(origem.replace(/^https?:\/\//, "").toLowerCase())) {
        return responderJson(res, 403, { erro: "Requests from other sites are not allowed." });
      }
      if (["cross-site", "same-site"].includes(String(req.headers["sec-fetch-site"] ?? ""))) {
        return responderJson(res, 403, { erro: "Requests from other sites are not allowed." });
      }
    }
    const url = new URL(req.url, `http://${HOST}`);
    const leitura = req.method === "GET" || req.method === "HEAD";
    if (leitura && ARQUIVOS_PUBLICOS[url.pathname]) {
      const [nome, tipo] = ARQUIVOS_PUBLICOS[url.pathname];
      return servirArquivo(res, nome, tipo);
    }
    if (leitura && url.pathname === "/api/status") {
      return responderJson(res, 200, {
        modo_real_disponivel: modoRealDisponivel,
        texto_exemplo: TEXTO_EXEMPLO,
        dominios_exemplo: DOMINIOS_OFICIAIS_EXEMPLO,
        exemplos: listarExemplos(),
        limites: { caracteres: LIMITE_TEXTO, afirmacoes: MAX_AFIRMACOES, evidencias_por_afirmacao: MAX_EVIDENCIAS_REAL, dominios: MAX_DOMINIOS },
        tipos: TIPOS,
        // Só nomes de modelos (nunca chaves): mostra a cadeia de failover.
        bifrost: (() => { try { return require("./src/bifrost").configuracaoModelos(); } catch { return null; } })()
      });
    }
    if (req.method === "POST" && url.pathname === "/api/verificar") {
      return tratarVerificacao(req, res);
    }
    responderJson(res, 404, { erro: "Not found." });
  });
  // Pedido que demora para chegar (cabeçalhos ou corpo) é cortado.
  servidor.headersTimeout = 15000;
  servidor.requestTimeout = 15000;
  return servidor;
}

if (require.main === module) {
  const servidor = criarServidor();
  servidor.on("error", erro => {
    if (erro.code === "EADDRINUSE") {
      console.error(`A porta ${PORTA} já está em uso (provavelmente outro Entrelinhas aberto).`);
      console.error(`Feche a outra janela ou use outra porta: PORT=${PORTA + 1} npm run web`);
      process.exit(1);
    }
    throw erro;
  });
  servidor.listen(PORTA, HOST, () => {
    console.log(`Entrelinhas rodando em http://localhost:${PORTA}`);
    console.log(modoRealDisponivel
      ? "Modo real disponível (Tavily + Bifrost). O modo exemplo também pode ser usado."
      : SO_EXEMPLO
        ? "Somente modo exemplo (dados simulados, sem custo)."
        : "Chaves não encontradas no .env: somente modo exemplo (dados simulados, sem custo).");
    console.log("Nada é gravado em dados/entrelinhas.db; cada verificação usa SQLite em memória.");
  });
}

module.exports = { criarServidor, validarPedido };
