# HackCulture submission copy · Stale-Answer Detector

**Selected Problem Statement:** Build a Stale-Answer Detector for AI Applications (requires Tavily and Bifrost).

**Status (13 Nov 2026):** working prototype with a web interface, live Tavily + Bifrost verification, a public demo that replays recorded live checks without keys, a real-claims accuracy benchmark and 52 offline test files.

## Project title

Entrelinhas · Read between the lines of any AI answer

## Short description

AI answers sound equally sure when they are current, outdated or simply wrong, and nothing on the screen tells them apart. Entrelinhas (Portuguese for “between the lines”) checks an AI answer claim by claim against independent, current sources found live with Tavily: official sites, news and scientific articles first, blogs last. A model reads them through Bifrost. Each claim gets:
- a stale-risk flag;
- a verdict;
- a freshness score;
- the exact evidence behind it.

The answer comes back corrected, with citations, in English or Portuguese.

## Project description

Entrelinhas works in six steps.

1. **Splits and flags.** The answer is split into atomic claims, each tagged as a price, software version, company fact, or law/rule, with a validity window for each category. Before any search, a deterministic triage explains which claims can be stale and why, for example: “3 claims found · 2 time-sensitive: prices change about monthly, rules about yearly.”.
2. **Searches.** Tavily runs, for every claim:
   - a general search;
   - a news search (Brazilian outlets for Portuguese claims);
   - a scientific search for health and science claims;
   - an official-domain search. Brazilian authorities such as the Banco Central or gov.br are detected automatically.

   It extracts up to five sources of different types and never two from one site.
3. **Reads the sources.** One Bifrost call per claim reads all of them, knowing today's date, and decides for each source whether it supports or contradicts the claim. The output is validated: every quote and every fact date must exist in the source text.
4. **Weighs.** Deterministic rules group copies, weigh source types (official and scientific 3, news 2, reference 1.5, other 1, blog 0.25) and compute:
   - source agreement;
   - a **freshness score per claim**: source recency × support share, with its basis and confidence;
   - a verdict.
5. **Corrects the answer.** A final Bifrost call writes an **updated answer** using only verified quotes, with numbered citations, shown next to what the AI said.
6. **Records.** Everything is stored in SQLite.

**Bifrost does visible work.**
- Every call carries a fallback chain of Groq models, so rate limits and failures are absorbed by the gateway. In the 13 Nov benchmark, the backup model answered 22 of 60 model calls and all 15 checks finished (`avaliacao/gateway-casos-reais-2026-11-13.json`).
- The report shows which model answered each step, plus tokens and latency.
- An outage drill sends a check to a non-existent model and shows Bifrost finishing it with a backup.

**Built for Portuguese, not translated into it.** Entrelinhas reads:
- money and number formats (R$ 1.234,56, “5 mil”);
- qualifiers such as “a partir de” and “cerca de”;
- “atualmente”;
- dates in the form 03/04 (3 April, not March 4);
- slang such as “9 pau”, “50 conto” and “zap”.

## User problem, solution, differentiator and potential impact

**Problem:** chatbots confirm what users bring them and repeat facts that have changed: prices, versions, rates, laws, executives. Users cannot see which part of an answer to trust.

**Solution:** claim-level re-verification against independent live sources, with triage, verdict, freshness, evidence and a corrected answer.

**Differentiators:**
- independent voices weighted by source type, against confirmation bias;
- a freshness score that states its basis and confidence;
- a corrected answer written only from verified quotes;
- Bifrost failover in the report;
- Portuguese-aware reading;
- a real-claims benchmark.

**Potential impact:** AI products, support teams and newsrooms could recheck answers before reuse, including for Portuguese-speaking users. This is a potential benefit, not a measured deployment result.

## Challenge requirements and status

| Requirement | Status |
|---|---|
| 1. Claim identification | Done: atomic claims with category. |
| 2. Freshness detection | Done: stale-risk triage before searching, with reasons. |
| 3. Live verification | Done: Tavily general, news, scientific and official search and extraction; one validated Bifrost analysis per claim. |
| 4. Freshness score per claim | Done: 0 to 100 = source recency × support share, with status (current, aging, uncertain, contradicted), basis and confidence. A documented heuristic, not a probability. |
| Tavily and Bifrost | Done: Tavily for all search and extraction. Bifrost for all model calls, with fallback chain, routing info, rate-limit handling and an outage drill. |
| Expected outcome | Done: which claims current sources support, plus an updated answer with citations. |

## Accuracy on real claims

On 15 real claims with known answers (8 true, 7 outdated, in Portuguese and English), run live on 13 Nov 2026:
- **14 of 15** got the exact verdict. The other one, Netflix, came back Conflicting, which still warns the reader;
- **15 of 15** went in the right direction;
- **0** outdated claims were confirmed as true, and **0** true claims were marked as contradicted.

How to read it honestly:
- of the 6 outdated claims caught, 1 was contradicted by a dated official source and 5 by most independent sources without an official date. The interface says so;
- the rules were improved after a first run on the same 15 claims (11 of 15 exact on 12 Nov), so `avaliacao/casos-novos-2026-11-13.json` adds 8 new claims written after the fixes, to be run as an independent check;
- 15 claims show behavior; they are not a statistical accuracy estimate.

Every check of the run is recorded in `gravacoes/`, and the results are in `avaliacao/`.

## Architecture and technology

- Node.js 22.5+ (built-in `node:sqlite`), no framework; local web server on 127.0.0.1.
- Tavily Search (general, Brazilian news, scientific and official domains) and Tavily Extract.
- Bifrost HTTP gateway: fallback chain (gpt-oss-20b → gpt-oss-120b on Groq; more models or providers by configuration), routing info, `x-bf-dim-*` labels, rate-limit retry.
- Deterministic modules: categories, triage, Portuguese reading, source types, dependency grouping, agreement, freshness, verdicts.
- SQLite traceability.

## Limitations

- Live checks run locally with your own Tavily and Bifrost keys. The public demo (https://contatoalicecandido-lab.github.io/entrelinhas/) replays recorded live checks and built-in examples without keys.
- Scores are documented heuristics, not calibrated probabilities; independent sources can share an error.
- Validity windows are configurable defaults; the Selic rate, for example, moves faster than the yearly window for rules.
- The free model tier limits tokens per minute; a check takes about 15 to 70 s.

## Repository and demo

Public repository: https://github.com/contatoalicecandido-lab/entrelinhas

Public demo, no install: https://contatoalicecandido-lab.github.io/entrelinhas/ (click **See a real check**). Pitch deck: `submission/Entrelinhas_Pitch_Deck.pptx`.

Run `npm run web:exemplo` for the no-key demo, or `npm run web` with Tavily and Bifrost configured for live verification. Video script: `submission/VIDEO_SCRIPT.md`.

## AI-use disclosure

The product uses a model through Bifrost for claim decomposition and evidence analysis; dates, agreement, scores and verdicts are computed by deterministic code. AI coding assistants were used during development.

## Official challenge and submission sources

- Event page and rules: https://hackculture.io/hackathons/ai-global-hackathon
- Geek Room event overview: https://www.geekroom.co.in/event/global-ai-hackathon
