# Entrelinhas · demo video script (about 3:45, or 4:10 with scene 7b; the limit is 5:00)

Narrated by Alice, in English, calm and explanatory. Each scene shows one thing and says why it matters.
Record the screen at 1920×1080 with browser zoom at 110%. Record the voice separately if that is easier, and cut on actions, not pauses.

## Recording plan (no live calls needed)

Record from the **public demo**: <https://contatoalicecandido-lab.github.io/entrelinhas/>. Every button there replays a check that ran live with Tavily and Bifrost, with real sources, so the video does not depend on the free model quota. Scene 3 says so once.

Two checks carry the video:
- **Live · Brazil minimum wage, old value (PT)**: a claim in Portuguese, an official Brazilian source (the Senate) that contradicts it, the verdict *Likely outdated* (red) and the corrected answer with three sources.
- **Live · Bifrost outage drill**: an English claim that holds (green), and the gateway panel with the main model down and the backup answering.

## Scenes

| # | Time | Screen | Narration |
|---|---|---|---|
| 1 | 0:00-0:12 | You on camera for a few seconds, or the top of the page. | "Hi, I'm Alice, from Brazil. This is Entrelinhas, built for the Stale-Answer Detector challenge with Tavily and Bifrost." |
| 2 | 0:12-0:35 | Top of the page, then scroll slowly over the wall of struck-out answers and the four cards (a month, a quarter, six months, a year). | "When an AI answers, every sentence sounds equally sure. Some are current, some changed months ago, and some were never right. Different facts also age at different speeds: a price can change in a month, a software version in a quarter, a law in about a year. Nothing on the screen tells the reader which sentence to trust." |
| 3 | 0:35-0:55 | Back to the top. Click **Live · Brazil minimum wage, old value (PT)**. Show the four progress steps. | "Entrelinhas means 'between the lines' in Portuguese. It does not judge an answer as a whole. It splits it into single statements, which we call claims, and checks each one against sources published today. This is a real check, recorded live. The AI answer says, in Portuguese, that Brazil's minimum wage in 2026 is one thousand five hundred and eighteen reais." |
| 4 | 0:55-1:25 | The triage line, then the claim card. Point at the sources list: the Senate, the government news agency, national news. | "First, it flags how fast the claim can go stale: an official value like the minimum wage is reset once a year, so it is checked against a one-year window. Then Tavily searches the web. Because the claim is about a Brazilian official value, Entrelinhas knows the official source is the federal government: government sites weigh more, and the search also looks there directly. One model call through Bifrost reads every source knowing today's date. When the model quotes a page, the quote must really be in that page, or the source is not counted." |
| 5 | 1:25-1:55 | The card: the red verdict, Source agreement 0, then open the Senate source and its quote. | "The verdict is red: Likely outdated. That is the strongest warning, because an official source, the Brazilian Senate, says the value changed: R$ 1,518 was the 2025 value, and since 1 January 2026 it is R$ 1,621. Source agreement goes from 0 to 100; here it is 0, because every independent source disagrees with the claim. Official and scientific sources count more than blogs, copies of the same article count once, and a claim is only green when the sources really back it." |
| 6 | 1:55-2:15 | **Updated answer**: what the AI said next to the corrected text. Hover a citation number. | "Then it rewrites the answer from the sources, taking numbers and dates only from quotes checked against the page: the minimum wage in 2026 is R$ 1,621, with numbered sources. The reader gets a corrected answer they can check, in their own language. Most verification tools only work well in English; this one reads Brazilian number formats, words like 'atualmente', and knows where Brazil's official data lives." |
| 7 | 2:15-3:25 | Click **Live · Bifrost outage drill**. Show the green card, then the **AI gateway, Bifrost** panel. Then the numbers row on the page. | "Every model call goes through Bifrost, with a chain of backup models. Here the main model was made unavailable on purpose; Bifrost answered every step from a backup and the check finished, green, with five independent sources agreeing. It also saved this project for real: on our last test night the first provider hit its daily limit, and we moved the same model to another provider in Bifrost's settings, without changing code. We measured it on 23 real claims with known answers: 17 exact verdicts, no wrong ones, and 6 cautious ones that tell the reader to look closer. The same AI model, asked alone without sources, also got 17 right, but 5 wrong, with full confidence, and even said that last year's minimum wage is still valid. Then we ran 28 more and asked the model alone the same questions. It said Tim Cook is still Apple's CEO and Francis is still the pope: 12 wrong. Entrelinhas got 18 exact, never called a true claim false, and caught something we had missed: Nvidia's CEO had resigned two days earlier. It still made mistakes, and every one is reported in the repository." |
| 7b (optional, +25 s) | | Click **Live · Nvidia CEO, changed 2 days ago**. Show the *Conflicting* card, then Nvidia's own page and the NPR and Wired sources. | "This one surprised us. We wrote this test claim, Jensen Huang is the CEO of Nvidia, from news of two days before. Entrelinhas found Nvidia's own page still saying yes, and NPR and Wired reporting that he had resigned on 12 November. It does not pick a side it cannot prove: it says the sources conflict, and shows them. We had labeled it wrong; the filing confirms the resignation." |
| 8 | 3:25-3:45 | **For anyone who relies on AI answers**, then the bookmarklet steps and the API block. | "This matters wherever an answer is reused. A support chatbot can check a price or a policy before it reaches a customer. A product team can call the API after generating an answer. Anyone can select an answer on ChatGPT or Gemini and check it with one click. Checking one claim costs about three US cents. It is already live for anyone to try. Next: accounts where each company sets its trusted sources, and saved answers re-checked automatically when the fact behind them changes. Thank you." |

## If the video must be shorter

- **About 2:30:** cut scene 1 to one sentence and shorten scene 8 to its first three sentences.
- **About 2:00:** also drop the last sentence of scene 5 and of scene 6, and the numbers in scene 7.

## Editing tips

- Zoom in (1.3× to 1.5×) on the part being explained: the triage line, one source quote, the gateway panel.
- Short captions for the facts: "Minimum wage: R$ 1,621 since 1 Jan 2026", "Official sources count more, copies count once", "0 wrong answers vs 5 for the model alone · 17 of 23 exact, the other 6 marked as unsure", "51 real claims: 1 confident wrong answer vs 17 for the model alone".
- Keep music low and without lyrics.
- Never show the Terminal, the .env file or any API key.
