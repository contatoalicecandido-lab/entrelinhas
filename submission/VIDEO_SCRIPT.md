# Entrelinhas · demo video script (about 2:50)

Narration in English (the judges are global), with one Portuguese moment that shows the differentiator.
Record the screen at 1920×1080 and the voice separately. Cut on actions, not on pauses. The scenes follow the order of the website, so the video and the page tell the same story.

## Before recording

- Bifrost running (`localhost:8080`) and the server running: `PORT=3001 npm run web`.
- Groq's free tier has a daily token limit. If live checks start failing, wait for the daily reset or record from recorded checks.
- Browser zoom at 100% to 110%. Close other tabs. Hide the bookmarks bar except the Entrelinhas button.
- Run each live check once beforehand, so you know how long it takes. In editing, cut the wait and keep 2 s of the progress steps.
- Texts to paste:
  - **A (English):** `Node.js 20 is the current Active LTS release and the recommended version for production. ChatGPT Plus costs $20 per month.`
  - **B (Portuguese, informal):** `O salário mínimo em 2026 é de R$ 1.518 e a taxa Selic está atualmente em 10,5% ao ano.`
- Plan B if a live check fails or the free model tier is slow: use the public demo and click **See a real check**. It replays a real recorded check with the same panels.

## Scenes

| Time | Screen | Narration |
|---|---|---|
| 0:00-0:10 | Home, top of the page: "Read between the lines of any AI answer." | "An AI answer sounds just as sure when it is current, outdated or simply wrong. Entrelinhas reads between the lines." |
| 0:10-0:25 | Scroll slowly past the hero: the glass cards over the wall of struck-out answers, then **About** ("between the lines"). | "Models freeze the world on the day they were trained. Prices go stale in about a month, software versions in a quarter, company facts in six months, laws in a year." |
| 0:25-0:42 | Back to the top. Paste text **A** and click **Check answer**. The box turns into the four progress steps. | "Entrelinhas checks an answer claim by claim. Tavily searches official sites, the news and science, live. A model reads every source through the Bifrost gateway." |
| 0:42-0:55 | Report: **What still holds**, then the **Stale-risk triage** block. | "Before searching, it flags which claims can go stale, and why." |
| 0:55-1:15 | **Updated answer**: what the AI said, struck through, next to what current sources support. Hover a citation number. | "Then it rewrites the answer from verified quotes only. Node.js 20 reached end of life in April 2026. ChatGPT Plus is still twenty dollars, and every sentence cites its sources." |
| 1:15-1:35 | **Claim by claim**: the Node.js card (Contradicted by sources, agreement 0) and the ChatGPT Plus card (Corroborated, Current). Open one source and its quote. | "Each claim gets its own verdict, a source agreement score and a freshness score. Official sources weigh most and blogs least, so it does not just agree with you." |
| 1:35-1:55 | Paste text **B** and check it (or click **Live · Brazil minimum wage + Selic rate (PT)** on the public demo). Show the corrected answer and the official Brazilian source searched. | "And it is built for Portuguese, not translated into it. It reads Brazilian numbers and words like *atualmente*, and it goes to the Brazilian authorities on its own." |
| 1:55-2:12 | Open **Advanced options +**, tick **For judges: simulate a model outage**, run a short claim. Show the **AI gateway, Bifrost** panel: main model crossed out, answered by a backup. | "Every model call goes through Bifrost. When the main model fails or hits a rate limit, Bifrost answers from a backup on its own. Here I simulate an outage, and the check still finishes." |
| 2:12-2:22 | On ChatGPT, select an answer and click the **Check with Entrelinhas** bookmark. Entrelinhas opens with the text filled in. | "It works wherever you already use AI. Select an answer, one click, and it is ready to check." |
| 2:22-2:40 | Scroll to the example section: the two claim cards and the numbers row (22 of 60 calls answered by a backup through Bifrost, 14 of 15). Then **What the results mean** (green, yellow, red) and **For anyone who relies on AI answers**. | "On fifteen real claims with known answers, it got fourteen exactly right, put all fifteen on the right side and never confirmed an outdated claim as true. Green means it holds, yellow means look closer, red means don't rely on it. It is for anyone who relies on AI answers, from everyday questions to support bots and newsrooms." |
| 2:40-2:50 | Footer "Check an answer" (the arrow takes you back to the top), then the public link on screen. | "Try a recorded check now, no install. Entrelinhas. Read between the lines of any AI answer." |

## Editing tips

- Zoom in (1.3× to 1.5×) on the block being described.
- On-screen captions for the key facts: "Node.js 20 end of life: 30 Apr 2026", "14 of 15 exact · 0 stale claims confirmed".
- Keep music low and without lyrics.
- Do not show the Terminal or any API key on screen.
