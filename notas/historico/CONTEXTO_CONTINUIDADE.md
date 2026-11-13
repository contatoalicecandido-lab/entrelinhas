# Contexto de continuidade — leia primeiro

**Atualizado em 12/11/2026.** Documento curto de entrada. O histórico completo está em `CONTEXTO_ENTRELINHAS.md` (documento mestre, ~80 KB) e `RELATORIO_AUDITORIA_FINAL.md` (auditoria com adendos cronológicos de 10–11/11).

## Ordem de leitura
1. `STATUS_DO_PROJETO.md` — onde estamos.
2. `PLANO_DE_CONCLUSAO.md` — o que fazer agora.
3. `MATRIZ_AUDITORIA.md` e `RELATORIO_TESTES.md` — evidências.
4. `DECISOES_TECNICAS.md` — por que as coisas são assim.
5. `ESPECIFICACAO_FRESHNESS_SCORE.md` — contrato do índice temporal.

## Linha do tempo reconstruída
- 02–05/11: módulos base (afirmações, Tavily, Bifrost, evidência, correspondência, classificador, atualidade, comparador, impacto, benchmark).
- 07/11: primeiro commit estável. 08/11: README.
- 08–10/11: IDs de coleta, normalização, critérios temporais 1–18, migração do banco (com backups).
- 10/11: auditoria inicial; critério 12 falhou e foi corrigido.
- 11/11 manhã: agregador ligado ao fluxo, busca dupla oficial, Bifrost destravado (401 → 200), commit `cb41829` e push. Decks gerados.
- 11/11 tarde (**não commitado**): decisão de desafio único, freshness score, sinais de data da página, independência de fontes, avaliação rotulada, agregador 1.2.0 com escopo de data por atributo, `demo.js` exibindo índice.
- 12/11: esta auditoria (sem alterar código).

## Mapa do código (`src/`)
`verificador.js` (orquestra) → `afirmacoes.js` (decompõe via Bifrost) → `tavily.js` (busca/extração + `sinais-temporais.js`) → `preparar-evidencia.js` / `evidencia.js` → `correspondencia.js` + `classificador.js` (Bifrost) → `atualidade.js` → `agregador.js` (+ `freshness-score.js`, `independencia-fontes.js`) → `banco.js` (SQLite).
Separados do fluxo principal: `comparador-fontes.js`, `normalizar-fonte.js`, `avaliador-impacto.js`, `historico.js`.

## Regras de segurança que continuam valendo
Não abrir `dados/entrelinhas.db`; preservar backups; não ler `.env`; não chamar APIs reais, commitar ou publicar sem autorização; testar com `:memory:` e fetch simulado.

## 12/11 tarde
Categorias automáticas, `maxAfirmacoes`, interface web com modo exemplo, suíte única `npm test` (41/41), documentação de submissão corrigida, commit. Detalhes em `CONTEXTO_ENTRELINHAS.md` §34.
