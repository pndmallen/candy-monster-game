# 🍭 The Candy Monster Game

The Candy Monster stole all the candy in the world! Dad, Mom, Rumia and Delana
start at home in **New York**, where Mr. Sugar's Lollipop Shop is. They find the first clue in Times Square,
then fly to **London, Tokyo, Moscow, Dubai, Venice, Rio de Janeiro and Ho Chi Minh City** in a **random order
every adventure**. The last clue leads **back home to New York**, where they catch the Candy Monster.

Built with [three.js](https://threejs.org) and [Vite](https://vitejs.dev). There are no image or sound files:
the characters are built from 3D shapes, the sounds are synthesized, and the
narrator uses the browser's built-in voice.

---

## Run it on your computer (localhost)

You need **Node.js 18 or newer** (Node 20 or 22 LTS recommended) (`node -v` to check).

```bash
cd candy-monster-game
npm install
npm run dev
```

Open **http://localhost:5173** in Chrome, Safari, Edge or Firefox.

**Test on an iPad or phone on the same Wi‑Fi:** `npm run dev` also prints a
`Network:` address (e.g. `http://192.168.1.23:5173`). Open that on the tablet.

## Build + deploy as a web app

```bash
npm run build      # makes the dist/ folder (plain static files)
npm run preview    # optional: serve dist/ at http://localhost:4173 to double-check
```

The `dist/` folder is a normal static website. Here are some hosting options:

| Host | How |
|---|---|
| **Netlify** (easiest) | Go to app.netlify.com/drop and drag the `dist` folder in. |
| **Vercel** | `npx vercel` in this folder. It auto-detects Vite (build `npm run build`, output `dist`). |
| **Cloudflare Pages** | New project → build command `npm run build`, output directory `dist`. |
| **GitHub Pages** | Push `dist/` to a `gh-pages` branch. It works from a sub-path because `base: './'` is set in `vite.config.js`. |

It includes a web-app manifest and icons, so on an iPad/iPhone you can use **Share → Add to Home Screen**
and it opens full-screen like an app.

---

## How to play (for grown-ups)

* **Move:** touch/click and hold where you want to walk (or tap a spot). You can also use the arrow keys / WASD.
* **Jump:** the big pink **JUMP** button (or the space bar).
* **Switch leader:** tap a family face in the bottom-left. Everyone else follows.
* 🔊 repeats the last spoken instruction · 💡 shows a hint arrow (Medium/Hard) · ⏸️ pauses.
* Progress is saved on the device for each difficulty. Cities you haven't reached yet show as ❓ Mystery city until a clue reveals them. After the happy ending, **New adventure** reshuffles the cities.

| | 🐣 Easy | 🦊 Medium | 🦁 Hard |
|---|---|---|---|
| Finding the clue | Yellow arrow + rainbow beam always on | Spoken riddle; clue only sparkles when you're close; 💡 hint anytime | Riddle, and the clue is **locked** until you find 3 ⭐ gold stars in the surprise boxes; 💡 hint has a cooldown |
| Obstacles | None (just bouncy jelly pads) | Rolling gumballs (jump over them!) + sticky caramel puddles that slow you down | More and faster gumballs, more caramel, and Sour Gummies that chase you |
| Getting bumped | n/a | Drops 2 candies (you can pick them back up) | Drops 3 candies **and** a ❤️. Lose all 3 hearts and you retry the city |
| New York finale | The Candy Monster walks over for a hug | Catch him 2 times | Catch him 3 times |

Later cities add a few more obstacles. Nothing has a timer.

## Customizing

* **Characters' look** (hair, clothes, colors): `src/characters.js`, in `makeDad`, `makeMom`, `makeRumia` and `makeDelana`.
* **Cities, riddles, clue text**: the `LEVELS` list at the top of `src/levels.js`. `MIDDLE` there lists the cities that get shuffled between the two New York stops.
* **Ending conversation with the Candy Monster**: `runFinale()` in `src/main.js`.
* **Difficulty numbers** (candies, boxes, gumball speed…): `DIFFICULTY` in `src/game.js`.

Testing shortcuts in the browser console: `__game.route()` shows this adventure's order, `__game.startLevel(3)` jumps to stop 4, `__game.newAdventure()` reshuffles, `__game.unpause()`,
`__game.goEnding()`, `__game.setDifficulty('hard')`.

## Notes

* **Voice on iPhone/iPad:** the narrator is silent if the ring/silent switch is on silent. You can turn voice, music and sounds on or off in ⚙️ Settings.
* **Privacy:** the family photos are not in the app. The characters are made from simple 3D shapes and colors.
