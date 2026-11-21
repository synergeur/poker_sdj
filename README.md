# Poker Room Manager

Visual proof of concept for a poker-room supervisor. The screen follows the dark floor-plan concept: eleven tables, dealer chips, a dealer-by-dealer timeline, and the rotation panel.

This slice is for trying the layout and the manual floor operations. It does not run a rotation.

## What you can do

- Open a closed table as tournament or cash game.
- Close a table. Its dealer becomes available and the game type returns to unassigned.
- Change an open table between tournament and cash game without moving the dealer.
- Assign an available dealer, remove them, send them on break, or mark them off shift.
- A dealer cannot sit at two tables. A second assignment is refused.
- Break and end-of-shift clear the table and leave it open with “Sans croupier”.
- Move a simulated clock (play, +15, +30, or a time between 17:00 and 23:00). The clock only moves the “now” line.
- Switch the stored rotation mode and interval. Nothing advances.
- Chip run stays disabled until its behavior is defined.
- Reset the fictional shift: Monday 17 November 2026, 19:44, Toronto time.

The floor, the timeline, the summary cards, and the “right now” list all read the same room state. Hatched bars after the current time mean “this assignment simply continues”. They are not a calculated rotation.

## What this prototype does not do

- No automatic or manual rotation cycle.
- No chip run.
- No break policy (duration, frequency, who is eligible).
- No payroll, time clock, tournament director tools, or financial reports.
- No Firebase writes. The repository boundary is in place; Firestore is not connected.

Interaction rules used by the buttons are listed in the app under Paramètres. They are prototype rules, not a claim about how a poker room operates.

## Stack

React, TypeScript, Vite, Tailwind CSS, React Router, Lucide. State lives in a React context. Business rules are plain functions with Vitest coverage. With the default environment, data is fictional and stored in the browser (`localStorage`).

ESLint and Prettier are the lint and format tools. TypeScript 5.9 is used because `typescript-eslint` does not yet accept TypeScript 7.

## Run locally

```bash
npm install
npm run dev
```

The dev server binds to `127.0.0.1:4178`.

Other commands:

```bash
npm test
npm run lint
npm run build
```

Copy `.env.example` to `.env` if you want the file present. The defaults already match that example: mock data on, Firebase off. Every `VITE_` variable is exposed to the browser. Do not put private service-account credentials in them.

## Heroku

The app is a Node app: `package.json` at the root makes Heroku select the Node.js buildpack. That buildpack does not serve files itself. With no `Procfile`, its web process is `npm start`.

`heroku-postbuild` compiles the Vite app into `dist` before devDependencies are removed. `start` then runs `serve` on `0.0.0.0` and `$PORT`, and `--single` sends routes such as `/dealers` to `index.html`. Node 22 is set in `engines`.

On an existing app, point it at the Node.js buildpack before the next deploy:

```bash
heroku buildpacks:set heroku/nodejs -a YOUR_APP_NAME
```

## Layout

- `src/features/room/operations.ts` — open, close, assign, break, clock
- `src/repositories` — `RoomRepository`, mock storage, unused Firebase boundary
- `src/components` — floor, timeline, rotation panels, inspector
- `src/pages` — live room, rotations, dealers, tables, shift snapshot, settings
