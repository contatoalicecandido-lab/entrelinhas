# Track alignment and B4 implementation gap

> **Status update (12 Nov 2026):** the T1 gaps listed in this historical
> document have been addressed. The code now exposes a per-claim freshness
> score (`agregacao.freshness`), assigns claim categories automatically,
> and ships a local web interface (`npm run web`, with a no-key example
> mode). See `README.md` and `FORM_COPY.md` for the current status. The B4
> analysis below remains historical only; B4 is not selected.

> **Decision supersedes this historical B4/T1 framing (11 Nov 2026):**
> the selected single Problem Statement is **Build a Stale-Answer
> Detector for AI Applications**. The submission form has one required
> Problem Statement field and a separate optional Tavily challenge
> checkbox. The selected stale-answer statement itself requires both
> Tavily and Bifrost. **B4 is not selected.** Do not use the older B4
> proposal below as the submission strategy; it is retained only as
> historical analysis. Current T1 implementation prerequisites are
> freshness score, repeatable evaluation, and a clear demonstration.

**Review date:** 11 November 2026  
**Selected strategy:** one integrated submission, Bifrost B4 primary and Tavily T1 additional.

## Official selection

| Submission field | Selection |
|---|---|
| Bifrost Priority Track | **B4 — Open-Source Bifrost Gateway** |
| Tavily Track Partner | **T1 — Build a Stale-Answer Detector for AI Applications** |
| Project structure | One integrated Entrelinhas project |

HackCulture's event page says projects may use only Bifrost, only Tavily, or both. For a combined project, its instructions say to select the Bifrost challenge as the primary problem and use the optional Tavily integration checkbox to indicate the additional challenge. So “both are required” means both are part of this project's chosen submission strategy; it is not a general event rule for every team.

## Original challenge text, summarized from the official event page

### B4 — Open-Source Bifrost Gateway

Add a practical feature for gateway developers/operators. The examples include a plugin, provider integration, caching/routing capability, user interface, or developer tool. The contribution must use supported extension points, work with a standard Bifrost installation, include clear setup documentation and tests, and be suitable for an upstream open-source PR.

### T1 — Build a Stale-Answer Detector for AI Applications

Detect potentially stale claims in LLM-generated answers, especially prices, API versions, regulations, and company information; re-verify against live web sources; and give each claim a freshness score so users can distinguish current/reliable information from potentially outdated information. The problem statement explicitly names Tavily and Bifrost.

## Current implementation evidence

### T1: substantial but incomplete

The current Node backend contains:

- Claim decomposition in `src/afirmacoes.js`, orchestrated by `src/verificador.js`.
- Live Tavily Search/Extract and official-domain search in `src/tavily.js`.
- Bifrost model analysis through `src/bifrost.js` for claim/source correspondence and stance.
- Temporal evaluation in `src/atualidade.js` and deterministic aggregation in `src/agregador.js`.
- SQLite evidence and collection traceability in `src/banco.js`.
- CLI demonstration in `demo.js`; it uses real provider calls and an in-memory database.

The system emits `FRESH`, `STALE`, or `UNVERIFIABLE` states at evidence level and summarizes each claim. The implementation does **not** currently provide a distinct freshness score per claim. `score_qualidade_evidencia` is not that score and must not be presented as one. There is no user-facing UI or hosted demo, and the live end-to-end evidence is limited rather than a broad accuracy benchmark.

**Assessment:** T1 is partially satisfied. Add a defined, calibrated per-claim freshness score or explain to the organizer how the existing statuses satisfy the scoring requirement before claiming complete fit.

### B4: not implemented

`src/bifrost.js` is an HTTP client to Bifrost. It supplies LLM calls for the Entrelinhas verifier and captures response metadata. The repository does not include Bifrost's source, a Go plugin, a semantic-cache change, a supported extension, or an upstream PR.

**Assessment:** B4 is not satisfied by the current project. Using the gateway as a model endpoint alone does not meet B4's requirement to add a feature to the open-source gateway.

## Concrete B4 proposal candidate — not yet validated as novel

### Expose freshness-bounded cache policy through the supported HTTP interface

The initial idea was “add per-response TTL to semantic cache.” That is **not new enough and must not be claimed**: the official `semanticcache` package already documents internal per-request `CacheTTLKey` and `CacheNoStoreKey` controls. These are set on `BifrostContext`; current Entrelinhas calls Bifrost over HTTP and does not set that Go context.

The remaining candidate gap is an operator-controlled, documented HTTP/API contract that lets a calling application pass an evidence freshness limit into the semantic-cache plugin, while Bifrost—not the caller—enforces the maximum. For example, a versioned cache-policy field/header could carry an expiry or maximum age; Bifrost would clamp it to an operator-configured ceiling and map stale/unverifiable/no-policy outcomes to bypass/no-store. The exact field/header, trust boundary, and whether existing HTTP hooks already make this possible are **unverified**. This is only a candidate B4 feature, not a confirmed gap or implemented functionality.

This would connect Entrelinhas' date-aware verifier to a gateway-level reuse policy: the verifier supplies a conservative freshness limit, and Bifrost enforces that cached answers are not reused beyond the operator's cap. Bifrost's existing internal TTL/no-store controls are a foundation, not the new contribution.

### Required validation before implementation

1. Inspect the exact Bifrost HTTP ingress and semantic-cache source/version to find whether a supported request field/header can set the documented internal `CacheTTLKey`/`CacheNoStoreKey` context values. Do not infer absence from Helm configuration alone.
2. Establish whether the operator can impose a hard TTL ceiling over client-supplied freshness policy; test unauthorized, malformed, missing, stale, and unverifiable values.
3. Review Bifrost issue [#9748](https://github.com/maximhq/bifrost/issues/9748), which proposes a general FreshGuard plugin and stream metadata. The candidate HTTP-to-cache policy bridge must be reviewed for overlap and usefulness with maintainers.
4. Confirm whether a supported standard-installation extension point can implement this, or whether the work needs a first-party HTTP/schema change. Pin policy semantics and streaming behavior.
5. Only after those checks, implement with unit/integration tests, setup docs, and request-path performance measurement; prepare an upstream PR if accepted.

### Standard installation constraint

Bifrost's plugin guide says Go `.so` plugins require a dynamic build, which is not enabled by default. A standalone dynamic plugin therefore may not satisfy B4's “standard installation” condition. The preferred path is a first-party supported HTTP-to-cache policy bridge or written maintainer confirmation that a packaged plugin and its installation method are acceptable.

## Submission wording guardrail

It is accurate to say:

> “Entrelinhas currently uses Bifrost as an HTTP gateway and implements a partial T1 stale-answer verification backend. We are investigating a Bifrost feature that exposes freshness-bounded semantic-cache controls safely through the supported HTTP interface; the gateway contribution is not implemented and its novelty is not yet confirmed.”

It is not accurate, before the Bifrost work is implemented, to say that Entrelinhas already adds a Bifrost feature, is a native Bifrost plugin, meets B4, or has an upstream contribution.

## Official and technical references

- HackCulture event page, exact B4/T1 descriptions, combine-track instructions, schedule, submission and judging rules: https://hackculture.io/hackathons/ai-global-hackathon
- Geek Room event overview: https://www.geekroom.co.in/event/global-ai-hackathon
- Bifrost custom-plugin lifecycle and dynamic-build constraints: https://github.com/maximhq/bifrost/blob/dev/docs/plugins/getting-started.mdx
- Bifrost semantic-cache configuration: https://github.com/maximhq/bifrost/blob/dev/docs/deployment-guides/helm/plugins.mdx
- Bifrost semantic-cache package API, including internal per-request TTL and no-store context keys: https://pkg.go.dev/github.com/maximhq/bifrost/plugins/semanticcache
- Overlapping public FreshGuard proposal: https://github.com/maximhq/bifrost/issues/9748
