# Entrelinhas · demo video script (about 3:50; the limit is 5:00)

Narrated by Alice, in English, calm and explanatory. Each scene shows one thing and says why it matters.
Record the screen at 1920×1080 with browser zoom at 110%. Record the voice separately if that is easier, and cut on actions, not pauses.

## Recording plan (no live calls needed)

Record from the **public demo**: <https://contatoalicecandido-lab.github.io/entrelinhas/>. Every button there replays a check that ran live with Tavily and Bifrost, with real sources, so the video does not depend on the free model quota. Scene 3 says so once.

Two checks carry the video:
- **Live · Brazil minimum wage, old value (PT)**: a claim in Portuguese, an official Brazilian source (the Senate) that contradicts it, the verdict *Likely outdated* (red) and the corrected answer with three sources.
- **Live · Bifrost outage drill**: an English claim that holds (green), and the gateway panel with the main model down and the backup answering.

## Scenes (simple version, about 3:50)

Record scene by scene. If a sentence goes wrong, redo only that scene.

| # | Screen | Narration |
|---|---|---|
| 1 | Top of the page. | "Hi, I'm Alice, from Brazil. This is Entrelinhas. It finds out-of-date answers from AI, using Tavily and Bifrost." |
| 2 | Scroll slowly over the problem section and the four cards. | "When an AI answers you, every sentence sounds sure. But some facts are out of date. A price can change in a month. A software version in a few months. A law in about a year. And nothing on the screen tells you which sentence to trust." |
| 3 | Back to the top. Click **Live · Brazil minimum wage, old value (PT)**. | "Entrelinhas means 'between the lines' in Portuguese. It breaks an answer into small facts and checks each one against today's sources. This is a real check, recorded live. The AI says that Brazil's minimum wage in 2026 is one thousand five hundred and eighteen reais." |
| 4 | The claim card and its list of sources. | "Tavily searches the web for this fact. Because it is an official Brazilian value, it also searches the government's own sites. Then an AI model, through Bifrost, reads every source. Each quote must really be on the page, or the source does not count." |
| 5 | The red verdict, then open the Senate source and its quote. | "The result is red: likely outdated. The Brazilian Senate says the value changed. One thousand five hundred and eighteen was last year. Since January, it is one thousand six hundred and twenty-one. Official sources count more than blogs, and copies of the same article count only once." |
| 6 | **Updated answer**. Hover a citation number. | "Then it fixes the answer, with links to the sources. And it works in Portuguese, not only in English. It understands Brazilian numbers, dates and words, and it knows where Brazil's official data lives." |
| 7 | Click **Live · Bifrost outage drill**. Show the green card, then the **AI gateway, Bifrost** panel. | "Every AI call goes through Bifrost. Here, we turned off the main model on purpose. Bifrost answered from a backup, and the check still finished. This saved us for real: when our first provider ran out of quota, we switched providers in Bifrost, with no code changes." |
| 8 | Scroll to the row of big numbers (22 of 60, 35 of 51, 1 vs 17). | "We tested it on 51 real facts with known answers, and asked the same AI model alone. Entrelinhas got 35 right. The AI alone got 31. But the big difference is this: the AI alone was sure, and wrong, 17 times. It said Tim Cook still runs Apple. Entrelinhas was sure and wrong only once. When it is not sure, it tells you." |
| 9 (optional) | Click **Live · Nvidia CEO, changed 2 days ago**. Show the sources. | "It even caught our own mistake. In our test, we wrote that Jensen Huang is Nvidia's CEO. Entrelinhas found the news that he had resigned two days before. We fixed our test." |
| 10 | The section for everyone, the browser button and the API block. | "Entrelinhas is live, and anyone can try it. You can paste an answer, check any page with a browser button, or call it from a chatbot with the API. Checking one fact costs about three cents. Entrelinhas: read between the lines of any AI answer. Thank you." |

## If the video must be shorter

- **About 2:30:** cut scene 1 to one sentence and shorten scene 8 to its first three sentences.
- **About 2:00:** also drop the last sentence of scene 5 and of scene 6, and the numbers in scene 7.

## Editing tips

- Zoom in (1.3× to 1.5×) on the part being explained: the triage line, one source quote, the gateway panel.
- Short captions for the facts: "Minimum wage: R$ 1,621 since 1 Jan 2026", "Official sources count more, copies count once", "0 wrong answers vs 5 for the model alone · 17 of 23 exact, the other 6 marked as unsure", "51 real claims: 1 confident wrong answer vs 17 for the model alone".
- Keep music low and without lyrics.
- Never show the Terminal, the .env file or any API key.
