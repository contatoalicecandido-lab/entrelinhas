# Decisões técnicas — consolidado em 12/11/2026

Fontes: `CONTEXTO_ENTRELINHAS.md`, `RELATORIO_AUDITORIA_FINAL.md`, `ESPECIFICACAO_FRESHNESS_SCORE.md`, `PESQUISA_REFERENCIAS.md`, código.

## Confirmadas
| Decisão | Por quê | Alternativa descartada |
|---|---|---|
| Desafio único: **Build a Stale-Answer Detector for AI Applications** (11/11) | O formulário tem um só campo de problema; esse desafio exige Tavily + Bifrost | Trilha B4 (extensão do gateway Bifrost) — exigiria contribuição Go upstream |
| Bifrost como gateway HTTP (`groq/openai/gpt-oss-20b`) | Atende ao desafio sem fingir ser plugin | Plugin nativo Bifrost |
| Node 22.5+ com `node:sqlite` nativo | Zero dependência de banco externa | better-sqlite3 |
| Data de coleta ≠ data de publicação/atualização | Evitar falsa sensação de atualidade | Usar data da busca como data da informação |
| Data só vira evidência de atualidade do atributo se `escopo_data = ATTRIBUTE` | Data da página não prova que o preço mudou | Usar `Last-Modified`/`published_date` direto |
| Índice temporal = `round(100 × 2^(-idade/(janela/2)))`, `null` sem data válida | Determinístico e explicável; não é probabilidade | Score de qualidade de evidência como "freshness" |
| Busca dupla com domínios oficiais | Garantir fonte oficial sem perder fontes independentes | Buscar só no domínio oficial |
| Fontes repetidas agrupadas por domínio/canonical/hash/Jaccard 0,88 | Reduz inflação por republicação | Contar por hostname apenas |
| Testes com fetch simulado e SQLite `:memory:` | Sem custo e sem risco ao banco | Testes contra APIs reais |

## Em aberto
- Critério 5: repetir a mesma persistência deve responder sucesso?
- Comparação temporal entra na demo ou fica como módulo separado?
- Formato da interface (web local, hospedada, ou só CLI)?
- Fuso do prazo de 15/11.

## Decisões de 12/11/2026
| Decisão | Por quê | Alternativa descartada |
|---|---|---|
| Categoria automática: configurada > modelo > palavras-chave | Sem categoria não há janela de validade nem índice; ninguém marca tipos à mão numa resposta de IA | Exigir tipo manual por afirmação |
| Interface web local sem dependências novas (`node:http`) | Zero instalação extra, menos superfície de ataque | Express/React |
| Modo exemplo com provedores simulados e fontes fictícias `.example` | Jurados testam sem chaves; nada se passa por fonte real | Gravar respostas reais (poderia parecer dado real) |
| Medidor vermelho quando a evidência recente contradiz | Nota alta em verde numa afirmação desatualizada confundia | Cor pela nota |
| Backups e decks fora do Git | Backups de banco podem conter dados; decks B4 contradizem a estratégia atual | Publicar tudo |
