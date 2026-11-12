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
const { criarBanco } = require("./src/banco");
const {
  TEXTO_EXEMPLO,
  DOMINIOS_OFICIAIS_EXEMPLO,
  criarVerificadorExemplo
} = require("./src/modo-exemplo");

const SO_EXEMPLO = process.argv.includes("--exemplo");
const PORTA = Number(process.env.PORT) || 3000;
const HOST = "127.0.0.1";
const LIMITE_CORPO_BYTES = 32 * 1024;
const LIMITE_TEXTO = 4000;
const MAX_AFIRMACOES = 6;
// O modo real lê 2 fontes por afirmação por padrão: cada fonte custa duas
// chamadas ao modelo, e o limite de uso do provedor domina a latência.
// Ajustável com ENTRELINHAS_MAX_FONTES (1 a 5).
const MAX_EVIDENCIAS_REAL = (() => {
  const valor = Number(process.env.ENTRELINHAS_MAX_FONTES);
  return Number.isInteger(valor) && valor >= 1 && valor <= 5 ? valor : 2;
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
  "/estilo.css": ["estilo.css", "text/css; charset=utf-8"]
};

const CABECALHOS_SEGURANCA = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store"
};

let ocupado = false;

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
        reject(Object.assign(new Error("Pedido grande demais."), { status: 413 }));
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
    throw erroDeEntrada(`Domínio inválido: ${String(valor).slice(0, 80)}`);
  }
  return dominio;
}

function validarPedido(dados) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    throw erroDeEntrada("Formato de pedido inválido.");
  }
  const texto = typeof dados.texto === "string" ? dados.texto.trim() : "";
  if (!texto) throw erroDeEntrada("Cole uma resposta de IA para verificar.");
  if (texto.length > LIMITE_TEXTO) {
    throw erroDeEntrada(`O texto passa de ${LIMITE_TEXTO} caracteres. Envie um trecho menor.`);
  }
  const modo = dados.modo === "real" ? "real" : "exemplo";
  const listaDominios = Array.isArray(dados.dominiosOficiais) ? dados.dominiosOficiais : [];
  if (listaDominios.length > MAX_DOMINIOS) {
    throw erroDeEntrada(`Informe no máximo ${MAX_DOMINIOS} domínios oficiais.`);
  }
  const dominiosOficiais = [...new Set(listaDominios.filter(d => String(d).trim()).map(validarDominio))];
  const tipo = dados.tipo && TIPOS.includes(dados.tipo) ? dados.tipo : null;
  return { texto, modo, dominiosOficiais, tipo };
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
  return copia;
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
      throw erroDeEntrada("O modo real não está disponível: configure TAVILY_API_KEY e BIFROST_KEY no .env e rode `npm run web`.");
    }

    // Carregado só no modo real, para não exigir credenciais no modo exemplo.
    const { verificarTexto } = require("./src/verificador");
    const tiposPorAfirmacao = pedido.tipo ? { afirmacao_1: pedido.tipo } : {};
    const resultado = await verificarTexto(pedido.texto, {
      ...opcoesComuns,
      dominiosOficiais: pedido.dominiosOficiais,
      tiposPorAfirmacao
    });
    return prepararParaNavegador(resultado, "real");
  } finally {
    banco.fechar();
  }
}

async function tratarVerificacao(req, res) {
  if (!String(req.headers["content-type"] ?? "").includes("application/json")) {
    return responderJson(res, 415, { erro: "Envie JSON." });
  }
  if (ocupado) {
    return responderJson(res, 429, { erro: "Já existe uma verificação em andamento. Aguarde ela terminar." });
  }
  ocupado = true;
  const inicio = Date.now();
  try {
    const corpo = await lerCorpo(req);
    let dados;
    try { dados = JSON.parse(corpo); } catch { throw erroDeEntrada("JSON inválido."); }
    const pedido = validarPedido(dados);
    const resultado = await executarVerificacao(pedido);
    resultado.duracao_ms = Date.now() - inicio;
    console.log(`[${new Date().toISOString()}] verificação ${pedido.modo}: ${resultado.total_afirmacoes} afirmação(ões) em ${resultado.duracao_ms} ms`);
    responderJson(res, 200, resultado);
  } catch (erro) {
    const status = erro.status ?? 502;
    // Mensagens internas podem citar o provedor; nunca contêm credenciais.
    console.error(`[${new Date().toISOString()}] falha (${status}): ${erro.message}`);
    responderJson(res, status, {
      erro: status === 502
        ? `A verificação falhou ao falar com um serviço externo: ${erro.message}`
        : erro.message
    });
  } finally {
    ocupado = false;
  }
}

function servirArquivo(res, nome, tipo) {
  const caminho = path.join(__dirname, "public", nome);
  fs.readFile(caminho, (erro, conteudo) => {
    if (erro) return responderJson(res, 404, { erro: "Arquivo não encontrado." });
    res.writeHead(200, { ...CABECALHOS_SEGURANCA, "Content-Type": tipo });
    res.end(conteudo);
  });
}

function criarServidor() {
  return http.createServer((req, res) => {
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
        limites: { caracteres: LIMITE_TEXTO, afirmacoes: MAX_AFIRMACOES, evidencias_por_afirmacao: MAX_EVIDENCIAS_REAL, dominios: MAX_DOMINIOS },
        tipos: TIPOS
      });
    }
    if (req.method === "POST" && url.pathname === "/api/verificar") {
      return tratarVerificacao(req, res);
    }
    responderJson(res, 404, { erro: "Rota não encontrada." });
  });
}

if (require.main === module) {
  criarServidor().listen(PORTA, HOST, () => {
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
