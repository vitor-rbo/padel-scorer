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
- **Match history:** every finished match is saved with its date, teams, rules and set scores. Open it from the new match page or from the screen shown when a match ends. Browse it, delete single matches or clear the lot. If you undo the winning point, the match is taken back out of the history, so it never lists a result that was reversed. The latest 200 matches are kept.
- **Saved on your device:** the match survives a refresh or an accidental close. Nothing is sent anywhere.
- **Works on any screen:** phone, tablet and desktop, including a phone held sideways.
- **Installable and offline:** add it to your home screen and it opens full screen like a normal app, and keeps working with no signal once it has loaded once.

## Install it on your phone

- **iPhone (Safari):** open the site, tap the Share button, then **Add to Home Screen**.
- **Android (Chrome):** tap **Install app** on the welcome page, or use the browser menu and choose **Install app**.
- **Desktop (Chrome or Edge):** click **Install app** on the welcome page, or the install icon in the address bar.

Open it once with a connection so it can save itself for offline use. After that it starts instantly, even in airplane mode. When a new version is released it downloads in the background and takes over the next time you open the app. Your match is saved on every tap, so an update never loses a score.

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

React, TypeScript and Vite, with Vitest for tests and `vite-plugin-pwa` for the installable, offline-capable part.

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
  archive.ts    What a finished match looks like and how its result is described
  matches.ts    Keeps the match history in step with the match being played
  install.ts    The "Install app" button and iPhone hint on the welcome page
  App.tsx       Chooses which screen to show
public/icons/   App icons in the sizes phones need
public/og-image.jpg   The picture shown when the link is shared in a chat app
design/         Source artwork for the icon and the link-preview picture
vite.config.ts  Build setup, including the web app manifest and service worker
```

The service worker keeps a copy of every file the app needs, which is what makes it work offline. It is generated at build time, so there is no hand-written service worker code to maintain.

How undo works: match state is never modified, only replaced with a new copy. Undo simply steps back to the previous copy, so it behaves the same at the start of a game, a set or a tie-break, with no special cases. The whole state is plain JSON, which is also what gets saved to local storage.

## Deploying

It is a static site, so any static host works. On Vercel, importing the repository is enough: the Vite preset is detected automatically (build command `npm run build`, output directory `dist`) and no environment variables are needed.
