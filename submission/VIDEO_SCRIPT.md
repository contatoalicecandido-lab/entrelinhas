# Entrelinhas · demo video script (about 3:00)

Narrated by Alice, in English, calm and explanatory. Each scene shows one thing and says why it matters.
Record the screen at 1920×1080 with browser zoom at 110%. Record the voice separately if that is easier, and cut on actions, not pauses.

## Recording plan (no live calls needed)

Record from the **public demo**: <https://contatoalicecandido-lab.github.io/entrelinhas/>. Every button there replays a check that ran live with Tavily and Bifrost, with real sources, so the video does not depend on the free model quota. Scene 3 says so once.

Two checks carry the video:
- **Live · Netflix price, in slang (PT)**: Portuguese slang, two claims, two different verdicts (red and yellow), the corrected answer with Brazilian sources.
- **Live · Bifrost outage drill**: an English claim that holds (green), and the gateway panel with the main model down and the backup answering.

Before recording, fill in the two **[fill]** marks in scene 7 with the final results in `avaliacao/`. If they are not ready, use the version of that line given below the table.

## Scenes

| # | Time | Screen | Narration |
|---|---|---|---|
| 1 | 0:00-0:12 | You on camera for a few seconds, or the top of the page. | "Hi, I'm Alice, from Brazil. This is Entrelinhas, built for the Stale-Answer Detector challenge with Tavily and Bifrost." |
| 2 | 0:12-0:35 | Top of the page, then scroll slowly over the wall of struck-out answers and the four cards (a month, a quarter, six months, a year). | "When an AI answers, every sentence sounds equally sure. Some are current, some changed months ago, and some were never right. Different facts also age at different speeds: a price can change in a month, a software version in a quarter, a law in about a year. Nothing on the screen tells the reader which sentence to trust." |
| 3 | 0:35-0:55 | Back to the top. Click **Live · Netflix price, in slang (PT)**. Show the four progress steps. | "Entrelinhas means 'between the lines' in Portuguese. It does not judge an answer as a whole. It splits it into single statements, which we call claims, and checks each one against sources published today. This is a real check, recorded live. The answer is in Brazilian slang: 'o Netflix padrão tá saindo por quarenta e quatro e noventa conto, e o zap é de graça'." |
| 4 | 0:55-1:25 | The triage line, then the two claim cards. Point at **Searched as** on each card, then at the official and news sources in the first card. | "First, it finds two claims and flags how fast each can go stale: this is a price, so it is checked against a one-month window. Here you can see how it reads Portuguese: 'conto' becomes reais, 'zap' becomes WhatsApp, before searching. Then Tavily searches Brazilian news and official sources for each claim, and one model call through Bifrost reads them, knowing today's date. Every quote it uses must exist in the source text." |
| 5 | 1:25-1:55 | First card (red): Source agreement, Freshness, then open one source and its quote. Then the second card (yellow). | "Each claim gets its own result, in three colors: green, it holds; yellow, look closer; red, don't rely on it. The price is red. Source agreement goes from 0 to 100 and says how many independent sources support the claim; here most sources disagree, because Netflix raised the price on 15 October. Official sources count more than blogs, and copies of the same article count once. The second claim is yellow: no source could confirm or deny it, and Entrelinhas says so instead of guessing." |
| 6 | 1:55-2:15 | **Updated answer**: what the AI said next to the corrected text. Hover a citation number. | "Then it rewrites the answer using only verified quotes: the standard plan now costs fifty-one ninety, with numbered sources, and the claim nobody could confirm is marked as such. The reader gets a corrected answer they can check, in their own language." |
| 7 | 2:15-2:40 | Click **Live · Bifrost outage drill**. Show the green card, then the **AI gateway, Bifrost** panel. Then the numbers row on the page. | "Every model call goes through Bifrost, with a chain of backup models. Here the main model was made unavailable on purpose; Bifrost answered from a backup and the check finished, green, with five independent sources agreeing. On 15 real claims with known answers it gave the exact verdict for 14 and never confirmed an outdated claim as true. On [fill] new claims written after the rules were tuned, it got [fill]. Asked alone, without sources, the same model called Brazil's current minimum wage outdated." |
| 8 | 2:40-3:00 | **For anyone who relies on AI answers**, then the bookmarklet steps and the API block. | "This matters wherever an answer is reused. A support chatbot can check a price or a policy before it reaches a customer. A product team can call the API after generating an answer. Anyone can select an answer on ChatGPT or Gemini and check it with one click. Each check costs about three US cents. Next: a hosted version where each company sets its trusted sources, and saved answers re-checked automatically when the fact behind them changes. Thank you." |

**Line for scene 7 if the new results are not ready:** "Every model call goes through Bifrost, with a chain of backup models. Here the main model was made unavailable on purpose; Bifrost answered from a backup and the check finished, green, with five independent sources agreeing. On 15 real claims with known answers it gave the exact verdict for 14 and never confirmed an outdated claim as true."

## If the video must be shorter

- **About 2:30:** cut scene 1 to one sentence and shorten scene 8 to its first three sentences.
- **About 2:00:** also drop the second half of scene 5 (the yellow card) and the numbers in scene 7.

## Editing tips

- Zoom in (1.3× to 1.5×) on the part being explained: the triage line, "Searched as", one source quote, the gateway panel.
- Short captions for the facts: "Netflix Standard: R$ 51,90 since 15 Oct 2026", "Official sources count more, copies count once", "14 of 15 exact · 0 outdated claims confirmed".
- Keep music low and without lyrics.
- Never show the Terminal, the .env file or any API key.
