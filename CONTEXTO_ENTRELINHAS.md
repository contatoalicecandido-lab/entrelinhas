# CONTEXTO_ENTRELINHAS.md

## Documento mestre de continuidade do projeto

**Projeto:** Entrelinhas\
**Nome/descritor usado no hackathon:** Freshness Guard\
**Última atualização deste documento:** 11 de novembro de 2026\
**Objetivo:** preservar contexto de produto, arquitetura, decisões,
testes, limitações e próximos passos para continuidade entre conversas e
sessões de desenvolvimento.

> O histórico anterior a 11/11/2026 foi preservado. As decisões e
> atualizações posteriores estão registradas nas seções datadas ao final.
> Ele não substitui a leitura do código atual nem a execução dos testes.
> Quando houver divergência entre um registro histórico e o estado mais
> recente do código, deve prevalecer a inspeção do repositório e a
> decisão mais recente registrada aqui. Pontos ainda não confirmados
> estão marcados como pendentes ou precisam ser verificados.

------------------------------------------------------------------------

# 1. Visão do produto

## 1.1 O que é o Entrelinhas

Entrelinhas é uma camada de verificação de evidências para aplicações
que usam inteligência artificial.

A proposta é não tratar uma resposta gerada por IA como verdade por
padrão. O sistema deve:

1.  Receber uma afirmação ou resposta que precise ser verificada.
2.  Decompor o texto em afirmações menores e verificáveis.
3.  Buscar evidências externas.
4.  Verificar se cada fonte realmente trata do mesmo objeto ou assunto
    específico.
5.  Avaliar se o conteúdo da fonte apoia, contradiz ou não permite
    avaliar a afirmação.
6.  Avaliar a atualidade temporal da evidência, sem confundir data de
    coleta com data de atualização da fonte.
7.  Agregar as evidências em uma conclusão explicável.
8.  Registrar fontes, versões, datas, limitações e histórico para
    permitir auditoria e comparação posterior.

O diferencial pretendido é incorporar a dimensão temporal à verificação:
não apenas perguntar se uma afirmação encontra apoio em uma fonte agora,
mas também acompanhar o que mudou nas evidências ao longo do tempo.

## 1.2 Princípio central de qualidade

A régua de qualidade do projeto é:

> "Quero que o Entrelinhas consiga explicar não apenas qual foi sua
> conclusão, mas também como chegou até ela e o que poderia fazer essa
> conclusão mudar."

Toda decisão de produto e arquitetura deve ser avaliada por esse
princípio.

## 1.3 O que o produto não deve afirmar

-   Uma resposta de IA não é verdade só por ter sido gerada.
-   Uma coleta recente não prova que a informação da página foi
    atualizada recentemente.
-   Uma diferença textual não prova, por si só, que houve uma mudança
    semântica relevante.
-   Uma mudança detectada não prova impacto real na confiabilidade de
    uma afirmação.
-   Uma fonte relacionada ao tema não necessariamente apoia a afirmação
    específica.
-   Ausência de evidência não significa que a afirmação é falsa.
-   Um score heurístico de qualidade da evidência não é probabilidade de
    verdade.
-   Uma fonte oficial sem data confiável não pode ser tratada
    automaticamente como atual.

## 1.4 Direção para português brasileiro

Uma direção de produto é tratar com cuidado particular ambiguidades do
português brasileiro, incluindo:

-   negação;
-   condicionais e ressalvas;
-   expressões regionais;
-   variações de vocabulário;
-   diferenças entre termos parecidos;
-   condições comerciais, prazos, quantidades e atributos.

Essa é uma direção a validar, não uma capacidade comprovada. O projeto
precisa construir um benchmark próprio em português para medir
desempenho nesses casos.

------------------------------------------------------------------------

# 2. Escopo e pilares do produto

## 2.1 Cinco capacidades oficiais

1.  **Histórico de evidências e mudanças:** registrar coletas e comparar
    versões de fontes.
2.  **Detecção de conflitos:** identificar evidências que apoiam e
    contradizem uma afirmação.
3.  **Rastreabilidade:** mostrar de onde veio cada evidência e como ela
    foi usada.
4.  **Abstenção inteligente:** não forçar uma conclusão quando a
    evidência é insuficiente.
5.  **Otimização de risco e custo:** usar busca, modelos e processamento
    de forma proporcional à complexidade e ao risco.

## 2.2 Quatro pilares

### 1. Evidence Intelligence

-   Decomposição de afirmações.
-   Classificação de evidências.
-   Detecção de conflitos.
-   Busca por contraevidências.

### 2. Temporal Intelligence

-   Avaliação de atualidade.
-   Histórico de fontes.
-   Validade temporal.
-   Revalidação adaptativa.

### 3. Trust & Transparency

-   Rastreabilidade.
-   Incerteza explícita.
-   Abstenção.
-   Mitigação de vieses e limitações.

### 4. Sustainable Intelligence

-   Reutilização de evidências.
-   Cache.
-   Busca proporcional ao risco.
-   Roteamento de modelos por complexidade.
-   Medição de custo, tokens e latência.

**Importante:** esses pilares representam escopo e direção de produto.
Nem todas as capacidades estão implementadas ou validadas.

------------------------------------------------------------------------

# 3. Hackathon e entregáveis

## 3.1 Contexto do desafio

O projeto está sendo desenvolvido para o Geek Room Global AI Hackathon
2026.

> **Superado em 11/11/2026 (ver seção 31):** a submissão usa um único
> Problem Statement, "Build a Stale-Answer Detector for AI Applications",
> que exige Tavily e Bifrost. B4 não foi selecionado. O texto abaixo é
> histórico.

O hackathon exige participação nas duas trilhas: - uma problem statement
da trilha Bifrost, prioritária; - uma problem statement da trilha
Tavily, parceira.

O projeto deve demonstrar atendimento às duas trilhas. A proposta do
Entrelinhas se conecta à verificação de respostas desatualizadas e ao
uso de Bifrost como gateway de modelos.

## 3.2 Datas e entrega

Conforme informações recebidas: - Prazo de submissão: **15 de novembro
de 2026, às 23h59**. O fuso horário não foi confirmado. - Julgamento:
**29 de novembro de 2026**.

Entregáveis informados: - repositório público no GitHub; - README com
configuração e instruções de execução; - tecnologias e APIs
utilizadas; - screenshots e exemplos; - apresentação em PPT; - vídeo de
demonstração opcional.

Prêmios informados: - Bifrost/Maxim: US\$ 1.000; - Tavily: 50.000
créditos divididos entre os três primeiros colocados; - código
GEEKROOM2: 8.000 créditos Tavily.

Esses dados vieram do material do hackathon compartilhado na conversa e
devem ser conferidos na página oficial antes da submissão.

## 3.3 Estratégia de entrega

O prazo é curto. Priorizar: 1. fluxo de ponta a ponta funcional; 2.
resultado explicável e reproduzível; 3. demonstração temporal clara; 4.
README e setup reproduzíveis; 5. apresentação objetiva.

Evitar construir uma plataforma de monitoramento generalizada antes de
ter uma demonstração confiável do núcleo de verificação.

------------------------------------------------------------------------

# 4. Arquitetura e fluxo principal

## 4.1 Pipeline de verificação

O fluxo existente/planejado é:

1.  Entrada da afirmação.
2.  Decomposição em afirmações verificáveis.
3.  Busca de fontes com Tavily.
4.  Extração de páginas quando disponível.
5.  Preparação do conteúdo para análise pelo modelo.
6.  Correspondência entre fonte e afirmação.
7.  Classificação da postura da evidência.
8.  Avaliação de atualidade.
9.  Agregação de evidências em um veredito.
10. Persistência da verificação e das fontes.
11. Histórico e comparação temporal.

O módulo `verificador.js` já coordena grande parte do fluxo:
decomposição, busca, preparação, correspondência, classificação,
atualidade e persistência. O agregador deve receber os resultados desse
fluxo sem executar novas chamadas ao Tavily ou ao Bifrost.

## 4.2 Separação das perguntas

A arquitetura deve manter separadas estas perguntas:

**Correspondência:** a fonte fala do mesmo objeto/entidade/afirmação
específica?

**Classificação:** considerando que a fonte corresponde, o conteúdo
apoia, contradiz ou não permite avaliar a afirmação?

**Atualidade:** existe uma data de publicação ou atualização confiável e
ela está dentro do limite configurado?

**Agregação:** considerando o conjunto de evidências utilizáveis, qual
conclusão pode ser sustentada?

Não misturar essas etapas em um único julgamento do modelo.

## 4.3 Contrato de dados: fonte, coleta e análise

Manter separados três grupos de informação.

### A. Dados recebidos da fonte/provedor

-   título;
-   URL;
-   conteúdo;
-   conteúdo bruto, quando disponível;
-   identificador do resultado;
-   score de relevância retornado pela busca;
-   datas declaradas pelo provedor ou pela própria fonte.

### B. Metadados de coleta do Entrelinhas

-   `retrieved_at`;
-   consulta de busca;
-   identificador da execução;
-   hash do conteúdo coletado;
-   provedor e método de coleta.

### C. Dados de análise

-   afirmação/proposição;
-   correspondência;
-   postura;
-   justificativa;
-   limitações;
-   avaliação temporal;
-   modelo e versão de prompt/regra, quando disponíveis.

Nunca misturar data da fonte com data de coleta. Não apresentar uma data
inferida como se tivesse sido fornecida pela fonte.

## 4.4 Semântica dos campos Tavily

-   Resultado de busca é uma pista para encontrar uma fonte.
-   `content` é o conteúdo/snippet retornado na busca, não
    necessariamente a página inteira.
-   `raw_content: null` significa que não foi fornecido conteúdo bruto
    adicional.
-   `score` representa relevância da busca, não autoridade nem
    confiabilidade.
-   `retrieved_at` é a data em que o Entrelinhas coletou a informação.
-   `/extract` pode retornar `url`, `title`, `raw_content` e `images`.
-   Uma página pode estar disponível e ser útil mesmo sem data confiável
    de atualização.
-   A ausência de data não significa que a página está desatualizada.
-   A coleta feita agora não significa que a página foi atualizada
    agora.

Campos propostos: - Fonte: `url`, `title`, `content`, `raw_content`,
`published_at`. - Coleta: `retrieved_at`, `provider`, `query`,
`request_id`. - Avaliação: `posture`, `justification`,
`temporal_status`, `limitations`.

Manter separados `search_score`, `source_authority`, `posture` e
`temporal_status`.

------------------------------------------------------------------------

# 5. Tecnologias e integrações

## 5.1 Bifrost

Bifrost é usado como gateway para chamadas ao modelo.

Comando utilizado para iniciar localmente:

``` bash
npx -y @maximhq/bifrost
```

O terminal deve permanecer aberto enquanto o serviço estiver sendo
usado.

Teste de disponibilidade executado:

``` bash
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:8080/v1/models
```

O retorno `HTTP 401` foi considerado esperado sem autenticação e
confirmou que o serviço estava respondendo.

Configuração registrada: - endpoint:
`http://localhost:8080/v1/chat/completions`; - modelo configurado:
`groq/openai/gpt-oss-20b`; - autenticação: header `x-bf-vk`, usando
`process.env.BIFROST_KEY`; - timeout: 90 segundos.

`src/bifrost.js` atualmente retorna o conteúdo da mensagem, mas não
retorna metadados completos de provedor/modelo/uso. É possível registrar
o modelo configurado e a versão do prompt, mas não afirmar que a
execução real foi independentemente comprovada sem instrumentação
adicional.

## 5.2 Tavily

Usado para busca e extração de conteúdo.

Configuração registrada em `src/tavily.js`: - autenticação por
`Authorization: Bearer ${process.env.TAVILY_API_KEY}`; - busca com
`max_results: 5`; - extração das três URLs principais; -
`extract_depth: basic`; - formato Markdown; - `include_images: false`.

A origem é identificada como: - `tavily_extract`, quando `raw_content`
está disponível; - `tavily_search`, quando o sistema precisa usar o
conteúdo do resultado de busca.

`data_publicacao` e `data_atualizacao` estavam nulos nas execuções reais
descritas.

Créditos registrados em 05/11: 27 de 9.000 utilizados. Evitar chamadas
desnecessárias. Também foi mencionado um bônus de US\$ 20 da Hugging
Face.

## 5.3 Persistência

SQLite foi escolhido por ser leve, local e suficiente para a primeira
versão de histórico/monitoramento.

`src/banco.js` usa `DatabaseSync` do Node e persiste o objeto completo
da fonte em JSON (`fonte_json`), preservando propriedades adicionais,
incluindo normalização.

Funções registradas incluem: - salvar verificação; - listar histórico; -
comparar coletas; - salvar avaliações de impacto.

------------------------------------------------------------------------

# 6. Módulos existentes e responsabilidades

Os caminhos abaixo foram mencionados durante o desenvolvimento. Conferir
o repositório antes de alterar, pois o estado pode ter evoluído.

  ---------------------------------------------------------------------
  Arquivo/módulo                     Responsabilidade
  ---------------------------------- ----------------------------------
  `src/verificador.js`               Orquestra o fluxo de verificação

  `src/bifrost.js`                   Comunicação com Bifrost/modelo

  `src/tavily.js`                    Busca e extração de fontes

  `src/preparar-evidencia.js`        Seleção/preparação de conteúdo
                                     relevante para uma afirmação

  `src/evidencia.js`                 Validação básica dos dados de
                                     evidência

  `src/correspondencia.js`           Verifica se a fonte corresponde à
                                     afirmação

  `src/classificador.js`             Classifica a postura da evidência

  `src/normalizar-fonte.js`          Normalização determinística de
                                     conteúdo

  `src/comparador-fontes.js`         Comparação de versões de fontes

  `src/banco.js`                     Persistência SQLite

  `src/historico.js`                 Exibição/consulta de histórico

  `src/agregador.js`                 Agregação das evidências em
                                     veredito

  `teste-evidencia.js`               Testes de validação de evidências

  `teste-classificador.js`           Testes do classificador

  `teste-agregador.js`               Testes do agregador
  ---------------------------------------------------------------------

------------------------------------------------------------------------

# 7. Correspondência e classificação

## 7.1 Correspondência

Estados registrados: - `MATCH`: a fonte trata do mesmo objeto/entidade
específico, ainda que possa haver diferenças de preço, condição,
período, quantidade ou atributo que serão avaliadas na etapa seguinte. -
`RELATED_INSUFFICIENT`: existe relação temática, mas não é possível
identificar correspondência suficiente com o objeto específico. -
`UNRELATED`: não há relação significativa com a afirmação. - Pode haver
estado de erro técnico, que nunca deve ser usado como evidência
decisória.

A correspondência `MATCH` não significa que a fonte apoia a afirmação.

## 7.2 Classificador

Posturas válidas: - `SUPPORTS`; - `CONTRADICTS`; - `INSUFFICIENT`; -
`IRRELEVANT`.

O classificador só deve ser executado como etapa decisória quando a
correspondência for `MATCH`.

Fontes `RELATED_INSUFFICIENT`, `UNRELATED` ou com erro não devem decidir
o veredito.

O prompt considera: - suporte e contradição; - tempo e contexto; -
unidades; - condições específicas.

A atualidade não deve ser inferida pelo classificador de postura.

O classificador ainda não registra de forma completa o identificador do
modelo e a versão do prompt. Isso é uma melhoria necessária para
rastreabilidade e comparação de versões.

## 7.3 Resultado de benchmark B010

Benchmark citado: - correspondência: 12/12 (100%); - classificador:
11/12 (91,67%); - sem falhas de execução ou casos não avaliados.

Caso Megabitplay: - afirmação: 200 Mega por R\$ 49,90; - o material da
fonte também continha tabela com R\$ 59,90; - o classificador ainda
retornou `SUPPORTS`, pois analisava uma evidência por vez e encontrou um
trecho de apoio.

Conclusão arquitetural: não era simplesmente um problema de prompt. Era
necessário agregar evidências e considerar contradições entre
fontes/trechos.

Esses números se referem àquele benchmark específico e não comprovam
acurácia geral.

------------------------------------------------------------------------

# 8. Atualidade temporal

## 8.1 Estados

-   `FRESH`: data declarada e válida dentro do limite configurado.
-   `STALE`: data declarada e válida fora do limite configurado.
-   `UNVERIFIABLE`: não há data confiável, ou a data é inválida, futura
    ou inconsistente.

`FRESH` significa que a data declarada está dentro da janela
configurada. Não prova que o conteúdo relevante foi revisado naquela
data.

## 8.2 Limites iniciais por categoria

  Categoria         Janela inicial
  --------------- ----------------
  Preço                    30 dias
  Versão de API            90 dias
  Empresa                 180 dias
  Regulação               365 dias

São regras iniciais do produto, não verdades universais. Precisam de
calibração empírica.

## 8.3 Regras importantes

-   A data de coleta nunca substitui a data da fonte.
-   Não inferir data de publicação ou atualização.
-   Datas ausentes, inválidas, futuras ou inconsistentes resultam em
    `UNVERIFIABLE`.
-   A data usada na avaliação deve ser registrada para permitir
    reprodução.
-   O agregador deve considerar `FRESH` somente quando existir data
    declarada válida.

## 8.4 Testes registrados

-   10 testes iniciais de atualidade.
-   8 testes de limites por categoria.
-   4 testes de entradas inválidas.
-   Uma última bateria relatada como 12/12.

Essas baterias foram executadas em momentos diferentes. Não somar
automaticamente os números como se fossem uma única suíte.

Em execuções reais, `data_publicacao` e `data_atualizacao` retornaram
`null`, então o estado foi `UNVERIFIABLE`.

------------------------------------------------------------------------

# 9. Validação de evidências

`evidencia.js` valida, entre outros itens: - URL HTTP(S); - título e
conteúdo; - tipo de coleta reconhecido; - data de coleta válida; -
relevância entre 0 e 1.

Limitações: - não valida autoridade da fonte; - não valida independência
entre fontes; - não valida verdade; - score de busca não é autoridade.

Testes registrados: - `teste-evidencia.js`: 15/15; -
`teste-classificador.js`: 6/6; - total relatado para essas duas suítes:
21/21.

Isso demonstra aprovação dos cenários programados, não precisão geral no
mundo real.

------------------------------------------------------------------------

# 10. Histórico, normalização e comparação de fontes

## 10.1 Princípio

Comparação de conteúdo deve ser determinística e separada da
interpretação semântica.

Preservar o conteúdo original. A normalização deve ser conservadora para
não apagar: - números; - datas; - condições; - ressalvas; - negações; -
parágrafos; - informações relevantes.

Não usar IA para decidir se duas páginas são iguais nesta etapa.

## 10.2 Problema encontrado: métodos de coleta incompatíveis

Um caso histórico comparou: - uma coleta `tavily_search`, que continha
apenas snippet; - uma coleta `tavily_extract`, que continha a página
extraída, com navegação e Markdown.

O hash mudou e o resultado inicial foi `CHANGED`, mas isso não provava
que a página havia mudado. Os métodos estavam coletando conteúdos de
natureza diferente.

Decisão: - comparar somente quando os métodos de coleta forem
compatíveis; - `tavily_search` versus `tavily_extract` deve resultar em
`NOT_COMPARABLE`; - preservar os registros antigos no histórico; - não
interpretar diferença de cobertura como mudança de conteúdo da página.

## 10.3 Normalização

Caminho citado: `src/normalizar-fonte.js`.

Versão citada: `VERSAO_NORMALIZACAO = "1.0.0"`.

Registro mais recente descreve: - Unicode NFC; - finais de linha LF; -
preservação de whitespace, parágrafos e texto original.

**Ponto a conferir:** registros anteriores mencionavam testes em que
diferenças de espaçamento eram ignoradas. Isso pode indicar mudança de
implementação ou divergência na descrição. Inspecionar o arquivo e os
testes atuais antes de afirmar exatamente quais transformações são
feitas.

A normalização deve ser versionada. Comparações devem considerar a
versão de normalização utilizada.

## 10.4 Comparador

Caminho citado: `src/comparador-fontes.js`.

Versão registrada: `1.2.0`.

Características descritas: - importa o normalizador; - usa normalização
persistida apenas quando status e versão são compatíveis; - caso
contrário, gera normalização a partir do conteúdo original; - usa hash
SHA-256; - usa LCS para detalhar diferenças; - limite de 1.200 tokens
para cálculo detalhado; - agrupa diferenças; - persiste resultados e
busca manter idempotência; - verifica compatibilidade entre métodos de
coleta.

A função legada `normalizarConteudo` permanece por compatibilidade, mas
não é usada no fluxo principal de comparação.

## 10.5 Estados de comparação

-   `NEW`: primeira coleta conhecida.
-   `UNCHANGED`: conteúdo equivalente após a normalização compatível.
-   `CHANGED`: hash diferente em comparação considerada compatível. Não
    prova, por si só, mudança semântica.
-   `NOT_COMPARABLE`: métodos ou condições de comparação incompatíveis.
-   `NOT_COMPUTED_LIMIT`: diferença detectada, mas o detalhamento por
    LCS não foi calculado por exceder o limite.

LCS compara palavras/texto, não significado. Testes mostraram detecção
de adições e remoções de preços, datas, condições, ressalvas e negações,
mas isso não garante interpretação semântica correta.

## 10.6 Testes e execuções históricas

Baterias relatadas em diferentes momentos: - comparador detalhado:
10/10; - histórico integrado: 6/6; - comparação contextual: 5/5; - outra
bateria de comparação: 8/8; - testes com contexto de preço: 8/8; - total
citado em um agrupamento: 21/21 para comparador + histórico + contexto.

Essas são suítes distintas, não devem ser somadas indiscriminadamente.

## 10.7 Caso real Alura

Comparação entre coletas de 3 e 5 de novembro: - status inicial:
`CHANGED`; - persistência realizada; - algoritmo: SHA-256 + LCS, versão
1.0.0; - conteúdo antigo: 1.229 caracteres / 193 tokens; - conteúdo
atual: 25.846 caracteres / 3.251 tokens; - LCS não calculado por exceder
1.200 tokens.

Na inspeção, descobriu-se que a coleta antiga era `tavily_search` e a
nova era `tavily_extract`, com navegação e Markdown. Portanto, não se
deve afirmar que o artigo mudou. Esse caso fundamentou a proteção
`NOT_COMPARABLE`.

## 10.8 Integração de busca, extração e histórico

Execução de integração registrada: - 5 resultados de busca; - 3
extrações bem-sucedidas; - 2 fontes mantidas com conteúdo da busca; - 0
falhas de extração; - 2 coletas persistidas no SQLite; - histórico com 2
registros; - comparação `UNCHANGED` para fontes com métodos de coleta
correspondentes.

`UNCHANGED` significa que o texto coletado ficou idêntico após a
normalização, não que toda a página publicada na web permaneceu
inalterada.

Conteúdos extraídos em algumas execuções tinham até 17 mil, 25.510 e
192.441 caracteres. O conteúdo original deve ser preservado, mantendo o
conteúdo preparado para o modelo em campo separado.

------------------------------------------------------------------------

# 11. Avaliação de impacto potencial

## 11.1 Separação essencial

O comparador detecta diferença textual. O avaliador de impacto estima se
a diferença pode ser relevante para a confiabilidade de uma afirmação.

A avaliação é uma hipótese baseada em sinais, não prova de impacto real.

## 11.2 Regras iniciais

A versão inicial é baseada em regras, sem inferência de modelo:

-   `ALTO`: alterações em preço, data/prazo, negação ou condições
    relevantes.
-   `MEDIO`: ressalva ou limitação.
-   `BAIXO`: alteração textual sem sinais relevantes detectados.
-   `INDETERMINADO`: informação insuficiente.

Formato de saída recomendado: - `estimativa_impacto` ou
`avaliacao_impacto`; - `metodo`; - `versao_regra`; - `nivel_estimado`; -
`sinais_detectados`; - `justificativa`; - `limites`; - `avaliado_em`.

Não escrever "impacto real" sem validação externa.

## 11.3 Limitações identificadas

As heurísticas podem disparar falsos positivos: - expressão "não
cumulativo" pode acionar sinais de negação e ressalva ao mesmo tempo; -
janela de proximidade de quatro tokens pode marcar condições sem relação
direta; - regras baseadas em palavras-chave precisam de avaliação
contextual.

## 11.4 Testes registrados

-   avaliador: 8/8;
-   falsos positivos: 3/3;
-   integração: 8/8;
-   um agrupamento reportou 40/40 para seis conjuntos (8 + 3 + 8 + 10 +
    6 + 5).

Também foram mencionados testes de persistência com 12 verificações, mas
a saída imprimiu "12/11". Isso parece erro no contador/relatório e
precisa ser corrigido. Não afirmar que essa suíte passou sem conferir a
execução atual.

------------------------------------------------------------------------

# 12. Agregador de evidências e veredito

## 12.1 Objetivo

O agregador recebe as evidências já coletadas, correspondidas,
classificadas e avaliadas temporalmente. Ele não deve fazer chamadas ao
Tavily ou ao Bifrost.

Sua função é produzir um veredito determinístico, transparente e
explicável.

## 12.2 Regras de entrada

Só podem participar da decisão: -
`correspondencia.status === "MATCH"`; - postura `SUPPORTS` ou
`CONTRADICTS`; - domínio válido; - demais condições de validade
definidas.

Não usar como evidência decisória: - `RELATED_INSUFFICIENT`; -
`UNRELATED`; - `INSUFFICIENT`; - `IRRELEVANT`; - erros técnicos.

Agrupar por domínio para reduzir contagem duplicada. A implementação
registrada agrupa pelo hostname exato, removendo `www`. Isso ainda pode
contar subdomínios de uma mesma organização como independentes; avaliar
agrupamento por domínio registrável quando necessário.

## 12.3 Autoridade da fonte

Domínios oficiais devem ser configurados explicitamente por
`dominiosOficiais`. Não inferir automaticamente que um domínio é
oficial.

Autoridade e atualidade são dimensões diferentes: - uma fonte oficial
pode não ter data; - uma fonte recente pode não ser oficial; - uma fonte
oficial sem data confiável não é evidência atual.

## 12.4 Vereditos propostos

-   `ATUAL`: evidência oficial e atual apoia a afirmação, sem
    contradição relevante de autoridade equivalente.
-   `CONTRADITA_POR_FONTE_ATUAL`: evidência oficial e atual contradiz a
    afirmação, sem apoio equivalente que impeça a conclusão.
-   `CONFLITO`: fontes independentes e comparáveis apresentam posturas
    opostas, sem critério suficiente para resolver.
-   `SUPORTE_FRACO`: existe apoio, mas autoridade, atualidade ou
    independência não são suficientes.
-   `NAO_VERIFICAVEL`: não há evidência utilizável para sustentar uma
    conclusão.

A expressão `CONTRADITA_POR_FONTE_ATUAL` é preferível a dizer
simplesmente que uma afirmação "estava errada". Uma afirmação pode ter
sido verdadeira no passado e ter mudado.

## 12.5 Estado da implementação do agregador

Arquivo criado: `src/agregador.js`.\
Testes: `teste-agregador.js`.\
Versão relatada: `1.0.0`.\
Última bateria relatada: 11/11 testes aprovados.

Lógica registrada na versão 1.0.0: - normaliza domínio removendo
`www`; - consulta lista explícita de domínios oficiais; - verifica datas
e status `FRESH`; - só aceita correspondência `MATCH` e posturas
`SUPPORTS`/`CONTRADICTS`; - agrupa por hostname; - calcula score com
componentes: - autoridade: até 40; - atualidade: até 30; -
independência: até 20; - concordância: até 10.

## 12.6 Problemas conhecidos da versão 1.0.0

Dois problemas foram identificados e uma revisão foi prometida, mas
ainda não foi entregue no contexto:

1.  Uma única fonte oficial atual podia produzir score 90, alto demais
    para uma evidência isolada.
2.  Uma contradição de fonte não oficial podia gerar `CONFLITO` mesmo
    quando havia apoio de fonte oficial atual.

A próxima ação técnica pendente é revisar integralmente
`src/agregador.js` e `teste-agregador.js`, com testes para os casos
abaixo.

## 12.7 Direção recomendada para a revisão

Regras desejadas:

-   Apoio oficial atual prevalece sobre contradição não oficial ou
    antiga, com a limitação registrada.
-   Contradição oficial atual prevalece sobre apoio não oficial ou
    antigo, com a limitação registrada.
-   Fontes oficiais atuais independentes em posições opostas geram
    `CONFLITO`.
-   Sem fonte oficial atual, fontes independentes comparáveis em
    posições opostas podem gerar `CONFLITO`.
-   Apenas apoio fraco resulta em `SUPORTE_FRACO`.
-   Apenas contradição fraca não deve ser suficiente para declarar a
    afirmação contradita; tende a `NAO_VERIFICAVEL`.
-   Mesmo domínio com páginas em posições opostas não deve ser tratado
    como confirmação independente. Definir comportamento conservador e
    documentar a limitação.

Score heurístico sugerido para avaliação: - autoridade: até 40; -
atualidade: até 30; - independência: 0 para uma fonte, até 20 para duas
ou mais fontes independentes; - concordância: até 10, apenas quando
houver pelo menos duas fontes independentes concordantes e sem oposição
equivalente.

Exemplo desejado: - uma única fonte oficial atual: score 70, não 90; -
duas fontes oficiais atuais independentes e concordantes: pode chegar a
100.

O score mede estrutura/qualidade do conjunto de evidências, não
probabilidade de verdade. Não fechar faixas ou interpretação do score
antes de benchmark rotulado.

## 12.8 Casos de teste obrigatórios para a revisão

1.  Uma fonte oficial atual apoiando: `ATUAL`, score sem inflar
    confiança.
2.  Fonte oficial atual apoiando + não oficial contradizendo: `ATUAL`,
    registrar ressalva.
3.  Fonte oficial atual contradizendo + não oficial apoiando:
    `CONTRADITA_POR_FONTE_ATUAL`, registrar ressalva.
4.  Duas fontes oficiais atuais independentes em posições opostas:
    `CONFLITO`.
5.  Apoio e contradição fracos, independentes e comparáveis: `CONFLITO`.
6.  Duas páginas do mesmo hostname não contam como duas fontes
    independentes.
7.  Fonte oficial sem data confiável não conta como atual.
8.  Fonte `RELATED_INSUFFICIENT` não entra no veredito.
9.  Fonte `UNRELATED` não entra no veredito.
10. Evidência com erro não entra no veredito.
11. Fonte antiga não deve superar uma fonte oficial atual apenas por
    existir.
12. Sem evidência utilizável: `NAO_VERIFICAVEL`.

------------------------------------------------------------------------

# 13. Benchmark próprio e validação

## 13.1 Prioridade P0

Construir dataset rotulado de 30 a 50 afirmações.

Critérios: - definir os critérios de rotulagem antes de rotular; -
rotular manualmente antes de olhar a saída do sistema; - registrar
fontes e datas; - congelar as evidências usadas no benchmark; - incluir
categorias como preço, versão de API, regulação e informações sobre
empresas; - misturar afirmações corretas, desatualizadas e incorretas; -
separar exemplos para ajuste (15--20) de um holdout final que não será
usado para tuning.

30--50 exemplos não formam um benchmark estatisticamente robusto, mas
ajudam a encontrar erros sistemáticos na primeira versão.

Registrar: - critérios de seleção; - decisão humana; - justificativa; -
fonte e data; - desacordos e adjudicação; - separação entre tuning e
holdout.

## 13.2 Métricas e análises desejadas

-   precisão por veredito;
-   falsos positivos e falsos negativos;
-   taxa de abstenção;
-   casos em que a fonte não tinha data;
-   conflitos resolvidos ou não resolvidos;
-   erros por categoria;
-   custo, tokens e latência;
-   estabilidade entre execuções.

Não anunciar uma acurácia global sem explicar tamanho, composição e
limitações do conjunto.

## 13.3 Valor atual e extração de valores

É importante mostrar o valor atual quando uma afirmação é contradita,
especialmente para preço, prazo ou versão.

A extração de valor deve ser uma etapa estruturada separada: - extrair
valor e unidade; - registrar trecho literal de origem; - registrar URL e
posição/âncora; - validar formato e contexto; - não usar regex genérica
como se fosse entendimento semântico completo.

------------------------------------------------------------------------

# 14. Arquitetura de comparação temporal em camadas

A visão de longo prazo separa quatro níveis:

## 14.1 Página

Chave baseada em URL + método de coleta + versão do normalizador.

Resultados: - `UNCHANGED`; - `CHANGED`; - `NOT_COMPARABLE`.

## 14.2 Trecho/âncora

Compara o mesmo trecho relevante da página ao longo do tempo.

Chave sugerida: - URL; - afirmação; - seção/contexto; - posição
auxiliar; - hash do trecho.

Resultados: - `UNCHANGED`; - `CHANGED`; - `ANCHOR_NOT_FOUND`.

A âncora deve considerar seção e texto estável ao redor. Posição
absoluta sozinha não é suficiente. Similaridade pode sugerir um
candidato, mas a âncora deve determinar se é o mesmo ponto.

## 14.3 Evidência

Compara a postura atribuída ao mesmo trecho em relação à mesma
afirmação, considerando a versão do classificador.

Se o texto não mudou, mas a classificação mudou, isso pode ser
instabilidade do classificador, não mudança da evidência.

Armazenar: - versão do modelo; - versão do prompt; - postura; -
justificativa; - limitações.

## 14.4 Veredito

Compara o resultado agregado considerando: - afirmação; - conjunto de
evidências; - versão das regras.

Registrar a causa da mudança: - página mudou; - trecho mudou; - conjunto
de fontes mudou; - versão do classificador mudou; - versão das regras
mudou; - passagem do tempo alterou a atualidade.

**Prioridade:** não construir toda essa pilha agora. O foco imediato é a
verificação da afirmação. O monitoramento temporal sustenta a proposta e
deve aparecer em uma demonstração simples e clara.

Mudança no conjunto de resultados do Tavily deve ser registrada como
mudança de cobertura do conjunto de evidências, não como mudança do
conteúdo da fonte.

------------------------------------------------------------------------

# 15. Execução real registrada em 5 de novembro de 2026

Afirmação testada:

> "O Node.js é um ambiente de execução de JavaScript."

Resultado: - 3 evidências retornadas pelo Tavily; - coleta registrada em
`2026-11-05T03:07:49.878Z`; - sem datas de publicação/atualização
fornecidas pelas fontes.

Fontes e observações: - Focus NFe: extração bem-sucedida, 17.992
caracteres, conteúdo preparado com 7.996 caracteres, correspondência
`MATCH`, postura `SUPPORTS`, atualidade `UNVERIFIABLE` por categoria
`UNKNOWN_CLAIM_TYPE`. - Quero Bolsa: a extração começou com o texto
"Nenhum resultado encontrado" antes do conteúdo do artigo; extração foi
marcada como bem-sucedida, correspondência `MATCH` e postura `SUPPORTS`.
Isso merece atenção na qualidade do conteúdo extraído. - Alura: extração
bem-sucedida, correspondência `MATCH` e postura `SUPPORTS`.

Essa execução demonstra o fluxo técnico, mas não é um benchmark de
precisão. A ausência de datas impede concluir que as evidências estavam
atuais.

------------------------------------------------------------------------

# 16. Referências e inspirações

Referências pesquisadas para orientar arquitetura e avaliação:

-   **AVeriTeC:** referência para formato de verificação de afirmações e
    anotação de evidências.
-   **RAGAS:** inspiração para decomposição em afirmações atômicas e
    avaliação estruturada/faithfulness.
-   **InvestigA:** referência de arquitetura de pipeline.
-   **FEVER:** referência de formato de dataset e exemplos.
-   **Documentação Bifrost:** referência para gateway, cache e
    observabilidade.

Decisões: - adotar decomposição em afirmações atômicas e avaliação
estruturada de forma nativa; - usar essas referências como inspiração,
sem instalar todas as ferramentas; - citar as referências no README; -
não apresentar esses projetos como se fossem implementações incorporadas
integralmente ao Entrelinhas.

Foi registrado que a anotação de AVeriTeC já havia sido consultada.

------------------------------------------------------------------------

# 17. Roadmap priorizado

## P0 --- núcleo confiável e demo

1.  Revisar o agregador e seus testes, corrigindo score e precedência de
    autoridade/atualidade.
2.  Criar dataset rotulado de 30--50 afirmações, com holdout.
3.  Garantir rastreabilidade de data usada na avaliação temporal.
4.  Registrar versão de modelo/prompt quando possível.
5.  Rodar 10 afirmações reais de ponta a ponta.
6.  Produzir relatório legível por afirmação com:
    -   afirmação;
    -   fontes;
    -   trechos que apoiam;
    -   trechos que contradizem;
    -   veredito;
    -   score e explicação;
    -   atualidade;
    -   limitações.
7.  Preparar uma demonstração temporal clara.
8.  Garantir instruções reproduzíveis de instalação e execução.

Critério de pronto para P0: - pelo menos 10 afirmações reais
executadas; - relatório compreensível; - evidências e limitações
rastreáveis; - nenhuma conclusão forçada quando não há dados
suficientes.

## P1 --- robustez e avaliação

-   benchmark de confiabilidade de fontes;
-   fixtures de fontes reais;
-   testes de prompt injection;
-   benchmark de impacto em português;
-   telemetria de custo, tokens e latência;
-   testes de estabilidade;
-   deduplicação e diversidade de fontes;
-   busca explícita por contraevidências.

## P2 --- demo e entrega

-   README;
-   setup;
-   screenshots;
-   exemplos;
-   pitch deck;
-   vídeo opcional;
-   preparação do repositório público.

## P3 --- evolução

-   comparação de trechos ancorados;
-   monitoramento contínuo;
-   revalidação adaptativa;
-   expansão de regras de atualidade e impacto;
-   comparação entre versões de classificador e agregador;
-   painel de histórico e explicabilidade.

------------------------------------------------------------------------

# 18. Problemas conhecidos e itens a verificar

1.  **Agregador:** revisão prometida da versão 1.0.0 ainda pendente no
    histórico disponível.
2.  **Score:** uma fonte oficial atual gerava score excessivo (90).
3.  **Conflito:** contradição não oficial podia gerar conflito contra
    fonte oficial atual.
4.  **Independência:** agrupamento por hostname pode contar subdomínios
    da mesma organização como fontes independentes.
5.  **Datas:** Tavily retornou datas nulas em execuções reais;
    atualidade frequentemente `UNVERIFIABLE`.
6.  **Categoria desconhecida:** afirmação sobre Node.js resultou em
    `UNKNOWN_CLAIM_TYPE`.
7.  **Extração:** caso Quero Bolsa incluiu "Nenhum resultado encontrado"
    no conteúdo extraído.
8.  **Normalização:** há divergência entre a descrição mais recente
    (preserva whitespace) e notas antigas (espaçamento normalizado).
    Inspecionar código e testes.
9.  **Persistência de impacto:** teste reportou "12/11", provável
    problema de contador.
10. **Histórico:** `src/historico.js` pode repetir cabeçalhos de
    comparação/avaliação para cada URL.
11. **Exibição de impacto:** `exibirAvaliacoesImpacto` pode não estar
    lendo o campo mapeado `registro.avaliacao`.
12. **Metadados Bifrost:** `src/bifrost.js` não retorna metadados
    completos de modelo/provedor/uso.
13. **Classificador:** não registra ainda versão de modelo/prompt de
    forma completa.
14. **Valor atual:** extração estruturada de valores e referência exata
    do trecho ainda precisa ser implementada.
15. **Benchmark:** resultados de testes unitários não substituem dataset
    rotulado com exemplos reais.

------------------------------------------------------------------------

# 19. Como trabalhar no projeto nas próximas conversas

## 19.1 Forma de orientar

A usuária prefere instruções: - em português brasileiro; - diretas e
didáticas; - uma tarefa por vez; - com decisões técnicas conduzidas pelo
assistente; - sem excesso de opções para escolher; - com o caminho exato
do arquivo; - indicando claramente se é para substituir o arquivo
inteiro; - com o código completo quando houver alteração; - com o
comando de terminal exato; - com o resultado esperado para validar.

A usuária pediu explicitamente que as mudanças sejam enviadas completas,
pois alterações parciais a deixam mais confusa.

Evitar travessão (---) nas respostas.

## 19.2 Formato recomendado para cada mudança técnica

1.  Explicar em poucas linhas o que será corrigido e por quê.
2.  Informar o caminho exato do arquivo.
3.  Dizer explicitamente: "substitua o arquivo inteiro" ou "adicione
    este trecho".
4.  Fornecer o conteúdo completo quando for substituição.
5.  Informar o comando exato para executar.
6.  Dizer qual saída esperar.
7.  Interpretar o resultado antes de avançar.

Não pedir à usuária para decidir questões técnicas que podem ser
resolvidas com base nos requisitos e no estado do projeto. Se faltar uma
informação essencial, fazer uma pergunta objetiva.

## 19.3 Cuidado com afirmações de progresso

-   Não dizer que algo está implementado sem verificar o arquivo ou o
    teste.
-   Não dizer que algo está validado em produção só porque um teste
    unitário passou.
-   Não somar baterias de testes diferentes como se fossem uma única
    métrica.
-   Diferenciar teste automatizado, execução real e benchmark rotulado.
-   Quando o estado atual do repositório for desconhecido, pedir o
    arquivo ou a saída do comando necessário, em vez de presumir.
-   Ao retomar em um novo chat, usar este documento como contexto
    inicial e confirmar o estado atual do repositório antes de modificar
    código.

------------------------------------------------------------------------

# 20. Próxima ação técnica pendente

A próxima alteração que já havia sido combinada antes da consolidação
deste documento é:

**Revisar integralmente `src/agregador.js` e `teste-agregador.js`.**

Objetivos: - impedir que uma única fonte oficial atual gere score 90; -
impedir que contradição não oficial supere apoio oficial atual; -
definir precedência clara entre autoridade e atualidade; - evitar que
páginas do mesmo domínio contem como independentes; - testar os 12 casos
listados na seção 12.8; - manter o score como indicador heurístico de
estrutura da evidência, nunca como probabilidade de verdade.

Essa alteração ainda não deve ser considerada concluída até que os
arquivos sejam revisados e os testes executados no repositório.

------------------------------------------------------------------------

# 21. Glossário rápido

  ---------------------------------------------------------------------
  Termo                              Significado no Entrelinhas
  ---------------------------------- ----------------------------------
  Afirmação/claim                    Proposição que será verificada

  Evidência                          Conteúdo de uma fonte usado para
                                     avaliar uma afirmação

  Correspondência                    Avaliação de se a fonte trata do
                                     mesmo objeto específico

  Postura                            Relação do conteúdo com a
                                     afirmação: apoio, contradição ou
                                     insuficiência

  Atualidade                         Avaliação baseada em data
                                     declarada e janela temporal
                                     configurada

  Data de coleta                     Momento em que o Entrelinhas
                                     obteve o conteúdo

  Autoridade                         Nível de autoridade
                                     atribuído/configurado para uma
                                     fonte

  Independência                      Evidências provenientes de fontes
                                     efetivamente distintas

  Agregador                          Módulo que combina evidências em
                                     um veredito

  Normalização                       Transformação determinística e
                                     versionada do conteúdo para
                                     comparação

  Hash                               Identificador calculado a partir
                                     do conteúdo normalizado

  LCS                                Algoritmo para encontrar
                                     subsequência comum e detalhar
                                     diferenças textuais

  Âncora                             Referência a um trecho específico
                                     de uma fonte

  Abstenção                          Decisão de não afirmar uma
                                     conclusão quando a evidência não
                                     permite

  Holdout                            Parte do benchmark reservada para
                                     avaliação final, sem tuning
  ---------------------------------------------------------------------

------------------------------------------------------------------------

**Fim do documento.**\
Este arquivo deve ser atualizado sempre que uma decisão arquitetural
mudar, um módulo for concluído, um teste relevante for executado ou uma
limitação for descoberta. Registrar data, arquivo afetado, decisão,
motivo e evidência de validação.

------------------------------------------------------------------------

# ADENDO --- CONTEXTO RECUPERADO DE CONVERSAS ANTERIORES

## Complementos importantes identificados após a primeira consolidação

**Data do adendo:** 5 de novembro de 2026

Este adendo registra detalhes que apareceram em conversas anteriores e
não estavam suficientemente explícitos no documento principal. Ele
também diferencia decisões iniciais de arquitetura da implementação que
existe hoje.

------------------------------------------------------------------------

# 22. Visão original do Freshness Guard: atuar no ciclo de vida da resposta

## 22.1 A proposta inicial era maior do que verificar respostas depois de geradas

A primeira concepção do Freshness Guard não era somente receber uma
resposta pronta, procurar fontes e classificá-la. A proposta também
previa uma camada de controle temporal integrada ao fluxo de geração e
cache de aplicações com IA.

O conceito original tinha três momentos:

1.  **Antes da geração:** estimar a sensibilidade temporal da
    solicitação.
2.  **Depois da geração:** decompor a resposta em afirmações e verificar
    evidências.
3.  **Quando houver reutilização de resposta em cache:** revalidar a
    resposta e decidir se ela ainda pode ser servida.

Isso é estrategicamente importante para posicionar o Entrelinhas como
infraestrutura de confiabilidade para aplicações de IA, e não apenas
como uma ferramenta isolada de fact-checking.

## 22.2 Política inicial de cache por sensibilidade temporal

Proposta inicial:

  Sensibilidade da informação   Política sugerida
  ----------------------------- -------------------------------------
  Estável                       TTL mais longo
  Sensível ao tempo             TTL mais curto
  Não foi possível determinar   `no-store` ou política conservadora

Exemplos conceituais: - Definições estáveis e conceitos fundamentais
podem tolerar cache mais longo. - Preços, disponibilidade, versões de
software, notícias e prazos precisam de revalidação mais frequente. -
Quando o sistema não consegue determinar a sensibilidade temporal, não
deve assumir que uma resposta pode ser reutilizada com segurança.

Os TTLs concretos ainda precisam ser definidos por categoria, risco e
benchmark. Não há evidência registrada de que essa política já esteja
implementada no cache do Bifrost.

## 22.3 Revalidação em cache hit

Fluxo proposto:

1.  Uma aplicação solicita uma resposta.
2.  O sistema identifica a sensibilidade temporal da solicitação.
3.  A política define se a resposta pode ser armazenada e por quanto
    tempo.
4.  A resposta é gerada e suas afirmações são verificadas.
5.  O sistema persiste a solicitação, as afirmações, a categoria
    temporal, as evidências e o resultado.
6.  Quando houver cache hit, o sistema reavalia a validade temporal da
    resposta armazenada.
7.  Se a evidência estiver vencida, houver mudança relevante ou a
    resposta não puder ser validada, o cache deve ser invalidado e a
    resposta regenerada ou submetida a nova verificação.

A invalidação por eventos foi considerada complexa demais para o MVP e
ficou fora da primeira versão. A abordagem inicial prioriza TTL e
revalidação no momento do cache hit.

**Status:** proposta arquitetural inicial; não considerar implementada
até existir integração e teste demonstrável de cache, TTL, revalidação,
invalidação e regeneração.

## 22.4 Dados que deveriam ser persistidos para esse fluxo

Além dos dados já descritos no modelo de verificação, a visão original
previa registrar: - identificador da requisição; - resposta gerada; -
afirmações extraídas; - categoria/sensibilidade temporal; - política de
cache aplicada; - TTL definido; - momento de geração; - evidências
utilizadas; - resultado da verificação; - momento da última
revalidação; - motivo de invalidação, quando houver.

Isso permitiria explicar por que uma resposta foi armazenada,
reutilizada, revalidada ou descartada.

------------------------------------------------------------------------

# 23. Integração com Bifrost: requisito estratégico e risco de avaliação

## 23.1 Intenção para as duas trilhas

A decisão estratégica foi construir **um único produto que atendesse às
duas frentes do hackathon**: - Bifrost como trilha principal; -
Stale-Answer Detector/Tavily como trilha complementar.

A intenção não era criar dois projetos desconectados, mas demonstrar uma
camada de confiabilidade que usa o gateway e as evidências externas em
um único fluxo.

## 23.2 Integração via API versus extensão nativa

Nas conversas iniciais, foi levantada a possibilidade de uma
extensão/plugin nativo em Go para Bifrost, mas isso não foi confirmado
como implementado nem como requisito técnico definitivo.

Depois, a integração HTTP padrão com Bifrost foi tratada como compatível
com o uso do gateway. Ainda assim, existe um risco estratégico que
precisa ser validado antes da submissão:

**Chamar o endpoint do Bifrost demonstra uso do gateway, mas não prova
automaticamente que o Entrelinhas estende ou adiciona uma capacidade ao
próprio gateway.**

Para fortalecer a trilha Bifrost, a demonstração deve deixar claro: - em
que ponto o Entrelinhas se conecta ao fluxo do gateway; - qual
capacidade adicional oferece; - como a política temporal influencia
geração, cache ou reutilização; - o que o Bifrost faz e o que o
Entrelinhas faz; - como a integração pode ser reproduzida por outra
aplicação.

Não afirmar que existe plugin, middleware nativo ou extensão Go sem
código e documentação que comprovem isso.

## 23.3 Pergunta de validação obrigatória

Antes de fechar a arquitetura de submissão, conferir o enunciado oficial
da problem statement Bifrost escolhida e responder:

-   A integração atual por API atende literalmente aos critérios?
-   A trilha exige uma extensão, plugin, contribuição ao gateway ou
    apenas uma aplicação construída sobre Bifrost?
-   Qual demonstração técnica comprova o requisito?
-   Qual parte do código mostra a integração?

Se a chamada HTTP padrão não for suficiente para a problem statement,
será necessário ajustar a integração. Não presumir elegibilidade apenas
porque o modelo foi chamado através do Bifrost.

------------------------------------------------------------------------

# 24. Estratégia de fontes e relevância social

## 24.1 Prioridade inicial para fontes brasileiras oficiais

A direção inicial do produto foi priorizar fontes oficiais brasileiras,
mantendo arquitetura extensível para outras regiões e idiomas.

A intenção é que o Entrelinhas possa ser reutilizado em: - chatbots; -
agentes; - sistemas corporativos; - aplicações que respondem perguntas
sobre políticas, regras, serviços e informações que mudam com o tempo.

Fontes oficiais brasileiras podem ser uma vantagem de foco e
diferenciação, desde que autoridade seja configurada explicitamente e
não inferida apenas pelo nome ou aparência do domínio.

## 24.2 Relevância social como critério de produto

A escolha do Freshness Guard foi motivada também pela busca de um
problema socialmente relevante, tecnicamente profundo e com potencial de
evolução.

Informações desatualizadas em sistemas de IA podem induzir pessoas e
organizações a decisões ruins, especialmente quando envolvem: - regras e
serviços públicos; - prazos; - políticas e regulamentações; - preços e
condições comerciais; - disponibilidade; - versões e requisitos
técnicos.

Esses são exemplos de áreas de aplicação, não resultados de validação de
mercado nem promessas de que o sistema já é seguro para decisões de alto
risco.

O Entrelinhas deve priorizar transparência, fonte rastreável e
abstenção. Não deve se apresentar como autoridade jurídica, médica,
financeira ou governamental.

------------------------------------------------------------------------

# 25. Evolução das propostas de score: não misturar fórmulas

Em uma proposta arquitetural inicial foi sugerida a fórmula
experimental:

`S = 0.40T + 0.35A + 0.25C`

Onde: - `T`: atualidade temporal; - `A`: autoridade da fonte; - `C`:
corroboração.

A escala proposta era de 0 a 100. A proposta também dizia que, sem
evidência suficiente, o resultado deveria ser `UNVERIFIABLE`, sem score.

Posteriormente, o agregador passou a ter uma composição diferente, com
componentes de autoridade, atualidade, independência e concordância.

**Decisão de documentação:** tratar a fórmula `0.40T + 0.35A + 0.25C`
como uma proposta exploratória anterior, não como fórmula atual nem como
implementação confirmada. Não combinar essa fórmula com a composição
posterior do `src/agregador.js`.

Antes de adotar qualquer score: - definir precisamente cada variável; -
documentar escala e normalização; - evitar dupla contagem entre
corroboração, independência e concordância; - testar contra dataset
rotulado; - verificar calibração por categoria; - nunca chamar o score
de probabilidade de verdade.

Se a evidência for insuficiente, manter `NAO_VERIFICAVEL`/`UNVERIFIABLE`
sem fabricar um número que transmita confiança inexistente.

------------------------------------------------------------------------

# 26. Estado do repositório e execução: detalhes recuperados

## 26.1 Estrutura da raiz observada

Em uma inspeção anterior, a raiz do projeto continha: - `index.js`; -
diretório `src/`; - diretório `dados/`; - `historico.js`; - arquivos
`package.json` e lockfile; - diretório `node_modules/`; - vários
arquivos `teste-*.js`.

Essa é uma fotografia histórica da estrutura em 4--5 de novembro de
2026. Conferir a árvore atual antes de assumir que continua igual.

## 26.2 `package.json` observado

Configuração registrada: - CommonJS; - `main`: `index.js`; - descrição:
"Freshness-aware evidence verification layer for AI applications"; -
palavras-chave incluem `bifrost` e `tavily`; - dependência declarada:
`dotenv` na versão `^18.0.9`; - script `test` executa:
`node teste-atualidade.js && node teste-evidencia.js && node teste-preparar-evidencia.js` -
script `test:benchmark` executa: `node teste-benchmark.js` - não havia
script `start` registrado.

A lista de scripts não necessariamente executa todas as suítes criadas
depois. Antes de declarar que `npm test` cobre o projeto inteiro,
conferir o `package.json` atual e os testes existentes.

## 26.3 Cuidado com `index.js`

Foi inspecionado e identificado como um teste de integração com pergunta
fixa sobre a versão estável mais recente do Node.js, chamando: -
`perguntarAoModelo` de `src/bifrost`; - `pesquisarComTavily` de
`src/tavily`.

Ele imprime resposta do modelo e metadados de evidência, mas não
representa o fluxo completo do Entrelinhas.

Pode consumir créditos de API. Não executar repetidamente sem
necessidade.

Apesar de `package.json` apontar `index.js` como `main`, isso não
significa que o arquivo seja um entrypoint de produto pronto para uso
externo. A ausência de script `start` também deve ser considerada na
documentação de setup.

## 26.4 Função principal `verificarTexto()`

Foi identificada em `src/verificador.js` como o fluxo mais completo de
verificação disponível.

Comportamento registrado: 1. recebe um texto; 2. decompõe em afirmações;
3. pesquisa evidências com Tavily; 4. prepara o conteúdo para análise;
5. avalia correspondência; 6. classifica postura quando há
correspondência; 7. avalia atualidade; 8. salva a verificação completa
no banco; 9. retorna um `id_verificacao`.

Parâmetros/opções mencionados: - `dataReferencia`; -
`tiposPorAfirmacao`; - quantidade de evidências configurável entre 1 e
5, com até 3 por padrão na execução descrita.

Também foi registrada lógica de até três tentativas para lidar com rate
limits em chamadas pertinentes.

**Atenção:** conferir assinatura e implementação atuais antes de
fornecer um exemplo de chamada. O histórico confirma os nomes das
opções, mas não preserva aqui a assinatura completa e todos os tipos
esperados.

A usuária havia pedido para descobrir a forma correta de chamar
`verificarTexto()` sem criar outro arquivo nem alterar o projeto naquele
momento. Respeitar isso ao retomar: primeiro inspecionar a exportação e
a assinatura existentes, sem criar arquivos desnecessários.

## 26.5 Histórico de configuração do modelo Bifrost

Em uma conversa anterior foi registrada configuração: - endpoint
`http://localhost:8080/v1/chat/completions`; - header `x-bf-vk`; -
modelo `gemini/gemini-3.7-flash`; - timeout de 90 segundos.

Em registro posterior, a configuração usada era: - modelo
`groq/openai/gpt-oss-20b`.

Também houve resposta HTTP 503 atribuída a alta demanda em uma tentativa
anterior.

Isso indica que a configuração do modelo mudou ou foi testada em mais de
uma etapa. Não tratar ambos os modelos como simultaneamente ativos.
Conferir `src/bifrost.js`, configuração local e variáveis de ambiente
antes de executar. A chave de acesso não deve ser incluída neste
documento, no Git ou em mensagens.

------------------------------------------------------------------------

# 27. Segurança, robustez e rastreabilidade: requisitos a explicitar

Alguns requisitos decorrem diretamente da arquitetura e merecem ser
tratados como critérios de qualidade, mesmo quando ainda não estão
implementados.

## 27.1 Prompt injection em conteúdo recuperado

Conteúdo de páginas externas deve ser tratado como dado não confiável,
nunca como instrução para o modelo.

O sistema deve: - separar instruções do sistema e conteúdo da fonte; -
delimitar claramente trechos recuperados; - não executar comandos
presentes em páginas; - testar ataques em snippets e páginas
extraídas; - registrar falhas e comportamento de abstenção.

Os testes iniciais de prompt injection mencionados no histórico são
positivos, mas não comprovam resistência geral.

## 27.2 Rastreabilidade de cada conclusão

Para cada evidência utilizada, o resultado ideal deve permitir
recuperar: - URL; - título; - provedor e método de coleta; - momento da
coleta; - data declarada pela fonte, se houver; - trecho exato usado; -
correspondência; - postura; - justificativa; - limitações; -
modelo/prompt/regra e versões relevantes.

Uma conclusão sem ligação clara às evidências que a sustentam não atende
à proposta central do Entrelinhas.

## 27.3 Falhas e abstenção

O sistema deve diferenciar: - fonte indisponível; - falha de extração; -
limite de API/rate limit; - conteúdo vazio ou inválido; - fonte não
correspondente; - evidência insuficiente; - data não verificável; -
conflito real entre evidências.

Falha técnica não deve ser convertida em `CONTRADICTS`, e ausência de
resultado não deve ser convertida em falsidade.

------------------------------------------------------------------------

# 28. Narrativa de demonstração recomendada

Uma demonstração forte deve mostrar uma situação simples em que uma
resposta que parecia aceitável deixa de ser segura para reutilização
depois que a evidência muda ou envelhece.

Sequência sugerida: 1. Apresentar uma afirmação temporalmente sensível.
2. Mostrar a fonte e o trecho que inicialmente a apoia. 3. Mostrar a
data declarada e a data de coleta separadamente. 4. Mostrar a
verificação e o veredito inicial. 5. Apresentar uma nova coleta
comparável. 6. Mostrar exatamente o que mudou no conteúdo. 7. Mostrar se
a mudança afeta preço, prazo, condição, versão ou outra informação
relevante. 8. Mostrar a reavaliação da evidência e do veredito. 9.
Explicar a decisão: manter, revalidar, invalidar, abster-se ou
regenerar.

Não usar uma comparação entre `tavily_search` e `tavily_extract` como
prova de mudança. A demonstração precisa usar métodos comparáveis e
conteúdo preservado.

Se a integração de cache ainda não estiver pronta, demonstrar o
histórico e a reavaliação sem afirmar que o sistema já invalida
automaticamente respostas no Bifrost.

------------------------------------------------------------------------

# 29. Novos critérios de pronto antes da submissão

Além dos critérios P0 já registrados, considerar estes critérios de
aceite:

-   [ ] A problem statement Bifrost escolhida foi conferida e a
    integração implementada atende explicitamente ao requisito.
-   [ ] Está documentado o que é responsabilidade do Bifrost e o que é
    responsabilidade do Entrelinhas.
-   [ ] O README não descreve `index.js` como fluxo completo se ele
    continuar sendo apenas um teste de integração.
-   [ ] Existe um comando de execução documentado que chama o fluxo
    completo `verificarTexto()`, se isso fizer parte da demo.
-   [ ] A demonstração temporal usa coletas comparáveis.
-   [ ] Datas de coleta e datas declaradas pela fonte aparecem
    separadas.
-   [ ] O resultado apresenta trechos e URLs que justificam cada
    postura.
-   [ ] O sistema se abstém quando não há evidência suficiente.
-   [ ] Falhas de API, extração e rate limit aparecem como falhas
    técnicas, não como conclusões factuais.
-   [ ] O score é explicado e não é apresentado como probabilidade.
-   [ ] As limitações do benchmark e dos testes estão documentadas.
-   [ ] Nenhuma chave ou segredo foi commitado no repositório público.
-   [ ] A instalação e execução podem ser reproduzidas em ambiente
    limpo.

------------------------------------------------------------------------

**Fim do adendo.**

------------------------------------------------------------------------

# 30. Enquadramento oficial das trilhas Bifrost B4 + Tavily T1

**Atualizado em 11/11/2026.** Esta seção registra a decisão vigente para
a submissão e substitui qualquer enquadramento anterior que coloque T1
como problem statement primária.

## 30.1 Seleção decidida

- **Bifrost Priority Track:** B4 — *Open-Source Bifrost Gateway*.
- **Tavily Track Partner:** T1 — *Build a Stale-Answer Detector for AI
  Applications*.
- **Estratégia:** um só projeto integrado; B4 é a seleção principal e
  T1 é a integração/desafio adicional.

Na plataforma, selecionar B4 como problema principal e indicar Tavily
como integração adicional no campo opcional correspondente. A regra
geral do evento permite projetos que usem somente Bifrost, somente
Tavily ou ambos; a seleção das duas frentes é a decisão estratégica
deste projeto para concorrer nas duas trilhas, não uma obrigação geral
imposta a todos os participantes.

## 30.2 Enunciados e regras confirmados

O B4 pede uma funcionalidade prática para o gateway open-source, por
exemplo plugin, integração de provedor, cache/roteamento, interface ou
ferramenta de desenvolvimento. A solução deve usar pontos de extensão
suportados, funcionar com uma instalação padrão, ter configuração,
documentação e testes claros, e ser apropriada para consideração como
pull request upstream.

O T1 pede um sistema que detecte afirmações possivelmente desatualizadas
em respostas de LLM, com foco em preços, versões de API, regulações e
informações sobre empresas; que revalide essas afirmações em fontes web
atuais e forneça um freshness score por afirmação, ajudando a distinguir
informação atual e confiável de conteúdo potencialmente obsoleto. O
enunciado pede uso de Tavily e Bifrost.

Para projetos combinados, a plataforma manda escolher o desafio
Bifrost como principal e preencher a opção Tavily adicional, explicando
como cada tecnologia contribui. Repositório GitHub público e detalhado,
README e pitch deck são exigidos. Aplicação publicada e vídeo são
opcionais, salvo solicitação específica do formulário. Os critérios
publicados incluem inovação, execução técnica, problema/impacto, uso de
IA, experiência do usuário, escalabilidade e potencial.

Fontes oficiais consultadas:

- Página do evento e textos de B4/T1: https://hackculture.io/hackathons/ai-global-hackathon
- Regras e instruções de projeto combinado: seção Schedule/Rules na
  página oficial acima.
- Página Geek Room: https://www.geekroom.co.in/event/global-ai-hackathon
- Guia de plugins Bifrost:
  https://github.com/maximhq/bifrost/blob/dev/docs/plugins/getting-started.mdx
- Configuração documentada do semantic cache:
  https://github.com/maximhq/bifrost/blob/dev/docs/deployment-guides/helm/plugins.mdx
- API do pacote semantic cache, incluindo TTL e no-store internos por
  `BifrostContext`: https://pkg.go.dev/github.com/maximhq/bifrost/plugins/semanticcache

## 30.3 Aderência real do estado atual

### T1 — parcialmente implementado

O fluxo atual de `src/verificador.js` decompõe o texto, pesquisa e extrai
fontes com Tavily, solicita ao modelo via Bifrost análise de
correspondência/postura, avalia datas e agrega um resultado cauteloso.
Os resultados incluem estados temporais por evidência (`FRESH`, `STALE`
ou `UNVERIFIABLE`) e síntese por afirmação.

Não há um campo de **freshness score por afirmação** demonstrado. O
`score_qualidade_evidencia` de `src/agregador.js` é um score de qualidade
da evidência agregada; não deve ser renomeado nem apresentado como score
de atualidade. Também faltam interface/serviço publicado e uma avaliação
ao vivo com conjunto de casos amplo. Portanto, T1 tem implementação
substancial, mas não está completo conforme o enunciado.

### B4 — não implementado no repositório atual

`src/bifrost.js` chama `/v1/chat/completions` e registra alguns
metadados. Isso comprova uso do Bifrost como gateway, mas não cria uma
funcionalidade dentro do gateway, não implementa plugin Bifrost, não
modifica o semantic cache e não oferece uma contribuição upstream.
Assim, o estado atual não atende B4.

## 30.4 Lacuna e proposta candidata B4 (novidade ainda não confirmada)

A ideia inicial de “adicionar TTL por requisição” foi retirada como
proposta de novidade: o pacote oficial `github.com/maximhq/bifrost/plugins/semanticcache`
já documenta `CacheTTLKey` como override de `Config.TTL` por requisição e
`CacheNoStoreKey` para não gravar a resposta. Ambos são valores de
`BifrostContext`, configurados antes da requisição entrar no pipeline.
Portanto, esses controles internos já existem; não os apresentar como
funcionalidade a ser criada.

**Candidato concreto ainda a confirmar:** expor por meio da interface
HTTP/API suportada do Bifrost uma política de cache baseada na atualidade
da evidência, conectada aos controles internos existentes e sujeita a um
limite rígido configurado pelo operador. A aplicação chamadora enviaria
prazo/decisão de atualidade; o gateway validaria e limitaria esse valor,
aplicaria o TTL interno ou bypass/no-store para conteúdo stale,
unverifiable ou sem política confiável. Uma requisição nunca poderia
ampliar o limite do operador.

Ainda não foi confirmado se o transporte HTTP atual já oferece um meio
suportado de mapear um campo/header para esses context values, nem se há
um teto de TTL configurável pelo operador. Portanto, nem a lacuna nem a
novidade desse candidato estão provadas. Antes de código, examinar o
ingress HTTP e a versão exata do plugin; confirmar contrato, confiança no
cliente, clamp, streaming, modo padrão e suporte a instalação normal com
os mantenedores. Só então decidir se existe trabalho B4 real ou se o
conceito pode ser feito hoje por integração sem qualquer mudança no
Bifrost.

## 30.5 Risco de duplicidade e diferenciação

Foi encontrada a issue pública
https://github.com/maximhq/bifrost/issues/9748, aberta em 08/11/2026,
com uma proposta chamada FreshGuard: plugin que revalida afirmações com
Tavily e adiciona metadados por resposta/stream. Essa proposta se
sobrepõe diretamente à ideia genérica de “criar um plugin de freshness”.
Não reivindicar essa ideia ampla como novidade exclusiva do Entrelinhas.

A hipótese de contribuição diferenciada é tornar essa política temporal
acessível aos clientes HTTP e impor um teto do operador, em vez de apenas
anexar um relatório de checagem à resposta. A hipótese depende de auditoria
do código Bifrost e de validação com os mantenedores; até lá, é apenas
proposta, não implementação nem prova de lacuna.

## 30.6 Condição de submissão honesta

Não descrever o projeto como atendendo B4 até haver uma funcionalidade
no próprio Bifrost ou plugin suportado, reproduzível em instalação
padrão, com documentação/testes e artefato de integração claro. O próximo
passo técnico é uma análise read-only da versão Bifrost em uso e do
semantic cache upstream, seguida de uma especificação revisável. A
alteração de produção requer autorização separada.

Até isso estar concluído, os materiais podem apresentar a seleção B4 +
T1 e a proposta B4 explicitamente rotulada como planejada; não podem
afirmar que B4 já foi implementado.

## 31. Correção oficial da seleção do Problem Statement — 11/11/2026

A captura do formulário mostra um único campo obrigatório “Problem
Statement” e uma pergunta separada para marcar um problema Tavily
adicional (ou deixar em branco). A lista completa de seis enunciados
fornecida nesta conversa confirma que **Build a Stale-Answer Detector
for AI Applications** é uma opção principal disponível e exige Tavily e
Bifrost juntos.

**Seleção aprovada pelo usuário:** Build a Stale-Answer Detector for AI
Applications. **Open-Source Bifrost Gateway (B4) não está selecionado.**
Bifrost permanece como tecnologia exigida pelo desafio escolhido, não
como uma segunda trilha nem como contribuição nova ao gateway.

Esta decisão substitui as seções 30.1 e 30.6 e qualquer documento que
oriente selecionar B4 como problema principal. Não implementar a proposta
de extensão de cache B4 para esta submissão.

Pré-requisitos de produto para aderir honestamente ao desafio escolhido:

1. Implementar um freshness score por afirmação com definição explícita,
   distinguindo-o de `score_qualidade_evidencia` e dos estados
   `FRESH`/`STALE`/`UNVERIFIABLE`. **Protótipo implementado; falta
   calibração e avaliação em evidências reais anotadas.**
2. Demonstrar entrada de resposta gerada por LLM, rechecagem das
   afirmações com Tavily e análise via Bifrost. **Fluxo existe no backend;
   falta validar uma demonstração real controlada ponta a ponta.**
3. Avaliar casos atuais, desatualizados, conflitantes e sem datas, com
   conjunto rotulado e resultados reproduzíveis. **Benchmark sintético
   implementado; rótulos humanos e páginas reais continuam pendentes.**
4. Exibir score, fontes, datas, incerteza e limitações na demonstração;
   não chamar o score de probabilidade de verdade sem calibração que
   sustente essa interpretação. **CLI atualizada; revisão visual e demo
   para submissão continuam pendentes.**

## 32. Atualidade como dois eixos e abstenção auditável — 11/11/2026

O usuário reafirmou que a ausência de data é um resultado informativo:
sem data confiável, o sistema não conclui atualidade. O produto deve
mostrar separadamente (a) se a evidência apoia/contradiz/não determina a
afirmação e (b) se há base temporal para dizer que ela continua válida.
Conteúdo pode apoiar uma afirmação e ainda deixar sua atualidade
inconclusiva.

Foi identificada e corrigida uma falha: uma data recente da página podia
promover um preço a `ATUAL`, embora não houvesse vínculo da data com o
campo de preço. Agora só `escopo_data: "ATTRIBUTE"` pode tornar a
evidência atual para a afirmação ou entrar no freshness score. O agregador
também expõe `conclusao_factual` separada de `freshness`; o campo legado
`veredito` permanece por compatibilidade. O sinal
Tavily `published_date` é preservado com origem `TAVILY_SEARCH_RESULT` e
escopo `PAGE`; a coleta não o apresenta como data do atributo. O agregador
mostra suporte como `SUPORTE_FRACO` e atualidade `UNVERIFIABLE` nesse
cenário.

O freshness score é índice temporal determinístico, não probabilidade de
verdade nem métrica calibrada. Exemplo auditável para janela de preço de
30 dias: uma evidência ligada ao atributo há 7 dias resulta em
`round(100 × 2^(-7/15)) = 72/100`. A data, janela, fórmula, versão do
algoritmo e limitações precisam acompanhar qualquer número apresentado.
Na revisão desta rodada, a versão do algoritmo foi elevada para `1.1.0`:
tipos sem janela configurada agora retornam `UNVERIFIABLE`/`null`, sem
fallback arbitrário de 180 dias; o estado temporal também é recalculado
da data e política, em vez de confiar num rótulo de entrada incoerente.

Validação sintética adicionada em `avaliacao/teste-avaliacao-rotulada-v1.js`:
13 casos fixos em eixos factual e temporal independentes, inclusive data
ausente, data de página, inválida/futura, contradição, conflito e
duplicação por domínio. São testes de regras, não prova de precisão em
web real. Referências técnicas consultadas: documentação oficial de
[Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search)
e [Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract),
[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.8.2) e
[Schema.org CreativeWork](https://schema.org/CreativeWork). A coleta direta
de metadados foi implementada com HTTPS, DNS público fixado à conexão,
redirecionamentos revalidados, timeout e limite de corpo; os testes usam
resolvedor e transporte simulados. O contrato dos sinais, os limites e a
política de abstenção estão em `ESPECIFICACAO_FRESHNESS_SCORE.md`.

## 33. Captura de datas de página e dependência entre fontes — 11/11/2026

Implementação em `src/sinais-temporais.js`: tentativa best-effort de GET
HTML para até três URLs extraídas, com `Last-Modified`, metadados Open
Graph, Schema.org meta/JSON-LD, elemento `<time>`, URL canonical e datas
visíveis próximas a pistas como “preço atualizado em”. Datas de página,
documento e oferta mantêm seus escopos; uma data visível só é atribuída a
`ATTRIBUTE` quando o contexto local contém a entidade/valor da afirmação.
Rótulos “Last Updated/Atualizado em” ficam em `PAGE`; “preços consultados
em” é registrado como `OBSERVATION`, nunca como data da alteração do
preço. `priceValidUntil` fica como validade de oferta. Datas ausentes,
inválidas, conflitantes ou não vinculadas continuam `UNVERIFIABLE`.

Defesas de rede: HTTPS, sem credenciais/portas não padrão/hosts locais,
resolução IPv4 pública, endereço fixado à conexão, redirecionamentos
manuais com validação em cada salto, HTML/XHTML apenas, máximo de 1 MiB,
timeout de 5 segundos e no máximo duas navegações de redirect. Testes
injetam DNS e HTTP; nenhuma API Tavily/Bifrost nem rede real é chamada nos
testes desta implementação. Limitação residual: a extração de datas
visíveis usa regras conservadoras, não compreensão semântica geral; sites
com HTML dinâmico, datas em formatos incomuns, páginas em outras línguas
ou metadados falsos podem continuar sem data ou produzir sinal incorreto.

Implementação em `src/independencia-fontes.js`: agrupa mesma origem de
domínio, URL canonical comum, hash de conteúdo normalizado idêntico ou
similaridade Jaccard de shingles de cinco tokens (mínimo 40 tokens e
limiar 0,88). Isso reduz republicações textualmente próximas e mantém
posturas conflitantes visíveis no grupo. Não comprova proveniência
editorial: edição extensa pode escapar; textos coincidentemente parecidos
podem ser unidos; ausência de detecção não prova independência. A nota de
limitação aparece no resultado do agregador.

Testes: `teste-sinais-temporais.js`, `teste-independencia-fontes.js`,
`avaliacao/teste-trechos-paginas-publicas.js`, regressão do agregador e
Tavily simulado. Quatro páginas foram rotuladas antes de executar o
parser. Seus trechos visíveis produziram 4/4 datas esperadas e nenhum
falso `ATTRIBUTE`; essa checagem não avalia a extração do HTML completo.
Na execução ao vivo feita pelo usuário em 11/11, as fontes acessíveis
capturaram 3/3 datas anotadas (Nio 1/1, Calculadoria 2/2) e geraram zero
falsos `ATTRIBUTE` em três páginas. A data 06/11 da Calculadoria foi
classificada corretamente como `OBSERVATION`, não alteração do preço. A
OpenAI forneceu `Last-Modified` de 11/11 com escopo `PAGE`. NASA foi
pulada (`NO_PUBLIC_IPV4`), então suas duas datas anotadas continuam sem
avaliação. A inspeção `view-source:` foi bloqueada pela política de
navegação; não tentamos contornar esse limite. O script ao vivo é opt-in:
`node avaliacao/validar-paginas-reais.js --live`.
Após examinar o resultado real, o parser foi ajustado para que um rótulo
genérico “Atualizado em” junto a um título com a palavra “plano” não crie
um candidato `EXPLICIT_ATTRIBUTE_UPDATE_DATE` com escopo `UNKNOWN`. Também
colapsa entradas JSON-LD duplicadas idênticas de uma mesma página. A suíte
`npm test` passou novamente depois dessas correções; falta repetir a coleta
ao vivo para confirmar a forma final dos sinais retornados.
Referências comparativas e decisões de desenho: `PESQUISA_REFERENCIAS.md`.


## 34. Continuidade em 12/11/2026 — interface web, categorias automáticas e suíte única

Sessão de continuidade com Claude (auditoria em `MATRIZ_AUDITORIA.md`,
`RELATORIO_TESTES.md`, `STATUS_DO_PROJETO.md`, `PLANO_DE_CONCLUSAO.md`,
`DECISOES_TECNICAS.md`, `CONTEXTO_CONTINUIDADE.md`). Mudanças:

- **Categorias automáticas** (`src/tipo-afirmacao.js`): sem tipo informado,
  a decomposição pede ao modelo uma categoria (validada contra a lista) e,
  na falta, regras por palavras-chave. Origem gravada em
  `origem_tipo_afirmacao`. Antes, sem tipo manual, nenhuma afirmação recebia
  índice temporal (`UNKNOWN_CLAIM_TYPE`).
- **`maxAfirmacoes`** em `verificarTexto()` limita custo; excedentes ficam em
  `afirmacoes_omitidas`.
- **Interface web** (`servidor.js`, `public/`): `npm run web` (real) e
  `npm run web:exemplo` (motor real com fontes fictícias e provedores
  simulados, sem custo). 127.0.0.1, uma verificação por vez, limites de
  entrada, CSP estrita, SQLite `:memory:`.
- **Mensagem do agregador**: fonte oficial sem nenhuma data agora recebe a
  explicação de ausência de data (antes recebia a de data não vinculada).
- **Testes**: três testes desatualizados após a política 1.2.0 foram
  ajustados (fixtures com `escopo_data: "ATTRIBUTE"`); novos
  `teste-tipo-afirmacao.js` e `teste-servidor.js`; `npm test` passou a rodar
  `rodar-testes.js` com toda a suíte offline.

## 35. Primeira execução real pela interface e ajustes — 12/11/2026 (tarde)

- Execução real (Node.js 20 LTS + Chat Completions; domínios nodejs.org e
  platform.openai.com): fluxo íntegro em ~307 s, dominado por esperas de
  limite de uso do Groq. Resultado: CONFLITO e SUPORTE_FRACO, índice null.
- **Falha de produto encontrada:** a página oficial do Node 20.9 diz "Active
  LTS até outubro de 2024 … fim de vida em abril de 2026", mas o
  classificador marcou SUPPORTS para "Node 20 é a LTS ativa atual". Causa:
  o modelo não recebia a data de hoje e a regra 6 proibia considerar tempo.
  **Correção:** o classificador recebe `data_referencia` e passa a usar
  CONTRADICTS quando a própria evidência declara prazo já vencido para uma
  afirmação no presente; continua sem julgar a idade da página.
- **Índice secundário** `agregacao.recencia_pagina` (PAGE_DATE_RECENCY_INDEX,
  confiança LOW): mesma meia-vida, usando datas de página. Decisão da Alice:
  manter o índice oficial rigoroso e mostrar o secundário separado.
- Modo real da interface lê 2 fontes por afirmação (`ENTRELINHAS_MAX_FONTES`).
- Tavily com tempo-limite de 45 s; resposta ao navegador sem textos completos
  de coleta/normalização (3,5 MB → ~85 KB no caso real); a interface mostra o
  trecho efetivamente analisado (`preparacao.trecho_analisado`).
- Testes: `teste-recencia-pagina.js` (8/8), `teste-classificador-data.js` (2/2);
  suíte 43/43.
- **Novo veredito `CONTRADICAO_FRACA`** (agregador): só há contradição, sem
  fonte oficial com data ligada ao fato. Antes virava NAO_VERIFICAVEL e
  escondia a contradição. Segunda execução real (Node.js 20 LTS) → 58 s,
  CONTRADICAO_FRACA. `teste-agregador.js` atualizado.

