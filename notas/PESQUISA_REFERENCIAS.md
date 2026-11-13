# Pesquisa de referências: datas, evidência e republicação

**Data da revisão:** 11/11/2026  
**Escopo:** documentação oficial, normas e repositórios públicos. Não foram executados projetos externos, não foram chamados serviços de provedores e nenhuma conclusão abaixo representa benchmark comparativo independente.

## O que fontes primárias estabelecem sobre datas

- A [documentação de Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search) descreve `published_date` como melhor estimativa do provedor para publicação ou atualização; pode ser posterior à publicação original e pode estar ausente. Portanto, tratamos como `PAGE`, nunca como prova de que o preço, versão ou outro atributo mudou.
- A [documentação de Tavily Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract) descreve o conteúdo extraído e metadados da requisição, mas não fornece, no contrato consultado, uma data semanticamente vinculada a cada afirmação.
- [RFC 9110 §8.8.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2) define `Last-Modified` como a estimativa do servidor de origem para a modificação da representação selecionada. A representação pode conter múltiplos componentes; logo o cabeçalho sinaliza recurso/página, não atualização de campo.
- Schema.org distingue `datePublished`/`dateModified` de um `Offer`; [`priceValidUntil`](https://schema.org/priceValidUntil) indica quando uma oferta deixa de estar disponível, não quando o preço foi alterado. Precisamos preservar os escopos `DOCUMENT`, `OFFER` e `ATTRIBUTE` separadamente.
- O [Open Graph Protocol](https://ogp.me/) oferece `article:published_time` e `article:modified_time`, ainda datas de artigo. A orientação do [Google Search Central sobre sitemap `lastmod`](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) pede uma data de modificação significativa e precisa, mas o site de origem pode não cumprir a orientação.

## Repositórios e sistemas públicos comparáveis

| Projeto | Padrão útil | O que não devemos inferir |
|---|---|---|
| [StaleBench](https://github.com/KaranSinghDev/stalebench) | Benchmark de transição de fatos controlada, execuções repetidas, comparação determinística, latência de recuperação e intervalo de confiança; ajuda a planejar avaliação e não depender de um juiz LLM para a métrica primária. | Resultado em fatos sintéticos não mede precisão em páginas vivas; não substitui rotulagem humana de evidências, nem valida extração de data por HTML. |
| [EEA RAG Facts Check](https://github.com/eea/rag-facts-check) | Verificação por afirmação, evidência textual citada e localização em documento, com espaço para conflito. Inspira guardar trecho e proveniência junto ao rótulo. | Uma citação localizada não demonstra recência nem independência editorial da fonte. |
| [Dokis](https://github.com/Vbj1808/dokis) | Middleware de proveniência para RAG que aplica política de freshness a timestamps de metadados de chunks. Demonstra o valor de manter data e proveniência estruturadas no pipeline. | Timestamp de ingestão/chunk não é data de alteração do atributo da página; não resolve a situação de `published_date` ausente. |
| [datasketch](https://github.com/ekzhu/datasketch) | MinHash/LSH como padrão escalável de candidate retrieval para conjuntos grandes de near-duplicates. | O Entrelinhas analisa até três fontes por execução; não precisa de índice probabilístico ainda e não deve introduzir aproximação desnecessária nessa escala. |

## Decisões aplicadas ao Entrelinhas

1. **Preservar sinais com tipo, origem, valor original, data normalizada e escopo.** `PAGE`, `DOCUMENT`, `OFFER`, `OBSERVATION`, `ATTRIBUTE` e `UNKNOWN` não são intercambiáveis.
2. **Tentar sinais de baixo custo antes de declarar ausência.** O código consulta headers HTTP e HTML/JSON-LD apenas para até três URLs já selecionadas pelo fluxo Tavily. Esse é um GET separado de melhor esforço; falha de extração não invalida a análise textual.
3. **Não transformar metadado genérico em freshness de atributo.** JSON-LD `dateModified`, `article:modified_time`, `Last-Modified` e rótulos visíveis “Updated/Atualizado em” informam sobre recurso/documento; `priceValidUntil` é validade da oferta; “preços consultados em” é uma data de observação. Na versão atual só um texto visível, com pista explícita de atualização e entidade/valor correspondentes, pode obter `ATTRIBUTE` automaticamente.
4. **Abster quando a associação é incerta.** Duas datas de atributo diferentes geram conflito e nenhuma é escolhida. Datas sem vínculo permanecem registradas, mas não entram no score.
5. **Deduplicar com sinais determinísticos e conservadores.** Mesmo domínio, canonical URL, hash do texto normalizado e similaridade de shingles de cinco tokens (>= 0,88 com pelo menos 40 tokens). Pairwise Jaccard é barato para três evidências.
6. **Expor limites da deduplicação.** Nenhum sinal de cópia não equivale a fonte editorial independente. Conteúdo editado pode escapar; assuntos e textos comuns podem coincidir. O método não determina autoria nem linhagem.
7. **Evoluir avaliação antes de ajustar thresholds.** Adicionar corpus rotulado com exemplos de cópia literal, cópia com edição, sindicância identificada, fontes independentes sobre o mesmo fato, datas de artigo versus atributo, HTML dinâmico, datas conflitantes e sinais falsos. Medir precisão/recall de vínculo temporal e deduplicação separadamente; usar split por domínio para evitar vazamento.

## Limites e próxima validação de produto

A implementação está coberta por fixtures sintéticas, não por uma amostra representativa de páginas da web. O passo que falta é validar em páginas reais selecionadas manualmente, registrar HTML/sinais permitidos e rótulos humanos antes de comparar a saída, mantendo controles de segurança e sem usar esses rótulos para ajustar e avaliar o mesmo conjunto. Devem ser medidos, ao menos: taxa de captura de uma data existente, precisão do vínculo `ATTRIBUTE`, taxa de abstenção correta, conflitos de sinais e falsos agrupamentos/escapes de near-duplicate.

O fetch de metadados é externo a Tavily/Bifrost. Execuções normais do fluxo podem visitar os URLs de origem com GET HTTPS após a busca; os testes automatizados substituem DNS/transporte e não fazem qualquer chamada externa. O comando `node avaliacao/validar-paginas-reais.js --live` é separado e opt-in. Na execução ao vivo confirmada pelo usuário, Nio e Calculadoria expuseram as datas anotadas e a página OpenAI retornou Last-Modified, sem nenhum falso `ATTRIBUTE`; NASA foi pulada como `NO_PUBLIC_IPV4`. Uma tentativa de abrir `view-source:` foi bloqueada pela política de navegação; não se buscou contornar esse bloqueio. Por isso, os testes locais reproduzem somente trechos visíveis curtos verificados no navegador, não o HTML bruto.

O output real também revelou um falso candidato `UNKNOWN` para a data geral da FAQ Nio, causado pela palavra genérica “plano” no título; esse gatilho foi removido, assim como duplicatas JSON-LD idênticas. A suíte automatizada passou depois da correção, mas a confirmação em rede permanece pendente.
