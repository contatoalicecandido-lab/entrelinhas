# Relatório de auditoria técnica do Entrelinhas

**Estado atualizado em 11/11/2026:** critério 12 corrigido e aprovado nos testes locais registrados no adendo. O critério 5 não duplica registros na retentativa, mas a repetição da mesma persistência falha por chave única e ainda não é idempotente com sucesso. Integração Tavily real passou em chamada mínima; Bifrost real está bloqueado por HTTP 401 na Virtual Key. O projeto ainda não está pronto para declarar todos os critérios aprovados.

**Histórico do relatório:** o texto abaixo registra a auditoria inicial e é complementado/sobreposto pelos adendos cronológicos ao final. Nenhum teste usou `dados/entrelinhas.db`.

## Preservação e estado do repositório

- O banco original `dados/entrelinhas.db` não foi aberto pelos testes desta rodada.
- Não foram alterados os backups `dados/entrelinhas.db.backup-antes-coletas-20261108`, `dados/entrelinhas.db.backup-antes-migracao-final-20261109` ou `src/comparador-fontes.js.backup-criterio8`.
- O estado inicial já continha alterações locais em `src/banco.js`, `src/comparador-fontes.js`, `src/normalizar-fonte.js`, `src/tavily.js`, `src/verificador.js`, `teste-integracao-normalizacao.js` e `teste-normalizar-fonte.js`, além de novos arquivos de backup e teste listados no Git. Foram preservados.
- Este relatório foi criado porque não existia previamente.
- Arquivo de teste criado nesta rodada: `teste-auditoria-temporal-criterios-7-10-12-13.js`.
- `teste-tavily-coletas-simulado.js`, criado anteriormente, foi estendido nesta rodada para verificar também que aquisições sucessivas geram IDs novos.
- Relatório criado nesta rodada: este arquivo.
- Nenhum arquivo de produção, `package.json`, banco ou backup foi alterado nesta rodada.

## Matriz dos 18 critérios oficiais

| # | Critério oficial | Estado | Evidência desta auditoria |
|---|---|---|---|
| 1 | Uma aquisição suporta três evidências com o mesmo `id_coleta`. | APROVADO | `teste-criterios-temporais.js`, 3/3 confirmado pelo usuário antes desta rodada e executado novamente com exit code 0; a gravação e recuperação preservam o mesmo ID nas três evidências. |
| 2 | Três URLs extraídas em uma chamada recebem IDs de coleta distintos. | APROVADO | `teste-tavily-coletas-simulado.js`, executado nesta rodada, exit code 0; três URLs, três extrações e três IDs não vazios distintos. `global.fetch` foi substituído e bloqueou destinos não simulados. |
| 3 | Uma nova verificação não é automaticamente interpretada como uma nova versão da página. | APROVADO NOS CASOS TESTADOS | Novo cenário: uma verificação posterior sem evidência/aquisição deixa o histórico com uma única aquisição e mantém `NEW`; nenhuma comparação é criada. |
| 4 | Evidências da mesma verificação nunca são comparadas como evolução temporal. | APROVADO NOS CASOS TESTADOS | Novo cenário: duas evidências da mesma URL e verificação, com IDs de coleta distintos, são consolidadas como uma aquisição; retorno `NEW` e nenhuma comparação persistida. |
| 5 | Repetições da mesma aquisição não duplicam a coleta. | PARCIALMENTE COBERTO | Uma nova tentativa com mesmo `id_verificacao` falha pela restrição única e não duplica registros (`teste-robustez-local.js`, SQLite em memória). Falta definir/testar se repetição deve retornar sucesso idempotente em vez de erro. |
| 6 | Uma nova aquisição efetiva gera um novo `id_coleta`. | APROVADO | `teste-tavily-coletas-simulado.js` executou duas chamadas simuladas para as mesmas três URLs; cada chamada gerou três IDs distintos e nenhum ID foi reutilizado entre as chamadas. |
| 7 | Extração versus extração compatível pode ser comparada. | APROVADO | No novo teste, SQLite em memória: extrações compatíveis com conteúdo igual retornam `UNCHANGED`; conteúdo diferente retorna `CHANGED`, hashes SHA-256 válidos, diff LCS e versão persistida. Ambos passaram. |
| 8 | Snippet versus snippet exige consulta e parâmetros compatíveis. | APROVADO | `teste-compatibilidade-snippets.js`, 3/3 confirmado pelo usuário e executado novamente com exit code 0. Consulta ou parâmetros divergentes retornam `NOT_COMPARABLE`. |
| 9 | Snippet versus extração retorna `NOT_COMPARABLE`. | APROVADO | `teste-snippet-vs-extracao.js` passou nesta rodada; resultado `NOT_COMPARABLE` e persistência `NOT_PERSISTED`. |
| 10 | Mudanças em snippets não implicam mudança na página original. | APROVADO COM ESCOPO LIMITADO | O novo teste confirmou `CHANGED` para snapshots `tavily_search`, e que justificativa e registro persistido dizem que isso não confirma alteração da página original. O resultado ainda usa o status genérico `CHANGED`; a conclusão é segura porque o método e a justificativa delimitam o objeto da comparação. |
| 11 | Datas ausentes, inválidas ou sem ordem confiável impedem a comparação. | APROVADO | `teste-datas-temporais.js` 3/3 e `teste-nao-comparavel-sem-impacto.js` passaram. Os cenários de conteúdo igual e diferente com data inválida no novo teste também retornaram `NOT_COMPARABLE`. |
| 12 | URLs canônicas incompatíveis impedem a comparação. | APROVADO LOCALMENTE APÓS CORREÇÃO | O teste focalizado agora cobre URLs incompatíveis, equivalentes após normalização e protocolo inválido; comparações inseguras retornam `NOT_COMPARABLE`/`NOT_PERSISTED`. Também verifica legado com legado e legado misturado com coleta nova. |
| 13 | Histórico legado permanece disponível e não recebe IDs inventados. | APROVADO | Novo cenário salvou duas evidências sem objeto de coleta; o histórico retornou ambas com `coleta === null`, sem `id_coleta`, preservando conteúdo. O comparador manteve compatibilidade com o histórico. |
| 14 | `NOT_COMPARABLE` não gera avaliação de impacto. | APROVADO | `teste-nao-comparavel-sem-impacto.js` passou; também `teste-snippet-vs-extracao.js` confirmou `NOT_PERSISTED`. |
| 15 | Cada comparação registra a versão do algoritmo. | APROVADO NOS CAMINHOS TESTADOS | O novo teste confirmou versão `1.2.0` em comparações válidas de extração com conteúdo igual e diferente. `src/banco.js` exige algoritmo e versão na persistência. |
| 16 | Comparações válidas continuam utilizando hash e LCS. | APROVADO NOS CAMINHOS TESTADOS | O novo teste verificou hashes de 64 caracteres hexadecimais e `detalhamento.algoritmo === "LCS"` em mudança válida. `teste-comparador-fontes.js` também passou, 10/10. |
| 17 | Conteúdo igual retorna `UNCHANGED` somente quando a comparação é válida. | APROVADO NOS CASOS TESTADOS | Conteúdo igual com extrações e datas válidas retornou `UNCHANGED`; conteúdo igual com data inválida retornou `NOT_COMPARABLE` e não foi persistido. |
| 18 | Conteúdo diferente retorna `CHANGED` somente quando a comparação é válida. | APROVADO NOS CASOS TESTADOS | Conteúdo diferente com extrações compatíveis e datas válidas retornou `CHANGED`; com data inválida retornou `NOT_COMPARABLE` e não foi persistido. Snippet incompatível com extração também foi bloqueado. |

Os estados “parcialmente coberto” não significam falha observada; indicam falta de um cenário que demonstre precisamente o enunciado. O critério 12 falhou na rodada inicial e foi corrigido e revalidado no adendo ao final deste relatório.

## Testes executados nesta rodada

Na rodada inicial, o teste focalizado terminou com exit code 1 pela falha do critério 12. Essa falha foi corrigida e revalidada: o adendo registra a execução atual com 13/13 cenários aprovados. Consulte o adendo para os resultados mais recentes.

- `npm test`: passou. Saída: atualidade 20/20; evidência 15/15; preparação/redução e fallback aprovados; persistência/comparador 16/16; fluxo controlado/rastreabilidade aprovado. O próprio fluxo confirma SQLite em memória e nenhuma API externa.
- `node teste-tavily-coletas-simulado.js`: passou; executou duas chamadas simuladas para as mesmas três URLs; cada aquisição gerou três IDs distintos, sem reutilização entre aquisições. Quatro chamadas de `fetch` foram interceptadas (`/search` e `/extract`, duas vezes).
- `node teste-comparador-fontes.js`: 10/10.
- `node teste-contexto-comparador.js`: 5/5.
- `node teste-compatibilidade-snippets.js`: 3/3.
- `node teste-snippet-vs-extracao.js`: aprovado, `NOT_COMPARABLE`/`NOT_PERSISTED`.
- `node teste-criterios-temporais.js`: passou; três cenários.
- `node teste-datas-temporais.js`: 3/3.
- `node teste-nao-comparavel-sem-impacto.js`: aprovado.
- `node teste-coletas.js`: aprovado.
- `node teste-historico-fonte.js`: aprovado.
- `node teste-integracao-comparador.js`: 6/6.
- `node teste-regressao-normalizacao-comparador.js`: 8/8.
- `node teste-normalizar-fonte.js`: 15/15.
- `node teste-integracao-normalizacao.js`: 8/8.
- `node teste-persistencia-comparacoes.js`: 12/12.
- `node teste-avaliador-impacto.js`: 8/8.
- `node teste-falsos-positivos-impacto.js`: 3/3.
- `node teste-integracao-impacto.js`: 8/8.
- `node teste-agregador.js`: 16/16.
- `node teste-banco.js`: aprovado; banco em memória.
- `node teste-rastreabilidade-bifrost.js`: aprovado; `fetch` simulado, sem rede.
- `node teste-auditoria-temporal-criterios-7-10-12-13.js`: o primeiro resultado foi 8/9; após correção e ampliação, o resultado atualizado é 13/13 (veja adendo).

O teste focalizado usa SQLite `:memory:` e fixtures. Os casos 3 e 4 verificam que verificações/evidências simultâneas não criam evolução temporal; o caso 7 confere `UNCHANGED` e `CHANGED`; casos 17 e 18 verificam que data inválida impede esses status; o caso 10 confere a justificativa e o resultado persistido; o caso 12 falha conforme descrito; o caso 13 verifica legado sem IDs inventados.

## Testes confirmados anteriormente pelo usuário

Antes desta rodada, o usuário havia confirmado: `teste-compatibilidade-snippets.js` 3/3; `teste-snippet-vs-extracao.js` aprovado; `teste-comparador-fontes.js` 10/10; `teste-criterios-temporais.js` 3/3; `teste-datas-temporais.js` 3/3; `teste-nao-comparavel-sem-impacto.js` aprovado; `npm test` com atualidade 20/20, evidência 15/15 e persistência 16/16; `teste-tavily-coletas-simulado.js` aprovado. Os resultados acima foram reexecutados por mim nesta rodada, exceto que os resultados anteriores continuam sendo atribuídos ao usuário.

## Testes encontrados, mas não executados por risco

- Possíveis chamadas reais de modelo/Bifrost: `teste-afirmacoes.js`, `teste-classificador.js`, `teste-correspondencia.js`, `teste-qualidade-afirmacoes.js`, `teste-integracao-verificador.js` e `teste-rastreabilidade-completa.js`.
- Chamadas reais de Tavily: `teste-tavily-real.js` e `teste-integracao-fontes.js`.
- `teste-verificador.js` chama `verificarTexto()` sem banco injetado; o fluxo pode usar `dados/entrelinhas.db` e serviços externos.
- `teste-benchmark.js` pode chamar o modelo e sobrescreve `dados/resultado-benchmark.json`.
- `index.js` faz chamadas Bifrost/Tavily. `historico.js` abre o banco padrão.

Esses testes/scripts foram excluídos da execução. Nenhum está bloqueado por erro observado; estão excluídos para cumprir as regras de isolamento e não uso de APIs reais.

## Falha real reproduzida inicialmente (corrigida depois)

**Critério afetado:** 12, URLs canônicas incompatíveis impedem a comparação.

**Gravidade:** alta para a confiabilidade da comparação temporal; a implementação pode atribuir `CHANGED` a dois recursos diferentes se compartilharem o mesmo campo de URL consultado, mas tiverem `coleta.url_canonica` incompatível.

**Evidência histórica:** a primeira execução retornou `CHANGED` em vez de `NOT_COMPARABLE`. A correção e a nova evidência constam no adendo de 10/11/2026.

**Arquivo/função:** `src/comparador-fontes.js`, função `compararHistoricoFonte()`. Ela verifica data e método, mas não compara explicitamente `coletaAnterior.coleta.url_canonica` com `ultimaColeta.coleta.url_canonica` antes de calcular hashes e diferenças.

**Correção realizada:** validar URLs canônicas HTTP(S) equivalentes antes de comparar conteúdo. URLs inválidas, incompatíveis ou metadados mistos entre legado e registros novos retornam `NOT_COMPARABLE` sem persistência/impacto; dois registros legados podem ser comparados pela URL de evidência comum, sem inventar IDs.

**Risco/impacto:** alguns registros com identidade canônica faltante ou inconsistente deixam de ser comparáveis. A regra não exige migração de esquema.

**Regressões após autorização:** caso atual falho; URLs canônicas iguais; originais distintos que canonicalizam para o mesmo valor; URLs canônicas diferentes; campo canônico ausente/malformado; regressão dos critérios 7–11 e 13–18; `npm test` e demais testes locais seguros.

## Próximos passos pendentes

1. Decidir se a retentativa da mesma persistência deve ser idempotente com resposta de sucesso (critério 5).
2. Integrar o agregador ao fluxo apenas se fizer parte do escopo de produto/demonstração.
3. Retomar a Virtual Key do Bifrost quando o usuário estiver pronto; não é necessário comprar crédito para diagnosticar o HTTP 401.
4. Planejar demonstração ponta a ponta isolada e revisar a matriz integral antes de declarar prontidão.

## Limitações

- A suíte cobre regras programadas e fixtures sintéticas; não prova acurácia geral em páginas reais.
- Tavily real foi testado em fluxo mínimo e passou; Bifrost real foi testado uma vez e retornou 401. Não houve teste em ambiente publicado.
- A auditoria não abriu nem inspecionou dados internos do banco original.
- O status `CHANGED` para snippets é genérico; a distinção segura depende do método e da justificativa que acompanham o resultado.

## Adendo — rodada adversarial local de 10/11/2026

### Correção do critério 12

Foi implementada em `src/comparador-fontes.js` a validação da identidade canônica antes de calcular hashes, diferenças ou impacto. URLs canônicas incompatíveis, ausentes em apenas um dos lados, malformadas ou com protocolo fora de HTTP(S) agora resultam em `NOT_COMPARABLE` e `NOT_PERSISTED`.

Para manter compatibilidade sem inventar `id_coleta`, dois registros legados sem metadados de coleta podem ser comparados usando suas URLs de evidência quando ambas forem válidas e equivalentes. Um registro legado misturado com um registro novo sem identidade de coleta compatível não é comparado.

### Validação desta rodada

- `node teste-auditoria-temporal-criterios-7-10-12-13.js`: **13/13 cenários aprovados**. Inclui critério 12 incompatível, igual, equivalente após normalização e URL inválida; critério 13 legado preservado; e caso misto legado/novo.
- `node teste-robustez-local.js`: **aprovado**. Respostas inválidas do modelo foram rejeitadas; instruções hostis foram testadas como conteúdo de dados com as regras defensivas do prompt; respostas Bifrost simuladas HTTP 503, erro de transporte e JSON malformado foram tratadas; falha de persistência reverteu a transação em SQLite em memória.
- `npm test`: **aprovado** após a correção.
- 23 scripts locais determinísticos ou simulados foram executados sem falhas, incluindo agregador, impacto, persistência, histórico, comparação temporal, rastreabilidade Bifrost simulada e Tavily simulada.
- `node --check index.js historico.js src/*.js`: **aprovado**.

Nenhuma API real foi chamada e o banco original não foi aberto. Os cenários de prompt injection verificam a presença de instruções defensivas e a validação de saída; não demonstram resistência geral do modelo a ataques. Integrações reais com Tavily/Bifrost continuam pendentes e devem ser planejadas com escopo de dados e possível consumo de créditos antes da execução.

### Estado atualizado e próximos passos

O critério 12 está aprovado nos cenários locais executados. O agregador segue testado isoladamente, mas não integrado ao fluxo de `verificarTexto()`. Permanecem pendentes a avaliação de integração real, uma interface/caminho demonstrável isolado e a decisão de produto sobre a integração do agregador. Scripts com chamadas externas, banco padrão ou efeitos colaterais foram mantidos fora da execução.

## Adendo — smoke tests reais autorizados

Após autorização ampla do usuário, foram feitas chamadas externas mínimas com apenas dados sintéticos, sem abrir banco e sem imprimir credenciais.

- **Tavily:** uma busca `basic` pela documentação pública do Node.js e uma extração `basic` dos três URLs selecionados concluíram com sucesso. A função retornou cinco evidências (três `tavily_extract`, duas `tavily_search`), todas com `id_coleta`; metadados registraram `BUSCA/SUCESSO` e `EXTRACAO/SUCESSO`. Pela tabela oficial de créditos, o fluxo corresponde a 1 crédito de busca básica e, para até cinco extrações bem-sucedidas, 1 crédito de extração básica; o painel de uso não foi consultado, então o consumo efetivo não foi confirmado. [Documentação oficial de créditos Tavily](https://docs.tavily.com/documentation/api-credits)
- **Bifrost:** uma única solicitação sintética ao modelo configurado foi enviada. O gateway retornou HTTP 401 `access_not_found` e não entregou uma resposta de modelo. A mensagem indica que a credencial virtual configurada não existe ou foi revogada. Não foram feitas novas tentativas; o custo eventual do provedor não foi confirmado.

As duas chamadas reais foram executadas fora do sandbox de rede restrito, com aprovação da execução. Nenhum texto privado foi enviado, nenhum valor de chave foi exibido e nenhum dado foi gravado no SQLite.

## Adendo — continuação de testes e bloqueio operacional do Bifrost

O usuário decidiu deixar a configuração do Bifrost para outro momento e autorizou prosseguir com testes independentes. Não foram feitas novas chamadas reais ao Bifrost.

O teste `teste-robustez-local.js` foi ampliado para repetir a persistência da mesma verificação em SQLite `:memory:`. A segunda tentativa falha pela restrição única e a transação não duplica evidência nem coleta. Portanto, não há duplicação, mas a operação ainda não é idempotente com resposta de sucesso: o cliente recebe erro ao repetir um `id_verificacao` já gravado. Isso mantém o critério de retentativa parcialmente coberto e sugere decidir se o contrato de produto deve tratar repetição como sucesso idempotente.

O bloqueio atual do Bifrost é operacional, não de lógica local: na última tentativa autorizada, o serviço retornou `401 access_not_found` para a credencial configurada. O painel precisa fornecer uma Virtual Key do Bifrost para `BIFROST_KEY`; a chave `gsk_...` do provider Groq é distinta. O usuário pediu para adiar essa etapa. Tavily real foi validado com busca e extração bem-sucedidas; não é necessário recarregar créditos Tavily para continuar com os testes locais.

## Adendo — testes adversariais de síntese sistêmica

Foi criado e executado `teste-politica-agregacao-adversarial.js` com cinco cenários sintéticos: (1) dez páginas do mesmo domínio não anulam uma fonte independente contraditória; (2) evidência apenas relacionada não decide uma afirmação ampla; (3) postura `INSUFFICIENT` não vira apoio; (4) fonte oficial atual pode superar contradição antiga, mas o relatório deve expor essa limitação; (5) posições conflitantes no mesmo domínio permanecem conflito após agrupamento.

Resultado: **5/5**, sem rede e sem banco. `teste-agregador.js` também passou **16/16** e `npm test` passou. Essa cobertura exercita as regras determinísticas do agregador; não valida a classificação de fontes reais nem resolve o caso de como identificar independência entre domínios, cópias sindicadas ou atualizações específicas de um atributo (como preço).

## Adendo — limites de independência e atualidade por atributo

`teste-limites-independencia-atualidade.js` executou duas reproduções explícitas de limitações atuais, sem APIs e sem banco:

- Duas republicações textualmente iguais em domínios diferentes foram contadas como duas fontes independentes; junto com uma fonte contraditória, o agregador deu `CONFLITO` e contou três domínios. Hoje a independência é aproximada pelo hostname, não pela origem comum do conteúdo.
- Uma página com `data_atualizacao` recente, sem informação de qual parte foi alterada, fez a avaliação de um preço retornar `FRESH`; com uma fonte oficial que apoia o preço, o agregador retornou `ATUAL`. O contrato de dados não vincula data de atualização ao atributo alegado.

Esses testes são diagnósticos: registram comportamentos observados, não aprovam o mérito epistemológico desses resultados. Regressão de confirmação temporal foi executada depois: política adversarial 5/5, agregador 16/16 e `npm test` passaram. Próximo passo técnico é desenhar enriquecimento da proveniência (origem/sindicância) e do escopo da data por trecho/atributo antes de integrar o agregador ao fluxo principal.

Inspeção do contrato atual: Tavily preserva `resultado_id`, IDs de request e hash SHA-256 do conteúdo coletado em `coletas.metadados_json`/`hash_conteudo`, mas não traz uma relação de republicação/origem comum nem um campo que indique qual atributo foi atualizado. Isso permite deduplicação exata como sinal, mas não prova independência nem atualidade específica do preço. Qualquer agrupamento por hash deve ser apresentado como possível conteúdo repetido, com ressalva, e não como prova de mesma origem.

## Adendo — integração local da síntese de evidências

Em 11/11/2026, o agregador determinístico foi ligado ao fluxo `verificarTexto()` sem adicionar chamadas ao modelo. Cada afirmação verificada agora recebe `agregacao`, com veredito, explicação curta e grupos de fontes/URLs já produzidos pelo agregador. O objeto de nível superior `sintese` resume uma afirmação diretamente; para múltiplas afirmações, apresenta a contagem de vereditos e orienta a leitura dos resultados individuais, sem fundir afirmações distintas num único juízo de verdade. Afirmação ausente de evidência utilizável resulta em `NAO_VERIFICAVEL` com a ressalva de que isso não significa falsidade.

`dominiosOficiais` é uma opção de `verificarTexto()` e deve ser configurada para que o agregador possa aplicar a regra de fonte oficial. O padrão é lista vazia; portanto, não se deve interpretar `ATUAL` como uma conclusão produzida sem essa configuração. A redação de `ATUAL` afirma explicitamente que não é garantia absoluta. Citações são URLs agrupadas nas referências de cada agregação por afirmação; a síntese global de múltiplas afirmações não duplica as referências.

### Validação local

- `node teste-integracao-sintese-controlada.js`: **2/2 cenários aprovados** — conflito com duas fontes distintas retorna `CONFLITO`, resumo explicativo e URLs, persistindo o resultado em SQLite `:memory:`; evidência apenas relacionada retorna `NAO_VERIFICAVEL` e não chega ao classificador.
- `node teste-politica-agregacao-adversarial.js`: **5/5**.
- `node teste-agregador.js`: **16/16**.
- `npm test`: aprovado.
- `node --check src/*.js`: aprovado.

Os testes de integração controlada substituem dependências externas; nenhuma API foi chamada. O teste abre SQLite em memória, sem acessar `dados/entrelinhas.db`. Não houve edição deste banco nem dos backups.

### Escopo ainda não validado

A integração conecta a política determinística ao resultado interno do fluxo, mas ainda não constitui uma interface de produto para usuário final. Naquele momento, a integração real não havia sido repetida após o HTTP 401 anterior do Bifrost; isso foi verificado no adendo seguinte. Também permanecem os limites previamente documentados: hostname não prova independência editorial, e data de atualização da página não prova atualização do atributo consultado. A seleção de fontes oficiais e a apresentação visual das referências ainda precisam ser aperfeiçoadas antes de alegar uma experiência de produto pronta.

## Adendo — primeira execução ponta a ponta com credenciais atualizadas

Em 11/11/2026 foi executado um cenário real mínimo de `verificarTexto()` com a afirmação pública sintética “A API da OpenAI oferece o endpoint Chat Completions.” O fluxo foi: uma chamada Bifrost para decomposição; uma busca Tavily com cinco resultados; uma extração Tavily com três páginas; e duas chamadas Bifrost para correspondência e classificação da única evidência analisada. As três chamadas Bifrost retornaram HTTP 200. O resultado foi gravado e recuperado de SQLite `:memory:`. Não foi aberto `dados/entrelinhas.db`.

O resultado foi `SUPORTE_FRACO`: a única evidência analisada era uma página secundária da Palo Alto Networks, que apoiava a afirmação e foi avaliada como `FRESH`; nenhuma fonte do domínio oficial configurado entrou no conjunto analisado. O sistema, portanto, não elevou essa evidência a conclusão forte. Esta execução confirma conectividade e passagem técnica de dados entre os módulos, mas **não** confirma a qualidade epistemológica do resultado nem serve como validação factual final da afirmação.

### Lacuna observada na seleção de fontes

`dominiosOficiais` é usado pelo agregador para classificar evidências já coletadas; não direciona a busca Tavily nem assegura que fontes oficiais estejam entre as evidências limitadas por `maxEvidencias`. Neste cenário, mesmo com domínios oficiais configurados, o limite de uma evidência selecionou uma página secundária. Próxima correção recomendada: desenhar uma estratégia de busca que preserve fontes independentes gerais e tente obter evidência oficial sem deixar que uma consulta restrita a domínios oficiais substitua a busca plural. Até essa mudança ser projetada e coberta, resultados como `SUPORTE_FRACO` são esperados quando a evidência oficial não está presente.

A chamada de conectividade anterior e este fluxo usaram somente prompts curtos e uma afirmação pública; nenhuma credencial foi impressa. Uma solicitação mínima foi encaminhada pelo Bifrost ao provedor Groq; o fluxo ponta a ponta realizou três chamadas ao Bifrost e as operações de busca/extração indicadas acima. Nenhum arquivo de banco ou backup foi alterado.

### Correção da prioridade de seleção e regressão

Depois de identificar que a fonte oficial configurada podia ficar fora de `maxEvidencias`, `src/verificador.js` passou a priorizar evidências cujo hostname corresponde aos domínios oficiais configurados, preservando a ordem original dentro de cada grupo. Os resultados gerais continuam disponíveis no restante do limite; a regra não muda nem restringe a busca Tavily. Sem domínios oficiais configurados, a ordem original é preservada.

- `node teste-selecao-fontes-oficiais.js`: **2/2 aprovados**, incluindo prioridade em subdomínio oficial e preservação da ordem sem configuração.
- `node teste-integracao-sintese-controlada.js`: **2/2 aprovados**.
- `npm test`: aprovado (20 testes de atualidade, 15 de evidência, 16 de persistência e fluxo controlado).
- `git diff --check`: aprovado.

Essa correção só pode priorizar um domínio oficial se a busca já o tiver retornado. Ela não garante presença de fonte oficial; nesse caso, o agregador deve manter um veredito conservador, como `SUPORTE_FRACO` ou `NAO_VERIFICAVEL`.

Regressão adicional após a correção: `teste-robustez-local.js` aprovado; `teste-politica-agregacao-adversarial.js` 5/5; `teste-auditoria-temporal-criterios-7-10-12-13.js` 13/13; `teste-regressao-normalizacao-comparador.js` 8/8; `teste-tavily-coletas-simulado.js` aprovado (fetch inteiramente simulado). `teste-limites-independencia-atualidade.js` reproduziu novamente as duas limitações conhecidas, sem falhas de execução: cópias em domínios distintos contam como independentes e uma data geral de atualização pode ser atribuída a um preço sem escopo por atributo. Todos esses scripts foram executados sem rede real e sem acesso ao banco original.

## Adendo — busca dupla para preservar fontes oficiais e independentes

Em 11/11/2026, `pesquisarComTavily()` foi ampliada: com `dominiosOficiais` configurado, faz uma busca geral e uma busca adicional com `include_domains`; combina resultados, deduplica URLs canônicas, prioriza fontes dos domínios indicados na seleção para extração e mantém a proveniência dos dois pedidos nos metadados das coletas. Se a busca oficial falhar, registra o erro e continua com a busca geral. Sem domínios configurados, mantém o caminho de uma busca. O campo `include_domains` e seu modo restritivo constam na [referência oficial do endpoint de busca Tavily](https://docs.tavily.com/documentation/api-reference/endpoint/search).

### Validação automatizada

- `node teste-tavily-busca-oficial.js`: **2/2 cenários aprovados** — resultados gerais e oficiais combinados/deduplicados, fontes oficiais priorizadas, operações ligadas à coleta; falha da consulta oficial preserva a busca geral. `fetch` foi totalmente simulado e a variável de ambiente restaurada.
- `node teste-tavily-coletas-simulado.js`: aprovado; IDs de coleta distintos preservados no caminho sem configuração de domínio.
- `node teste-rastreabilidade-fluxo-controlado.js`: aprovado com `dominiosOficiais` encaminhado à Tavily e persistência em SQLite em memória.
- `npm test`: aprovado.

### Validação real limitada

Uma chamada real pública com `platform.openai.com` retornou cinco resultados gerais e cinco resultados oficiais; três páginas oficiais foram extraídas. O fluxo completo foi então executado com uma evidência máxima e SQLite `:memory:`: busca geral e oficial e extração tiveram sucesso; o Bifrost teve uma resposta HTTP 429 transitória na classificação, retentou e concluiu com HTTP 200. A página analisada (`platform.openai.com/docs/guides/gpt/completions-api`) apoiou a afirmação, mas não tinha data verificável; a atualidade foi `UNVERIFIABLE` e a conclusão permaneceu `SUPORTE_FRACO`. Isso demonstra que a busca encontrou uma fonte oficial e que a ausência de data não foi convertida em certeza de atualidade.

Esse modo configurado faz **uma busca básica adicional por afirmação**, além da busca geral; logo, aumenta o uso de Tavily. A extração permanece limitada às três URLs priorizadas. A busca não prova que os domínios configurados sejam confiáveis para toda afirmação: a lista precisa ser apropriada ao assunto, e fontes de subdomínios são tratadas como pertencentes ao domínio configurado.

## Adendo — domínios por escopo e datas de observação

Em 11/11/2026, `verificarTexto()` passou a aceitar três níveis de configuração, com precedência de escopo específico para geral:

1. `dominiosOficiaisPorAfirmacao` — exceção para um ID de afirmação, útil quando jurisdição ou entidade exige uma fonte específica.
2. `dominiosOficiaisPorTipo` — cadastro por tipo (`versao_api`, `regulamento`, `preco`, `empresa`).
3. `dominiosOficiais` — lista geral de compatibilidade.

Cada afirmação registra `dominios_oficiais_usados` no resultado persistido. Isso permite configurar, por exemplo, documentação de API para uma afirmação e domínio governamental específico para outra afirmação regulatória, em vez de aplicar uma única lista indiscriminadamente. A lista continua sendo configuração fornecida pela aplicação: o sistema não deduz automaticamente a jurisdição nem verifica se o domínio escolhido é autoridade competente.

O agregador foi atualizado para a versão de regras `1.2.0`. Nas referências de cada fonte, `consultado_em` registra quando o conteúdo foi coletado; `data_publicacao` e `data_atualizacao` continuam sendo datas declaradas pela fonte; `status_datas_declaradas` indica `AUSENTE`, `VERIFICAVEL` ou `INVALIDA_OU_INCOERENTE`. A data da coleta não é usada como substituta de data editorial. Se uma fonte oficial apoia uma afirmação sem declarar data verificável, `SUPORTE_FRACO` explica essa distinção explicitamente.

Validação local: `teste-politica-fontes-e-datas.js` passou **3/3** (precedência por tipo/afirmação, persistência em memória, e data observada separada de data declarada); `teste-agregador.js` passou **16/16**; `teste-politica-agregacao-adversarial.js` passou **5/5**; teste de síntese controlada passou **2/2**; `npm test` passou; `node --check` e `git diff --check` passaram. Todos os testes desta lista usaram fixtures e/ou SQLite `:memory:`, sem chamadas externas.

A última execução real, feita antes da redação explicativa da versão 1.2.0, encontrou uma página oficial sem data verificável e produziu `SUPORTE_FRACO`. A nova redação foi validada localmente, mas não foi feita uma nova chamada paga a modelo para confirmar o texto em resposta real.
