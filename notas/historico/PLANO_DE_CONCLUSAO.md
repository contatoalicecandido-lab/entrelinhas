# Plano de conclusão — 12/11/2026

## Andamento em 12/11 (tarde)
Concluídos: itens 3 (interface web), 4 (documentação de submissão, exceto deck), 5 (testes). Item 1 (commit) em andamento. Faltam: item 2 (execução real), revisão do deck, vídeo.

## Marco A — entrega do protótipo (até o prazo)
1. **Commit + push do trabalho atual** (precisa de autorização). Sem isso o repositório público não mostra o freshness score. Antes: confirmar que `.env` e `.db` seguem fora (já estão no `.gitignore`) e decidir se backups `*.backup*` e `submission/.build/` entram.
2. **Uma execução real controlada do `demo.js`** com 2–3 afirmações (uma de preço, uma de versão de API, uma de regulamento) para confirmar que o código atual funciona de ponta a ponta e capturar a saída para prints/vídeo. Custo: poucas chamadas Tavily + Bifrost/Groq. Precisa de autorização.
3. **Interface mínima**: uma página web simples (um campo para colar a resposta da IA + cartões por afirmação com veredito, índice temporal, fontes e datas). Pode ser um servidor Node sem dependências novas que chama `verificarTexto()` com SQLite `:memory:`. É o maior ganho para os jurados. Precisa de autorização (código novo).
4. **Corrigir documentação de submissão**: `FORM_COPY.md`, `TRACK_ALIGNMENT.md`, README e deck devem dizer que o freshness score existe (e que é um índice não calibrado). Remover menções a B4 do deck.
5. **Atualizar os 3 testes desatualizados** para o comportamento atual do agregador e, se fizer sentido, colocá-los no `npm test`.
6. Gravar vídeo curto (opcional) seguindo `avaliacao/ROTEIRO_DEMO.md`.

## Marco B — produto completo (depois)
- Critério 5: retentativa idempotente com resposta de sucesso.
- Integrar comparação temporal (histórico de mudanças) ao fluxo/interface.
- Dataset rotulado real (30–50 afirmações) e calibração do índice.
- Proveniência/sindicação de fontes além de similaridade textual.
- Telemetria de custo/latência, hospedagem, testes de carga e segurança.
