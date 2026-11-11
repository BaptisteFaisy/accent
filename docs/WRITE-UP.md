# Accent — It doesn't grade you. It names the sound that's off.

> **You read a sentence aloud. Accent isolates the exact phoneme that fails — no vague
> score — names the sound you actually produced, gives you a minimal pair, and drills
> that one sound with three sentences until it passes.**

Built for **IceHacks 2026** (CodeStarters, Devpost). One-person team, four days,
0 $ budget. This write-up is the Devpost submission text; the French version lives in
[`WRITE-UP.fr.md`](WRITE-UP.fr.md), the AI-tools declaration in
[`AI-DISCLOSURE.md`](AI-DISCLOSURE.md).

## 1. The problem

A French student has studied English for six years. When they speak, people answer
*"I don't understand you."* They cannot **hear** their own mistake: /θ/ doesn't exist in
French, so *think* and *sink* literally sound the same to them. What do current tools
give them?

- Pronunciation apps give a **global score**. You cannot act on "78 %".
- Courses are **linear** (lesson 1, 2, 3…) — most learners quit within three weeks.
- A human tutor gives excellent feedback at **25–40 €/hour**, unavailable to most.
- The moments where pronunciation actually costs points — oral exams, job interviews,
  presentations — are the moments nobody trains specifically for.

**The core problem is not pronunciation. It is the absence of a diagnosis.** A student
who knows *"my issue is /ð/ and final consonants"* can work alone. A student at 78 %
can do nothing.

## 2. The thesis

**A score cannot be fixed. A phoneme can.**

Accent refuses the global score on principle. One session = **one** target phoneme:
the app names it, names the sound actually produced, shows a minimal pair
(*think → sink*), measures progress on a retry, then drills that sound alone in three
sentences. When it passes, on to the next one.

Three non-negotiable ethical guardrails (also printed on screen in the product):

1. **Never a global score.** Never "bad accent". One sound, at one moment in time.
2. **No leaderboard, no comparison between users.** Progress is measured against
   yourself only.
3. **The goal is to be understood, not to sound native.** Claiming otherwise would be a
   technical lie: adults don't lose their accent, they become clearer.

## 3. What we built

A static web app (Vite + React + TypeScript + Tailwind, zero runtime dependency beyond
React) organized as a 5-step pipeline, orchestrated by `executerPipeline()` in
`src/engine/pipeline.ts`:

```
[Browser]                              [Edge]                 [Third-party API]
 MediaRecorder → 16 kHz mono PCM
 Static webapp
      │
      │  POST /api/analyse               Proxy (hidden key,  ── key ──▶  Azure Speech
      ├─ {text, target language, audio}    quota, cache)                 Pronunciation
      │  ← per-phoneme scores                                           Assessment
      │
      ├─ BYOK fallback: the user's own key talks directly to the provider
      └─ localStorage: sound profile + sessions (never audio)
```

| Step | What happens | Where it lives |
|---|---|---|
| 1. **Listen** | Mic capture, WAV 16 kHz mono, quality gate (too short < 1.5 s, silence, clipping) | `src/audio/` |
| 2. **Evaluate** | Per-phoneme score 0–100 + phoneme actually produced, 3 readings **in parallel** | `src/providers/` |
| 3. **Select** | Median across readings → **one** target phoneme, weighted by occurrences × difficulty | `src/engine/selectTarget.ts` |
| 4. **Explain** | Minimal pair + error signature + tip — from a local table, **zero model call** | `src/data/phonemes.ts`, `src/engine/explain.ts` |
| 5. **Train** | 3 sentences containing the target sound, from a **committed static cache** (works offline) | `src/data/training.json` |

Budget: under 10 s from the end of the reading to the diagnosis. The analysis screen
shows the five named steps progressing — waiting becomes a demonstration of the
pipeline.

The product knowledge is a **closed taxonomy of 15 phonemes** (P01–P15) with, for each:
IPA symbol, the typical French-speaker error signature ("comes out as /s/"), minimal
pairs, example words, difficulty 1–3, and a short kind instruction. The system can
never invent a category. Word stress (P14) is handled separately as *positional*, not
phonetic: the screen shows syllable bars instead of a minimal pair.

## 4. The honest competitive landscape

Yes, ELSA Speak exists, and yes, it gives phoneme-level feedback. Here is the table we
would show a judge before they ask:

| Solution | What it does | Where it fails our user |
|---|---|---|
| **ELSA Speak** | Pronunciation coach, per-phoneme feedback | Imposed curriculum (lessons), global score displayed, English only, subscription, you must **follow its program** |
| **Duolingo** | Motivation through games | Barely corrects pronunciation; a game, not a diagnosis |
| **ChatGPT voice** | Natural conversation | Says "that's great"; cannot name a phoneme, let alone measure one |
| **Private tutor** | Excellent feedback | 25–40 €/h, unavailable to most |
| **YouTube "French pronunciation"** | Free | Passive; no measurement, no feedback on **your** voice |

Accent's space:

1. **Your text, not their curriculum.** You bring the sentence you actually have to say
   (your presentation, your interview, your exam). The home screen is one textarea and
   ten ready-made sentences — nothing else.
2. **Zero global score, by principle** — enforced by a CI guard that fails the build if
   `scoreGlobal|globalScore|noteGlobale|overallScore` ever appears in `src/`.
3. **Any language pair, same architecture.** The taxonomy is data (`src/data/phonemes.ts`);
   a Spanish→French table is a new table, not a new engine. (Today only FR→EN is ready —
   `fr`/`es` ship disabled, flagged "coming soon".)
4. **Progress stays local** — your voice never touches a database, because there is none.

## 5. Hard decisions

**Why zero global score.** A number invites judgment; a diagnosis invites action. It is
an ethical stance (accent discrimination is illegal in several workplaces) *and* a
product stance: the one-phoneme rule is what makes the retry loop work. We made it
machine-checkable: the type system has no way to express a global score (`src/types.ts`),
and CI greps for forbidden names (`ci.yml`).

**Why a single language pair at first.** Four days, one person. The closed 15-phoneme
taxonomy is only meaningful for a *specific* L1→L2 pair — the error signatures
("a French speaker turns /θ/ into /s/") **are** the pedagogy. Shipping one pair
perfectly beats shipping three pairs approximately. The architecture keeps the promise:
language is a parameter (`LangueCible`), the taxonomy is data, and the selector already
lists ES→FR and EN→ES as `pret: false`.

**Why 3 readings and the median.** Measuring one phoneme on a short word is noisy — a
single reading can swing tens of points. Three readings are evaluated **in parallel**
(`Promise.all` in `pipeline.ts`, so latency stays one API round-trip), consolidated to a
median per phoneme (`consoliderLectures()` in `src/engine/measure.ts`). If the spread
between readings exceeds 20 points (`ECART_MAX`), the app **refuses to display a
number**: "unstable measurement, try again" (`choisirCible()` → state `instable`,
RNF-11). Under 1.5 s of audio (`DUREE_MIN_MS`), it says "too short" *before* calling any
API. A one-reading "quick try" mode exists, explicitly labelled as less reliable.

**Why an edge proxy and no backend.** There is no user data to store: the profile lives
in `localStorage`, sessions are capped at 50, export is a Markdown download, deletion is
one click (`toutEffacer()`, `src/store/profile.ts`). The only server-side need is hiding
the API key and bounding the quota — a static-worker job, not a backend. No database,
no auth, no server-side GDPR. (Honest status: the proxy's client contract is coded in
`src/providers/proxy.ts`; the worker itself is not committed yet.)

**Why step 4 is data, never a model.** The explanation (minimal pair, signature, tip)
comes from the committed 15-entry table, not from an LLM. That makes it instant
(< 10 ms), free, offline, testable, and defensible: every minimal pair can be read in
the diff. Pedagogical knowledge is versioned data, not a generation. Same principle for
training sentences: they are cached in `src/data/training.json`, committed — the demo
never breaks because an API returned 429.

## 6. Failures and workarounds

This is the section we are most proud of, because each failure shaped the product:

- **The measurement is noisy on short words.** Early tests showed the same word scoring
  34, then 70, then 41 across readings. One reading proves nothing. Workaround: three
  readings, median, and an explicit refusal to display anything when the spread exceeds
  20 points. Saying "I'm not sure, read it again" is a feature, not a bug — it is what
  separates a diagnosis from a horoscope. (Tested: `engine.test.ts`, 16 tests.)
- **Final consonants get overestimated.** The evaluation tends to be lenient with
  word-final consonants: a devoiced *dog* → *dok* still scores high, hiding exactly the
  error Francophones make (P12 in our taxonomy). Workaround: P12 is a first-class
  taxonomy entry with its own signature and minimal pairs (*dog/dock*, *bed/bet*), and
  the target-selection weight (`poids()`) uses occurrences × difficulty so a repeated,
  structurally important error outranks an exotic one-off.
- **Quota is the real enemy of a demo.** Free tiers are measured in hours of audio;
  judges test in a 48-hour window. Workarounds, in order: (1) the committed training
  cache — step 5 never calls the network; (2) a local **simulation engine**
  (`src/providers/demo.ts`) that is always available and always labelled "simulation"
  on screen — we never pass a fake measurement for a real one; (3) **BYOK**: any user
  can paste their own Azure Speech key in Settings, stored in their browser, sent only
  to Microsoft — the app keeps working for a judge even if our proxy quota dies;
  (4) automatic fallback: on a proxy error the app re-runs the pipeline on the demo
  engine (`App.tsx`) with the honest label.

## 7. What we learned

- **Perception precedes production.** A learner cannot fix a contrast they cannot hear.
  The minimal pair is not decoration — it is the teaching device: *think/sink* makes
  /θ/ audible before it becomes producible.
- **Reliability is a UX decision.** The three hardest constants of the project
  (`ECART_MAX = 20`, `DUREE_MIN_MS = 1500`, `LECTURES_REFERENCE = 3`) are not
  engineering details; they are the moments where the product chooses honesty over a
  number. All of them live in one file, `src/constants.ts`, and nowhere else.
- **Free speech APIs are lenient in predictable places** (word-final consonants) and
  noisy elsewhere. Knowing *where* an API lies is worth more than hoping it doesn't.
- **Constraints make the product.** No account, no backend, no global score, one
  phoneme per session: every "no" removed a failure mode and sharpened the pitch.

## 8. What's next

1. **Second language pair (ES→FR)** through the same engine — the strongest argument
   against "ELSA already does this": the architecture is language-pair data, not
   English-only code.
2. **Exam-oral mode**: long text, guided sentence by sentence (RF-21).
3. **Recurring-sound profile** across ≥ 3 sentences (RF-22): the profile screen already
   stores per-phoneme history; the detection rule is next.
4. **Slow model audio (TTS)** for side-by-side comparison (RF-23).
5. **Validation with teachers** and a recorded test corpus (10 tricky words × 3 readings,
   acceptance target: correct phoneme identified ≥ 8/10).
6. Commit the **edge proxy worker** and deploy to a public HTTPS URL.

## 9. AI tools used — explicit declaration

Required by the contest rules; full details in [`AI-DISCLOSURE.md`](AI-DISCLOSURE.md).
Summary: (a) the product itself calls a **pronunciation-assessment API** (Azure Speech,
per-phoneme granularity) — that is the product, not a development aid; (b) training
sentences were drafted with an **LLM** and are shipped as a **committed static cache**
(`src/data/training.json`), so no LLM runs at demo time; (c) coding was done with
**AI coding agents** during the hackathon, under the author's review — the author can
explain every line; (d) merge conflicts are triaged by an **agent-assisted gate**
(Hermes, `.github/workflows/hermes-lite.yml`).

## 10. Current status (honest)

Green at submission-prep time: TypeScript build clean, **16/16 engine tests passing**
(median, stability refusal, unique-target selection, "nothing to fix" zero-false-positive
case, 7-day acquired cooldown), initial JS bundle **60.2 KB gzipped** (budget: 300 KB),
CI on self-hosted runners with a 5-minute budget per job. Not done yet: public HTTPS
deployment, the proxy worker commit, the full 15-phoneme training cache (3/15 committed,
the rest falls back to locally generated sentences), and the recorded validation corpus.
We write this down because we would rather be checked than believed.

---

*Accent. One sound at a time.*
