# Roteiro de demonstração ponto a ponto — Entrelinhas

**Duração alvo:** 90–120 segundos. **Nenhum mock deve ser apresentado como chamada real.**

## A história que a demo precisa provar

A resposta de IA pode estar correta como conteúdo citado, mas as fontes disponíveis não provam que a informação ainda vale. O Entrelinhas devolve o que apoia/contradiz e o que permanece inconclusivo, com datas, fontes e motivo de abstenção separados.

## Sequência

1. **Entrada:** fornecer resposta curta com afirmação de preço, por exemplo “O plano X custa R$ 49,90/mês”. Explicar que o sistema verifica afirmações atômicas, não aceita o parágrafo todo como uma só unidade.
2. **Busca e extração:** mostrar URLs consultadas, Tavily Search/Extract e conteúdo extraído. Mostrar a data de busca/captura como “consultado em”, nunca como “publicado em”. Identificar fontes repetidas/dependentes.
3. **Postura factual:** abrir o trecho-fonte e mostrar `SUPPORTS`, `CONTRADICTS` ou `INSUFFICIENT` e por que ele corresponde (ou não) ao plano, região, moeda e condição exatos.
4. **Atualidade:** se há apenas `published_date`/data da página, mostrar: “A fonte apoia o preço anunciado, mas a data não está vinculada ao preço; atualidade inconclusiva; sem índice temporal confiável.” Não chamar isso de falha de busca: é uma abstenção deliberada.
5. **Contraste explicável:** mostrar caso explicitamente rotulado `ATTRIBUTE` com data há sete dias e política de preço de 30 dias. O cálculo é `round(100 × 2^(-7/(30/2))) = 72/100`; rotular “índice temporal não calibrado, não probabilidade”. Mostrar também que evidência atual contraditória continua atual, mas muda a síntese factual para conflito/contradição.
6. **Auditoria:** abrir “Como chegamos aqui”: política e versão, data `as_of`, datas incluídas/excluídas, limitações, URLs e razão da abstenção. Fechar com “a próxima evidência que poderia mudar o resultado” (página com preço/condições e validade explicitamente ligados ou API/changelog oficial).

## Estado real do que a demo consegue provar hoje

- Os testes locais provam regras do agregador, abstenção por ausência/invalidade/escopo de página, cálculo determinístico e rastreabilidade simulada.
- `demo.js` executa fluxo com Tavily e Bifrost reais; pode consumir créditos. Ainda precisa de execução end-to-end controlada para provar a apresentação a avaliadores.
- O pipeline atual não extrai sozinho JSON-LD/HTML headers nem promove datas de página a `ATTRIBUTE`. Portanto, não prometa que o exemplo `72` será produzido automaticamente numa URL arbitrária; o teste usa um fixture sintético marcado como data de atributo.
- Grave uma execução real somente depois de verificar credenciais e custo, sem persistir no banco original. Use SQLite `:memory:` para a demo técnica.
