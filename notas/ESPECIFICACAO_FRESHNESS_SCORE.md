# Especificação: atualidade por afirmação para o desafio Stale-Answer Detector

**Estado:** protótipo implementado parcialmente em 11/11/2026; regra e score determinísticos, extração best-effort de sinais temporais e avaliação sintética. Não calibrado nem validado em amostra representativa de páginas reais.  
**Problem Statement selecionado:** Build a Stale-Answer Detector for AI Applications.  
**Princípio:** o score representa atualidade temporal da evidência para uma afirmação. Não estima probabilidade de verdade, qualidade global da fonte ou correção factual.

## 1. Requisito e lacuna atual

O desafio pede identificar alegações possivelmente obsoletas em respostas de LLM, revalidá-las em fontes web atuais e dar um freshness score a cada alegação. O protótipo já tem o score em `src/freshness-score.js`, integrado ao resultado do agregador, extração best-effort de sinais HTTP/HTML e avaliação sintética. Ainda não há calibração empírica nem validação end-to-end recente com ambas as APIs. `score_qualidade_evidencia` continua sendo uma métrica separada.

`src/atualidade.js` avalia uma evidência isolada por data declarada e janela por categoria. `src/agregador.js` produz `score_qualidade_evidencia` a partir dos grupos de fontes. Esse score mede qualidade de evidência e não deve ser reutilizado como freshness. A regressão `teste-limites-independencia-atualidade.js` agora exige que uma data recente da página não torne atual um preço sem prova de que o atributo preço mudou ou foi revisado.

### Sinais temporais que o sistema realmente tem

- Tavily Search pode retornar `published_date`; a documentação atual descreve-o como melhor estimativa da Tavily para quando a fonte foi publicada **ou atualizada**, podendo ser posterior à publicação original; sem data detectável, retorna `null`. O recurso é indicado como beta. O Entrelinhas preserva valor original e normalizado, origem `TAVILY_SEARCH_RESULT` e escopo `PAGE`.
- Tavily Extract retorna URL, `raw_content`, imagens opcionais e metadados da requisição; o contrato consultado não fornece um campo independente de data do atributo. Não inferir que a extração bem-sucedida ou a data da busca atualizou o conteúdo.
- RFC 9110 define `Last-Modified` como a data em que o servidor de origem acredita que a representação selecionada foi modificada; a própria norma observa que a representação pode ser composta por várias partes. O módulo agora captura o cabeçalho como sinal `PAGE`; ele não prova automaticamente atualização semântica de preço ou versão.
- `datePublished` e `dateModified` do Schema.org são metadados de `CreativeWork`; também descrevem o trabalho/documento. Só um trecho/documento explicitamente ligado ao atributo pode ser classificado como `ATTRIBUTE`.
- Para preços, `Offer.price`, `priceCurrency`, `seller`, identidade do `Product`/plano, país/região/condições e `priceValidUntil` em Schema.org podem fornecer sinais mais diretamente ligados à oferta. `priceValidUntil` indica quando a oferta deixa de estar disponível, não quando o preço foi atualizado; conferir a URL oficial, o valor atual e as condições continua necessário.
- `src/sinais-temporais.js` coleta `Last-Modified`, Open Graph article dates, Schema.org meta/JSON-LD (`datePublished`, `dateModified`, `dateCreated`, `priceValidUntil`), `<time datetime>`, canonical URL e datas visíveis. Rótulos genéricos como “Last Updated”/“Atualizado em” ficam `PAGE`; “preços consultados em” fica `OBSERVATION`; uma data explícita de mudança ligada ao atributo fica `ATTRIBUTE`. Datas de página/documento/oferta/observação não são promovidas automaticamente a atualização de preço. Datas conflitantes ou sem vínculo não entram no score.
- Para até três URLs selecionadas, o módulo faz um GET HTTPS de melhor esforço com DNS IPv4 público validado e fixado à conexão, redirects manuais revalidados, timeout de 5 s e limite de 1 MiB. Falha, não HTML, protocolo/host/porta inseguros ou ausência de data não invalidam evidência factual: apenas deixam atualidade sem prova. O fetch e DNS são injetáveis e os testes usam simuladores; testes não fazem chamadas de rede.
- `priceValidUntil` é uma data de validade da oferta, não de alteração do preço. O sinal é preservado como `OFFER`, mas ainda não é usado para declarar atualidade/freshness; falta uma regra que confirme identidade da oferta, moeda, região, condições e preço observado antes de aplicar expiração.
- Uma avaliação preliminar em quatro páginas públicas tem rótulos humanos registrados em `avaliacao/rotulos-paginas-reais-v1.json`. Trechos visíveis fixos capturaram 4/4 datas anotadas sem produzir sinal `ATTRIBUTE`, mas não testam HTML original. A execução ao vivo confirmada pelo usuário capturou todas as 3 datas anotadas em fontes acessíveis (Nio 1/1; Calculadoria 2/2), com 0 falsos `ATTRIBUTE` em três fontes; a NASA ficou indisponível por `NO_PUBLIC_IPV4`. A anotação da Calculadoria foi corrigida para classificar 06/11 como `OBSERVATION`, e o relatório ao vivo agora separa fonte indisponível de falha de captura. Amostra pequena, sem poder estimar precisão/recall geral.
- A análise do output real identificou e removeu um sinal `UNKNOWN` redundante: o título “Contratação e troca de plano” fazia a data genérica “Atualizado em” parecer candidata a data do plano. O parser agora exige um atributo específico na associação. Entradas JSON-LD duplicadas idênticas também são consolidadas. `npm test` passou após os ajustes; a coleta ao vivo precisa ser repetida para confirmar o output final.
- Sinais futuros incluem sitemap `<lastmod>`, changelog/release notes, API oficial, feed RSS/Atom e snapshots do próprio projeto. Snapshot/diff informa que conteúdo observado mudou, não qual mudança está correta.

Referências primárias: [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search), [Tavily Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract), [RFC 9110 §8.8.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2), [Schema.org CreativeWork](https://schema.org/CreativeWork), [Schema.org Offer](https://schema.org/Offer), [Schema.org priceValidUntil](https://schema.org/priceValidUntil), [Open Graph Protocol](https://ogp.me/), [Google Search Central: sitemap lastmod](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). Comparáveis e repositórios públicos são analisados em [PESQUISA_REFERENCIAS.md](PESQUISA_REFERENCIAS.md).

## 2. Unidade de avaliação e contrato de saída

A unidade é a afirmação atômica já produzida pelo verificador, não o texto inteiro nem uma página-fonte. Cada resultado recebe um objeto separado:

```json
{
  "freshness": {
    "score": 72,
    "status": "MIXED",
    "confidence": "LIMITED",
    "as_of": "2026-11-11T12:00:00.000Z",
    "policy_id": "freshness-v1",
    "claim_type": "preco",
    "evidence_summary": {
      "eligible": 2,
      "fresh": 1,
      "stale": 1,
      "undated": 1,
      "conflicting": true
    },
    "drivers": [
      { "code": "ATTRIBUTE_DATE_UNCONFIRMED", "evidence_id": "..." },
      { "code": "RECENT_SUPPORTING_EVIDENCE", "evidence_id": "..." }
    ],
    "limitations": ["A data de atualização é da página, não do campo de preço."]
  }
}
```

O contrato separa quatro eixos que não podem ser colapsados:

| Eixo | O que responde | Exemplo |
|---|---|---|
| Veredito/postura | A evidência apoia, contradiz ou não determina a afirmação? | `SUPPORTS`, `CONTRADICTS`, `UNKNOWN` |
| Atualidade | A evidência é temporalmente recente segundo uma política explícita? | `FRESH`, `STALE`, `UNVERIFIABLE` |
| Freshness score | Qual o sinal numérico de atualidade para esta afirmação? | 0–100 ou `null` |
| Qualidade da evidência | Quão adequada é a base de fontes segundo o agregador existente? | `score_qualidade_evidencia` |

Não derivar freshness apenas do veredito factual, relevância Tavily, autoridade do domínio, número de fontes ou data de coleta.

## 3. Semântica do score

O score é um **índice ordinal operacional** entre 0 e 100, calculado deterministicamente a partir de evidências elegíveis, datas, postura e vínculo com a afirmação. Não é uma probabilidade nem uma garantia de validade. `null` significa “não há base temporal suficiente para pontuar”; não deve ser convertido para zero nem para 50.

Faixas iniciais para apresentação, a calibrar em avaliação:

| Intervalo | Rótulo de interface | Interpretação restrita |
|---:|---|---|
| 80–100 | Sinal temporal recente | Evidência relevante e recente segundo a política e datas observadas |
| 50–79 | Sinal temporal misto | Há evidência recente, mas também conflito, idade maior ou limitações |
| 0–49 | Sinal temporal fraco | Evidência relevante predominantemente antiga para a categoria |
| sem score | Não determinável | Datas, vínculo temporal ou evidência elegível insuficientes |

No MVP, status continua autoritativo e categórico. O número complementa a explicação; não substitui `FRESH`/`STALE`/`UNVERIFIABLE` nem decide sozinho o veredito.

## 4. Elegibilidade antes de pontuar

Uma evidência só participa do score quando:

1. passou validação estrutural (`validarEvidencia`);
2. a correspondência com a afirmação é `MATCH`;
3. a postura é conhecida (`SUPPORTS` ou `CONTRADICTS`); evidência `UNKNOWN` permanece visível, mas não recebe peso direcional;
4. a origem é identificada e a consulta/extract é rastreável;
5. datas declaradas são válidas e não contraditórias; data futura, inválida ou atualização anterior à publicação não recebe atualidade presumida;
6. snippet e extração da mesma URL são tratados como uma família de evidência, sem contagem duplicada como confirmação independente.

Evidência sem data pode ajudar a explicar suporte/conflito factual, mas não pode elevar o freshness score. Data de coleta só informa quando o sistema observou o conteúdo.

## 5. Cálculo proposto — versão 1

### 5.1 Idade e janela

Para evidência `i`, escolher a data confiável disponível segundo regra explícita: `data_atualizacao` verificada, senão `data_publicacao`. Seja `age_i` a idade não negativa em dias até `as_of`, e `H_c` a janela de validade da categoria `c` já existente em `VALIDADE_MAX_DIAS`.

Calcular decaimento contínuo com meia-vida ligada à janela:

```text
temporal_i = 100 * 2 ^ (- age_i / (H_c / 2))
```

O uso de meia-vida evita o salto brusco do modelo atual no limite `H_c`. `FRESH`/`STALE` continua usando a regra categórica atual até avaliação e decisão separadas; o novo número não muda limites sem calibração.

### 5.2 Pesos de evidência e independência

Não somar URLs como se fossem observações independentes. Primeiro agrupar por origem editorial/domínio canônico e por família de aquisição (snippet/extract da mesma URL). Para cada grupo `g`, consolidar `temporal_g` pela melhor data verificável, mantendo flags de conflito e datas divergentes. Fontes sindicais, republicações e domínios relacionados não devem ganhar peso multiplicado; quando não houver detector de dependência confiável, registrar a limitação em vez de alegar independência.

Peso direcional candidato para evidência elegível:

```text
w_i = match_strength_i * posture_reliability_i * source_independence_weight_i
```

No MVP, `match_strength_i` e `posture_reliability_i` não devem inventar precisão numérica. Enquanto não houver calibração, usar classes discretas configuradas/documentadas (por exemplo, aceito/restrito) ou peso uniforme entre evidências elegíveis e reportar sensibilidade. `Tavily score` não é peso de verdade.

### 5.3 Síntese conservadora

Score candidato por afirmação:

```text
score = weighted_mean(temporal_g, w_g)
```

Aplicar reduções explícitas apenas por condições definidas e testáveis:

- evidência relevante contraditória e recente: impedir faixa “sinal recente”; marcar `MIXED` e mostrar conflito;
- conflito de datas ou atualização de página sem vínculo com o atributo: limitar confiança; não inventar data por atributo;
- fontes insuficientes ou todas sem datas: score `null`, status `UNVERIFIABLE`;
- evidência relevante somente antiga: score baixo e `STALE`;
- fonte recente que contradiz: pode ter freshness alto e veredito factual conflitante/contraditório. Não reduzir atualidade só porque a evidência contraria.

Não usar um multiplicador arbitrário para “confiança”. `confidence` deve ser categórica (`ADEQUATE`, `LIMITED`, `INSUFFICIENT`) enquanto não houver calibração empírica. Score e confiança são distintos: evidência pode ser recente (score alto) mas cobertura insuficiente (confiança limitada).

### 5.4 Estado derivado

- `UNVERIFIABLE`: nenhuma evidência elegível tem data confiável relevante; score `null`.
- `STALE`: evidências elegíveis são temporalmente antigas e não há evidência atual conflitante que torne o quadro misto.
- `FRESH`: evidência elegível recente, relacionada à afirmação, sem conflito temporal relevante segundo a política.
- `MIXED`: há combinação material de evidência recente/antiga ou divergente; score numérico pode existir, mas a interface deve priorizar a ressalva.

`FRESH` significa “dentro da política e baseado em datas observadas”, não “conteúdo comprovadamente revisado” nem “afirmação verdadeira”.

## 6. Atualidade de página versus atualidade do atributo

Toda evidência de data deve registrar escopo: `PAGE`, `ATTRIBUTE`, `DOCUMENT`, `SEARCH_SNIPPET` ou `UNKNOWN`. No MVP, somente `ATTRIBUTE` ou documento cuja data esteja ligada semanticamente à afirmação pode receber sinal forte. `PAGE` pode contribuir com sinal limitado e exige ressalva. O texto da página, metadado HTML ou Tavily `published_date` não prova automaticamente que o preço/versão/regra mudou naquela data.

O teste adversarial existente deve virar caso bloqueador de regressão: “página atualizada ontem, preço no conteúdo copiado sem data própria” não pode ser apresentado como preço atualizado ontem.

## 7. Determinismo, proveniência e persistência

Entrada do cálculo deve ser uma função pura: evidências elegíveis, tipo de afirmação, política/versionamento e `as_of` explícito. Não chamar API, relógio global ou banco dentro do núcleo matemático. Registrar:

- `algorithm_id`, `algorithm_version`, `policy_id`;
- `evaluated_at` e `as_of` distintos;
- datas originais e campo/escopo selecionado;
- evidências incluídas/excluídas e códigos de motivo;
- pesos/configuração, faixa apresentada e limitações;
- score não arredondado persistido com precisão definida; apresentação pode arredondar;
- modelo e versão apenas para avaliações que dependem do modelo; cálculo temporal determinístico não deve atribuir sua decisão ao LLM.

Resultados antigos sem score permanecem sem score; não sintetizar valores retrospectivos sem versão de política e dados necessários.

## 8. Avaliação antes de alegar qualidade

Criar conjunto rotulado versionado por afirmação e evidência, com split por domínio/entidade para evitar vazamento. Casos mínimos:

1. atributo confirmado com data recente;
2. atributo confirmado, mas data além da janela;
3. fonte sem data;
4. data impossível, futura ou ordem publicação/atualização contraditória;
5. página atualizada recentemente, atributo sem data/vínculo;
6. duas fontes atuais em conflito;
7. fonte atual contradizendo a alegação;
8. snippet versus extração da mesma URL;
9. republicações dependentes;
10. categorias `preco`, `versao_api`, `regulamento`, `empresa` e afirmação atemporal.

Rótulos humanos devem separar `claim_support`, `evidence_freshness`, `attribute_date_scope`, `source_dependency` e `abstention_needed`. Atribuir rótulos temporais com dois avaliadores em uma amostra e resolver desacordos; registrar guia e consenso. Não usar apenas respostas de LLM como ground truth.

Métricas:

- MAE e Spearman/Kendall do score contra rótulo ordinal, somente se houver escala humana coerente;
- Brier/ECE apenas se futuramente interpretado como probabilidade calibrada — por padrão não se aplica;
- macro-F1 por estado `FRESH`/`STALE`/`UNVERIFIABLE`/`MIXED`;
- recall de abstenção em datas ausentes/inválidas e precisão da faixa alta;
- taxa crítica: preço/versão/regra marcada `FRESH` sem data de atributo confiável;
- desempenho por categoria, idioma, tipo de fonte e presença de conflito;
- cobertura e taxa `null`, para expor quando o sistema se abstém;
- custo/latência por afirmação, reportados separadamente da qualidade.

Comparar baseline atual (estados categóricos), score novo, e baseline sem busca/verificação. Fixar dataset, seeds, versões e prompts; repetição de chamadas não deve mascarar variância do modelo.

## 9. UX e demonstração do hackathon

Resposta principal primeiro: “Atualidade inconclusiva — há evidência recente sobre a página, mas não conseguimos confirmar que o preço foi atualizado.” Abaixo, score ou “sem score confiável”, estado e motivo em linguagem simples. Em seguida, fontes com URL, trecho relevante, data declarada, data de coleta explicitamente separada, postura e relação com a afirmação. Um painel “Como calculamos” mostra a política, evidências excluídas, conflito e o que faria o resultado mudar.

Demo de 60–90 segundos: resposta com três afirmações; uma evidência atual e vinculada, um preço copiado em página recentemente atualizada porém sem data de atributo, e um conflito de fontes. Mostrar score por afirmação, abstenção quando cabível, fontes e trilha de decisão. Não apresentar “82/100” sem explicar o significado ordinal; preferir “sinal temporal recente (82/100), confiança limitada — data da página, não do preço”.

## 10. Critérios de aceitação para implementação

- Cada afirmação retorna score `0..100` ou `null`, status, confiança, `as_of`, política, drivers e limitações.
- Nenhum caminho confunde relevância Tavily, qualidade de evidência, veredito e atualidade.
- Datas ausentes/inválidas/futuras não geram score alto.
- Data de coleta nunca substitui data-fonte.
- Atualização de página sem escopo do atributo não prova atualização do atributo.
- Evidências dependentes não contam como fontes independentes; snippet/extract da mesma fonte não duplica peso.
- Evidência atual contraditória continua atual; o resultado factual mostra conflito sem contaminar o eixo temporal.
- O mesmo input/política/`as_of` produz saída determinística.
- Saída e histórico persistem a versão da política/algoritmo; legado continua legível sem score inventado.
- Benchmark reproduzível publica composição do conjunto, métricas por classe/categoria, limitações e falhas observadas.
- Testes usam fixtures e SQLite em memória; testes unitários não chamam Tavily/Bifrost nem acessam `dados/entrelinhas.db`.

## 11. Sequência de entrega

1. Revisar a especificação e fechar semântica das faixas com decisão de produto.
2. Construir/rotular dataset mínimo e congelar baseline dos estados atuais.
3. Implementar função pura de score e testes unitários adversariais.
4. Integrar no agregado por afirmação e validar persistência/migração isolada.
5. Atualizar CLI/demo para explicar score, datas e incerteza.
6. Executar regressão e avaliação controlada; só depois preparar claims de desempenho e apresentação.

**Não reivindicar “vencedor”, precisão ou calibração antes dos resultados.** O diferencial competitivo deve ser demonstrado por comportamento confiável, rastreável e útil, inclusive quando o sistema se abstém.

## 12. Estado de implementação e avaliação em 11/11/2026

Implementado:

- `src/freshness-score.js` calcula score determinístico de meia-vida, exige `dateScope: ATTRIBUTE`, valida data e status, deduplica por domínio, retorna `null` com `UNVERIFIABLE` se não houver data elegível e grava `algorithm_id`, `algorithm_version`, política, `as_of`, drivers e limitações.
- O estado `FRESH`/`STALE` do índice é recalculado pela mesma data, `as_of` e janela usados no score; um rótulo de entrada `FRESH` incompatível com a idade não pode sobrepor a política.
- Algoritmo atual: `1.1.0`. Categoria sem janela em `VALIDADE_MAX_DIAS` recebe `UNVERIFIABLE`/`null`; nenhuma janela substituta é inventada.
- O agregador devolve `conclusao_factual` (`APOIA`, `CONTRADIZ`, `CONFLITO`, `INSUFICIENTE` ou `NAO_VERIFICAVEL`) separada de `freshness`; data de página não pode, por si só, classificar uma fonte como atual do atributo. O `veredito` legado continua disponível por compatibilidade; a CLI prioriza os eixos separados. A data fica visível com escopo e procedência.
- `demo.js` mostra estado, índice, confiança, versão/política e limitações.
- `avaliacao/teste-avaliacao-rotulada-v1.js` contém 13 cenários sintéticos para suporte recente, data só da página, ausência, antiguidade, contradição atual, conflito, datas inválida/futura ou em ordem incoerente, duplicação do mesmo domínio e falta de correspondência. Também fixa o cálculo numérico: validade de 30 dias, idade de 7 dias, meia-vida de 15 dias: `round(100 × 2^(-7/15)) = 72`.

Resultado desta avaliação sintética: 13/13 casos esperados. Isso é cobertura de regras de software, não medida de precisão do produto em páginas reais. O 72/100 é índice temporal operacional não calibrado, não probabilidade de que a afirmação seja verdadeira ou continue verdadeira.

Pendências críticas antes de alegar qualidade ampla:

1. Criar amostra de páginas e afirmações reais, com URLs arquivadas/versões fixas, dois anotadores humanos, guia de rótulos e consenso; separar entidades/domínios entre desenvolvimento e avaliação.
2. Capturar e rotular sinais auxiliares sem promovê-los indevidamente: `Last-Modified`, JSON-LD `datePublished`/`dateModified`, `article:published_time`/`article:modified_time`, datas visíveis no corpo, sitemap `lastmod`, release notes/changelog, API estruturada e snapshots do próprio Entrelinhas. Registrar fonte, timestamp de captura, escopo, valor bruto, parsing, conflitos e proveniência.
3. Para preço/versão/regulação, extrair a data junto do trecho/registro que expressa o valor e verificar se a data se aplica ao atributo e ao produto/plano/região/versão corretos. Sinais de página permanecem auxiliares.
4. Comparar suporte/contradição e atualidade como rótulos diferentes; medir abstenção, falsos `FRESH`, precisão de suporte/contradição, cobertura, resultados por categoria e dependência/republicação.
5. Proteger qualquer fetch direto com limites SSRF rigorosos (HTTP/S apenas, bloquear endereços locais/privados/link-local, validar DNS em cada redirect, timeout e limite de bytes, tipos permitidos e ausência de execução de scripts). Não foi adicionado fetch direto nesta etapa.

Execução local, sem APIs externas e sem banco persistente: `node teste-freshness-score.js && node teste-agregador.js && node teste-limites-independencia-atualidade.js && node avaliacao/teste-avaliacao-rotulada-v1.js`. O banco original não participa desses testes.
