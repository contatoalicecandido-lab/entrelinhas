# Entrelinhas · demo video script (about 3:10)

Narration in English, calm and explanatory. Every scene shows one thing and says why it matters.
Record the screen at 1920×1080 with browser zoom at 110%, and record the voice separately. Cut on actions, not pauses.

## Recording plan (no live calls needed)

Record from the **public demo**: <https://contatoalicecandido-lab.github.io/entrelinhas/>. Every button there replays a check that ran live with Tavily and Bifrost, with real sources, so the video does not depend on the free model quota. Say once that they are recorded live checks (scene 3).

Buttons used: **See a real check** (Node.js 20 + ChatGPT Plus), **Live · Netflix price, in slang (PT)**, **Live · Brazil minimum wage, old value (PT)**, **Live · Bifrost outage drill**.

Before recording, fill in the two numbers marked **[fill]** in scene 8 with the final results in `avaliacao/` (the new held-out claims and the model-alone comparison). If they are not ready, use the version of the line without them.

## Scenes

| # | Time | Screen | Narration |
|---|---|---|---|
| 1 | 0:00-0:18 | Top of the page, then scroll slowly over the wall of struck-out answers. | "When an AI answers a question, everything in the answer sounds equally sure. Some sentences are current, some changed months ago, and some were never right. Nothing on the screen tells you which is which, so people copy the whole answer into an email, a support reply or a decision." |
| 2 | 0:18-0:38 | **About** section: "Entrelinhas means between the lines". | "Entrelinhas means 'between the lines' in Portuguese. It does not judge the answer as a whole. It splits the answer into single statements, which we call claims, and checks each claim against sources published today. Time is the most common reason an answer goes wrong, but it also catches claims that are simply false or that nobody can confirm." |
| 3 | 0:38-1:00 | Back to the top. Click **See a real check**. Show the four progress steps, then the report header. | "This is a real check, recorded live. The answer says Node.js 20 is the current long-term support release and that ChatGPT Plus costs twenty dollars a month. First, Entrelinhas finds the claims and flags which ones can go stale and why: software versions change about every quarter, prices about every month. Then Tavily searches the web for each claim: official sites, news and, when it matters, scientific sources." |
| 4 | 1:00-1:22 | **Updated answer**: what the AI said, struck through, next to the corrected text. Hover one citation number. | "One model call per claim, made through the Bifrost gateway, reads all the sources knowing today's date, and every quote it uses must exist in the source text. The result is the same answer, rewritten only from verified quotes: Node.js 20 reached end of life on 30 April 2026, and the price is still twenty dollars. Each sentence points to its sources, so you can check them yourself." |
| 5 | 1:22-1:50 | **Claim by claim**: the two cards. Point at Source agreement, then Freshness, then open one source and its quote. | "Each claim gets its own result. The verdict is a color: green, it holds; yellow, look closer; red, don't rely on it. Source agreement goes from 0 to 100 and says how many independent sources support the claim. Official and scientific sources count more than blogs, and ten copies of the same article count once, so it does not simply agree with whatever is repeated most. Freshness says how recently a source confirmed the claim, measured against how fast that kind of fact changes." |
| 6 | 1:50-2:15 | Click **Live · Netflix price, in slang (PT)**. Show the claim cards and the Brazilian sources. Then **Live · Brazil minimum wage, old value (PT)** and its official source. | "Most verification tools are built for English. Entrelinhas was built for Portuguese too. Here the answer is written the way people talk in Brazil: 'quarenta e quatro e noventa conto', 'o zap é de graça'. It understands the slang, the Brazilian number format and words like 'atualmente', searches Brazilian news outlets, and goes to the official authority on its own. In the minimum wage check, official sources, the Brazilian Senate and the government news agency, show that R$ 1,518 was the 2025 value and that it changed on 1 January 2026." |
| 7 | 2:15-2:35 | Click **Live · Bifrost outage drill**. Show the **AI gateway, Bifrost** panel: the main model crossed out, the backup answering. | "Every model call goes through Bifrost. Each request carries a chain of backup models, so when the main one fails or hits its limit, Bifrost answers from the next one and the check still finishes. Here the main model was made unavailable on purpose. In our 15-claim test, the backup answered 22 of 60 model calls, and no check was lost." |
| 8 | 2:35-2:55 | **Example** section with the numbers row, then **What the results mean**. | "We measured it on 15 real claims with known answers, in English and Portuguese. It gave the exact verdict for 14, put all 15 on the right side, and never confirmed an outdated claim as true. On [fill] new claims written after the rules were tuned, it got [fill]. Asked alone, without sources, the same model called Brazil's current minimum wage outdated. Each check costs about three US cents, mostly search." |
| 9 | 2:55-3:12 | **For anyone who relies on AI answers**, then the bookmarklet steps and the API block. | "This matters wherever an answer is reused. A support chatbot can check a price or a policy before it reaches a customer. A product team can call the API after generating an answer. A newsroom can check a draft. And anyone can select an answer on ChatGPT or Gemini and check it with one click. Next, we want a hosted version where each company sets its trusted sources, and saved answers that are re-checked automatically when the fact behind them changes." |
| 10 | 3:12-3:18 | Footer, then the public link on screen. | "Entrelinhas. Try the recorded checks at the link, and run it locally to check your own text." |

**Line for scene 8 if the new results are not ready:** "We measured it on 15 real claims with known answers, in English and Portuguese. It gave the exact verdict for 14, put all 15 on the right side, and never confirmed an outdated claim as true. Each check costs about three US cents, mostly search."

## If the video must be shorter

- **About 2:30:** cut scene 2 (the About section) and shorten scene 9 to its first two sentences.
- **About 2:00:** also cut scene 7, and keep only one sentence about Bifrost in scene 4.

## Editing tips

- Zoom in (1.3× to 1.5×) on the part being explained: the progress steps, one card, one source quote, the gateway panel.
- Short captions for the facts: "Node.js 20: end of life on 30 April 2026", "Official sources count more, copies count once", "14 of 15 exact · 0 outdated claims confirmed".
- Keep music low and without lyrics.
- Never show the Terminal, the .env file or any API key.
