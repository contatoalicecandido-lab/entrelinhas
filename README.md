# Entrelinhas

### Is this AI answer still true today? Multi-source, freshness-aware fact checking for AI applications

Entrelinhas checks AI-generated answers claim by claim. For every claim it gathers live evidence from different kinds of sources (official sites, news, references, other websites, blogs and forums), lets a model read them through the Bifrost gateway, and reports:

- **a verdict** (Current, Corroborated, Supported but unconfirmed, Conflicting, Contradicted by sources, Likely outdated, Not verifiable);
- **source agreement (0–100)**: how much independent sources agree, weighted by source type;
- **a freshness score (0–100) per claim**: how recent the date tied to that exact fact is;
- **the evidence itself**: every source with its stance, a key quote checked against the source text, the model's reason and its published / updated / retrieved dates.

It is **Portuguese-aware**: Brazilian number formats, currency, qualifiers such as “a partir de”, “até” and “cerca de”, dates written out in Portuguese and present-tense markers such as “atualmente” are read the way a Brazilian reader means them.

**The central idea:** an answer is not true because one page says so, and it is not current because a page was published recently. Entrelinhas weighs many independent voices and treats time as one dimension of truth.

## The problem

AI applications retrieve relevant sources and still give wrong or outdated answers. A cited page can be official and relevant while the fact it supports has already changed; a claim can be repeated by ten copies of one article; a price written “a partir de R$ 99,90” can be read as an exact price. Users need to see, claim by claim, what independent sources say today.

## What Entrelinhas does

1. **Splits the answer** into atomic claims and assigns each a category with its own validity window (prices 30 days, API versions 90, companies 180, regulations 365), detected by the model with keyword rules as fallback.
2. **Gathers diverse evidence with Tavily**: a general search (boosted to Brazil for Portuguese claims), a news search, and an optional official-domain search; up to five sources of different types are extracted, never two from the same site.
3. **Reads all sources for a claim in one Bifrost call**: same object? supports, contradicts or inconclusive? The model receives today's date and the Portuguese reading notes; its output is validated and every key quote must exist in the source text.
4. **Weighs and explains deterministically**: copies and same-site pages count once, source types are weighted (official 3, news 2, reference 2, other 1, blog/forum 0.5), agreement and freshness are computed, and a verdict is produced. Risky directions are conservative: a dominant contradiction raises a warning, but a contradiction is never hidden behind majority support.
5. **Stores everything** in SQLite: claims, sources, collection IDs, model calls and search operations.

## How it works

```text
AI answer
  └─ claims + category + Portuguese reading        (Bifrost model + deterministic rules)
       └─ general + news + official search, extract (Tavily)
            └─ one batch analysis per claim         (Bifrost model, validated)
                 └─ grouping, weights, dates        (deterministic)
                      └─ verdict · agreement · freshness · evidence   (web UI, SQLite)
```

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

**Challenge requirements and where they are met:**

| Requirement | How Entrelinhas meets it |
|---|---|
| Identify potentially stale information in LLM answers | The answer is split into claims; each gets a verdict. *Likely outdated* and *Contradicted by sources* flag stale or wrong claims; present-tense claims are checked against deadlines written in the sources. |
| Focus on prices, API versions, regulations, company information | Four claim categories, each with its own validity window, assigned automatically (`src/tipo-afirmacao.js`). |
| Re-validate against current web sources | Tavily general, news and official-domain searches plus extraction of diverse sources (`src/tavily.js`, `src/tipo-fonte.js`). |
| Freshness score per claim | `agregacao.freshness.score` (0–100, or explicitly not determinable), plus a separate low-confidence page-date recency (`src/freshness-score.js`). |
| Use Tavily and Bifrost | Every search/extraction goes through Tavily; every model call goes through the Bifrost HTTP gateway (`src/bifrost.js`). |

Beyond the requirements: source agreement across independent, typed sources (`src/concordancia.js`), Portuguese-aware reading (`src/portugues.js`), batch analysis with validated quotes (`src/analise-lote.js`), full traceability and 47 offline test files. The scores are documented heuristics, not calibrated probabilities; a human-labeled real-world benchmark is future work.

The Bifrost HTTP integration is the model-provider path required by the selected stale-answer challenge; it is not represented as a new Bifrost gateway feature. See [challenge alignment and implementation prerequisites](submission/TRACK_ALIGNMENT.md).

The selected stale-answer challenge and its implementation prerequisites are documented in [`submission/FORM_COPY.md`](submission/FORM_COPY.md). The score contract, calculation, adversarial evaluation plan, acceptance criteria, and demo flow are in [`ESPECIFICACAO_FRESHNESS_SCORE.md`](ESPECIFICACAO_FRESHNESS_SCORE.md). Official event: [HackCulture](https://hackculture.io/hackathons/ai-global-hackathon).

### Web interface

```bash
npm run web            # live mode if TAVILY_API_KEY and BIFROST_KEY are set; example mode is always available
npm run web:exemplo    # example mode only: no keys, no network, no cost
```

Open <http://localhost:3000>, paste an AI-generated answer and click **Check answer**. The page is in English and accepts answers in English or Portuguese. Each claim gets a card with the verdict, source agreement, freshness, the evidence mix by source type, how the Portuguese was read (when relevant), every source with its key quote and dates, and the limitations.

**Example mode** runs the real engine (categories, Portuguese reading, agreement, freshness, verdicts, SQLite) on two built-in answers with fictional `.example` sources and simulated search/model responses; the page labels it as simulated.

- English example: a current price (freshness 72), an API endpoint retired by a recent official changelog (likely outdated), and a regulation corroborated by official, news and reference sources.
- Portuguese example: “custa **a partir de** R$ 99,90 por mês” is compatible with an official page listing R$ 99,90 to R$ 119,90 (current), and “**atualmente** tem **cerca de 5 mil** funcionários” is contradicted by news and a reference saying 3,200 today (contradicted by sources).

Live mode reads up to 5 diverse sources per claim (`ENTRELINHAS_MAX_FONTES`, 1–6) with a single model call per claim, so it stays usable on free model tiers.

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

`npm test` runs `rodar-testes.js`, which executes all 47 offline test files and prints a summary. Every test uses simulated Tavily/Bifrost responses and SQLite `:memory:`; credentials are blanked for the run, so no paid call is possible. Coverage includes Portuguese reading (numbers, currency, qualifiers, dates), source types and diverse selection, batch analysis validation, source agreement and verdict rules, freshness scoring, date scopes, claim categorization, aggregation policy (including adversarial cases), source independence, Tavily collection IDs, the 18 temporal-comparison criteria, persistence, robustness against malformed model output, and the web server (input validation, size limits, CSP, no credential exposure).

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
