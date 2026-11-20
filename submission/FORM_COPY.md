# HackCulture submission copy · Stale-Answer Detector

**Selected Problem Statement:** Build a Stale-Answer Detector for AI Applications (requires Tavily and Bifrost).

**Status (20 Nov 2026):** working prototype with a web interface, live Tavily + Bifrost verification, a public demo that replays recorded live checks without keys, page audit by link, a real-claims benchmark (73 claims, against the model alone and with web search) and 59 offline test files.

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

   It extracts up to five sources of different types and never two from one site (subdomains count as the same site).
3. **Reads the sources.** One Bifrost call per claim reads all of them, knowing today's date, and decides for each source whether it supports or contradicts the claim. The output is validated: every quote and every fact date must exist in the source text (a quote with “...” must stay inside one sentence, and every number in it must match), and a stance whose quote is not in the source is not counted.
4. **Weighs.** Deterministic rules group copies, weigh source types (official and scientific 3, news 2, reference 1.5, other 1, blog 0.25) and compute:
   - source agreement;
   - a **freshness score per claim**: source recency × support share, with its basis and confidence;
   - a verdict.
5. **Corrects the answer.** A final Bifrost call writes an **updated answer** from the sources, taking numbers and dates only from quotes checked against the page, with numbered citations, shown next to what the AI said.
6. **Records.** Everything is stored in SQLite.

**Bifrost does visible work.**
- Every call carries a fallback chain, so rate limits and failures are absorbed by the gateway. When Groq's free tier hit its daily limit during our last test night and its paid plan was unavailable, we moved the same model to OpenRouter with Groq as backup by changing Bifrost's configuration, with no code change. In the 13 Nov benchmark, the backup model answered 22 of 60 model calls and all 15 checks finished (`avaliacao/gateway-casos-reais-2026-11-13.json`).
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
- a corrected answer whose numbers and dates come only from verified quotes;
- Bifrost failover in the report;
- Portuguese-aware reading;
- **page audit**: paste the link of a help center or FAQ, Tavily reads it, and each fact is checked (the page never proves itself);
- **Bifrost governance on the live site**: a virtual key with a daily budget, the same mechanism a paid plan would use per customer;
- a real-claims benchmark against the model alone and the model with web search.

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

**73 real claims with known answers**, in four sets written between 12 and 19 Nov 2026 (Portuguese and English), each run live and re-scored with the current rules (1.9.0) from the same recorded evidence, compared with the same model asked alone:

| 73 real claims | Entrelinhas | Same model alone |
|---|---|---|
| Exact verdict | **50** | 42 |
| Wrong with confidence | **1** | **28** |
| Cautious (yellow, conflicting, not verifiable) | 22 | 3 |

**Unseen set (22 claims written on 19 Nov, never used to tune the rules before the run).** We also asked the same model **with web search** (OpenRouter's web plugin):

| Same 22 claims | Entrelinhas live | Entrelinhas, rules 1.9.0 | Model alone | Model with web search |
|---|---|---|---|---|
| Exact | 8 | 11 | 11 | **20** |
| Wrong with confidence | **0** | **0** | 11 | 1 |

What we learned, without softening it:
- The model alone said Warren Buffett still runs Berkshire Hathaway, Pat Gelsinger still runs Intel and Bulgaria still uses the lev.
- An AI with web search is strong on single yes/no questions. Its one confident error was Brazil's income tax exemption, which Entrelinhas caught with a current official source.
- Entrelinhas never stated something false with confidence on this set, but it was too cautious: big newsrooms counted as "other website" and un.org was not official. Rules 1.9.0 fix that; that column was written after seeing these cases, so the live column is the independent one.
- Over all 73 claims, the one confident error was "Node.js 24 is the current Active LTS", inferred by the model from a support end date. Rules 1.8.0 now forbid inferring a status the source does not state.

**Our message:** an AI with search gives you an answer; Entrelinhas shows its work, claim by claim: which sources agree, what kind they are, how recent they are, quotes checked against each page, and a warning instead of a guess when the evidence is weak. 73 claims show behavior; they are not a statistical accuracy estimate. Every check is recorded in `gravacoes/`, and all results are in `avaliacao/`.

## Architecture and technology

- Node.js 22.13+ (built-in `node:sqlite`), no framework; web server local or public (Render), with per-person and daily limits.
- Tavily Search (general, Brazilian news, scientific and official domains) and Tavily Extract.
- Bifrost HTTP gateway: fallback chain across providers (gpt-oss-20b on OpenRouter → gpt-oss-20b and gpt-oss-120b on Groq; the 13 Nov runs used Groq only), routing info, `x-bf-dim-*` labels, rate-limit retry.
- Deterministic modules: categories, triage, Portuguese reading, source types, dependency grouping, agreement, freshness, verdicts.
- SQLite traceability.

## Limitations

- The live site is limited to protect credits: 5 checks per person and 25 in total per day, up to 3 claims per answer or 5 facts per page, plus a Bifrost daily budget. The public demo (https://contatoalicecandido-lab.github.io/entrelinhas/) replays recorded live checks with no wait.
- Scores are documented heuristics, not calibrated probabilities; independent sources can share an error.
- Validity windows are configurable defaults. Fast official values have their own (Selic 45 days, inflation 30 days); others may still need one.
- The free model tier limits tokens per minute; a check takes about 15 to 90 s.

## Repository and demo

Public repository: https://github.com/contatoalicecandido-lab/entrelinhas

Live demo, check your own text: https://entrelinhas-qwgp.onrender.com/ (5 live checks per person per day; the first one can take a minute while the free server wakes up). Recorded checks, no wait: https://contatoalicecandido-lab.github.io/entrelinhas/ (click **See a real check**). Pitch deck: `submission/Entrelinhas_Pitch_Deck.pptx`.

Run `npm run web:exemplo` for the no-key demo, or `npm run web` with Tavily and Bifrost configured for live verification. Video script: `submission/VIDEO_SCRIPT.md`.

## AI-use disclosure

The product uses a model through Bifrost for claim decomposition and evidence analysis; dates, agreement, scores and verdicts are computed by deterministic code. AI coding assistants were used during development.

## Official challenge and submission sources

- Event page and rules: https://hackculture.io/hackathons/ai-global-hackathon
- Geek Room event overview: https://www.geekroom.co.in/event/global-ai-hackathon
