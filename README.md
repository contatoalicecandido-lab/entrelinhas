
# Entrelinhas

### Freshness-aware evidence verification for AI applications

Entrelinhas is an evidence verification layer designed to help AI applications assess not only whether information is supported by sources, but also whether that evidence is still current.

It combines web research, evidence preparation, source comparison, temporal validation, and traceability to make AI-generated information easier to inspect and evaluate.

**The central idea:** evidence should not be treated as permanently valid just because it was once accurate.

## The problem

AI applications can retrieve relevant sources and still produce outdated answers.

A source may support a claim while its information has already changed. A publication date does not necessarily indicate when the information was last updated, and the moment a source is collected does not prove that its content is current.

Entrelinhas addresses this problem by introducing a temporal and traceable evidence layer into AI workflows.

## What Entrelinhas does

The project is designed around five principles:

- **Evidence traceability:** preserve source information and the history of evidence used in verification.
- **Temporal intelligence:** evaluate evidence using publication and update dates, rather than treating collection time as proof of freshness.
- **Critical evaluation:** distinguish supported, outdated, conflicting, and unverifiable evidence.
- **Evidence memory:** persist collected evidence and comparison history for later inspection.
- **Explainability:** retain the information and reasoning behind verification outcomes.

## How it works

The current backend prototype contains components for the following workflow:

1. **Claim preparation:** organize information for verification.
2. **Web research:** retrieve relevant sources using Tavily Search.
3. **Source extraction:** collect source content using Tavily Extract.
4. **Evidence preparation:** select relevant passages while preserving important information.
5. **Source correspondence:** evaluate the relationship between claims and collected evidence.
6. **Temporal validation:** assess evidence freshness using available source dates and claim-specific validity periods.
7. **Page metadata signals:** for up to three extracted URLs, make a bounded, read-only HTTPS GET to inspect HTTP `Last-Modified`, HTML/JSON-LD dates, canonical URLs, and explicit dates visibly tied to a claim value.
8. **Evidence comparison:** identify textual changes between collected source snapshots.
9. **Impact evaluation:** assess the relevance of detected changes.
10. **Aggregation and persistence:** consolidate results and preserve evidence history in SQLite.

These components are connected in `src/verificador.js` and exposed through two entry points: a **local web interface** (`npm run web`) and a **command-line demo** (`node demo.js`). `index.js` remains a minimal connectivity smoke test.

## Freshness assessment

Entrelinhas uses three main freshness outcomes:

| Status | Meaning |
|---|---|
| `FRESH` | Evidence is within the configured validity period. |
| `STALE` | Evidence exceeds the configured validity period. |
| `UNVERIFIABLE` | Available information is insufficient or invalid for a reliable freshness assessment. |

Validity periods depend on the type of claim.

For example, information about prices may require more frequent validation than information about regulations.

These periods are configurable product rules, not universal guarantees of accuracy.

**Important distinctions:**

- Publication date is not the same as update date.
- Collection time is not proof that a source was updated.
- Missing dates do not mean that information is false.
- A detected textual change does not automatically imply a meaningful factual change.
- A source relevance score is not an authority score.
- Freshness does not guarantee truth.

## Technology stack

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| JavaScript | Core application logic |
| SQLite | Evidence and verification persistence |
| Tavily Search | Web research and source discovery |
| Tavily Extract | Source content extraction |
| Bifrost | LLM gateway and model observability |
| Groq / GPT-OSS 20B | Model provider and configured model |
| dotenv | Environment variable configuration |

### Bifrost integration

Entrelinhas connects to Bifrost through its HTTP API.

The current implementation uses:

- Endpoint: `http://localhost:8080/v1/chat/completions`
- Model: `groq/openai/gpt-oss-20b`
- Virtual key: configured through `BIFROST_KEY`

The integration captures available request and response metadata for traceability, including model, provider, latency, and request identifiers when provided.

This is an HTTP API integration with Bifrost, not a native Bifrost plugin or extension.

### Geek Room Global AI Hackathon 2026 tracks

The selected problem statement is **Build a Stale-Answer Detector for AI Applications**. The submission form presents one Problem Statement selector; this challenge explicitly requires using both Tavily and Bifrost. **Open-Source Bifrost Gateway (B4) is not selected.**

**What the prototype covers today:** claim decomposition of an LLM answer; automatic claim categorization into the challenge's four categories (prices, API versions, regulations, company information); live re-verification with Tavily Search/Extract; Bifrost-routed model analysis of source correspondence and stance; date-scope-aware temporal states; a **freshness score per claim** (0–100, or explicitly “not determinable”); deterministic aggregation into a verdict such as *Current* or *Likely outdated*; SQLite traceability; and a local web interface. The freshness score is an uncalibrated, documented heuristic, not a probability of truth. A synthetic labeled evaluation is included; real-world accuracy still needs a human-labeled benchmark.

The Bifrost HTTP integration is the model-provider path required by the selected stale-answer challenge; it is not represented as a new Bifrost gateway feature. See [challenge alignment and implementation prerequisites](submission/TRACK_ALIGNMENT.md).

The selected stale-answer challenge and its implementation prerequisites are documented in [`submission/FORM_COPY.md`](submission/FORM_COPY.md). The score contract, calculation, adversarial evaluation plan, acceptance criteria, and demo flow are in [`ESPECIFICACAO_FRESHNESS_SCORE.md`](ESPECIFICACAO_FRESHNESS_SCORE.md). Official event: [HackCulture](https://hackculture.io/hackathons/ai-global-hackathon).

### Web interface

```bash
npm run web            # live mode if TAVILY_API_KEY and BIFROST_KEY are set; example mode is always available
npm run web:exemplo    # example mode only: no keys, no network, no cost
```

Open <http://localhost:3000>, paste an AI-generated answer and click **Check claims**. Each claim gets a card with:

- a verdict (*Current*, *Likely outdated*, *Contradicted by sources*, *Supported, freshness unconfirmed*, *Conflicting* or *Not verifiable*);
- the freshness score (0–100), or “no fact-level date” when no source ties a date to the specific fact; in that case a separate, clearly labeled **page-date recency** (low confidence) shows whether the dated sources found are recent or old, without replacing the official score;
- the detected category and its validity window, and whether the category was set by the user, suggested by the model or matched by keyword rules;
- every source with its stance, official badge, excerpt, model justification and the published / updated / retrieved dates, with an explicit note on whether the date is tied to the specific fact;
- limitations and a traceability footer (verification ID, model calls, search operations).

**Example mode** runs the real verdict and freshness engine on a fixed demo answer with fictional sources and simulated search/model responses; the page labels it as simulated. It shows the three key outcomes: a current price (score 72), an API endpoint contradicted by a recent official changelog (likely outdated), and a regulation supported by an undated official page (no score).

Live mode reads 2 sources per claim by default (`ENTRELINHAS_MAX_FONTES`, 1–5): every source costs two model calls, and on free model tiers the provider's rate limit dominates latency (a first live run with 3 sources per claim took about 5 minutes for 2 claims because of automatic waits and retries).

The server binds to `127.0.0.1` only, handles one verification at a time, caps input (4,000 characters, 6 claims), sends a strict Content-Security-Policy, renders all content as text, never returns credentials and stores every verification in SQLite `:memory:`.

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

Make sure the configured model is available:

```text
groq/openai/gpt-oss-20b
```

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

`npm test` runs `rodar-testes.js`, which executes all 41 offline test files and prints a summary. Every test uses simulated Tavily/Bifrost responses and SQLite `:memory:`; credentials are blanked for the run, so no paid call is possible. Coverage includes freshness scoring, date scopes, claim categorization, aggregation policy (including adversarial cases), source independence, Tavily collection IDs, the 18 temporal-comparison criteria, persistence, robustness against malformed model output, and the web server (input validation, size limits, CSP, no credential exposure).

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

### 8. Run the benchmark

```bash
npm run test:benchmark
```

This executes the project's separate benchmark script.

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
