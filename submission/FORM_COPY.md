# HackCulture submission copy — Stale-Answer Detector

**Selected Problem Statement:** Build a Stale-Answer Detector for AI Applications.

**Status (updated 12 Nov 2026):** working prototype for the stale-answer challenge: claim decomposition, automatic claim categories, live Tavily re-verification, Bifrost-routed analysis, a per-claim freshness score, verdicts such as *Likely outdated*, and a local web interface. The freshness score is an uncalibrated heuristic and real-world accuracy has not been benchmarked. B4 is not selected and no B4 contribution is claimed.

## Form selections

- **Problem Statement:** **Build a Stale-Answer Detector for AI Applications**.
- The form uses one Problem Statement selection. This statement explicitly calls for both Tavily and Bifrost.

The submission selects the stale-answer challenge directly. It does not select Open-Source Bifrost Gateway.

## Project title

Entrelinhas — Evidence Freshness for AI Answers

## Short description

Entrelinhas takes an AI-generated answer, splits it into claims, re-checks each one against live sources found with Tavily, analyses them with a model through Bifrost, and gives every claim a verdict (current, likely outdated, unconfirmed, conflicting) and a 0–100 freshness score, with sources and dates you can inspect.

## Project description

AI answers can cite a relevant page and still repeat a fact that has changed. Entrelinhas is a backend prototype for checking individual claims against live sources and making evidence, dates, and uncertainty inspectable.

The verifier decomposes an LLM answer into atomic claims and assigns each one a category (price, API version, regulation, company information) — set by the caller, suggested by the model, or matched by keyword rules as a fallback. It searches and extracts evidence with Tavily (with an optional extra search restricted to official domains) and uses a model through Bifrost to judge whether each source is about the same object and whether it supports or contradicts the claim. Deterministic rules then read publication/update dates, keep only dates tied to the specific fact, and compute a per-claim freshness score that halves every half validity window (prices 30 days, API versions 90, companies 180, regulations 365). A deterministic aggregator turns the evidence into a verdict, e.g. *Likely outdated* when a current official source contradicts the claim. SQLite records the verification, evidence, collection IDs and provider metadata. A local web interface shows a card per claim with verdict, score, sources, excerpts, dates and limitations.

The project uses Bifrost as its model gateway; it does not claim to extend the Bifrost gateway.

## User problem, solution, differentiator, and potential impact

**Problem:** a sourced AI answer may still rely on information that changed, while retrieval time alone does not establish when a source was updated. For sensitive answers, false certainty can mislead decisions.

**Solution:** inspect individual claims against retrieved sources, separate evidence support from date-based freshness, and return a cautious outcome with traceable sources and explicit uncertainty.

**Differentiator:** freshness is treated as a separate question from whether a source supports a claim. A page's publication date or the time we retrieved it is never passed off as proof that a specific price or API detail is current; only dates tied to the fact count. Missing or invalid dates stay visible as uncertainty instead of becoming a confident score, and evidence count is not presented as probability of truth.

**Potential impact:** if developed and evaluated, this approach could help AI application teams identify answers that need rechecking before reuse, particularly for prices, API behavior, policies, and other changing facts. This is a potential benefit, not a measured deployment result.

## Challenge requirements and status

| Requirement | Status |
|---|---|
| Identify potentially stale information in LLM answers | Done: answer → atomic claims → verdict per claim (*Likely outdated* when a current official source contradicts). |
| Focus on prices, API versions, regulations, company info | Done: four categories with their own validity windows; assigned automatically. |
| Re-verify claims against live web sources | Done: Tavily Search + Extract, optional official-domain search. Live end-to-end runs recorded on 11 Nov; re-run with the final code pending (see below). |
| Freshness score per claim | Done: 0–100 deterministic score or explicit “not determinable”; uncalibrated. |
| Use Tavily and Bifrost | Done: Tavily for search/extraction; every model call goes through the Bifrost HTTP gateway. |
| Clear demo | Done: local web interface with a no-key example mode; CLI demo for live runs. |

## Track fit and honest status

### Stale-answer challenge (Tavily + Bifrost)

The prototype performs claim decomposition with automatic categories, live Tavily Search/Extract, Bifrost-routed correspondence/stance analysis, date-scope-aware states (`FRESH`, `STALE`, `UNVERIFIABLE`), a per-claim freshness score (`agregacao.freshness.score`), deterministic verdicts, SQLite traceability and a local web interface. `score_qualidade_evidencia` is a separate evidence-quality number and is not presented as the freshness score. The live end-to-end evaluation is limited and is not an accuracy benchmark.

### Bifrost B4 — not yet satisfied

The current Node.js code uses the Bifrost HTTP gateway as an LLM client. It does not extend Bifrost, implement a Bifrost plugin, or provide an upstream pull request. The HTTP-to-cache policy bridge is an unvalidated proposal, not a shipped feature. Before claiming novelty, verify whether the HTTP transport already exposes the semantic cache's internal per-request TTL/no-store controls.

There is already a public Bifrost proposal for a general freshness-check plugin (issue #9748). Any HTTP-to-cache policy contribution must be checked against that work and the existing cache controls before coding or claiming novelty.

## Architecture and technology

### Implemented

- Node.js and JavaScript verification backend.
- Tavily Search and Extract for live evidence discovery and extraction.
- Bifrost HTTP gateway; in the tested setup it routed to Groq GPT-OSS 20B.
- Deterministic date validation, claim-type freshness windows, and evidence aggregation.
- SQLite traceability and source-snapshot history.

### Proposed for B4

- A possible Bifrost HTTP/API bridge to existing semantic-cache per-request TTL/no-store controls.
- If maintainers confirm the gap, enforce `effective TTL = min(operator maximum, verified response limit)`; a caller must never lengthen the operator's maximum.
- Treat stale or unverifiable evidence conservatively and avoid extending cache lifetime.
- Add upstream documentation, tests across supported response types/streams, and request-path performance measurements.

The precise API/header contract and exact Bifrost integration point remain open until the upstream source is checked. Public Helm documentation describes a configured semantic-cache TTL; it is not yet enough evidence to assert that the current source lacks every per-request override.

## What has been demonstrated

- A claim-verification flow using live Tavily and Bifrost integrations, available from the web interface and the CLI.
- A web interface whose example mode runs the real verdict/score engine on simulated sources and shows a current claim (score 72), an outdated claim contradicted by a recent official changelog, and a supported claim without a dated source (no score).
- A controlled live example where official documentation supported the claim but the page's publication/update date was not verifiable; the outcome was weak support, not a claim of confirmed current truth.
- Automated regression coverage for freshness, evidence, persistence, source comparison, and controlled integration behavior.

This evidence is an integration demonstration, not a broad accuracy evaluation.

## Limitations

- Local web interface only; no hosted demo.
- The freshness score is a documented heuristic, not calibrated against labeled real-world data.
- Most real pages do not tie a date to the specific fact, so many live claims will honestly show “no dated evidence”.
- No Bifrost-side integration or upstream pull request; the proposed HTTP-facing gap has not yet been confirmed.
- No broad evaluation across stale/current/timeless claims, categories, source types, and failures.
- Attribute-level update-date detection and reused/syndicated-source detection remain open work.
- Freshness, official status, or source agreement is not a guarantee of truth.

## Repository and demo

Public repository: https://github.com/contatoalicecandido-lab/entrelinhas

The public repository history begins on 7 November 2026, within the published event window. This describes Git history and does not claim that a commit timestamp alone proves when every component was developed.

No hosted demo URL is available. Run `npm run web:exemplo` for the no-key demo or `npm run web` with Tavily and Bifrost configured for live verification; `node demo.js` offers the same flow in the terminal. Live runs consume provider usage and store data only in SQLite `:memory:`. Do not claim a video is attached unless one is recorded and uploaded.

## AI-use disclosure

The project uses a model through Bifrost for claim decomposition, source correspondence, and evidence-stance analysis. Deterministic application code evaluates dates and aggregates results. AI assistance was used in development; complete any platform-specific AI disclosure truthfully.

## Official challenge and submission sources

- Event, B4/T1 wording, submission rules and combined-project instructions: https://hackculture.io/hackathons/ai-global-hackathon
- Geek Room event overview: https://www.geekroom.co.in/event/global-ai-hackathon
- Bifrost plugin extension guide: https://github.com/maximhq/bifrost/blob/dev/docs/plugins/getting-started.mdx
- Bifrost semantic cache configuration: https://github.com/maximhq/bifrost/blob/dev/docs/deployment-guides/helm/plugins.mdx
- Bifrost semantic-cache package API, including internal per-request TTL and no-store context keys: https://pkg.go.dev/github.com/maximhq/bifrost/plugins/semanticcache
- Existing overlapping Bifrost issue: https://github.com/maximhq/bifrost/issues/9748
