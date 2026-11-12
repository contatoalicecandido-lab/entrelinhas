// Papel do Bifrost: cadeia de modelos reserva (fallbacks), leitura de quem
// respondeu, simulação de queda do modelo principal e resumo do gateway.
// fetch simulado; sem rede; sem banco.
const assert = require("node:assert/strict");
process.env.BIFROST_KEY = "chave-ficticia-para-teste";
delete process.env.BIFROST_MODEL;
delete process.env.BIFROST_FALLBACKS;
const { perguntarAoModelo, configuracaoModelos, determinarFallback, executarComContextoGateway, MODELO_QUEDA_SIMULADA } = require("./src/bifrost");

let n = 0;
const ok = nome => { n += 1; console.log(`PASSOU: ${nome}`); };

function respostaBifrost({ provider = "groq", model = "openai/gpt-oss-20b", isFallback = false, total = 321 } = {}) {
  return new Response(JSON.stringify({
    model,
    choices: [{ message: { content: "{\"ok\":true}" } }],
    usage: { prompt_tokens: 300, completion_tokens: 21, total_tokens: total },
    extra_fields: { routing_info: { provider, model, is_fallback: isFallback, primary_provider: "groq", primary_model: "openai/gpt-oss-20b" }, latency: 0.42 }
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function principal() {
  const fetchOriginal = global.fetch;
  try {
    // 1. Configuração padrão e por variável de ambiente.
    assert.deepEqual(configuracaoModelos(), { principal: "groq/openai/gpt-oss-20b", reservas: ["groq/openai/gpt-oss-120b", "groq/llama-3.3-70b-versatile"] });
    process.env.BIFROST_FALLBACKS = "none";
    assert.deepEqual(configuracaoModelos().reservas, []);
    process.env.BIFROST_MODEL = "groq/x"; process.env.BIFROST_FALLBACKS = "groq/y, groq/x ,groq/z";
    assert.deepEqual(configuracaoModelos(), { principal: "groq/x", reservas: ["groq/y", "groq/z"] });
    delete process.env.BIFROST_MODEL; delete process.env.BIFROST_FALLBACKS;
    ok("cadeia de modelos: padrão, desligável e configurável por ambiente");

    // 2. O pedido leva a cadeia de reservas; a resposta diz quem respondeu.
    let corpo = null; let cabecalhos = null; let meta = null;
    global.fetch = async (url, cfg) => { corpo = JSON.parse(cfg.body); cabecalhos = cfg.headers; return respostaBifrost(); };
    await perguntarAoModelo("pergunta", "instruções", { etapa: "ANALISE_EM_LOTE", onMetadata: m => { meta = m; } });
    assert.equal(corpo.model, "groq/openai/gpt-oss-20b");
    assert.deepEqual(corpo.fallbacks, ["groq/openai/gpt-oss-120b", "groq/llama-3.3-70b-versatile"]);
    assert.equal(cabecalhos["x-bf-dim-stage"], "ANALISE_EM_LOTE");
    assert.equal(meta.foi_fallback, false);
    assert.deepEqual(meta.servido_por, { provedor: "groq", modelo: "openai/gpt-oss-20b" });
    assert.deepEqual(meta.tokens, { entrada: 300, saida: 21, total: 321 });
    assert.equal(meta.latencia_total_s, 0.42);
    ok("pedido com fallbacks; resposta registra modelo, tokens e latência");

    // 3. Queda simulada: o principal vira um modelo inexistente e o reserva responde.
    global.fetch = async (url, cfg) => { corpo = JSON.parse(cfg.body); return respostaBifrost({ model: "openai/gpt-oss-120b", isFallback: true }); };
    await executarComContextoGateway({ simularQuedaPrincipal: true }, () =>
      perguntarAoModelo("pergunta", null, { onMetadata: m => { meta = m; } }));
    assert.equal(corpo.model, MODELO_QUEDA_SIMULADA);
    assert.equal(meta.queda_simulada, true);
    assert.equal(meta.foi_fallback, true);
    assert.deepEqual(meta.cadeia_modelos, [MODELO_QUEDA_SIMULADA, "groq/openai/gpt-oss-20b", "groq/openai/gpt-oss-120b", "groq/llama-3.3-70b-versatile"]);
    assert.deepEqual(corpo.fallbacks, ["groq/openai/gpt-oss-20b", "groq/openai/gpt-oss-120b", "groq/llama-3.3-70b-versatile"]);
    // Fora do contexto, nada é simulado.
    await perguntarAoModelo("pergunta", null, { onMetadata: m => { meta = m; } });
    assert.equal(corpo.model, "groq/openai/gpt-oss-20b");
    ok("queda simulada só dentro da verificação que pediu; Bifrost assume com o reserva");

    // 4. Detecção de fallback sem routing_info (cabeçalho ou comparação de modelos).
    assert.equal(determinarFallback({ indice: "1", modeloPedido: "groq/a" }), true);
    assert.equal(determinarFallback({ indice: "0", modeloPedido: "groq/a" }), false);
    assert.equal(determinarFallback({ modeloPedido: "groq/openai/gpt-oss-20b", provedorFinal: "groq", modeloFinal: "openai/gpt-oss-20b" }), false);
    assert.equal(determinarFallback({ modeloPedido: "groq/openai/gpt-oss-20b", provedorFinal: "groq", modeloFinal: "llama-3.3-70b-versatile" }), true);
    assert.equal(determinarFallback({ modeloPedido: "groq/a" }), null);
    ok("fallback detectado por routing_info, cabeçalho ou modelo que respondeu");
  } finally {
    global.fetch = fetchOriginal;
  }
  console.log(`\n${n} testes passaram.`);
}

principal().catch(erro => { console.error(erro); process.exit(1); });
