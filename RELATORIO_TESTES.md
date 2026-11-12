# Relatório de testes — 12/11/2026

## Ambiente
- Mac da Alice (Apple Silicon), testes executados numa **VM Linux do Claude** com Node.js v22.23.4.
- Executados numa **cópia** do projeto, sem `.git`, sem `.env` e **sem nenhum arquivo `.db`** (o banco original nem foi copiado).
- Variáveis `TAVILY_API_KEY` e `BIFROST_KEY` removidas do ambiente. Nenhuma chamada real a Tavily/Bifrost.
- Tipo: testes unitários e de integração **simulada** (fetch falso, SQLite `:memory:`).

## `npm test` — PASSOU (exit 0)
| Parte | Resultado |
|---|---|
| teste-atualidade | aprovado |
| teste-evidencia | aprovado |
| teste-preparar-evidencia | redução e fallback aprovados |
| teste-integracao-persistencia-comparador | 16 aprovados |
| teste-rastreabilidade-fluxo-controlado | aprovado |
| teste-freshness-score | 10/10 |
| teste-sinais-temporais | aprovado (rede simulada) |
| teste-independencia-fontes | aprovado |
| avaliacao/teste-trechos-paginas-publicas | 4/4 datas, 0 falsos ATTRIBUTE |
| teste-agregador | 16 aprovados |
| teste-limites-independencia-atualidade | 2 regressões passaram |
| teste-tavily-coletas-simulado | aprovado (4 fetch interceptados) |
| avaliacao/teste-avaliacao-rotulada-v1 | 13/13 casos sintéticos |

## Testes avulsos seguros — 23 passaram, 3 falharam
Passaram (exit 0, sem "FALHOU"): auditoria-temporal-criterios-7-10-12-13 (13/13), criterios-temporais, compatibilidade-snippets (3/3), snippet-vs-extracao, datas-temporais, nao-comparavel-sem-impacto, coletas, historico-fonte, comparador-fontes, contexto-comparador, integracao-comparador, regressao-normalizacao-comparador, normalizar-fonte, integracao-normalizacao, persistencia-comparacoes (12/12), avaliador-impacto, falsos-positivos-impacto, integracao-impacto, banco, rastreabilidade-bifrost, robustez-local, integracao-sintese-controlada, tavily-busca-oficial.

**Falharam (3):**
| Teste | Esperava | Obteve | Diagnóstico provável |
|---|---|---|---|
| teste-politica-agregacao-adversarial.js (caso 4/5) | `ATUAL` | `CONFLITO` | Teste escrito às 11:03 de 11/11; `src/agregador.js` mudou às 15:10 (data só conta se vinculada ao atributo). O teste não foi atualizado. |
| teste-selecao-fontes-oficiais.js | `ATUAL` | `SUPORTE_FRACO` | Mesma causa: fixture sem `escopo_data: ATTRIBUTE`. |
| teste-politica-fontes-e-datas.js (caso 2/3) | texto "data da consulta informa…" | novo texto do agregador | Mensagem do agregador foi reescrita depois do teste. |

As três parecem **testes desatualizados**, não bugs novos — o comportamento atual é mais conservador e coerente com a especificação. Mas isso é diagnóstico, não confirmação: precisa da decisão de atualizar os testes.

Esses três não estão no `npm test`, por isso o `npm test` continua verde.

## Não executados (risco de API real, custo ou banco original)
`index.js`, `demo.js`, `historico.js`, `teste-afirmacoes.js`, `teste-classificador.js`, `teste-correspondencia.js`, `teste-qualidade-afirmacoes.js`, `teste-integracao-verificador.js`, `teste-rastreabilidade-completa.js`, `teste-rastreabilidade-bifrost-real.js`, `teste-tavily-real.js`, `teste-integracao-fontes.js`, `teste-verificador.js` (sem banco injetado → usaria `dados/entrelinhas.db`), `teste-benchmark.js` (sobrescreve `dados/resultado-benchmark.json`), `avaliacao/validar-paginas-reais.js --live`.

## Integração real
Nenhuma nesta sessão. Últimos registros (do relatório anterior, 11/11): Tavily OK; Bifrost passou de 401 para 200 após troca de chave; uma execução ponta a ponta resultou `SUPORTE_FRACO`. **Depois** disso o agregador e o freshness score mudaram — o fluxo real com o código atual está **NÃO VERIFICADO**.

## Rodada 2 — 12/11/2026 (tarde)
Mesmo ambiente isolado (cópia sem `.db`/`.env`, chaves vazias).
- `npm test` → `rodar-testes.js`: **41/41 arquivos passaram** (39 anteriores + `teste-tipo-afirmacao.js` 14/14 + `teste-servidor.js` 12/12).
- Os 3 que falhavam passaram após ajuste: fixtures agora declaram `escopo_data: "ATTRIBUTE"` (política 1.2.0), e o agregador prioriza a mensagem de "sem data declarada" sobre "data não vinculada".
- Interface verificada em Chrome headless (1280 px e 390 px): sem erros de console; layout conferido por captura de tela.
- Testes manuais do servidor: rotas, 400/413/415/404, CSP, travessia de caminho bloqueada.
- Integração real: ainda **não executada** com o código final (depende do Bifrost rodando no Mac).

## Rodada 3 — execução real (12/11/2026, ~14h30, autorizada)
Pela interface web no Mac (`npm run web`, Bifrost local + Groq, Tavily real, SQLite `:memory:`), com domínios oficiais `nodejs.org, platform.openai.com`.
Texto: "Node.js 20 is the current Active LTS release. The OpenAI API offers the Chat Completions endpoint."
- Duração: **~307 s**. O log mostra ~14 esperas por limite de uso do provedor do modelo (Groq), com novas tentativas automáticas — todas concluídas.
- Afirmação 1 → categoria `versao_api` (detectada pelo modelo); 3 páginas oficiais nodejs.org (2 apoiam, 1 contradiz; datas de página 2023-04, 2023-10, 2026-01, escopo PAGE) → **CONFLITO**, índice `null`.
- Afirmação 2 → `versao_api` (modelo); 3 páginas platform.openai.com que apoiam, sem data → **SUPORTE_FRACO**, índice `null`.
- Conclusões: fluxo real íntegro (decomposição, categoria, busca dupla, extração, correspondência, postura, agregação). Duas limitações de produto ficaram evidentes: (a) com fontes reais, quase nenhuma data é vinculada ao atributo, então o índice tende a ser `null`; (b) a latência é dominada pelo limite de taxa do Groq.
- Falha encontrada e corrigida durante a espera: chamadas à Tavily sem tempo-limite (agora 45 s, com erro claro para resposta não-JSON). A tela de espera agora mostra o tempo decorrido e explica a demora.

