# Growth Lab V.2 — Personal AI Clinical Workspace & Queue Intelligence System for Dental Assistants

A lightweight, iPad-first workspace built from real chairside work in a dental clinic.
It gives dental assistants the tools that practice-management software (PMS) does not:
chairside translation, a standalone queue with a synchronized TV display, AI task
extraction, case / lab follow-up, and working evidence — without touching the clinic's
main database or spreadsheets.

> Status: working prototype. Everything runs on local state (LocalStorage / IndexedDB).
> No patient data is written to any external system unless you explicitly connect one.

## Why it exists

| Pain point at the chair | What this app does |
|---|---|
| Foreign-language patients (Myanmar, Lao, Khmer, English) slow down history-taking and consent | **Chairside Language Copilot** — side-by-side translation that always keeps the Thai text visible |
| Queue calls shouted down the corridor, cases moved to another room | **Queue Manager + TV Display** — call, skip, mark "moved", Thai speech announcement, separate TV window |
| Doctor's orders, lab slips, stock notes copied by hand | **AI Inbox** — text / image / file → structured tasks, always confirmed by the user first |
| Follow-ups and lab returns fall through the cracks | **Follow-up, Lab Tracker, Denture Recall** |
| No proof of work for reporting | **Work Evidence + Satisfaction Center** |

## Architecture

```
┌────────────── React 19 + Vite (iPad-first, lazy-loaded modules) ──────────────┐
│  Personal Space  ⇄  Assistant Operations Space   (Dual-Space, 1-tap switch)   │
│  QuickActionBar → Chairside · Queue/TV · AI Inbox · Tasks/Stock · Cases/Labs  │
│  Local state: LocalStorage / IndexedDB, partitioned per workspace ID          │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │  /api/ai/*  (no API key in the browser)
                    ┌───────────▼───────────┐
                    │  Express (server.ts)  │  Gemini via @google/genai
                    │  25 s timeout, clear  │  PII redaction tokens preserved
                    │  503 / 429 messages   │  user must confirm before saving
                    └───────────────────────┘
```

Key design rules

- **Decoupled state** — never writes formulas or data back to external spreadsheets.
- **Confirm before create** — AI output is a draft; nothing becomes a real record until the user confirms.
- **Thermal budget** — small `backdrop-filter` radii, no decorative infinite animations on touch tablets, independent scroll containers.
- **Fail soft** — module error boundaries; AI timeouts and quota errors tell the user they can save without AI.

## Hybrid AI (Firebase AI Logic)

Implemented for the #BuildHybridAI track:

- `src/services/firebaseApp.ts` — lazy Firebase init + **App Check** (debug provider for dev/demo).
- `src/services/hybridAi.ts` — `getAI` + `getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE`:
  Chrome's built-in **Gemini Nano** when available, automatic fallback to the cloud model.
- `src/components/HybridAiBadge.tsx` — shows the active path (Server / On-Device / Cloud) and the
  one-tap button that downloads the on-device model (a user gesture is required by Chrome).
- First feature on the Hybrid path: **patient chat reply drafts** (`generatePatientChatReply`).
  Input is PII-masked first; if Hybrid is off, unavailable or returns unusable output, the app
  falls back to the existing server route `/api/ai/chat-reply`. Nothing is saved until a human confirms.

Requirements for on-device: Chrome Desktop 139+, flag
`chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` = Enabled, enough disk space.
iPad browsers cannot run on-device AI; they use the cloud path and the badge says so.

Setup: create a Firebase project, register a Web app, enable **AI Logic** (Gemini Developer API) and
**App Check**, copy the config into `.env.local` (see `.env.example`), run the app on desktop Chrome,
register the App Check debug token printed in the console, then enforce App Check for AI Logic.
Never commit `.env.local` or a debug token.

## Run locally

Prerequisites: Node.js 20+

```bash
npm install
cp .env.example .env.local      # then set GEMINI_API_KEY
npm run dev                     # http://localhost:3000
npm run lint                    # type-check
npm run build
```

Environment variables are documented in `.env.example`. Never commit real keys.

## Honest limitations

- No clinical outcome numbers are claimed here. Any usage or satisfaction figures must come
  from data actually collected in the clinic, with the method and sample size stated.
- Demo data (`src/data/judgeDemoData.ts`) is synthetic.
- The model name used in `server.ts` must be verified against your Gemini account before deployment.

## License

MIT — see [LICENSE](./LICENSE).
