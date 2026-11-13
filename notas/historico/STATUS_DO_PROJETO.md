# Status do projeto — 12/11/2026

## Em uma frase
O Entrelinhas é um **backend em Node.js que funciona por linha de comando** (`demo.js`): recebe um texto, separa as afirmações, busca evidências na Tavily, usa um modelo via Bifrost para ler as fontes e devolve, por afirmação, veredito, fontes, datas e um **índice temporal 0–100** (ou "não determinável"). Não tem interface visual.

## Pronto e testado (offline)
- Decomposição em afirmações, busca/extração Tavily (incl. busca extra em domínios oficiais), correspondência e postura via Bifrost — código integrado em `src/verificador.js`.
- Avaliação de atualidade (`FRESH`/`STALE`/`UNVERIFIABLE`) e **freshness score por afirmação** (`src/freshness-score.js`, chamado pelo agregador e exibido no `demo.js`).
- Agregador ligado ao fluxo principal (vereditos `ATUAL`, `SUPORTE_FRACO`, `CONFLITO`, `NAO_VERIFICAVEL`…).
- Leitura de sinais de data da página (`src/sinais-temporais.js`) e detecção de fontes repetidas (`src/independencia-fontes.js`).
- Persistência SQLite com rastreabilidade; comparação temporal (critérios 1–18) como módulo separado.
- `npm test` verde; 23 de 26 testes avulsos seguros verdes.

## Feito, mas NÃO validado
- Fluxo real com o código atual (freshness score + agregador 1.2.0 + sinais de data). Última execução real foi antes dessas mudanças.
- 3 testes avulsos desatualizados (ver `RELATORIO_TESTES.md`).
- Pitch decks em `submission/` — dois têm "B4_T1" no nome, de uma estratégia já abandonada; conteúdo não revisado nesta sessão.

## Problemas de consistência na documentação
- `submission/FORM_COPY.md` e `submission/TRACK_ALIGNMENT.md` ainda dizem que **não existe freshness score** — isso ficou desatualizado (ele existe).
- `CONTEXTO_ENTRELINHAS.md` §3.1 ainda diz que é preciso participar das duas trilhas; a decisão mais recente (11/11) é **só** o desafio Stale-Answer Detector.
- README lista `src/` duas vezes na estrutura.

## Git
- Branch `main` igual a `origin/main` no último commit (`cb41829`, 11/11 09:10).
- **Muito trabalho não commitado**: 11 arquivos modificados e ~20 novos (freshness score, sinais temporais, independência de fontes, avaliação, docs, submission). O GitHub público **não tem** essas partes.

## Prazo
Documentos registram **15/11/2026 às 23h59 (fuso não confirmado)**. Não consegui confirmar na página oficial nesta sessão.

## Atualização — 12/11/2026 (tarde)
- **Interface web pronta**: `npm run web` (real) e `npm run web:exemplo` (sem chaves). Testada em navegador (desktop e celular) e por ``teste-servidor.js``.
- **Categorias automáticas**: afirmações recebem tipo pelo modelo ou por palavras-chave; antes, sem tipo manual, nunca havia índice temporal.
- **Testes**: `npm test` roda 41 arquivos offline — **41/41 passaram**. Os 3 testes desatualizados foram ajustados; mensagem do agregador para fonte sem data foi corrigida.
- **Documentação de submissão** (`FORM_COPY.md`, `TRACK_ALIGNMENT.md`, README, CONTEXTO §3.1) corrigida para o estado real.
- **Git**: backups, builds e decks ficaram fora pelo `.gitignore` (continuam no disco).
- **Pendente**: execução real com o código final; revisão dos pitch decks (remover B4); vídeo opcional.

## Atualização — 12/11/2026 (noite)
- Foco do produto: veracidade por concordância entre fontes diversas + atualidade (exigida pelo desafio) + português.
- Novo pipeline (notícias, fontes diversas, análise em lote, concordância, nuances do português) implementado e testado offline: **47/47**.
- Interface nova, toda em inglês, com exemplos em inglês e português.
- 18/18 critérios temporais aprovados (critério 5 resolvido).
- Pendente: execução real do novo pipeline; deck atualizado; push.
