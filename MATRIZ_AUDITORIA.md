# Matriz de auditoria — 18 critérios temporais

**Data:** 12/11/2026 · **Auditoria:** Claude (sessão de continuidade) · **Base:** código atual + testes reexecutados hoje numa cópia isolada (sem `.db`, sem `.env`, sem rede para APIs).

**Como ler:** "reexecutado hoje" = rodei o teste e ele passou. A leitura linha a linha das asserções de cada teste foi feita na auditoria anterior (`RELATORIO_AUDITORIA_FINAL.md`); hoje não refiz essa leitura caso a caso, só a execução. Nenhum `.js`, banco ou backup foi alterado.

**Observação importante:** os critérios 1–18 cobrem o **módulo de comparação temporal** (`src/comparador-fontes.js`, `src/banco.js`, `src/tavily.js`). Esse módulo **não é chamado** pelo fluxo principal `verificarTexto()`/`demo.js`; ele funciona como operação separada.

| # | Critério | Status | Evidência (arquivo / teste / resultado hoje) |
|---|---|---|---|
| 1 | Uma aquisição suporta três evidências com o mesmo `id_coleta` | APROVADO | `teste-criterios-temporais.js` — exit 0 |
| 2 | Três URLs extraídas em uma chamada recebem IDs distintos | APROVADO | `teste-tavily-coletas-simulado.js` (no `npm test`) — "cada aquisição possui três id_coleta distintos" |
| 3 | Nova verificação ≠ nova versão de página | APROVADO (casos testados) | `teste-auditoria-temporal-criterios-7-10-12-13.js` — 13/13 |
| 4 | Evidências da mesma verificação nunca comparadas como evolução | APROVADO (casos testados) | idem — 13/13 |
| 5 | Retentativas da mesma aquisição não duplicam a coleta | **PARCIAL** | `teste-robustez-local.js` — não duplica, mas a 2ª tentativa **falha com erro** (chave única) em vez de responder sucesso idempotente. Falta decisão de produto. |
| 6 | Nova aquisição efetiva gera novo `id_coleta` | APROVADO | `teste-tavily-coletas-simulado.js` — "a segunda aquisição gerou IDs diferentes" |
| 7 | Extração × extração compatível pode ser comparada | APROVADO | auditoria temporal 13/13 |
| 8 | Snippet × snippet exige consulta/parâmetros compatíveis | APROVADO | `teste-compatibilidade-snippets.js` — 3/3 |
| 9 | Snippet × extração → `NOT_COMPARABLE` | APROVADO | `teste-snippet-vs-extracao.js` — exit 0 |
| 10 | Mudança em snippet não implica mudança na página | APROVADO (escopo limitado) | auditoria 13/13. Status ainda é o genérico `CHANGED`; a distinção está no método e na justificativa. |
| 11 | Datas ausentes/inválidas/sem ordem impedem comparação | APROVADO | `teste-datas-temporais.js`, `teste-nao-comparavel-sem-impacto.js` — exit 0 |
| 12 | URLs canônicas incompatíveis impedem comparação | APROVADO (após correção de 10/11) | auditoria 13/13 |
| 13 | Histórico legado sem IDs inventados | APROVADO | auditoria 13/13 |
| 14 | `NOT_COMPARABLE` não gera avaliação de impacto | APROVADO | `teste-nao-comparavel-sem-impacto.js`, `teste-snippet-vs-extracao.js` |
| 15 | Cada comparação registra versão do algoritmo | APROVADO (caminhos testados) | auditoria 13/13 (versão `1.2.0`) |
| 16 | Comparações válidas usam hash e LCS | APROVADO (caminhos testados) | auditoria 13/13; `teste-comparador-fontes.js` exit 0 |
| 17 | Igual → `UNCHANGED` só se a comparação é válida | APROVADO (casos testados) | auditoria 13/13 |
| 18 | Diferente → `CHANGED` só se a comparação é válida | APROVADO (casos testados) | auditoria 13/13 |

**Resumo:** 17 aprovados (vários "nos casos testados"), 1 parcial (critério 5), 0 reprovados.
