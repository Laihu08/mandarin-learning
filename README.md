# CCCC Flashcards - 兒童華語文能力測驗

A mobile-first flashcard web app for the Taiwan Children's Chinese Competency Certificate (CCCC) vocabulary list. Works on GitHub Pages with no build step. Syncs across devices with optional Google sign-in.

---

## Local testing

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

**Important:** you must serve from a local server, not open the file directly with `file://`, because the app fetches JSON data files and ES modules don't load over `file://` in most browsers.

---

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository.
2. Go to **Settings - Pages**.
3. Under "Build and deployment", set source to **Deploy from a branch**.
4. Select **main** (or your branch name) and **/ (root)**.
5. Save. GitHub will give you a URL like `https://yourusername.github.io/your-repo/`.

The app works without Firebase — progress is stored in your browser's localStorage.

---

## Firebase setup (optional - enables cross-device sync)

### 1. Create a Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. Disable Google Analytics if you don't need it.

### 2. Enable Google authentication

1. In the Firebase console, go to **Authentication - Sign-in method**.
2. Click **Google** and enable it.
3. Set a support email and save.
4. Go to **Authentication - Settings - Authorized domains**.
5. Add your GitHub Pages domain: `yourusername.github.io`

   If you see auth errors after deploying, this is almost always the cause. The exact error in the browser console will say something like "auth/unauthorized-domain". Fix it by adding your `*.github.io` domain here.

### 3. Create a Firestore database

1. Go to **Firestore Database** and click **Create database**.
2. Choose **Production mode** and select a region close to you (e.g., asia-east1 for Taiwan).

### 4. Set Firestore security rules

In Firestore, go to **Rules** and paste these rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Click **Publish**.

### 5. Add your app config

1. In the Firebase console, go to **Project settings** (gear icon).
2. Under "Your apps", click the web icon `</>` to register a web app.
3. Give it a nickname and click "Register app".
4. Copy the `firebaseConfig` object.
5. In this project, copy `firebase-config.example.js` to `firebase-config.js`:

   ```bash
   cp firebase-config.example.js firebase-config.js
   ```

6. Open `firebase-config.js` and paste your real values.

`firebase-config.js` is listed in `.gitignore` so your API keys stay out of the repo.

### Sign in and sync

After setup, click **Sign in** in the top-right corner of the app. Your progress will sync to Firestore and be available on any device where you sign in.

---

## Works without Firebase

If you skip the Firebase setup entirely, the app falls back to localStorage silently. Your progress is saved per device. No error messages, no broken UI.

---

## Regenerate vocabulary data

If you update the source Excel file:

```bash
pip install xlrd
python3 scripts/build-data.py
```

This overwrites `data/vocabulary.json` and `data/pos.json`. Commit those files so the site has no runtime dependencies.

---

## Keyboard shortcuts (desktop)

| Key | Action |
|-----|--------|
| `Space` or `Enter` | Flip card |
| `ArrowLeft` | Previous card |
| `ArrowRight` | Next card |
| `1` | Mark as "Again" (didn't know) |
| `2` | Mark as "Known" |
| `P` | Toggle pinyin hint |

---

## Troubleshooting

**"Auth domain not authorized" error after deploying to GitHub Pages**
- Add `yourusername.github.io` to Firebase Authentication - Settings - Authorized domains.

**App shows blank page**
- Open it via a local server (`python3 -m http.server`), not by double-clicking `index.html`.

**Progress not syncing**
- Make sure you're signed in (top-right button).
- Check the browser console for Firestore errors.
- Verify your Firestore security rules are published.

**Chinese characters show in a sans-serif font**
- Make sure Google Fonts is loading. Check your internet connection or try disabling an aggressive ad-blocker.
