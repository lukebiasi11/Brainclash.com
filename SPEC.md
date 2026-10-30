# Daily Gauntlet — Locked-in Spec (working name)

Source of truth: friend's ChatGPT conversation "Daily Brain Game Idea" (share 6adbd39f…).
Mixed in from Luke's "Start Invention Development" conversation (share 6adbdbc8…) only where compatible.

## Format
- One daily challenge, same content for everyone, **5 categories × 1,000 pts = 5,000 max**.
- **Fixed order every day:** 1 World Rush → 2 History Timeline → 3 Sports IQ → 4 Word Challenge → 5 Think Fast.
- Only the current category is playable; finishing it unlocks the next. No skipping, reordering, or replaying for points.
- No speed bonuses anywhere.

## 1. World Rush (geography) — 1,000
- 2 map-pin challenges (450 each) + 1 multiple-choice geography question (100).
- Pin points = round(450 × max(0, 1 − d/4000)), d = great-circle km.
- Time limits: **not finalized**.

## 2. History Timeline — 1,000
- 2 rounds of picture cards dragged onto a timeline in chronological order.
- Round 1: 4 events, 30 s, 400 pts. Round 2: 5 events, 45 s, 600 pts.
- Partial credit by correctly ordered pairs (6 pairs / 10 pairs). Auto-submit at time-out, then reveal correct order + dates.

## 3. Sports IQ — 1,000
- 3 questions of rising difficulty: Easy 250, Medium 350, Hard 400.
- Formats: multiple choice, athlete silhouette, team logo, fill-in-the-blank. No partial credit.
- **Timed:** 20 seconds per question (`SPORTS_SECONDS` in app.js), shown with the same timer bar as the other sections. When time runs out the question scores 0 ("Time's up") and the game moves on, the same as the World Rush multiple-choice timeout.
- **Common teammate** (`kind:"common-teammate"`): `{type:"text", kind:"common-teammate", q, clues:[5 player names], answer, aliases?, explain?}`. The 5 clues appear as a compact numbered 2-column list (no image needed) above the prompt, and the answer is typed. It's checked with the lenient checker (answers.js) using person-name rules (surname alone, nicknames, typos; `person:false` opts out). Same 20 s timer, Skip and Time's up as other Sports questions. `tools/validate.js` requires exactly 5 non-empty clues and an `answer` (or `answers[]`). Tested by `tools/commonteammate.test.js`, which fits with no scroll at 375x548.

## 4. Word Challenge — 1,000 (one game per day, rotating among 5)
- **Word Flip:** 60 s, 6 medium/hard scrambled words, tap letters, hint style varies (definition/synonym/antonym/riddle); undo/skip; 4×150 + 2×200.
- **Word Bridge:** 60 s, 6 puzzles (HOT ___ / ___ HOUSE → DOG); type or skip; 4×150 + 2×200.
- **Connections 3×3:** 90 s, 9 words → 3 groups of 3; 3 wrong submissions end the round; shuffle/deselect; 300 + 300 + 400.
- **Odd One Out:** 60 s, 8 puzzles (4 medium @100, 4 hard @150), pick the word that doesn't fit, one tap advances, connections revealed after.
- **Anagram Rush:** 60 s, one set of 6 letters, unlimited guesses, 3–6 letter words: 10/25/50/100; no penalties/duplicates; shows missed words. Score shown everywhere (live header, category-end box, banked score, total) is the converted /1,000 score: min(1000, raw ÷ (60% of the common-word raw points) × 1000). Raw points appear only as a secondary "N words · X raw" note (**formula not finalized**).

## 5. Think Fast (logic/reasoning) — 1,000
- 2 puzzles a day: **[thinking (400), fun (600)]**. One final submission each. Time limit per puzzle: **45 s** (`THINK_SECS` in app.js, all 6 types; Luke, Oct 26).
- **Thinking kinds:** `math` (math trap), `sequence`, `logic`. **Fun kinds:** `guesstimate`, `illusion` (optical illusion), `riddle` (lateral riddle).
- **Pairing and rotation come from the content order**, not the engine. Each `thinkFast` day in content.js is `[thinking, fun]`, and no kind may repeat in the same slot on consecutive days. `pick(C.thinkFast, day)` is unchanged, and `tools/validate.js` enforces the slot and no-repeat rules whenever puzzles carry `kind`.

### Puzzle schema (Game maker's format is primary)
| `type` | Fields | UI and scoring |
|---|---|---|
| *(absent)*, typed (legacy, unchanged) | `q, answers[], aliases?, wrong?, noSurname?, explain?` | Text input, `Answers.checkAnswer`. All or nothing. |
| `"guess"` | `q, answer: Number, unit?: String, explain?` | Numeric input (`inputmode=decimal`) with `unit` shown after it. Parsed by `Answers.parseEstimate`, which uses parseNum/parseQty: "8,760", "8.76k", "eight thousand…", "-20", "$40", and the same value in another unit of the same dimension ("365 days" for hours). Default score = `Answers.closenessScore`: err = abs(guess − answer) / abs(answer). Full points if err ≤ 5%, then linear to 0 at err ≥ 50%: `round(value × (0.5 − err) / 0.45)`. For answer 0, only an exact 0 scores. |
| `"mc"` | `q, options[], a` (0-based index), `kind?`, `img?`, `explain?` | Same as Sports MC (`mcQuestion`, seeded option order, correct index remapped). With `kind:"illusion"`, the image `assets/<img>.svg` appears above the question as an `<img>` with uniform scale on a white card. Its max-height fits the no-scroll layout. A missing asset shows a placeholder. The option matching /equal\|same/ ("They're equal") is always last. |
| `"illusion"` (Designer alias) | `svg: "assets/illusion-….svg", q, options[], a` | Normalised to `{type:"mc", kind:"illusion", img:<file name without .svg>}`. |

Optional labels: `cat: "thinking"|"fun"` and `kind` (shown as a badge in the subtitle, e.g. "Puzzle 2 of 2 · Guesstimate · 600 pts").

Example day:
```js
[ { cat: "thinking", kind: "math", q: "It takes 6 minutes to saw a log into 3 pieces…", answers: ["15", "15 minutes"], wrong: ["12"], explain: "…" },
  { cat: "fun", kind: "guesstimate", type: "guess", q: "How many hours are in a (non-leap) year?", answer: 8760, unit: "hours", explain: "365 × 24" } ]
[ …, { cat: "fun", kind: "illusion", type: "mc", img: "illusion-01", q: "Which line is longer?", options: ["Top", "Bottom", "They're equal"], a: 2 } ]
```
Illusion assets (Designer, verified by `trivia-illusions/verify.py`): illusion-01 (a=2), illusion-02 (a=1), illusion-03 (a=2), illusion-04 (a=0), illusion-05 (a=2), illusion-06 (a=0).

### Typed-answer units (answers.js, Luke's rules)
- The same value in another unit counts: time (s/sec, m/min/mins/minute(s), h/hr/hour(s), days, weeks, years, "quarter of an hour", "1/4 hour") and length (mm, cm, m, km, in, ft, yd, mi). "m" means minutes when the expected answer is a time, and metres otherwise. Money keeps its $/cents rules.
- An explicit unit of a different dimension is wrong: "70 percent" or "70 minutes" for a plain count, "$15" for 15 minutes. A bare number with no unit is still fine.
- Minus signs are kept: "-20", "−20", "minus 20" and "negative 20" all mean −20, and none of them match 20. Dashes inside words and ranges are still spaces.
- Spelled-out numbers get no typo tolerance ("fiften"). That's on hold for Luke.

## From Luke's brainstorm (compatible additions)
- Daily challenge unlocks at midnight; anytime practice mode separate from the ranked daily.
- Leaderboards / friends / head-to-head, paid buy-ins and prize pools: planned for later (need backend + legal review) — not in this static beta.

## Daily reset
- One reset for every player: **midnight US Eastern** (`RESET_TIMEZONE = "America/New_York"` at the top of app.js, DST-aware).
- The day key (`YYYY-MM-DD`) is the New York calendar date, computed with `Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" })`. The same day number seeds the content rotation and shuffles, the "Gauntlet #N" game number (counted from `LAUNCH_DATE`), and streaks.
- The home countdown runs to the next New York midnight. It is correct on DST change days (23 h or 25 h days).
- A run is credited to the day it **started**: finishing after midnight doesn't break the streak.
- If the page is closed or reloaded mid-category, that category is locked in at the points earned so far (no replays).
- Anti-clock-tamper (best effort, client-only):
  - The highest day the device has reached is stored (`dg-maxday`). Turning the clock back never serves an earlier day than that.
  - On load, the site sends one HEAD request to itself and reads the HTTP `Date` header. If the device clock is more than 10 minutes ahead, server time is used (and a future `dg-maxday` is pulled back). This fails silently when offline.
  - This is not secure: all content ships in content.js, so a determined player can read future days.

## Future work: server-released questions (not built)
- Luke wants a backend that releases each day's questions to everyone at once (e.g. 12 PM ET) for anti-cheat.
- All content lookup already goes through a single function, `getDailySet(dayKey)` in app.js. Later it can be swapped for a `fetch("/api/daily/" + dayKey)` (made async), with content.js removed from the public site.

## Content selection rules (app.js)
- Word Challenge format rotates daily (5 formats). Each format's list is indexed by `floor(day / 5)`, so any list length works.
- Multiple-choice options and Odd One Out word positions are shuffled with a deterministic seed (day key + question), so everyone sees the same order on a given day. Write `a`/`odd` against the order in content.js; the app keeps the mapping.
- Text answers are compared after lowercasing and stripping punctuation, except `$ . /` (so "2/15" stays "2/15").

## Mobile fit (all game screens)
- In-game screens never scroll the page. `body.in-game` is a flex column whose height is `100svh`, falling back to `100dvh`, then `100vh`, then a JS `--vh` taken from visualViewport. Layout: a compact header, a flexible middle (`.game-body`, `min-height:0`), and an action bar pinned with `margin-top:auto` and `padding-bottom: max(12px, env(safe-area-inset-bottom))`.
- If the content is still too tall, `fitScreen()` scales down the non-flex blocks with CSS zoom (no lower than 0.45). The globe and illusion art flex instead of zooming.
- Only the Anagram found-words list scrolls, and it scrolls internally. The home and results pages may scroll.
- The timeline wording follows the layout: below 560 px, cards stack ("Earliest at top, latest at bottom" with a vertical rail); at 560 px and up, they run left to right.

### Number-word typos (A3) and `textOnly`
- Typos in spelled-out numbers are only forgiven when the expected answer is numeric. Each word is fuzzy-matched against the number-word list: words of 4+ letters may be 1 edit off ("fiften" → 15, "sevnty" → 70, "nien" → 9, "fourty" → 40); words of 3 letters or fewer may only have two adjacent letters swapped ("sxi" → 6, but "sic" and "tan" don't count). A typo that is equally close to two different number words is not corrected ("fine" could be five or nine). The corrected value must still equal the answer, so "fiften" is wrong for 50 and "sevnty" is wrong for 17.
- `textOnly: true` (an optional field on any typed question) turns off number parsing and the numeric rules for that question. Any input containing a digit is wrong, and number words are matched as plain text, typos allowed. It is used on Think Fast day 5 (O, T, T, F, F, S, S, E → N): "N", "nine" and "nien" are right; "9" is wrong.

### Timer vs score (header)
- The countdown always reads `⏱ Ns` (clock icon + seconds) so it cannot be mistaken for a score.
- The header chip always reads `Score X/1,000 pts` for the **current category** (running partial). It is visually separate from the timer.
- Every play screen (all 5 Word Challenge formats, Think Fast, Sports, Timeline, World Rush) has a visible **Skip** button in the bottom action bar, kept above the browser chrome / safe-area.

### Sports IQ rework (engine)
Draft pools live in `/workspace/trivia-drafts/sports-rework/` (fixtures only — **not** merged into `content.js`).
- **Q1 history:** `text`/`fill`, `guess`/`year-guess`, `mc`/`true-false`, `mc`/`which-first`.
- **Q2 visual:** `text` + `img` for `stat-chart` | `moment` | `color-swatch` | `jersey-number` → `sportsArt()` SVG above prompt.
- **Q3 interactive:**
  - `order`/`team-path` — `orderQuestion()` (FIRST/LAST chips, drag / ▲▼ / tap-swap / keys). `PARTIAL_ORDER=true` → partial credit: round(value × items in correct position / n).
  - `bracket`/`bracket` — `bracketQuestion()`: two tappable team chips under a simple fork; fields `matchup:[nickA,nickB]`, `a` (winner), optional `round`. All-or-nothing. (Spec also allows a multi-round tree; samples are single matchups — engine implements the single-fork card.)
  - `match`/`match-records` — `matchQuestion()`: 4×4 tap-to-pair (primary) + drag; unpair supported; right column seed-shuffled; `aria-pressed` + `aria-live`. Fields `left[]`, `right[]`, `pairs[]` (right index per left). `PARTIAL_MATCH=true` → partial credit: round(value × correct pairs / n) (1/4 of 400 = 100).
  - `mc`/`higher-lower` — reuse MC.
- **Year-guess scoring:** relative `closenessScore` is wrong for years. With `exactYear: true`, score via `Answers.yearScore` — full points only for the exact year, else 0. Optional `yearBand: N` (default omit / unused) gives full points when `|guess − answer| ≤ N`, else 0. Without either flag, Think Fast keeps relative closeness.
- Timer: `SPORTS_SECONDS` (20) per question; Skip + Lock; timeout → 0. Fit: no-scroll at 7 VPs; interactive targets ≥44px.
- Live `content.js` is unchanged until Luke merges the draft samples.

## Rotation & how to add content (append-safe, Oct 27 2026)

**How a date picks its content.** Every list has an explicit, frozen schedule for Oct 23 – Nov 10 2026
(`FROZEN` in `app.js`): those dates show exactly what was live on Oct 27 and can never change.
After Nov 10, each list plays the entries that have **not been scheduled yet, in content order**, one per
unit, and only wraps (repeats, in content order) once every entry has been used.
- Daily lists (one new entry per day): `worldRush`, `history`, `sports`, `thinkFast`.
- Word-game lists (one new entry per 5-day format cycle, `w = floor(day / 5)`): `wordFlip`, `wordBridge`,
  `connections`, `oddOneOut`, `ANAGRAM_SETS`. The word *format* of a day is `WORD_GAMES[day % 5]`.

**For Game maker — adding content**
1. **Append** new sets to the **end** of a list. That schedules them for the next unused future dates
   (or, if the list already wrapped, makes the list longer from then on). No earlier date moves.
2. **Never delete, insert in the middle, or reorder** entries. That shifts every later date.
3. To fix an entry (typo, wrong answer), edit it **in place**. Its dates stay the same; only its content changes.
4. To retire an entry, replace it in place with its successor. Don't remove it.
5. To see which date shows what, open `admin.html` and set the date, or run `node tools/rotation.test.js`.
   That test freezes the Oct 23 – Nov 10 date→index map and fails if any of it changes.
6. Content shortage: when a list runs out of unused entries it repeats. Keep each list ahead of the calendar.
