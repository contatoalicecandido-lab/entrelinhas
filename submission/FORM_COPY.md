# HackCulture submission copy — Stale-Answer Detector

**Selected Problem Statement:** Build a Stale-Answer Detector for AI Applications (requires Tavily and Bifrost). Open-Source Bifrost Gateway (B4) is not selected and no B4 contribution is claimed.

**Status (12 Nov 2026):** working prototype with a local web interface, live Tavily + Bifrost verification, a no-key example mode and 47 offline test files.

## Project title

Entrelinhas — Is this AI answer still true today?

## Short description

Entrelinhas checks AI-generated answers claim by claim against live, diverse sources found with Tavily (official sites, news, references, blogs) and read by a model through Bifrost. Each claim gets a verdict, a source-agreement score, a freshness score and the exact evidence behind it, in English or Portuguese.

## Project description

AI answers can cite a relevant page and still be wrong or out of date. Entrelinhas splits an answer into atomic claims and tags each as a price, API version, regulation or company fact, each with its own validity window. For every claim it runs a general search, a news search and an optional official-domain search with Tavily, extracts up to five sources of different types (never two from the same site) and sends them to a model through the Bifrost gateway in a single call that decides, source by source, whether it is about the same object and whether it supports or contradicts the claim. The model receives today's date, so a source saying “Active LTS until October 2024” contradicts “is the current LTS” in 2026; its output is validated and each key quote must exist in the source text.

Deterministic rules then group copies and same-site pages, weigh source types, compute a source-agreement score (0–100) and a freshness score per claim (0–100, from a date tied to that exact fact; otherwise explicitly not determinable, with a separate low-confidence page-date recency), and produce a verdict: Current, Corroborated, Supported but unconfirmed, Conflicting, Contradicted by sources, Likely outdated or Not verifiable. Everything is stored in SQLite for traceability.

Entrelinhas is Portuguese-aware: “R$ 1.234,56”, “a partir de” (starting price), “até” (upper bound), “cerca de 5 mil” (about 5,000), “atualmente” (must hold today), “12/11/2026” and “18 de setembro de 2020” are read the way a Brazilian reader means them, and Portuguese claims get search results boosted to Brazil.

## User problem, solution, differentiator and potential impact

**Problem:** a sourced AI answer may rely on a fact that changed, on one page repeated by many copies, or on a misread qualifier. Users cannot see which part of an answer to trust.

**Solution:** claim-level re-verification against diverse live sources, with verdict, agreement, freshness and evidence shown side by side.

**Differentiators:** many independent voices instead of one link; freshness that refuses to guess (publish dates and retrieval time never become proof that a fact is current); Portuguese-aware reading; conservative rules that raise warnings but never hide a contradiction; full traceability and reproducible offline tests.

**Potential impact:** AI products, support teams and content teams could flag answers to recheck before reuse, especially prices, API behaviour, regulations and company facts, including for Portuguese-speaking users. This is a potential benefit, not a measured deployment result.

## Challenge requirements and status

| Requirement | Status |
|---|---|
| Identify potentially stale information in LLM answers | Done: per-claim verdicts; *Likely outdated* and *Contradicted by sources*; deadline-aware stance with today's date. |
| Prices, API versions, regulations, company information | Done: four categories with validity windows, assigned automatically. |
| Re-validate against current web sources | Done: Tavily general, news and official-domain search and extraction. Live runs recorded on 11–12 Nov; the final batch pipeline must be re-run live before recording the demo. |
| Freshness score per claim | Done: 0–100 or explicitly not determinable, plus low-confidence page-date recency. Uncalibrated heuristic. |
| Use Tavily and Bifrost | Done: all search via Tavily; all model calls via the Bifrost HTTP gateway (tested setup routes to Groq GPT-OSS 20B). |

## Architecture and technology

- Node.js 22.5+ (built-in `node:sqlite`), no framework; local web server on 127.0.0.1.
- Tavily Search (general, news, official domains; country boost) and Tavily Extract.
- Bifrost HTTP gateway for decomposition and batch evidence analysis.
- Deterministic modules: claim categories, Portuguese reading, source types, dependency grouping, source agreement, freshness score, verdict rules.
- SQLite traceability of verifications, evidence, collections and provider operations.

## What has been demonstrated

- Live runs with Tavily and Bifrost: a Node.js 20 LTS claim was first marked supported by a page saying LTS ended in October 2024; after giving the model today's date it was flagged as contradicted (58 s, down from 307 s).
- The web interface in example mode, in English and Portuguese, with the real engine.
- 47 offline test files (simulated providers, in-memory database), including the 18 temporal-history audit criteria.

## Limitations

- Local web interface; no hosted demo.
- Agreement and freshness scores are documented heuristics, not calibrated probabilities; independent sources can share the same error.
- Most real pages do not tie a date to a specific value, so the strict freshness score is often not determinable; page-date recency is shown with low confidence.
- Source types come from domain lists and search origin, not from an editorial authority model.
- Free model tiers add waiting time under rate limits.

## Repository and demo

Public repository: https://github.com/contatoalicecandido-lab/entrelinhas

Run `npm run web:exemplo` for the no-key demo, or `npm run web` with Tavily and Bifrost configured for live verification. Do not claim a video is attached unless one is recorded and uploaded.

## AI-use disclosure

The product uses a model through Bifrost for claim decomposition and evidence analysis; dates, agreement, scores and verdicts are computed by deterministic code. AI assistants were used during development; complete any platform-specific disclosure truthfully.

## Official challenge and submission sources

- Event page and rules: https://hackculture.io/hackathons/ai-global-hackathon
- Geek Room event overview: https://www.geekroom.co.in/event/global-ai-hackathon
