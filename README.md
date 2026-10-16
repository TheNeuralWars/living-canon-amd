# Living Canon — The Neural Wars on AMD

**Track:** Create a New Kind of Experience (+ Google/Gemma partner prize) · **Team:** GoalWorld (Nico Del Bello Pez Dorado)

One film universe, a different interactive episode for every viewer. *Living Canon* turns the canon of the AI film **The Neural Wars: Fractured Code** into an audience-adaptive story that stays on-model, written live by **Gemma 4 (31B) served on AMD GPUs** through the AMD Developer Cloud Token Factory (ROCm stack).

## Problem
Generative video and story tools can make infinite content, but studios can't ship it: characters drift (wrong scar, wrong wrist, invented faces), lettering and logos sneak into shots, and every audience gets the same cut. Continuity supervision is manual and expensive.

## What it does
1. **Director** (Gemma 4 on AMD) writes one scene beat for a specific viewer profile — e.g. an Italian teen gamer vs. an English film buff vs. a plain-language/audio-description viewer — plus a single-camera shot prompt for the image-to-video pipeline and two branching choices.
2. **CanonGuard** checks it two ways: deterministic rules compiled from the film's `WORLD_TOKENS.json` (valid character/location ids, "Serpent Coil only on LEFT wrist", Kora's scar behind RIGHT ear, banned lettering/split-screen negatives) **and** a Gemma critic pass at temperature 0.
3. **Repair**: if anything breaks canon, the Director is asked to fix only those issues; rules are re-run and remaining violations are shown to the user (no hidden failures).
4. The UI shows two audiences side by side, with per-stage latency, real token usage and API-reported cost returned by the AMD API. A *fan remix* toggle sends a request that tries to break the canon, so you can watch CanonGuard catch and repair it.

## Human + AI split
Humans author the canon (lock sheets, palettes, invariants — from the real Fractured Code production). The model generates narration, branching and shot prompts. CanonGuard enforces the human canon.

## Cost
The Token Factory public Gemma endpoint is free during the event. Each beat = 2–3 calls; the UI shows the exact token count per beat, so cost at any paid rate = tokens × price. Who pays: studios/IP owners (fan experiences, localized promo), streaming/marketing teams needing per-audience variants with brand-safe continuity.

## Real results (16 Oct 2026, Gemma-4-31B-IT on AMD Token Factory)
From the runs saved in `docs/SAMPLES.md` (raw JSON next to it; nothing edited):
- 6 normal beats (2 per audience: Italian teen gamer, English film buff, plain-language/audio-description). All valid JSON, all on canon (0 rule violations), each one in the right language and register.
- 2 fan-remix stress beats (asking for the Coil on the RIGHT wrist, a NeuroSys logo and Batman). CanonGuard flagged 4 violations each time (deterministic rules + Gemma critic), auto-repaired them, and 0 rule violations remained.
- Per beat: about 4.1–4.4k tokens normally, about 7.2–7.4k with a repair. API-reported cost $0.00005–$0.00018 per beat. Wall time about 11–57 s (shared free endpoint, so it varies).
- Screenshots: `docs/screenshot_beat1.png`, `docs/screenshot_canonguard.png`, `docs/screenshot_beat2.png`. Demo video: `docs/demo.mp4`, a capture of the live site with the waiting parts sped up 3×.

Reliability: retries with backoff on 429/5xx/transient gateway errors; each request is split into two serverless calls (`direct`, `guard`) so each stays under the function timeout.

## Run
```bash
cp .env.example .env   # add AMD_API_KEY from https://developer.amd.com.cn/radeon/tokenfactory (free, no card)
export $(cat .env | xargs) && node server.js   # http://localhost:3000
# or: docker build -t living-canon . && docker run -p 3000:3000 --env-file .env living-canon
npm test   # CanonGuard rule tests
```
Deploy: Vercel (static `public/` + `api/` functions), set `AMD_API_KEY` env var.

## Architecture
`public/index.html` (UI) → `api/episode.js` → `lib/engine.js` (Director → CanonGuard rules + critic → Repair) → AMD Token Factory `POST /v1/chat/completions` (model `Gemma-4-31B-IT`). Canon: `lib/canon.json` (extracted from the film's WORLD_TOKENS).

## Responsible use
No API keys in the repo (env vars only). Viewer profiles are free text, never stored. MIT licensed.
