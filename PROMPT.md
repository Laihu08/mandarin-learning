# Build a Chinese Vocabulary Flashcard Web App

## Project context

I'm a foreigner living in Taiwan learning Mandarin. In this folder is `CCCC_Vocabulary_2017.xls` — the official Taiwan **Children's Chinese Competency Certificate (兒童華語文能力測驗)** vocabulary list. Build a beautiful, mobile-friendly flashcard web app from this data that I can host on GitHub Pages and use from any device.

**Before writing any UI code, read your `frontend-design` skill.** This needs to feel intentional and elegant, not templated.

---

## Data source

The Excel file has 6 sheets. You only need three of them:

| Sheet | Level | English label |
|---|---|---|
| 萌芽級 | Méngyá jí | Beginner (Sprout) |
| 成長級 | Chéngzhǎng jí | Intermediate (Growth) |
| 茁壯級 | Zhuózhuàng jí | Advanced (Flourishing) |

Each of these three sheets has the same column layout. Note: row 1 of each sheet is a title row, **row 2 is the real header**, data starts at row 3.

Columns:
- `分類` — Category (e.g., 人物, 生活, 自然)
- `細目` — Subcategory (e.g., 家庭, 飲食, 動物)
- `正體字` — Traditional characters ← **USE THIS**
- `簡體字` — Simplified characters ← **SKIP — Taiwan uses traditional**
- `漢拼` — Hanyu Pinyin (with tone marks)
- `詞性` — Part of speech (N, V, ADV, etc.)
- `英文` — English translation

The 6th sheet `詞性縮寫對照表` is the legend for parts of speech. Use it to expand abbreviations into full English names so the UI never shows raw codes like `VS` or `Prep`.

---

## Build steps

### Step 1 — Convert the data
- Write `scripts/build-data.py` using `pandas` + `xlrd` (legacy `.xls` needs xlrd, not openpyxl — `pip install xlrd`)
- Read the three level sheets, drop the `簡體字` column
- Build `data/vocabulary.json` shaped like:
  ```json
  {
    "levels": {
      "beginner":     [{"id": "b001", "char": "人", "pinyin": "rén", "english": "person", "pos": "N", "category": "人物", "subcategory": "人物"}, ...],
      "intermediate": [...],
      "advanced":     [...]
    }
  }
  ```
- Build `data/pos.json` mapping abbreviation → full English name from the legend sheet
- Run the script once and commit the JSON output so the site needs no build step at deploy time

### Step 2 — Build the app
Single-page static site. Plain HTML / CSS / vanilla JS (or a tiny amount of Alpine/HTMX if it actually helps) — **no bundler, no framework build step**. It must work on GitHub Pages with zero CI.

---

## Features

### Home screen — level selection
- Three large cards: **Beginner · 萌芽級** / **Intermediate · 成長級** / **Advanced · 茁壯級**
- Each shows word count + cards I've marked "known" (e.g., `23 / 475 learned`)
- Below each level, an optional **category filter** (人物 / 生活 / 自然 …) shown with English labels — let me study one category at a time
- Categories come from the data; show them in the same order they appear in the source file

### Flashcard view

**Front of card:**
- Big traditional character(s) — the hero of the screen
- Small category badge in a corner: `生活 · 飲食 / Daily Life · Food`
- A subtle **"Show pinyin"** button (eye icon) — tapping it reveals the pinyin **without flipping the card**
- Critical: this button must `stopPropagation` so it doesn't trigger the card flip

**Back of card (after flip):**
- The character again, smaller, at the top
- Pinyin with tone marks (medium size)
- English meaning (large — this is the answer)
- Part of speech as a full English word (e.g., "Noun", not "N")
- Category + subcategory

**Card interactions:**
- Tap anywhere on the card (except the hint button) → smooth 3D flip
- Swipe left = "didn't know, show again later"
- Swipe right = "know it, mark as learned"
- Equivalent buttons below the card for desktop / accessibility
- Previous / Next buttons
- Shuffle toggle
- Keyboard support on desktop: `Space` flip, `←` prev, `→` next, `1` mark unknown, `2` mark known

**Progress UI:**
- Thin progress bar at top: `23 / 475 in 萌芽級`
- Subtle "cards reviewed today" counter

---

## Persistence — two layers

1. **localStorage** by default — works without sign-in, per-device. Always on.
2. **Google Sign-In via Firebase Auth (optional)** — when signed in, sync to Firestore so my phone and laptop stay in sync.

Per user, persist: current level, current category filter, last card index, set of "known" word IDs, set of "review again" word IDs, last-opened timestamp.

**Firebase setup:**
- Put config in `firebase-config.js` (gitignored)
- Provide `firebase-config.example.js` with clear placeholder keys and comments
- Use Firestore in production mode with rules that only allow each user to read/write their own document at `users/{uid}`
- Use the **modular v9+ Firebase SDK** via CDN (no npm)
- Auth: Google provider only

---

## Mobile-first design

- Design for 375px-wide phones first, scale up to tablet / desktop gracefully
- No horizontal scroll, no awkward line breaks with Chinese characters
- Tap targets ≥ 44×44px
- Card fills most of the screen on mobile, centered with breathing room on desktop
- Respect iOS safe-area insets (`env(safe-area-inset-*)`)
- Works in portrait and landscape
- Test at 375px, 768px, 1440px before declaring done

---

## Aesthetic direction — non-negotiable

Warm, calm, scholarly — reading by lamplight, not a tech app.

- **Typography**: `Noto Serif TC` (Google Fonts) for Chinese — the characters deserve real type. `Inter` or `Geist` for Latin text.
- **Palette**: restrained. One warm accent (terracotta, ink-blue, or muted gold) on a near-neutral background. Subtle paper-like texture is welcome but optional.
- **Whitespace**: generous around the character. The character is the focus.
- **Card flip**: weighty, ~450–550ms, ease-in-out, proper 3D transform with `perspective`. No bounce.
- **Dark mode**: a considered separate palette, not a CSS filter invert. Toggle in a corner. Respect `prefers-color-scheme` on first load.

**Avoid:**
- Generic Tailwind defaults (purple gradient, `rounded-2xl shadow-xl` everywhere)
- Emoji as decoration
- Playful / bouncy animations — keep it composed
- Auto-generated icon-font clutter — one well-chosen icon set (e.g., Lucide) and use it sparingly

---

## File structure

```
.
├── index.html
├── styles.css
├── app.js
├── firebase-config.example.js
├── firebase-config.js              (gitignored — I fill this in)
├── data/
│   ├── vocabulary.json
│   └── pos.json
├── scripts/
│   └── build-data.py
├── .gitignore
└── README.md
```

---

## Deliverables

1. `scripts/build-data.py` + run it once and commit the JSON output
2. The full app: `index.html`, `styles.css`, `app.js`
3. `firebase-config.example.js` with placeholder keys + comments
4. `.gitignore` excluding `firebase-config.js`
5. `README.md` covering:
   - One-time Firebase setup (create project → enable Google auth → create Firestore → paste Firestore security rules → copy web app config into `firebase-config.js`) with the exact rules I should paste
   - Local testing: `python3 -m http.server 8000` then open `http://localhost:8000`
   - Push to GitHub + enable Pages (Settings → Pages → Deploy from branch → main / root)
   - "It works without Firebase too" note — if I skip the Firebase step, the app falls back to localStorage silently
   - Troubleshooting: common Firebase auth domain errors when deployed to GH Pages (I'll need to add the `*.github.io` domain to Firebase Auth → authorized domains)

---

## Final checks before declaring done

- 375px viewport: nothing overflows, no awkward wraps
- 1440px viewport: still feels composed, not stretched
- Flip a card 20 times: no jank
- Sign out → progress persists in localStorage
- Sign in on a fresh browser → progress restores from Firestore
- All Chinese characters render in the chosen serif (verify font is actually loading, not falling back)
- No raw POS codes visible to the user — all expanded
- Hint button does NOT flip the card
- Dark mode is a separate palette, not an invert filter
- Keyboard shortcuts work on desktop

---

For any **design** decision you're unsure about, exercise taste and decide — don't ask.
For any **architectural** decision you're unsure about (data shape, auth flow, deploy mechanics), ask before committing.

Now: read the Excel file, build the data, and ship the app.
