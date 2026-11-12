# Entrelinhas

### Is this AI answer really true? Multi-source, freshness-aware fact checking for AI answers, in English and Portuguese

AI assistants tend to agree with whatever you bring them. Paste a blog post or a hunch into a chatbot and it will often confirm it. Entrelinhas does the opposite: it takes an AI-generated answer, splits it into claims and checks each one against **independent, current sources**: official sites first, then news and scientific articles, with blogs counting least.

For every answer it shows, in this order:

1. **Stale-risk triage** (before searching): *“3 claims found · 2 time-sensitive (prices change ~monthly, laws and rules ~yearly)”*, with the reason for each flag.
2. **An updated answer**: the original answer rewritten using only verified source quotes, with numbered citations, next to what the AI said.
3. **One card per claim** with:
   - a **verdict**: Current, Corroborated, Supported but unconfirmed, Conflicting, Contradicted by sources, Likely outdated or Not verifiable;
   - a **freshness score (0–100)**: source recency × share of sources that support the claim, with its basis and confidence;
   - **source agreement** weighted by source type, and **who says what**;
   - **every source** with its stance, a quote checked against the source text, and its dates.
4. **The AI gateway panel**: which model answered each step through Bifrost, whether a backup model took over, tokens and latency.

It is **built for Portuguese, not translated into it**. It reads:
- Brazilian number and currency formats;
- qualifiers such as “a partir de” and “cerca de”;
- present-tense markers such as “atualmente”;
- slang such as “9 pau” (R$ 9 mil), “50 conto” and “zap”;
- Brazilian authorities (Banco Central, gov.br, Anatel…), which it searches automatically.

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
   - a news search;
   - a scientific search for health and science claims;
   - a search on official domains, which come from the user's trusted sites or from the Brazilian authority map.

   Up to five sources of different types are extracted, never two from one site, and blogs come last. Results that carry no content are dropped.
4. **Reads all sources for a claim in one Bifrost call**. The model decides whether each source is about the same object, and whether it supports or contradicts the claim. It also returns the date of the fact. Its output is validated: every quote, and every fact date, must exist in the source text. Pages are cleaned of menus and links first, and the most relevant passages are selected.
5. **Weighs and explains deterministically**:
   - copies and pages from the same site count once;
   - source types are weighted (official 3, scientific 3, news 2, reference 1.5, other 1, blog/forum 0.25);
   - agreement, freshness and a verdict are computed.

   A contradiction is never hidden behind majority support.
6. **Writes the updated answer** with one more Bifrost call, using only verified quotes. Citations to sources that do not exist are removed. If citations are missing, the model is asked once more, and any still missing are appended.
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

**Freshness score (0–100) = source recency × support share.**

- **Source recency** uses a half-life equal to half of the category's validity window: `100 × 2^(−age / (window / 2))`.
  - A source exactly half a window old scores 50.
  - A source one full window old scores 25 and is marked stale.
  - The age comes from the **date of the fact** when a source states it (for example “a partir de 1º de janeiro”, quoted and checked against the text: higher confidence). Otherwise it comes from the **page date** (low confidence).
- **Support share** is the weighted share of independent sources that confirm the claim.

What the score means in practice:
- a claim contradicted by current sources scores near 0 (*Outdated*);
- a claim confirmed by recent sources scores high (*Current*);
- a claim confirmed only by old sources scores low (*Aging*).

Each card shows the basis of its score and a confidence level. The score is a documented heuristic, **not a probability of truth**.

### Why these windows

| Category | Window | Why |
|---|---|---|
| Prices and plans | **30 days** | Subscriptions bill and get repriced on monthly cycles, and promotions rotate within weeks. A one-month-old price page is the most common source of a wrong price. Example from our benchmark: Netflix Brazil repriced every plan on 15 Oct 2026, so an answer saying “R$ 44,90” went stale overnight. |
| Software and API versions | **90 days** | Runtimes and APIs ship every few weeks and change support status on published schedules. Node.js, for example, moves LTS lines every April and October. A quarter catches a status change before it bites. |
| Company facts and leadership | **180 days** | Headcount, leadership and funding change less often than prices and are typically confirmed in semiannual or annual reporting. |
| Laws and official rules | **365 days** | Most official values in Brazil reset once a year: the minimum wage every 1 January by decree, tax tables per fiscal year. Laws themselves change through slower processes. |

These windows are **configurable product defaults** (`VALIDADE_MAX_DIAS` in `src/atualidade.js`), not universal truths. The known exception is the Selic rate, which the Copom revisits about every 45 days. Two things compensate:
- the triage marks any “currently” claim as high risk;
- the verdict relies on what current sources say, not on the window.

Per-entity windows (Selic 45 days, inflation monthly) are next on the list. Calibrating the windows against labeled cases is future work, using the benchmark below.

**Important distinctions:**
- A publication date is not the date a fact changed.
- The time a page was retrieved is not proof that it was updated.
- A missing date does not make a claim false.
- Freshness does not guarantee truth.

## Accuracy on real claims

`avaliacao/casos-reais-2026-11.json` lists 15 real claims with answers known on 12 Nov 2026, 8 still true and 7 outdated, in Portuguese and English: minimum wage, Selic, Netflix prices, dengue vaccine, LGPD, Pix, Node.js 20 and 22, ChatGPT Plus, OpenAI's CEO, Python 2, Twitter's CEO and GPT-4. Each case lists the sources used to set the answer.

Run it against a live server with `node avaliacao/rodar-casos-reais.js`. It pauses 45 s between claims because of the free model tier's tokens-per-minute limit.

**Result of the live run on 12 Nov 2026** (`avaliacao/resultado-casos-reais-2026-11-12.json`):

| | |
|---|---|
| Exact verdict (Current/Corroborated for true claims, Contradicted for outdated ones) | **11 of 15** (73%) |
| Right direction (also counting “Supported but unconfirmed” and “Conflicting”) | **15 of 15** |
| Outdated claims confirmed as true | **0** |
| True claims marked as contradicted | **0** |

| Claim | Known answer | Verdict |
|---|---|---|
| Salário mínimo 2026 é R$ 1.621 | true | Current |
| Salário mínimo 2026 é R$ 1.518 | outdated | Contradicted by sources |
| Selic está em 13,75% | true | Supported but unconfirmed |
| Selic está em 10,5% | outdated | Contradicted by sources |
| Netflix Padrão custa R$ 44,90 | outdated (R$ 51,90 since 15 Oct) | Contradicted by sources |
| Qdenga no SUS, 10 a 14 anos | true | Supported but unconfirmed |
| LGPD em vigor desde 2020 | true | Corroborated |
| Pix gratuito para pessoa física | true | Corroborated |
| Node.js 20 is Active LTS | outdated (EOL 30 Apr 2026) | Contradicted by sources |
| Node.js 22 still gets security updates | true | Supported but unconfirmed |
| ChatGPT Plus costs $20/month | true | Corroborated |
| Sam Altman is CEO of OpenAI | true | Corroborated |
| Python 2.7 still gets security updates | outdated | Contradicted by sources |
| Jack Dorsey is CEO of Twitter | outdated | Contradicted by sources |
| GPT-4 is OpenAI's newest model | outdated | Conflicting |

What the run taught us, already fixed:
- Portuguese claims got international English news (Selic), so news search now uses Brazilian outlets only.
- Long-standing facts (“em vigor desde 2020”) were labeled *Aging*, so freshness now uses the most recent confirmation.
- The updated answer, which is the last call, sometimes hit the free tier's per-minute limit, so the client now waits for Bifrost's `retry_after_ms`.
- One updated answer came back in the wrong language, so the language is now pinned.

15 claims is a small sample: this shows behavior on real cases, not a statistical accuracy estimate.

## Technology stack

| Technology | Purpose |
|---|---|
| Node.js 22.5+ (no framework) | Server, pipeline and tests; built-in `node:sqlite` |
| Tavily Search and Extract | General, news, scientific and official-domain search; page extraction |
| Bifrost by Maxim AI | AI gateway for every model call: fallback chain, routing info, rate-limit handling, per-stage labels |
| Groq (gpt-oss-20b, gpt-oss-120b) | Models served through Bifrost; more models or providers can be chained |
| SQLite | Full verification trace |

### What Bifrost does in Entrelinhas

Every model call goes to `http://localhost:8080/v1/chat/completions` with the virtual key from `BIFROST_KEY`. The gateway does real work:

- **Fallback chain.** Each request names a main model and backups: `groq/openai/gpt-oss-20b` → `groq/openai/gpt-oss-120b` by default. Set `BIFROST_MODEL` and `BIFROST_FALLBACKS` (comma-separated) to add more, for example a Gemini model, for failover across providers. When the main model fails or hits the free tier's per-minute token limit, Bifrost retries the backups on its own, so Entrelinhas has no retry code for that. In the 15-claim benchmark, backup models answered **23 of 50** model calls when the main model hit its limit, and every check finished.
- **Routing info.** `extra_fields.routing_info` (provider, model, `is_fallback`), token usage and latency are recorded for every call and shown in the **AI gateway · Bifrost** panel.
- **Rate limits.** If the whole chain is limited, Entrelinhas waits the `retry_after_ms` that Bifrost reports (at most 25 s) and tries once more. A daily quota cannot be waited out: on Groq's free tier, gpt-oss-20b has a daily token limit, which is why a second provider in the chain matters.
- **Labels for observability.** Requests carry `x-bf-dim-app` and `x-bf-dim-stage` (decomposition, batch analysis, updated answer), plus request and verification IDs.
- **Outage drill.** In live mode, the option *Simulate an outage of the main model* sends that check to a model that does not exist. The panel then shows Bifrost serving every step from a backup, without any change to the request code.

### Geek Room Global AI Hackathon 2026: challenge requirements

The selected problem statement is **Build a Stale-Answer Detector for AI Applications**, which requires both Tavily and Bifrost. **Open-Source Bifrost Gateway (B4) is not selected.**

| Requirement | How Entrelinhas meets it |
|---|---|
| 1. Claim identification | The answer is split into atomic claims, each with a category (`src/afirmacoes.js`, `src/tipo-afirmacao.js`). |
| 2. Freshness detection | Stale-risk triage before searching, with reasons such as category window, “currently” and past years (`src/risco-desatualizacao.js`), shown as the first panel. |
| 3. Live verification | Tavily general, news, scientific and official searches plus extraction (`src/tavily.js`); one validated Bifrost analysis per claim (`src/analise-lote.js`). |
| 4. Freshness score per claim | 0–100 = source recency × support share, with basis and confidence (`src/atualidade-afirmacao.js`). |
| Tavily and Bifrost, meaningfully | Tavily for every search and extraction. Bifrost for every model call, with fallback chain, routing info, rate-limit handling and an outage drill (`src/bifrost.js`). |
| Expected outcome: which claims are supported by current sources | Verdict, agreement and sources per claim, plus the **updated answer** with citations (`src/resposta-corrigida.js`). |

The scores are documented heuristics, not calibrated probabilities. See [`submission/FORM_COPY.md`](submission/FORM_COPY.md) and [`ESPECIFICACAO_FRESHNESS_SCORE.md`](ESPECIFICACAO_FRESHNESS_SCORE.md). Official event: [HackCulture](https://hackculture.io/hackathons/ai-global-hackathon).

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

Missing, invalid, future, or page-only dates do not produce a claim freshness score. Tavily `published_date`, HTTP `Last-Modified`, article metadata and document `dateModified` remain page/document-scoped. Visible “Updated/Atualizado em” labels remain `PAGE`; “prices consulted on” is recorded as `OBSERVATION`; only a visible update date linked to the claim's entity/value can become `ATTRIBUTE`. Schema.org `priceValidUntil` is retained as an `OFFER` validity signal and is not treated as an update timestamp. See [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search), [Tavily Extract API](https://docs.tavily.com/documentation/api-reference/endpoint/extract), and the detailed [temporal signal contract](ESPECIFICACAO_FRESHNESS_SCORE.md).

For up to three extracted URLs, production execution attempts a separate direct page metadata read: HTTPS only, public IPv4 DNS result pinned to the connection, redirects manually followed and revalidated, 1 MiB body cap, 5-second timeout, and HTML/XHTML only. This is a best-effort read; network failures, non-HTML pages, unsafe URLs, missing dates, or unlinked dates remain explicit and do not become freshness evidence. In tests this request is injected/mocked; no page or provider network calls are made.

Evidence aggregation now groups pages by domain, declared canonical URL, exact normalized-content hash, or conservative near-duplicate five-token shingle Jaccard similarity (minimum 40 tokens, threshold 0.88). This reduces obvious republication inflation. It cannot establish editorial provenance, detect heavily edited copies, or prove independence when no duplicate signal is found; the output says this directly. See [public implementation research and design choices](PESQUISA_REFERENCIAS.md).

Four public pages have human labels recorded before parsing in [`avaliacao/rotulos-paginas-reais-v1.json`](avaliacao/rotulos-paginas-reais-v1.json). Their short visible excerpts are covered offline; they are not raw HTML fixtures or a real-web accuracy benchmark. A separate live check is available as `node avaliacao/validar-paginas-reais.js --live` and performs bounded GET requests to those pages.

The stance classifier receives the reference date (today) and must answer CONTRADICTS when a present-tense claim is contradicted by deadlines stated in the evidence itself (for example, a release page saying a version stayed in Active LTS only until a date that has already passed). It still does not judge a page by its age; that remains the job of the deterministic date rules.

The demo shows factual verdict and temporal state separately. A source can support an assertion while freshness remains inconclusive. The 0–100 value is a deterministic temporal index under a documented half-life formula, not a probability or calibrated confidence. A reproducible synthetic evaluation is available with `node avaliacao/teste-avaliacao-rotulada-v1.js`; it tests rules and regression cases, not accuracy on real-world sources.

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

Configure the Groq provider and create a virtual key in Bifrost.

Make sure the configured models are allowed for your virtual key (all models, or at least these):

```text
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

The Groq provider API key belongs in the Bifrost configuration, not in the Entrelinhas `.env` file.

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

### 8. Measure accuracy on real claims

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
├── src/
│   ├── verificador.js       # orchestrates the pipeline
│   ├── afirmacoes.js        # claim decomposition + category suggestion (Bifrost)
│   ├── tipo-afirmacao.js    # category resolution and keyword fallback
│   ├── tavily.js            # Tavily Search/Extract, official-domain search
│   ├── sinais-temporais.js  # page date signals and their scope
│   ├── preparar-evidencia.js, evidencia.js
│   ├── correspondencia.js, classificador.js, bifrost.js
│   ├── atualidade.js        # FRESH / STALE / UNVERIFIABLE
│   ├── freshness-score.js   # per-claim 0–100 freshness score
│   ├── independencia-fontes.js
│   ├── agregador.js         # verdict per claim
│   ├── modo-exemplo.js      # simulated providers for the demo
│   ├── banco.js             # SQLite traceability
│   └── comparador-fontes.js, normalizar-fonte.js, avaliador-impacto.js  # snapshot history
├── avaliacao/               # labeled evaluation and demo script
├── submission/              # hackathon form copy and pitch deck
└── teste-*.js               # tests
```

## Testing and validation

The automated test suite currently covers:

- Valid and invalid source dates
- Claim-specific freshness thresholds
- Missing and malformed evidence
- Evidence preparation and fallback behavior
- Source snapshot comparison
- Impact evaluation
- SQLite persistence and history recovery
- Controlled verification flow
- Bifrost and Tavily trace metadata using simulated dependencies

- Automatic claim categorization and its precedence rules
- Web interface: input validation, body/text limits, CSP, example mode, no credential exposure

The controlled traceability test uses simulated dependencies and does not make external API calls.

Real API integration is checked separately through `node index.js`.

## Current scope and limitations

Entrelinhas is an evolving backend prototype.

The current implementation focuses on evidence handling, temporal assessment, source comparison, traceability, and persistence.

It includes a local web interface for demonstration; it is not yet a hosted, multi-user product.

Freshness assessment is not a guarantee of factual correctness. Results depend on source availability, date detection, configured validity rules, and the quality of the retrieved evidence.

Some advanced capabilities, including semantic change interpretation and broader temporal dependency analysis, remain areas for future development.

## Vision

As AI becomes increasingly integrated into real products, verifying whether information is supported is no longer enough.

Applications also need to understand whether the evidence behind an answer is still relevant today.

Entrelinhas aims to make evidence more transparent, traceable, and temporally aware, helping AI systems communicate not only what their sources say, but also how current that information is.

---

**Entrelinhas**  
*Evidence has a history. Its validity has a timeline.*
