# Protocolo de avaliação rotulada — Entrelinhas v1

**Estado:** protocolo para coleta/anotação; nenhuma alegação de performance real ainda.

## Objetivo

Avaliar separadamente (A) se a evidência apoia ou contradiz a afirmação e (B) se há base suficiente para dizer que a informação continua válida no instante de referência. A ausência ou conflito de datas deve aparecer como rótulo observável, não ser descartado nem convertido em “falso”.

## Unidade e registro

Uma linha representa uma afirmação atômica + uma fonte específica + um instante de referência. Registrar:

- `case_id`, texto original, afirmação atômica e categoria (`preco`, `versao_api`, `regulamento`, `empresa` ou `outra`);
- entidade/variante exata (plano, SKU, moeda, região, versão, jurisdição e condições relevantes);
- URL canônica, título, domínio, tipo de fonte e relação de dependência/republicação conhecida;
- timestamp UTC de captura e cópia imutável do conteúdo ou trecho com hash; nunca usar data de captura como data de publicação;
- datas visíveis, metadados, cabeçalhos, changelog/API ou validade, cada qual com valor bruto, parser, proveniência e escopo;
- fonte primária/secundária, responsável editorial e contexto material (país, plano, prazo promocional, impostos, versão, período de vigência).

Não publicar cookies, tokens, dados pessoais ou conteúdo que a equipe não tenha direito de redistribuir. Guardar referência e hash se a cópia integral não puder ser armazenada.

## Rótulos independentes

1. `claim_posture`: `SUPPORTS`, `CONTRADICTS`, `INSUFFICIENT`, `IRRELEVANT`.
2. `temporal_state`: `FRESH`, `STALE`, `UNVERIFIABLE`, `MIXED`, com justificativa e política/janela aplicada.
3. `date_scope`: `ATTRIBUTE`, `DOCUMENT`, `PAGE`, `SEARCH_SNIPPET`, `UNKNOWN`.
4. `date_signal_type`: `EXPLICIT_ATTRIBUTE`, `VISIBLE_DOCUMENT_DATE`, `JSON_LD`, `OPEN_GRAPH`, `HTTP_LAST_MODIFIED`, `SITEMAP_LASTMOD`, `PROVIDER_ESTIMATE`, `CHANGELOG`, `API_VERSION_OR_TIMESTAMP`, `SNAPSHOT_ONLY`, `NONE`, `CONFLICTING`.
5. `source_dependency`: `INDEPENDENT`, `REPUBLICATION`, `SAME_PUBLISHER`, `UNKNOWN`.
6. `abstention_needed`: boolean + códigos (`NO_DATE`, `INVALID_DATE`, `FUTURE_DATE`, `DATE_ORDER_CONFLICT`, `ATTRIBUTE_SCOPE_UNPROVEN`, `SOURCE_CONFLICT`, `ENTITY_MISMATCH`, `INSUFFICIENT_CONTENT`).
7. `human_rationale`: explicação curta apontando o trecho e o vínculo lógico entre trecho e afirmação.

**`FRESH` significa somente que a evidência temporal elegível está dentro da política definida para a categoria e data de referência.** Não significa “verdadeiro” nem prova que o fato continuará verdadeiro. Em conflito de fontes, marcar `MIXED` e manter posturas individuais.

## Procedimento e controle de qualidade

- Dois anotadores humanos rotulam cada caso independentemente, sem ver a saída do sistema.
- Calcular concordância nominal para postura/escopo/abstenção e concordância ordinal ponderada para atualidade; publicar a matriz de desacordos.
- Um terceiro processo de adjudicação resolve conflitos; manter rótulos originais e rótulo adjudicado.
- Não usar resposta de LLM como ground truth. LLM pode sugerir rótulos para triagem, sempre ocultos dos anotadores e nunca contabilizados como referência final.
- Separar treino/desenvolvimento/teste por domínio, entidade e produto para evitar vazamento. Congelar URLs, conteúdo/hash, `as_of`, algoritmo, prompts, políticas e versão do dataset.

## Amostragem recomendada

Primeira avaliação operacional: 120 pares afirmação-fonte, 30 por categoria de volatilidade (`preco`, `versao_api`, `regulamento`, `empresa`), usando ao menos 20 domínios independentes. Estratificar cada categoria entre evidência com data ligada ao atributo, data apenas de página/documento, sem data, datas inválidas/futuras/conflitantes, contradição, republicação e mismatch de entidade. Incluir português brasileiro e fontes oficiais e independentes. Aumentar a amostra se uma classe tiver menos de 15 exemplos adjudicados; publicar o tamanho real por estrato em vez de ocultar desbalanceamento.

## Métricas a publicar

- Macro-F1 e matriz de confusão de `claim_posture` e `temporal_state`, por categoria e tipo de fonte.
- Precisão e recall de abstenção; cobertura (`não UNVERIFIABLE`) reportada ao lado para impedir incentivo a “chutar”.
- **Taxa de falso FRESH**: casos rotulados `STALE`/`UNVERIFIABLE` adjudicados como `FRESH`, separando especialmente `PAGE`/`UNKNOWN` promovidos a atributo.
- Acurácia da detecção de escopo de data e taxa de conflito de datas detectado.
- Resultado por dependência (independente/republicação/desconhecida) e classe de evidência.
- Score contínuo só recebe MAE/rank correlation quando anotadores concordarem numa escala ordinal documentada. Sem calibração probabilística, não publicar Brier/ECE nem chamar o valor de probabilidade.
- Contagem e exemplos de falhas críticas, cobertura, taxa de `null`, latência e custo; custo/latência nunca substituem qualidade.

## Modelo de linha JSONL

```json
{"case_id":"ex-0001","claim":"O plano X custa R$ 49,90 por mês no Brasil.","claim_type":"preco","entity":{"product":"X","region":"BR","currency":"BRL","conditions":"mensal"},"source":{"url":"https://example.invalid/oferta","captured_at":"2026-11-11T12:00:00Z","content_sha256":"...","quote":"..."},"dates":[{"raw":"...","normalized":"...","signal_type":"PROVIDER_ESTIMATE","scope":"PAGE"}],"labels":{"claim_posture":"SUPPORTS","temporal_state":"UNVERIFIABLE","date_scope":"PAGE","source_dependency":"UNKNOWN","abstention_needed":true,"reason_codes":["ATTRIBUTE_SCOPE_UNPROVEN"]},"annotators":["A","B"],"adjudication":"...","dataset_split":"test"}
```

O domínio `.invalid` e o hash são apenas marcadores de modelo. Não contam como uma observação real.
