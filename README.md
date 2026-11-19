# Padel Scorer

A simple score keeper for padel, built to be used on a phone during a match. Big buttons, one-handed use, and the score is always easy to read. Everything runs in the browser, so there is no account, no backend and no data leaves your device.

## What it does

- **Two big point buttons**, one per team, showing 15 / 30 / 40 / Ad (or tie-break points).
- **Undo** for mis-taps, including across game, set and tie-break boundaries.
- **Standard format:** best of 3 sets. A set goes to 6 games with a 2-game margin, with a 7-point tie-break at 6-6. Optionally, a first-to-10 super tie-break can replace the deciding set.
- **Custom format:** play a fixed number of games with no sets (for example always 3 games), or a custom number of sets. Every game or set is always played, even if the result is already decided.
- **Level scores:** if an even number of games or sets ends level, you choose between a draw and one extra game or set.
- **Deuce rules:** at 40-40 choose between advantage with a golden point on the third deuce (the default), a straight golden point, or traditional advantage with no limit.
- **Team names** are optional and can be changed for each match, which makes rotating pairs easy. Rematch keeps the same teams and rules.
- **Saved on your device:** the match survives a refresh or an accidental close.
- **Works on any screen:** phone, tablet and desktop, including a phone held sideways.

## Run it locally

You need [Node.js](https://nodejs.org) (a recent version).

```bash
npm install
npm run dev
```

Then open the address it prints. To try it on a phone on the same Wi-Fi network, run `npm run dev -- --host` and open the "Network" address.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run the unit tests once |
| `npm run test:watch` | Re-run tests when files change |
| `npm run lint` | Check the code with Oxlint |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |

## How it is built

React, TypeScript and Vite, with Vitest for tests.

The most important design decision is that the **scoring rules are separate from the screen**. All the padel logic lives in `src/scoring/` as plain TypeScript with no React in it, so it can be tested thoroughly and reused anywhere.

```
src/
  scoring/      The rules engine (pure TypeScript, fully unit tested)
    types.ts      Match configuration and state types, rule presets, validation
    game.ts       Points within a game, deuce handling, tie-breaks
    match.ts      Sets, super tie-break, fixed-games mode, level-score decisions
    history.ts    Undo
  components/   Welcome, Setup, Scorer and Scoreboard screens
  setup.ts      Turns the setup screen choices into a rules configuration
  storage.ts    Saving and loading the match, tolerant of missing or corrupt data
  App.tsx       Chooses which screen to show
```

How undo works: match state is never modified, only replaced with a new copy. Undo simply steps back to the previous copy, so it behaves the same at the start of a game, a set or a tie-break, with no special cases. The whole state is plain JSON, which is also what gets saved to local storage.

## Deploying

It is a static site, so any static host works. On Vercel, importing the repository is enough: the Vite preset is detected automatically (build command `npm run build`, output directory `dist`) and no environment variables are needed.

## Not built yet

- Keeping the screen awake during a match (Screen Wake Lock API)
- Vibration feedback on points (Android only, as iPhone Safari does not support it)
- Installing it to the home screen and working fully offline
