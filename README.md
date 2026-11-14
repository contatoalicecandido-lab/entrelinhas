# Entrelinhas

### Read between the lines of any AI answer. A stale-answer detector for AI applications, in English and Portuguese

AI assistants tend to agree with whatever you bring them. Paste a blog post or a hunch into a chatbot and it will often confirm it. Entrelinhas does the opposite: it takes an AI-generated answer, splits it into claims and checks each one against **independent, current sources**: official sites first, then news and scientific articles, with blogs counting least. It shows **what still holds, what is outdated and what is simply wrong**.

For every answer it shows, in this order:

1. **Stale-risk triage** (before searching): *“3 claims found · 2 time-sensitive (prices change ~monthly, laws and rules ~yearly)”*, with the reason for each flag.
2. **An updated answer**: the original answer rewritten from the sources, with numbers and dates taken only from quotes checked against the page, and numbered citations, next to what the AI said.
3. **One card per claim** with:
   - a **verdict**: Current, Corroborated, Supported but unconfirmed, Conflicting, Contradicted by sources, Likely outdated or Not verifiable;
   - a **freshness score (0 to 100)**: source recency × share of sources that support the claim, with its basis and confidence;
   - **source agreement** weighted by source type, and **who says what**;
   - **every source** with its stance, a quote checked against the source text, and its dates.
4. **The AI gateway panel**: which model answered each step through Bifrost, whether a backup model took over, tokens and latency.

It is **built for Portuguese, not translated into it**. It reads:
- Brazilian number and currency formats;
- qualifiers such as “a partir de” and “cerca de”;
- present-tense markers such as “atualmente”;
- slang such as “9 pau” (R$ 9 mil), “50 conto” and “zap”;
- Brazilian authorities (Banco Central, gov.br, Anatel…), which it searches automatically.

**Try it now, no install:** <https://contatoalicecandido-lab.github.io/entrelinhas/>. Click **See a real check**. The public demo replays real live checks (real Tavily searches, real model calls through Bifrost) and the built-in examples, without API keys. To check your own text, run it locally (see [Getting started](#getting-started)).

**Check any AI answer from any site:** with Entrelinhas running locally, drag the **Check with Entrelinhas** button (on the page, in the section “Use Entrelinhas on any AI app”) to your bookmarks bar. Select an answer on ChatGPT, Gemini or any page and click it: Entrelinhas opens with the text ready. Apps can call the same check with `POST /api/verificar` (see [API](#api)).

## The problem

Large language models confidently repeat facts that have changed: prices go up, API versions reach end of life, rates and laws are updated, executives leave. Retrieval does not solve it alone. A cited page can be official and relevant while the fact it supports has already changed. A claim can be repeated by ten copies of one article. A price written “a partir de R$ 99,90” can be read as an exact price.

## What Entrelinhas does

1. **Splits the answer** into atomic claims and gives each a category with its own validity window: prices, software versions, company facts, or laws and official rules. The model detects the category, with keyword rules as a fallback.
2. **Flags stale risk before searching** (`src/risco-desatualizacao.js`), using deterministic rules:
   - the category's window;
   - present-tense markers (“currently”, “atualmente”, “still”);
   - years already in the past.
3. **Gathers diverse evidence with Tavily**:
   - a general search, boosted to Brazil for Portuguese claims;
   - a news search limited to the period in which a change would matter (`time_range`: last month for prices, last year for versions, companies and rules), so recent news of a change surfaces first;
   - a scientific search for health and science claims;
   - a search on official domains, which come from the user's trusted sites or from the Brazilian authority map.

   Up to five sources of different types are extracted, never two from one site (subdomains such as help.openai.com and openai.com count as one site), and blogs come last. Results that carry no content and search-engine result pages are dropped.
4. **Reads all sources for a claim in one Bifrost call**. The model decides whether each source is about the same object, and whether it supports or contradicts the claim. It also returns the date of the fact. Its output is validated: every quote shown, and every fact date, must exist in the source text, and a stance whose quote is not in the source text is not counted at all (this blocks instructions hidden in a page and invented quotes). Pages are cleaned of menus and links first, and the most relevant passages are selected.
5. **Weighs and explains deterministically**:
   - copies and pages from the same site count once: same registrable domain, same canonical URL, the same text, or one text contained in another (the same article wrapped in different menus);
   - source types are weighted (official 3, scientific 3, news 2, reference 1.5, other 1, blog/forum 0.25);
   - agreement, freshness and a verdict are computed.

   A contradiction is never hidden behind majority support.
6. **Writes the updated answer** with one more Bifrost call. Numbers and dates come only from quotes checked against the page; sources without one are marked `quote_verified: false`. Citations to sources that do not exist are removed. If citations are missing, the model is asked once more, and any still missing are appended.
7. **Stores everything** in SQLite: claims, sources, collection IDs, model calls and search operations.

## How it works

```text
AI answer
  └─ claims + category + Portuguese reading + stale-risk triage   (Bifrost + deterministic rules)
       └─ general · news · scientific · official search, extract   (Tavily)
            └─ one batch analysis per claim                         (Bifrost, validated)
                 └─ grouping, weights, dates, verdict, freshness    (deterministic)
                      └─ updated answer with citations              (Bifrost, validated)
                           └─ web UI · SQLite trace
```

## Freshness score and validity windows

**Freshness score (0 to 100) = source recency × support share.**

- **Source recency** is the recency of the **newest source that confirms the claim** (not an average: one recent confirmation is enough to show the fact still holds). It uses a half-life equal to half of the category's validity window: `100 × 2^(−age / (window / 2))`.
  - A source exactly half a window old scores 50.
  - A source one full window old scores 25 and is marked stale.
  - The age comes from the **date of the fact** when a source states it (for example “a partir de 1º de janeiro”, quoted and checked against the text: higher confidence). Otherwise it comes from the **page date** (low confidence).
- **Support share** is the weighted share of independent sources that confirm the claim.

What the score means in practice:
- a claim contradicted by current sources scores near 0 (*Outdated*);
- a claim confirmed by recent sources scores high (*Current*);
- a claim confirmed only by old sources scores low (*Aging*).

Each card shows the basis of its score and a confidence level. The score is a documented heuristic, **not a probability of truth**.

In the API response this claim score is `agregacao.atualidade_afirmacao` (the number on the card). A second field, `agregacao.freshness`, only measures how recent the sources are, whether or not they agree with the claim. A contradicted claim can therefore have recent sources (`freshness` 57) and still a claim score of 0.

### Why these windows

| Category | Window | Why |
|---|---|---|
| Prices and plans | **30 days** | Subscriptions bill and get repriced on monthly cycles, and promotions rotate within weeks. A one-month-old price page is the most common source of a wrong price. Example from our benchmark: Netflix Brazil repriced every plan on 15 Oct 2026, so an answer saying “R$ 44,90” went stale overnight. |
| Software and API versions | **90 days** | Runtimes and APIs ship every few weeks and change support status on published schedules. Node.js, for example, moves LTS lines every April and October. A quarter catches a status change before it bites. |
| Company facts and leadership | **180 days** | Headcount, leadership and funding change less often than prices and are typically confirmed in semiannual or annual reporting. |
| Laws and official rules | **365 days** | Most official values in Brazil reset once a year: the minimum wage every 1 January by decree, tax tables per fiscal year. Laws themselves change through slower processes. |

These windows are **configurable product defaults** (`VALIDADE_MAX_DIAS` in `src/atualidade.js`), not universal truths.

Some official values move at their own pace, whatever category the model gives them, so they get their own window (`JANELAS_POR_ENTIDADE` in `src/atualidade.js`), and the triage says why:

| Value | Window | Why |
|---|---|---|
| Selic rate | **45 days** | Brazil's Copom reviews it about every 45 days (8 meetings a year). |
| Inflation (IPCA, INPC, CPI) | **30 days** | Official inflation figures are published every month. |
| Brazil's minimum wage | **365 days** | Set once a year, in force from 1 January. A live check filed the daily minimum wage as a *price* (30 days) and scored a correct 2026 value as aging; the entity window fixes that. |

Calibrating the windows against labeled cases is future work, using the benchmark below. (The 13 Nov benchmark ran before these entity windows existed. The Selic and inflation windows make the check stricter: an official page about the Selic that is older than 45 days no longer counts as a current confirmation. The minimum wage window only changes the freshness score; re-scoring the recorded evidence gives the same verdicts.)

**Important distinctions:**
- A publication date is not the date a fact changed.
- The time a page was retrieved is not proof that it was updated.
- A missing date does not make a claim false.
- Freshness does not guarantee truth.

## Accuracy on real claims

`avaliacao/casos-reais-2026-11.json` lists 15 real claims with answers known on 12 Nov 2026, 8 still true and 7 outdated, in Portuguese and English: minimum wage, Selic, Netflix prices, dengue vaccine, LGPD, Pix, Node.js 20 and 22, ChatGPT Plus, OpenAI's CEO, Python 2, Twitter's CEO and GPT-4. Each case lists the sources used to set the answer.

Run it against a live server with `node avaliacao/rodar-casos-reais.js`. It pauses 45 s between claims because of the free model tier's tokens-per-minute limit.

**Result of the live run on 13 Nov 2026** (`avaliacao/resultado-casos-reais-2026-11-13.json`), and the **same recorded evidence re-scored with the current rules** after an adversarial review tightened them (`avaliacao/reavaliacao-casos-reais-2026-11-13.json`, rebuilt by `node avaliacao/reavaliar-benchmark.js`, no new calls):

| | Live run, 13 Nov | Current rules (same evidence) |
|---|---|---|
| Exact verdict (Current/Corroborated for true claims, Contradicted by sources or Likely outdated for outdated ones) | 14 of 15 | **13 of 15** |
| Right direction (also counting “Supported but unconfirmed” and “Conflicting”) | 15 of 15 | **15 of 15** |
| Outdated claims confirmed as true | 0 | **0** |
| True claims marked as contradicted | 0 | **0** |

| Claim | Known answer | Live run | Current rules |
|---|---|---|---|
| Salário mínimo 2026 é R$ 1.621 | true | Corroborated | Corroborated |
| Salário mínimo 2026 é R$ 1.518 | outdated | Likely outdated | Likely outdated |
| Selic está em 13,75% | true | Corroborated | Corroborated |
| Selic está em 10,5% | outdated | Contradicted by sources | Contradicted by sources |
| Netflix Padrão custa R$ 44,90 | outdated (R$ 51,90 since 15 Oct) | Conflicting (partial) | Conflicting (partial) |
| Qdenga no SUS, 10 a 14 anos | true | Corroborated | Corroborated |
| LGPD em vigor desde 2020 | true | Corroborated | Corroborated |
| Pix gratuito para pessoa física | true | Corroborated | Supported, unconfirmed (partial) |
| Node.js 20 is Active LTS | outdated (EOL 30 Apr 2026) | Contradicted by sources | Contradicted by sources |
| Node.js 22 still gets security updates | true | Corroborated | Corroborated |
| ChatGPT Plus costs $20/month | true | Corroborated | Corroborated |
| Sam Altman is CEO of OpenAI | true | Corroborated | Corroborated |
| Python 2.7 still gets security updates | outdated | Contradicted by sources | Contradicted by sources |
| Jack Dorsey is CEO of Twitter | outdated | Contradicted by sources | Contradicted by sources |
| GPT-4 is OpenAI's newest model | outdated | Contradicted by sources | Contradicted by sources |

Why Pix dropped: four of its five supporting sources are company blogs, and “Corroborated” now needs supporting weight of at least 4 (one official source plus one news outlet, for example), so three or four weak sites are not enough. It is still on the right side: “Supported, unconfirmed” tells the reader to look closer.

**Independent check: 8 new claims** written after the rules were tuned and never used to tune them (`avaliacao/casos-novos-2026-11-13.json`, 4 true and 4 outdated, recordings in `gravacoes/`). The live run had two parts on 13 Nov: the first 3 claims at 17:14 UTC with rules 1.2.0, the other 5 at 23:06 UTC with rules 1.3.0 (`avaliacao/resultado-casos-novos-2026-11-13.json`). After a final adversarial review the rules were tightened again, and the same recorded evidence was re-scored with them (`avaliacao/reavaliacao-casos-novos-2026-11-13.json`, no new calls):

| Claim | Known answer | Live run | Current rules (same evidence) |
|---|---|---|---|
| Satya Nadella is the CEO of Microsoft | true | Corroborated | Corroborated |
| Sundar Pichai is the CEO of Alphabet | true | Corroborated | Supported, unconfirmed (partial) |
| Em 2026, o salário mínimo diário é R$ 54,04 | true | Corroborated | Corroborated |
| Python 3.12 still receives security fixes | true | Supported, unconfirmed (partial) | Supported, unconfirmed (partial) |
| Node.js 18 is still supported | outdated | Contradicted by sources | Not verifiable (no decision) |
| Python 3.8 still receives security updates | outdated | Likely outdated | Likely outdated |
| Ubuntu 20.04 LTS is still in standard support | outdated | Contradicted by sources | Contradicted by sources |
| O salário mínimo atual é R$ 1.412 | outdated | Not verifiable (no decision) | Not verifiable (no decision) |

**Live: 6 of 8 exact. Current rules: 4 of 8 exact, 2 partial, 2 no decision. Both: 0 wrong, 0 outdated claims confirmed as true.** The stricter rules cost two exact answers on purpose: Pichai's five supporting sources are Wikipedia, two company profiles, the World Bank's speaker page and a Facebook post, with no official or news source, so it is no longer *Corroborated*; Node.js 18 was contradicted by a single vendor blog while nodejs.org's own page gave no clear stance, which is now *Not verifiable* instead of red. We prefer a cautious answer to a confident one built on weak sources.

Re-run live with the final rules (1.4.0) the same night (`avaliacao/resultado-casos-novos-regras-1-4-0-2026-11-13.json`): the first 4 claims came back exact (Nadella, Pichai and the daily minimum wage *Corroborated*, Python 3.12 *Corroborated*; the minimum wage search went straight to gov.br). The other 4 could not run: the free model tier hit its daily limit. We report them as not run rather than guess.

The two live misses taught us two things, both fixed after the run (so these two cases are no longer independent tests):
- *Python 3.12*: the quote check was too literal and dropped three good sources, including python.org, over curly quotes and markdown. It now ignores differences that do not change the text and still rejects any quote with a different number or sentence.
- *R$ 1.412*: searching with the old value only found 2024 news repeating it. A claim with a value now also gets a search without the value and with the current year, to find today's value.

Re-run live after the fixes (`avaliacao/resultado-casos-novos-depois-das-correcoes-2026-11-13.json`): Python 3.12 came back *Corroborated* (python.org among the sources, with a checked quote) and R$ 1.412 *Contradicted by sources*, both exact, and both still exact under the current rules. They are reported separately because the fixes were made after seeing these cases.

**Compared with the model alone** (`avaliacao/linha-de-base.js`: the same model, through Bifrost, asked with today's date whether each claim is still true, with no search):

| On the same 23 claims | Model alone | Entrelinhas (current rules) |
|---|---|---|
| Right answer | 17 | 17 exact |
| Cautious (partial or not verifiable) | 1 (no answer on the old Selic) | 6 |
| Wrong answer | **5** | **0** |
| Outdated claim confirmed as true | **1** (said the 2025 minimum wage, R$ 1.518, is still valid) | **0** |
| Sources the reader can check | none | every verdict |

The model alone also called Brazil's current minimum wage (R$ 1.621), the current daily minimum wage, the current Selic and the dengue vaccine policy outdated. Same number of exact answers, but where Entrelinhas is not sure it says so and shows the sources; the model alone is wrong with full confidence. Results: `avaliacao/linha-de-base-casos-reais-2026-11-13.json` and `avaliacao/linha-de-base-casos-novos-2026-11-13.json`.

**Read these numbers with their limits:**
- **How strong each “outdated” verdict is.** Of the 6 outdated claims caught, 1 was contradicted by a current official source with a date (*Likely outdated*). The other 5 were contradicted by most independent sources, but no official source dated the fact (*Contradicted by sources*, internally `CONTRADICAO_FRACA`, “weak contradiction”). The interface presents those 5 as a strong warning, not a final ruling.
- **The partial case.** Netflix found sources with both the old and the new price, so the verdict was *Conflicting* instead of contradicted. It still tells the reader not to rely on the claim.
- **Low freshness on true claims.** Some true claims (Pix, ChatGPT Plus) come back with a low freshness score. That is intended: the non-blog sources that confirm them are older than the window for that kind of fact, so the report labels them *Aging* and suggests looking for a recent source.
- **Tuned on the same cases.** The rules were improved after the first run on these same 15 claims, so those numbers are not an independent accuracy estimate; the 8 new claims above are.
- **Small sample.** 23 claims show behavior; they are not a statistical accuracy estimate.

**Bifrost during this run** (`avaliacao/gateway-casos-reais-2026-11-13.json`, built by `node avaliacao/resumir-gateway.js 2026-11-13T13` from the 15 recorded checks in `gravacoes/`): 60 model calls, **22 answered by the backup model** when the main one hit the free tier's limit, 4 answers in an invalid format that Entrelinhas retried, and all 15 checks finished.

The first run, on 12 Nov 2026, scored 11 of 15 exact and 15 of 15 in the right direction (`avaliacao/resultado-casos-reais-2026-11-12.json`).

What the run taught us, already fixed:
- Portuguese claims got international English news (Selic), so news search now uses Brazilian outlets only.
- Long-standing facts (“em vigor desde 2020”) were scored only by the date the fact started, so freshness also uses the page dates of the sources that confirm the claim. When every confirming page is old, the claim still comes back *Aging* (LGPD, Pix and ChatGPT Plus in the 13 Nov run): it holds, but no recent source confirmed it. The card says so.
- After the run, a third review found that the freshness score still **averaged** all dated sources, so one recent confirmation was diluted by older pages (ChatGPT Plus showed 21 next to *Current*). Version 1.1 of the score uses the newest confirming source. The public demo's recordings were re-scored with 1.1 from the data they already store (dates, stances, agreement, check date), with no new calls; each re-scored card keeps `recalculated_from: "1.0.0"`. The 13 Nov benchmark files are kept exactly as recorded.
- The updated answer, which is the last call, sometimes hit the free tier's per-minute limit, so the client now waits for Bifrost's `retry_after_ms`.
- An adversarial review by five simulated judges (13 Nov) tried to break the engine and found real holes, now closed with a test for each:
  - a claim could be green while most weighted sources disagreed; now it becomes *Conflicting*;
  - an invented quote (or an instruction hidden in a page that the model obeyed) still counted; now a stance whose quote is not in the source text is not counted;
  - a fact date older than the page (“em vigor desde 2020” in a 2026 article) made the page look incoherent and discarded it (LGPD scored 0); now the page confirms the fact on its publication date;
  - three weak sites could make a claim *Corroborated*, and one blog could make it *Contradicted*; both now need real weight;
  - look-alike domains (salariominimo.com.br) and company forums counted as official, blogs from the news search counted as news, and subdomains counted as separate sources; all fixed;
  - the same article wrapped in different menus, or copied with one word changed, counted several times; now grouped;
  - a recent blog post could make an old fact look current; freshness now prefers stronger sources;
  - the local server accepted requests from other websites (CSRF and DNS rebinding); now it checks the content type, the Origin and the Host.
- A final panel of five simulated judges (13 Nov) found more, closed in rules 1.4.0 with tests (`testes/teste-regras-1-4-0.js`):
  - a quote could be stitched from two distant sentences with “...”, or match while hiding a different number; quotes with “...” must now stay inside one sentence, and every number in the quote must be in the matched text;
  - the updated answer could take a number from the start of a page whose quote was not checked; now only checked quotes reach it, sources without one are marked `quote_verified: false`, and the model is told not to take numbers, dates or names from them. In the source list, a page with a stance but no exact quote says so;
  - hosts like `bcb.gov.br.example.com` or `netflix.blog.br` could pass as official; now only real government suffixes and the company's own registrable domain count. ResearchGate and Google Scholar no longer count as scientific (anyone can upload there);
  - a strong source (official, scientific or news) against a green claim now makes it *Conflicting*; *Corroborated* needs at least one strong supporting source; red needs contradicting weight of at least 2 (one blog alone is not enough);
  - the Brazilian authority found in a claim (Selic → bcb.gov.br, minimum wage → gov.br) only gave weight to sources found by chance; now it is also searched directly;
  - a slow request could hold the local server's single check slot; the body is now read before the slot is taken, and stalled requests are cut after 15 s.
- A live re-run that night found one more: when the free model tier slowed down, a check passed the server's 4-minute limit but kept running in the background, so the next checks were refused as "already running". Each check now has a deadline (`src/prazo.js`): every Tavily and Bifrost call gets only the time that is left, and calls still running at the deadline are cancelled, so the server is free again right after the limit (`testes/teste-prazo.js`).
- One updated answer came back in the wrong language, so the language is now pinned.

23 claims is a small sample: this shows behavior on real cases, not a statistical accuracy estimate.

## Technology stack

| Technology | Purpose |
|---|---|
| Node.js 22.5+ (no framework) | Server, pipeline and tests; built-in `node:sqlite` |
| Tavily Search and Extract | General, news (filtered by `time_range` per claim type), scientific and official-domain search; page extraction |
| Bifrost by Maxim AI | AI gateway for every model call: fallback chain, routing info, rate-limit handling, per-stage labels |
| OpenRouter and Groq (gpt-oss-20b, gpt-oss-120b) | The same open model from two providers, chained by Bifrost. The 13 Nov runs used Groq only; see the note below |
| SQLite | Full verification trace |

### What Bifrost does in Entrelinhas

Every model call goes to `http://localhost:8080/v1/chat/completions` (or the gateway set in `BIFROST_URL`) with the virtual key from `BIFROST_KEY`. The gateway does real work:

- **Fallback chain.** Each request names a main model and backups: `groq/openai/gpt-oss-20b` → `groq/openai/gpt-oss-120b` by default. Set `BIFROST_MODEL` and `BIFROST_FALLBACKS` (comma-separated) to add more, for example a Gemini model, for failover across providers. When the main model fails or hits the free tier's per-minute token limit, Bifrost retries the backups on its own, so Entrelinhas has no retry code for that. In the 13 Nov benchmark, the backup model answered **22 of 60** model calls when the main model hit its limit, and all 15 checks finished (`avaliacao/gateway-casos-reais-2026-11-13.json`).
- **Routing info.** `extra_fields.routing_info` (provider, model, `is_fallback`), token usage and latency are recorded for every call and shown in the **AI gateway · Bifrost** panel.
- **Rate limits.** If the whole chain is limited, Entrelinhas waits the `retry_after_ms` that Bifrost reports (at most 25 s) and tries once more. A daily quota cannot be waited out: on Groq's free tier, gpt-oss-20b has a daily token limit, which is why a second provider in the chain matters.
- **It already happened for real.** On the night of 13 Nov, Groq's free tier hit its daily limit in the middle of a test run, and Groq's paid plan was "temporarily unavailable due to high demand". We moved the same model, `gpt-oss-20b`, to OpenRouter as the main provider, with Groq kept as the backup: one provider added in Bifrost and two lines of configuration (`BIFROST_MODEL=openrouter/openai/gpt-oss-20b`, `BIFROST_FALLBACKS=groq/openai/gpt-oss-20b,groq/openai/gpt-oss-120b`). No code changed. Runs before that switch (the 13 Nov benchmark, the held-out run and the public demo's recordings) used Groq; later runs say which provider answered in their gateway summary.
- **Labels for observability.** Requests carry `x-bf-dim-app` and `x-bf-dim-stage` (decomposition, batch analysis, updated answer), plus request and verification IDs.
- **Outage drill.** In live mode, the option *Simulate an outage of the main model* sends that check to a model that does not exist. The panel then shows Bifrost serving every step from a backup, without any change to the request code.

### Geek Room Global AI Hackathon 2026: challenge requirements

The selected problem statement is **Build a Stale-Answer Detector for AI Applications**, which requires both Tavily and Bifrost. **Open-Source Bifrost Gateway (B4) is not selected.**

| Requirement | How Entrelinhas meets it |
|---|---|
| 1. Claim identification | The answer is split into atomic claims, each with a category (`src/afirmacoes.js`, `src/tipo-afirmacao.js`). |
| 2. Freshness detection | Stale-risk triage before searching, with reasons such as category window, “currently” and past years (`src/risco-desatualizacao.js`), shown as the first panel. |
| 3. Live verification | Tavily general, news, scientific and official searches plus extraction (`src/tavily.js`); one validated Bifrost analysis per claim (`src/analise-lote.js`). |
| 4. Freshness score per claim | 0 to 100 = source recency × support share, with basis and confidence (`src/atualidade-afirmacao.js`). |
| Tavily and Bifrost, meaningfully | Tavily for every search and extraction. Bifrost for every model call, with fallback chain, routing info, rate-limit handling and an outage drill (`src/bifrost.js`). |
| Expected outcome: which claims are supported by current sources | Verdict, agreement and sources per claim, plus the **updated answer** with citations (`src/resposta-corrigida.js`). |

The scores are documented heuristics, not calibrated probabilities. See [`submission/FORM_COPY.md`](submission/FORM_COPY.md) and [`ESPECIFICACAO_FRESHNESS_SCORE.md`](notas/ESPECIFICACAO_FRESHNESS_SCORE.md). Official event: [HackCulture](https://hackculture.io/hackathons/ai-global-hackathon).

### Web interface

```bash
npm run web            # live mode if TAVILY_API_KEY and BIFROST_KEY are set; demo mode is always available
npm run web:exemplo    # demo mode only: no keys, no network, no cost
```

Open <http://localhost:3000>; use `PORT=3001 npm run web` if port 3000 is busy. Paste an AI answer and click **Check answer**. The page is in English and accepts answers in English or Portuguese.

**Demo mode** runs the real engine on two built-in answers, with fictional `.example` sources and simulated search and model responses. The page labels it as simulated. The engine covers categories, triage, Portuguese reading, agreement, freshness, verdicts, the updated answer and SQLite.
- English example: a current price, an API endpoint retired by a recent official changelog, and a regulation corroborated by official, news and reference sources.
- Portuguese example: “custa **a partir de** R$ 99,90” matches an official page listing R$ 99,90 to R$ 119,90. “**atualmente** tem **cerca de 5 mil** funcionários” is contradicted by sources saying 3,200 today.

The server is built defensively:
- it binds to `127.0.0.1` and runs one verification at a time;
- it caps input at 4,000 characters and 6 claims;
- it sends a strict Content-Security-Policy and renders all content as text;
- it never returns credentials;
- it stores every verification in SQLite `:memory:`.

### Run one claim through the verification flow

```bash
node demo.js --type versao_api --official-domain platform.openai.com \
  "The API provides the Chat Completions endpoint."
```

The demo runs claim decomposition, Tavily Search and Extract, source correspondence and stance analysis, freshness assessment, and deterministic aggregation. It prints each result with its source URL and date fields. It uses real Bifrost and Tavily requests but stores verification data in SQLite `:memory:`; it does not write to `dados/entrelinhas.db`.

Available claim types are `preco`, `versao_api`, `regulamento`, and `empresa`. If no type is given, the category is resolved automatically: the model proposes one during decomposition (validated against the allowed list) and deterministic keyword rules are the fallback. The origin is recorded in `origem_tipo_afirmacao` (`CONFIGURADO`, `MODELO` or `HEURISTICA`). Official domains are optional. When supplied, Entrelinhas makes one additional Tavily search per claim to seek those domains while retaining the general search. This adds Tavily usage.

Missing, invalid or future dates never produce a score. Page-only dates (publication or update of the whole page) are used only as a low-confidence fallback when no source dates the fact itself, and the card then says the basis is the page date. Tavily `published_date`, HTTP `Last-Modified`, article metadata and document `dateModified` remain page/document-scoped. Visible “Updated/Atualizado em” labels remain `PAGE`; “prices consulted on” is recorded as `OBSERVATION`; only a visible update date linked to the claim's entity/value can become `ATTRIBUTE`. Schema.org `priceValidUntil` is retained as an `OFFER` validity signal and is not treated as an update timestamp. See [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search), [Tavily Extract API](https://docs.tavily.com/documentation/api-reference/endpoint/extract), and the detailed [temporal signal contract](notas/ESPECIFICACAO_FRESHNESS_SCORE.md).

For up to three extracted URLs, production execution attempts a separate direct page metadata read: HTTPS only, public IPv4 DNS result pinned to the connection, redirects manually followed and revalidated, 1 MiB body cap, 5-second timeout, and HTML/XHTML only. This is a best-effort read; network failures, non-HTML pages, unsafe URLs, missing dates, or unlinked dates remain explicit and do not become freshness evidence. In tests this request is injected/mocked; no page or provider network calls are made.

Evidence aggregation now groups pages by domain, declared canonical URL, exact normalized-content hash, or conservative near-duplicate five-token shingle Jaccard similarity (minimum 40 tokens, threshold 0.88). This reduces obvious republication inflation. It cannot establish editorial provenance, detect heavily edited copies, or prove independence when no duplicate signal is found; the output says this directly. See [public implementation research and design choices](notas/PESQUISA_REFERENCIAS.md).

Four public pages have human labels recorded before parsing in [`avaliacao/rotulos-paginas-reais-v1.json`](avaliacao/rotulos-paginas-reais-v1.json). Their short visible excerpts are covered offline; they are not raw HTML fixtures or a real-web accuracy benchmark. A separate live check is available as `node avaliacao/validar-paginas-reais.js --live` and performs bounded GET requests to those pages.

The stance classifier receives the reference date (today) and must answer CONTRADICTS when a present-tense claim is contradicted by deadlines stated in the evidence itself (for example, a release page saying a version stayed in Active LTS only until a date that has already passed). It still does not judge a page by its age; that remains the job of the deterministic date rules.

The demo shows factual verdict and temporal state separately. A source can support an assertion while freshness remains inconclusive. The 0 to 100 value is a deterministic temporal index under a documented half-life formula, not a probability or calibrated confidence. A reproducible synthetic evaluation is available with `node avaliacao/teste-avaliacao-rotulada-v1.js`; it tests rules and regression cases, not accuracy on real-world sources.

## API

The web interface uses the same local HTTP API that any app can call. It runs on your machine (`npm run web`, port 3000 by default) and needs Tavily and Bifrost configured for live checks.

### `POST /api/verificar`

Request (JSON):

| Field | Required | What it does |
|---|---|---|
| `texto` | yes | The AI answer to check, up to 4,000 characters. |
| `modo` | yes | `"real"` for a live check (Tavily + Bifrost), `"exemplo"` for the offline simulated example. |
| `dominiosOficiais` | no | Extra trusted sites, for example `["gov.br", "nodejs.org"]`. Adds one Tavily search per claim. |
| `tipo` | no | Force one claim type: `preco`, `versao_api`, `regulamento` or `empresa`. By default it is detected per claim. |
| `simularQuedaModelo` | no | `true` sends every model call of the check to a model that does not exist first, so Bifrost answers each one from a backup. |

```bash
curl -s http://127.0.0.1:3000/api/verificar \
  -H "Content-Type: application/json" \
  -d '{"texto": "Node.js 20 is the current Active LTS release. ChatGPT Plus costs $20 per month.", "modo": "real"}'
```

Response (shortened from a real recorded check, `docs/dados/gravacoes/2026-11-12T23-26-59-580Z-…json`, the one behind **See a real check**):

```json
{
  "total_afirmacoes": 3,
  "afirmacoes": [
    {
      "texto": "Node.js 20 is the current Active LTS release",
      "tipo_afirmacao": "versao_api",
      "risco_desatualizacao": { "nivel": "HIGH", "sensivel_ao_tempo": true },
      "agregacao": {
        "veredito": "CONTRADICAO_FRACA",
        "concordancia": { "score": 0, "independent_sources": 5, "supporting": 0, "contradicting": 5 },
        "atualidade_afirmacao": { "score": 0, "status": "CONTRADICTED", "window_days": 90 },
        "fontes": ["…each source with its type, date, stance and the quote it was judged on…"]
      }
    }
  ],
  "resposta_corrigida": {
    "texto": "Node.js 20 is no longer an Active LTS release; it reached end-of-life on 30 April 2026 and is therefore not the recommended version for production [2][3][4]. ChatGPT Plus costs $20 per month [6][7][8].",
    "fontes": ["…numbered sources cited in the text…"]
  },
  "gateway": { "gateway": "bifrost", "chamadas": 6, "respostas_de_reserva": 4, "cadeia_modelos": ["groq/openai/gpt-oss-20b", "groq/openai/gpt-oss-120b"] }
}
```

How to read the main fields:
- `agregacao.veredito`: the verdict. `ATUAL` (Current), `CORROBORADA` (Corroborated), `SUPORTE_FRACO` (Supported, unconfirmed), `NAO_VERIFICAVEL` (Not verifiable), `CONFLITO` (Conflicting), `CONTRADICAO_FRACA` (Contradicted by sources: most independent sources disagree, but no official source dates the fact) and `CONTRADITA_POR_FONTE_ATUAL` (Likely outdated: a current official source disagrees).
- `agregacao.concordancia.score`: source agreement, 0 to 100.
- `agregacao.atualidade_afirmacao.score`: the claim's freshness score, 0 to 100 (the number on the card).
- `agregacao.freshness`: how recent the sources are, whether or not they agree. Not the claim score.
- `resposta_corrigida`: the rewritten answer, with numbered citations that point to `fontes`.
- `gateway`: what Bifrost did in this check: model calls, which model answered, backups used, tokens.

### `GET /api/status`

Tells whether live mode is configured, the limits (characters, claims, sources per claim) and the Bifrost model chain (model names only, never keys).

## Requirements

Example mode (`npm run web:exemplo`) needs only Node.js 22.5+. Live verification additionally needs:

- Node.js 22.5 or later
- npm
- A Tavily API key
- A running Bifrost instance
- A configured model provider and virtual key in Bifrost

Node.js 22.5+ is required because the project uses the built-in `node:sqlite` module.

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/contatoalicecandido-lab/entrelinhas.git
cd entrelinhas
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Bifrost

Start Bifrost locally:

```bash
npx -y @maximhq/bifrost
```

Open the Bifrost interface:

```text
http://localhost:8080
```

Configure a provider and create a virtual key in Bifrost. We use OpenRouter as the main provider and Groq as the backup, both serving the same open model, `gpt-oss-20b`.

Make sure the configured models are allowed for your virtual key (all models, or at least these):

```text
openrouter/openai/gpt-oss-20b
groq/openai/gpt-oss-20b
groq/openai/gpt-oss-120b
```

Optional: add a second provider (for example Gemini) to the virtual key and append one of its models to `BIFROST_FALLBACKS`. Bifrost will then fail over across providers, not only across models.

Use the generated Bifrost virtual key in the next step.

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
TAVILY_API_KEY=your_tavily_api_key
BIFROST_KEY=your_bifrost_virtual_key
```

Replace the placeholders with your actual credentials.

Optional settings:

| Variable | Default | What it changes |
|---|---|---|
| `BIFROST_URL` | `http://localhost:8080` | Where the Bifrost gateway runs, if not on this machine. |
| `BIFROST_MODEL` | `groq/openai/gpt-oss-20b` | Main model. |
| `BIFROST_FALLBACKS` | `groq/openai/gpt-oss-120b` | Backup models, comma-separated, in order. A model from another provider (for example Gemini) makes Bifrost fail over across providers. |
| `PORT` | `3000` | Port of the web interface. |
| `ENTRELINHAS_GRAVAR` | off | `1` records every live check to `gravacoes/` (used for the public demo and the benchmark proof). |

Provider API keys (OpenRouter, Groq) belong in the Bifrost configuration, not in the Entrelinhas `.env` file. With no `BIFROST_MODEL` set, Entrelinhas uses `groq/openai/gpt-oss-20b` with `groq/openai/gpt-oss-120b` as backup.

**Never commit `.env` or API credentials to the repository.**

### 5. Run the automated tests

```bash
npm test
```

`npm test` runs `rodar-testes.js`, which executes all 52 offline test files and prints a summary. Every test uses simulated Tavily/Bifrost responses and SQLite `:memory:`; credentials are blanked for the run, so no paid call is possible. Coverage includes Portuguese reading (numbers, currency, qualifiers, dates), source types and diverse selection, batch analysis validation, source agreement and verdict rules, freshness scoring, date scopes, claim categorization, aggregation policy (including adversarial cases), source independence, Tavily collection IDs, the 18 temporal-comparison criteria, persistence, robustness against malformed model output, and the web server (input validation, size limits, CSP, no credential exposure).

### 6. Start the web interface

```bash
npm run web
```

See [Web interface](#web-interface) above.

### 7. Run the integration smoke test

```bash
node index.js
```

This script checks communication with the configured Bifrost and Tavily services using real API requests.

Both services must be running and correctly configured.

This is an integration smoke test, not a complete application interface.
It sends real requests to Bifrost and Tavily. Use `node demo.js` for a full claim-level verification flow.

### 8. Rebuild the public demo

```bash
ENTRELINHAS_GRAVAR=1 PORT=3001 npm run web   # live checks are saved to gravacoes/
node scripts/montar-demo-estatica.js         # builds docs/ from gravacoes/selecao.json and the examples
```

GitHub Pages serves `docs/` from the `main` branch. Recordings keep no credentials; provider organization IDs are redacted.

### 9. Measure accuracy on real claims

```bash
node avaliacao/rodar-casos-reais.js            # needs the live server running
```

It runs the 15 real claims with known answers and saves the result in `avaliacao/`. It spends Tavily credits and model tokens.

## Project structure

```text
entrelinhas/
├── servidor.js              # local web interface (npm run web)
├── demo.js                  # command-line verification
├── index.js                 # connectivity smoke test (real calls)
├── rodar-testes.js          # offline test runner (npm test)
├── public/                  # web page: index.html, app.js, estilo.css
├── docs/                    # public demo built for GitHub Pages (built by node scripts/montar-demo-estatica.js)
├── src/
│   ├── verificador.js       # orchestrates the pipeline
│   ├── afirmacoes.js        # claim decomposition + category suggestion (Bifrost)
│   ├── tipo-afirmacao.js    # category resolution and keyword fallback
│   ├── tavily.js            # Tavily Search/Extract, official-domain search
│   ├── sinais-temporais.js  # page date signals and their scope
│   ├── preparar-evidencia.js, evidencia.js
│   ├── correspondencia.js, classificador.js, bifrost.js
│   ├── atualidade.js        # FRESH / STALE / UNVERIFIABLE per source
│   ├── atualidade-afirmacao.js  # claim freshness score (the number on the card)
│   ├── freshness-score.js   # how recent the evidence is
│   ├── concordancia.js      # source agreement index
│   ├── resposta-corrigida.js  # rewritten answer with citations
│   ├── independencia-fontes.js
│   ├── agregador.js         # verdict per claim
│   ├── modo-exemplo.js      # simulated providers for the demo
│   ├── banco.js             # SQLite traceability
│   └── comparador-fontes.js, normalizar-fonte.js, avaliador-impacto.js  # snapshot history
├── avaliacao/               # real-claim benchmark: cases, results, gateway summary, new held-out cases
├── gravacoes/               # recorded live checks (the 13 Nov benchmark and the public demo selection)
├── testes/                  # offline tests (npm test)
├── notas/                   # technical notes in Portuguese (score spec, research, decisions, history)
└── submission/              # hackathon form copy, video script and pitch deck
```

## Testing and validation

See [5. Run the automated tests](#5-run-the-automated-tests) for what the 52 offline test files cover, and [Accuracy on real claims](#accuracy-on-real-claims) for the live benchmark. Real API connectivity is checked separately with `node index.js`.

## Current scope and limitations

Entrelinhas is a working hackathon prototype. Live checks run locally with your own Tavily and Bifrost keys; the public demo replays recorded live checks and built-in examples without keys. It is not yet a hosted, multi-user product.

Freshness assessment is not a guarantee of factual correctness. Results depend on source availability, date detection, configured validity rules, and the quality of the retrieved evidence.

Some advanced capabilities, including semantic change interpretation and broader temporal dependency analysis, remain areas for future development.

## Vision

As AI becomes increasingly integrated into real products, verifying whether information is supported is no longer enough.

Applications also need to understand whether the evidence behind an answer is still relevant today.

Entrelinhas aims to make evidence more transparent, traceable, and temporally aware, helping AI systems communicate not only what their sources say, but also how current that information is.

**Who it is for first.** The first users are teams that already ship AI answers to customers: support chatbots and AI products, where one outdated price or policy becomes a complaint. They would call the API after generation and show the verdicts or block the risky claims. People who rely on AI for everyday decisions use the same check through the browser button. A hosted version would charge per check for teams and a low monthly plan for individuals; this is a plan, not a tested business.

**What it costs and how long it takes today.** Measured on the 15 recorded checks of 13 Nov (one claim each): on average 2.2 basic Tavily searches + 1 extraction of 5 pages (about 3.3 Tavily credits) and about 9,350 input + 3,900 output model tokens per claim. At list prices (Tavily pay-as-you-go US$ 0.008 per credit; Groq gpt-oss-20b US$ 0.075 per million input and US$ 0.30 per million output tokens) that is about **US$ 0.03 per claim, almost all of it Tavily**; on Tavily's largest monthly plan (US$ 0.005 per credit) about US$ 0.02. Prices change; check the providers before relying on these numbers. On free tiers a check takes about 15 to 90 seconds (12 to 71 s for the 15 single-claim checks of the 13 Nov run, 91 s for the three-claim demo check), so it fits review before reuse (support macros, published content, decisions) better than real-time chat. Faster paid models and caching repeated claims would cut that time.

---

**Entrelinhas**  
*Read between the lines of any AI answer.*

## License

MIT. See [LICENSE](LICENSE).
