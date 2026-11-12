# Entrelinhas · demo video script (about 2:55)

Narration in English (the judges are global), with one Portuguese moment that shows the differentiator.
Record the screen at 1920×1080 and the voice separately. Cut on actions, not on pauses.

## Before recording

- Bifrost running (`localhost:8080`) and the server running: `PORT=3001 npm run web`.
- Browser zoom at 110%. Close other tabs. Light theme.
- Run each live check once beforehand, so you know how long it takes. Cut the wait in editing and show the progress steps for 2–3 s.
- Have these texts ready to paste:
  - **A (English, mixed):** `Node.js 20 is in Active LTS and is the recommended version for production. ChatGPT Plus costs $20 per month.`
  - **B (Portuguese, informal):** `O plano Padrão da Netflix custa 44,90 conto por mês e a Selic está atualmente em 10,5% ao ano.`

## Scenes

| Time | Screen | Narration |
|---|---|---|
| 0:00–0:12 | A chatbot answer that agrees with a wrong claim (any chat window, or text on a slide). | "Ask an AI if your information is right, and it will usually agree with you. Prices change, versions reach end of life, rates move… and the answer still sounds confident." |
| 0:12–0:20 | Entrelinhas home: headline "Is this AI answer really true?". | "Entrelinhas checks AI answers claim by claim, against independent sources found live, so you see what is still true today." |
| 0:20–0:35 | Paste text **A**, choose *Live check*, click **Check answer**. Progress steps visible. | "I paste an answer. Tavily searches official sites, news and scientific sources. A model reads them through the Bifrost gateway." |
| 0:35–0:50 | **Stale-risk triage** panel: "2 claims found · 2 time-sensitive (software versions ~quarterly, prices change ~monthly)". | "Before searching, it flags which claims can go stale, and why. A price changes monthly, a software version quarterly." |
| 0:50–1:10 | **Updated answer**, side by side: what the AI said vs what current sources support, with [1][2]. Hover a citation. | "Then it gives back a corrected answer, written only from verified quotes, and every sentence cites its source. Node 20 reached end of life in April 2026; ChatGPT Plus is still twenty dollars." |
| 1:10–1:30 | Node.js card: verdict *Contradicted by sources*, Freshness score near 0 "Outdated", "Who says what", the nodejs.org source with its quote. | "Each claim gets a verdict and a freshness score: how recent the sources are, times how many of them support the claim. Official sources weigh most and blogs least, so it does not just agree with you." |
| 1:30–1:55 | Paste text **B**. Show the Portuguese panel open: "44,90 conto → R$ 44,90", "atualmente = must hold today", official BR source searched. | "And it is built for Portuguese. It reads slang, Brazilian money formats and words like *atualmente*, and it goes to the Central Bank on its own." |
| 1:55–2:10 | Netflix card *Outdated* with the quote "passa de R$ 44,90 para R$ 51,90"; Selic card contradicted (13,75%). | "Netflix raised the price in October; the Selic is 13.75%. Both claims are flagged, with the exact quote and date." |
| 2:10–2:20 | Tick **Simulate an outage of the main model**, run a short claim. Show the **AI gateway · Bifrost** panel: main model crossed out, "answered by a backup". | "Every model call goes through Bifrost. If the main model fails or hits a rate limit, Bifrost switches to a backup model by itself. Here I simulate an outage, and the check still finishes." |
| 2:20–2:30 | On ChatGPT (or any page), select an answer and click the **✓ Check with Entrelinhas** bookmark. Entrelinhas opens with the text filled in. | "And it works wherever you already use AI: select an answer on any site, one click, and it's ready to check." |
| 2:30–2:45 | Benchmark result on screen (README section "Accuracy on real claims"), then the GitHub repo. | "On 15 real claims with known answers, Entrelinhas got 11 exactly right and all 15 in the right direction. It never confirmed an outdated claim. It's open source, with 52 automated test files." |
| 2:45–2:55 | Public demo page, then logo / headline. | "You can try it right now, no install: the link is in the description. Entrelinhas. Read between the lines of any AI answer." |

## Editing tips

- Zoom in (1.3–1.5×) on the panel being described. The cards have small text.
- Add on-screen captions for the key numbers: "Node 20 EOL: 30 Apr 2026", "Netflix: R$ 44,90 → R$ 51,90 (15 Oct 2026)".
- Keep music low and without lyrics.
- If a live check is slow, cut from the click to the result and keep a 1 s shot of the progress steps.
- Caption for the benchmark: "15 real claims · 11 exact · 15/15 right direction · 0 stale claims confirmed".
