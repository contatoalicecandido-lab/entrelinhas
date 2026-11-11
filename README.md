
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
7. **Evidence comparison:** identify textual changes between collected source snapshots.
8. **Impact evaluation:** assess the relevance of detected changes.
9. **Aggregation and persistence:** consolidate results and preserve evidence history in SQLite.

These components are implemented in the backend. The current `index.js` file is an integration smoke test, not a complete execution interface for the entire workflow.

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

### Run one claim through the verification flow

```bash
node demo.js --type versao_api --official-domain platform.openai.com \
  "The API provides the Chat Completions endpoint."
```

The demo runs claim decomposition, Tavily Search and Extract, source correspondence and stance analysis, freshness assessment, and deterministic aggregation. It prints each result with its source URL and date fields. It uses real Bifrost and Tavily requests but stores verification data in SQLite `:memory:`; it does not write to `dados/entrelinhas.db`.

Available claim types are `preco`, `versao_api`, `regulamento`, and `empresa`. Official domains are optional. When supplied, Entrelinhas makes one additional Tavily search per claim to seek those domains while retaining the general search. This adds Tavily usage.

Missing publication or update dates remain `UNVERIFIABLE`; collection time is shown separately and is not treated as proof that a page was updated. The result is evidence-based support, conflict, weak support, or not verifiable, not a guarantee of truth.

## Requirements

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

The command runs the core automated suite, covering:

- Freshness assessment
- Evidence validation
- Evidence preparation
- Persistence and source comparison
- Controlled verification and traceability

Additional isolated checks can be run separately:

```bash
node teste-tavily-busca-oficial.js
node teste-politica-fontes-e-datas.js
node teste-integracao-sintese-controlada.js
```

These tests use simulated external services and SQLite in memory.

### 6. Run the integration smoke test

```bash
node index.js
```

This script checks communication with the configured Bifrost and Tavily services using real API requests.

Both services must be running and correctly configured.

This is an integration smoke test, not a complete application interface.
It sends real requests to Bifrost and Tavily. Use `node demo.js` for a full claim-level verification flow.

### 7. Run the benchmark

```bash
npm run test:benchmark
```

This executes the project's separate benchmark script.

## Project structure

```text
entrelinhas/
├── index.js
├── package.json
├── README.md
├── dados/
├── src/
│   ├── agregador.js
│   ├── banco.js
│   ├── bifrost.js
│   ├── evidencia.js
│   ├── tavily.js
│   └── verificador.js
├── teste-atualidade.js
├── teste-evidencia.js
├── teste-preparar-evidencia.js
├── teste-integracao-persistencia-comparador.js
├── teste-rastreabilidade-fluxo-controlado.js
└── teste-benchmark.js
```

Additional source and test files may be present in the repository.

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

The controlled traceability test uses simulated dependencies and does not make external API calls.

Real API integration is checked separately through `node index.js`.

## Current scope and limitations

Entrelinhas is an evolving backend prototype.

The current implementation focuses on evidence handling, temporal assessment, source comparison, traceability, and persistence.

It does not yet provide a complete user-facing application interface.

Freshness assessment is not a guarantee of factual correctness. Results depend on source availability, date detection, configured validity rules, and the quality of the retrieved evidence.

Some advanced capabilities, including semantic change interpretation and broader temporal dependency analysis, remain areas for future development.

## Vision

As AI becomes increasingly integrated into real products, verifying whether information is supported is no longer enough.

Applications also need to understand whether the evidence behind an answer is still relevant today.

Entrelinhas aims to make evidence more transparent, traceable, and temporally aware, helping AI systems communicate not only what their sources say, but also how current that information is.

---

**Entrelinhas**  
*Evidence has a history. Its validity has a timeline.*
