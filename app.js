/* ── CCCC Flashcard App ──────────────────────────────────────────── */

const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/10.14.1';

/* ── Category labels ─────────────────────────────────────────────── */
const CAT_LABELS = {
  '交通': 'Transportation',
  '人物': 'People',
  '功能詞': 'Function Words',
  '地方': 'Places',
  '常用語': 'Common Expressions',
  '形色': 'Shapes & Colors',
  '數量': 'Quantities',
  '時間': 'Time',
  '生活': 'Daily Life',
  '程度': 'Degree',
  '自然': 'Nature',
  // subcategories
  '一般': 'General',
  '交通工具': 'Vehicles',
  '人格特質': 'Personality',
  '休閒活動': 'Leisure',
  '健康': 'Health',
  '動物': 'Animals',
  '口部動作': 'Mouth Actions',
  '國家': 'Countries',
  '天氣': 'Weather',
  '季節': 'Seasons',
  '學校': 'School',
  '家庭': 'Family',
  '尺寸': 'Sizes',
  '居家活動': 'Home Activities',
  '居家用品': 'Household Items',
  '年月日星期': 'Dates & Days',
  '形狀': 'Shapes',
  '心理活動': 'Mental Activities',
  '手部動作': 'Hand Actions',
  '數字': 'Numbers',
  '數量': 'Quantities',
  '方位': 'Directions',
  '植物': 'Plants',
  '現象': 'Phenomena',
  '眼部動作': 'Eye Actions',
  '祝福': 'Greetings & Wishes',
  '職業': 'Occupations',
  '腳部動作': 'Foot Actions',
  '自然環境': 'Natural Environment',
  '處所': 'Locations',
  '衣物飾品': 'Clothing & Accessories',
  '語言': 'Language',
  '身體動作': 'Body Actions',
  '身體部位': 'Body Parts',
  '金錢': 'Money',
  '顏色': 'Colors',
  '飲食': 'Food & Drink',
  '鼻子動作': 'Nasal Actions',
};

const LEVEL_META = {
  beginner:     { zh: '萌芽級', en: 'Beginner',     sub: 'Sprout' },
  intermediate: { zh: '成長級', en: 'Intermediate', sub: 'Growth' },
  advanced:     { zh: '茁壯級', en: 'Advanced',     sub: 'Flourishing' },
};

/* ── State ───────────────────────────────────────────────────────── */
let vocab = null;   // full vocabulary.json
let posMap = null;  // pos.json

let state = {
  view: 'home',
  level: null,
  category: null,
  deck: [],
  reviewQueue: [],
  index: 0,
  isFlipped: false,
  showPinyin: false,
  isShuffled: false,
  todayCount: 0,
  todayDate: '',
  reviewMode: false,
  progress: {
    beginner:     { known: new Set(), review: new Set(), lastIndex: 0, category: null, skipKnown: false },
    intermediate: { known: new Set(), review: new Set(), lastIndex: 0, category: null, skipKnown: false },
    advanced:     { known: new Set(), review: new Set(), lastIndex: 0, category: null, skipKnown: false },
  },
};

/* ── Firebase state ──────────────────────────────────────────────── */
let firebaseAuth = null;
let firebaseDb   = null;
let currentUser  = null;
let firestoreSaveTimer = null;

/* ── Helpers ─────────────────────────────────────────────────────── */
function catLabel(zh) {
  return CAT_LABELS[zh] || zh;
}

function expandPos(code) {
  if (!code || !posMap) return '';
  const parts = code.replace(/;/g, '/').split('/').map(p => p.trim()).filter(Boolean);
  return parts.map(p => {
    if (posMap[p]) return posMap[p];
    const cap = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    return posMap[cap] || posMap[p.toUpperCase()] || p;
  }).join(' / ');
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/* ── Local storage ───────────────────────────────────────────────── */
const LS_KEY = 'cccc-flashcard';

function saveLocal() {
  const data = {
    todayCount: state.todayDate === todayKey() ? state.todayCount : 0,
    todayDate:  todayKey(),
    progress: {},
  };
  for (const lvl of ['beginner', 'intermediate', 'advanced']) {
    const p = state.progress[lvl];
    data.progress[lvl] = {
      known:      [...p.known],
      review:     [...p.review],
      lastIndex:  p.lastIndex,
      category:   p.category,
      skipKnown:  p.skipKnown,
    };
  }
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {}
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const today = todayKey();
    state.todayCount = data.todayDate === today ? (data.todayCount || 0) : 0;
    state.todayDate  = today;
    for (const lvl of ['beginner', 'intermediate', 'advanced']) {
      if (data.progress?.[lvl]) {
        const p = data.progress[lvl];
        state.progress[lvl].known      = new Set(p.known || []);
        state.progress[lvl].review     = new Set(p.review || []);
        state.progress[lvl].lastIndex  = p.lastIndex || 0;
        state.progress[lvl].category   = p.category || null;
        state.progress[lvl].skipKnown  = p.skipKnown || false;
      }
    }
  } catch (_) {}
}

/* ── Firestore helpers ───────────────────────────────────────────── */
async function loadFirestoreProgress(uid) {
  if (!firebaseDb) return;
  try {
    const { doc, getDoc } = await import(`${FIREBASE_CDN}/firebase-firestore.js`);
    const snap = await getDoc(doc(firebaseDb, 'users', uid));
    if (!snap.exists()) return;
    const data = snap.data();
    const today = todayKey();
    state.todayCount = data.todayDate === today ? (data.todayCount || 0) : 0;
    for (const lvl of ['beginner', 'intermediate', 'advanced']) {
      if (data.progress?.[lvl]) {
        const p = data.progress[lvl];
        state.progress[lvl].known      = new Set(p.known || []);
        state.progress[lvl].review     = new Set(p.review || []);
        state.progress[lvl].lastIndex  = p.lastIndex || 0;
        state.progress[lvl].category   = p.category || null;
        state.progress[lvl].skipKnown  = p.skipKnown || false;
      }
    }
    saveLocal();
    renderHome();
    showSync('Synced from cloud');
  } catch (e) {
    console.warn('Firestore load error', e);
  }
}

function scheduleFirestoreSave() {
  if (!firebaseDb || !currentUser) return;
  clearTimeout(firestoreSaveTimer);
  firestoreSaveTimer = setTimeout(saveToFirestore, 2000);
}

async function saveToFirestore() {
  if (!firebaseDb || !currentUser) return;
  try {
    const { doc, setDoc } = await import(`${FIREBASE_CDN}/firebase-firestore.js`);
    const data = {
      todayCount: state.todayDate === todayKey() ? state.todayCount : 0,
      todayDate:  todayKey(),
      lastOpened: new Date().toISOString(),
      progress:   {},
    };
    for (const lvl of ['beginner', 'intermediate', 'advanced']) {
      const p = state.progress[lvl];
      data.progress[lvl] = {
        known:     [...p.known],
        review:    [...p.review],
        lastIndex: p.lastIndex,
        category:  p.category,
      };
    }
    await setDoc(doc(firebaseDb, 'users', currentUser.uid), data);
  } catch (e) {
    console.warn('Firestore save error', e);
  }
}

/* ── Firebase init ───────────────────────────────────────────────── */
async function initFirebase() {
  if (!window.firebaseConfig) return;
  try {
    const { initializeApp }                        = await import(`${FIREBASE_CDN}/firebase-app.js`);
    const { getAuth, GoogleAuthProvider,
            signInWithPopup, signOut,
            onAuthStateChanged }                   = await import(`${FIREBASE_CDN}/firebase-auth.js`);

    const app  = initializeApp(window.firebaseConfig);
    const auth = getAuth(app);
    const { getFirestore }                         = await import(`${FIREBASE_CDN}/firebase-firestore.js`);
    firebaseDb = getFirestore(app);
    firebaseAuth = auth;

    const authBtn = document.getElementById('auth-btn');
    authBtn.classList.remove('hidden');

    authBtn.addEventListener('click', async () => {
      if (currentUser) {
        await signOut(auth);
      } else {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
        } catch (e) {
          console.warn('Sign-in error', e);
        }
      }
    });

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (user) {
        authBtn.textContent = user.displayName?.split(' ')[0] || 'Sign out';
        authBtn.classList.add('signed-in');
        await loadFirestoreProgress(user.uid);
      } else {
        authBtn.textContent = 'Sign in';
        authBtn.classList.remove('signed-in');
      }
      renderHome();
    });
  } catch (e) {
    console.warn('Firebase init error', e);
  }
}

/* ── Sync indicator ──────────────────────────────────────────────── */
let syncTimer;
function showSync(msg) {
  const el = document.getElementById('sync-indicator');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

/* ── Build deck ──────────────────────────────────────────────────── */
function buildDeck(level, category, reviewOnly = false) {
  let cards = vocab.levels[level] || [];
  if (category) cards = cards.filter(c => c.category === category);
  const known = state.progress[level].known;
  if (reviewOnly) {
    cards = cards.filter(c => known.has(c.id));
  } else if (state.progress[level].skipKnown) {
    cards = cards.filter(c => !known.has(c.id));
  }
  return cards;
}

function shuffleDeck(deck) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Persist progress ────────────────────────────────────────────── */
function persistProgress() {
  if (state.level) {
    state.progress[state.level].lastIndex = state.index;
    state.progress[state.level].category  = state.category;
  }
  saveLocal();
  scheduleFirestoreSave();
}

/* ── SVG icons ───────────────────────────────────────────────────── */
const ICON = {
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  chevLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  shuffle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
};

/* ── Home screen render ──────────────────────────────────────────── */
function renderHome() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';

  for (const [levelKey, meta] of Object.entries(LEVEL_META)) {
    const cards    = vocab.levels[levelKey] || [];
    const progress = state.progress[levelKey];
    const knownAll = progress.known.size;
    const total    = cards.length;

    // Per-category counts
    const catStats = {};
    cards.forEach(c => {
      if (!c.category) return;
      if (!catStats[c.category]) catStats[c.category] = { total: 0, known: 0 };
      catStats[c.category].total++;
      if (progress.known.has(c.id)) catStats[c.category].known++;
    });

    const categories = [...new Set(cards.map(c => c.category).filter(Boolean))];
    const savedCat   = progress.category;

    const percent = total > 0 ? Math.round(knownAll / total * 100) : 0;

    const card = document.createElement('div');
    card.className = 'level-card';
    card.innerHTML = `
      <div class="level-card-top">
        <div class="level-header">
          <div class="level-name-group">
            <span class="level-zh">${meta.zh}</span>
            <span class="level-en">${meta.en} &middot; ${meta.sub}</span>
          </div>
          <div class="level-stat-block">
            <div class="stat-fraction">
              <span class="stat-known">${knownAll}</span><span class="stat-denom">/${total}</span>
            </div>
            <span class="stat-label">learned</span>
          </div>
        </div>
        <div class="level-mini-bar">
          <div class="level-mini-fill" style="width:${percent}%"></div>
        </div>
      </div>
      <div class="category-filter-wrap">
        <div class="cat-filter-header">
          <span class="cat-filter-label">Category</span>
          <label class="skip-toggle">
            <input type="checkbox" class="skip-checkbox" ${progress.skipKnown ? 'checked' : ''}>
            <span class="skip-label">Skip learned</span>
          </label>
        </div>
        <div class="category-pills" data-level="${levelKey}">
          <button class="cat-pill${!savedCat ? ' active' : ''}" data-cat="">All <span class="pill-count">${knownAll}/${total}</span></button>
          ${categories.map(c => {
            const s = catStats[c] || { total: 0, known: 0 };
            return `<button class="cat-pill${savedCat === c ? ' active' : ''}" data-cat="${c}">${c} - ${catLabel(c)} <span class="pill-count">${s.known}/${s.total}</span></button>`;
          }).join('')}
        </div>
      </div>
      <div class="level-actions">
        <button class="start-btn">Start Studying</button>
        <button class="review-btn" ${knownAll === 0 ? 'disabled' : ''}>Review${knownAll > 0 ? ` (${knownAll})` : ''}</button>
      </div>
    `;
    grid.appendChild(card);

    // Category pill clicks
    card.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        card.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.progress[levelKey].category = pill.dataset.cat || null;
        saveLocal();
      });
    });

    // Skip toggle
    card.querySelector('.skip-checkbox').addEventListener('change', e => {
      state.progress[levelKey].skipKnown = e.target.checked;
      saveLocal();
    });

    // Start button
    card.querySelector('.start-btn').addEventListener('click', () => {
      const activePill = card.querySelector('.cat-pill.active');
      const cat = activePill?.dataset.cat || null;
      startLevel(levelKey, cat || null, false);
    });

    // Review button
    card.querySelector('.review-btn').addEventListener('click', () => {
      const activePill = card.querySelector('.cat-pill.active');
      const cat = activePill?.dataset.cat || null;
      startLevel(levelKey, cat || null, true);
    });
  }
}

/* ── Card screen render ──────────────────────────────────────────── */
function renderCard() {
  const card = state.deck[state.index];
  if (!card) return;

  const levelMeta = LEVEL_META[state.level];
  const total     = state.deck.length;
  const known     = state.progress[state.level].known.size;

  // Progress
  const fill = total > 0 ? ((state.index + 1) / total) * 100 : 0;
  document.getElementById('progress-fill').style.width = fill + '%';
  document.getElementById('progress-label').textContent = state.reviewMode
    ? `Reviewing learned · ${state.index + 1} of ${total} in ${levelMeta.zh}`
    : `${known} / ${total} in ${levelMeta.zh}`;

  // Front
  document.getElementById('front-char').textContent = card.char;
  document.getElementById('front-pinyin').textContent = card.pinyin;

  const catEn  = catLabel(card.category);
  const subcatEn = catLabel(card.subcategory);
  const catBadge = document.getElementById('front-category');
  const categoryMarkup = card.category
    ? `<span class="front-category-zh">${card.category} &middot; ${card.subcategory}</span>
       <span class="front-category-en">${catEn} &middot; ${subcatEn}</span>`
    : '';
  catBadge.innerHTML = categoryMarkup;
  document.getElementById('mobile-card-category').innerHTML = categoryMarkup;
  document.getElementById('mobile-card-pinyin').textContent = card.pinyin;
  const frontChar = document.getElementById('front-char');
  frontChar.classList.toggle('compact', card.char.length >= 3);
  frontChar.classList.toggle('compact-wide', card.char.length >= 5 || card.char.includes('/'));

  // Back
  document.getElementById('back-char').textContent    = card.char;
  document.getElementById('back-pinyin').textContent  = card.pinyin;
  document.getElementById('back-english').textContent = card.english;
  document.getElementById('back-pos').textContent     = expandPos(card.pos);

  const backCat = document.getElementById('back-category');
  backCat.innerHTML = card.category
    ? `<span class="back-category-zh">${card.category} &middot; ${card.subcategory}</span><br>${catEn} &middot; ${subcatEn}`
    : '';

  // Reset flip and pinyin
  setFlipped(false);
  setPinyinVisible(false);

  // Nav buttons
  document.getElementById('prev-btn').disabled = state.index === 0;

  // Today counter
  document.getElementById('today-counter').textContent =
    `${state.todayCount} reviewed today`;
}

function setFlipped(val) {
  state.isFlipped = val;
  const inner = document.getElementById('card-inner');
  inner.classList.toggle('is-flipped', val);
  setPinyinVisible(false);
}

function setPinyinVisible(val) {
  state.showPinyin = val;
  const pinyin = document.getElementById('front-pinyin');
  const mobilePinyin = document.getElementById('mobile-card-pinyin');
  const btn    = document.getElementById('pinyin-btn');
  const visible = val && !state.isFlipped;
  pinyin.classList.toggle('visible', visible);
  mobilePinyin.classList.toggle('visible', visible);
  btn.classList.toggle('revealed', val);
  btn.innerHTML = val ? ICON.eyeOff : ICON.eye;
  btn.setAttribute('aria-label', val ? 'Hide pinyin' : 'Show pinyin');
}

/* ── Navigation ──────────────────────────────────────────────────── */
function startLevel(level, category, reviewOnly = false) {
  let deck = buildDeck(level, category, reviewOnly);
  if (state.isShuffled) deck = shuffleDeck(deck);

  if (deck.length === 0) {
    showSync(reviewOnly ? 'No learned cards in this set' : 'All cards learned here!');
    return;
  }

  state.level      = level;
  state.category   = category;
  state.reviewMode = reviewOnly;
  state.todayDate  = todayKey();
  state.deck        = deck;
  state.reviewQueue = [];
  state.index       = 0;

  // Restore position only for regular study, not review sessions
  if (!reviewOnly) {
    const saved = state.progress[level];
    if (saved.category === category && saved.lastIndex < deck.length) {
      state.index = saved.lastIndex;
    }
  }

  showCardScreen();
  renderCard();
}

function showHome() {
  persistProgress();
  state.view = 'home';
  document.getElementById('home-screen').classList.add('active');
  document.getElementById('card-screen').classList.remove('active');
  document.getElementById('back-btn').classList.add('hidden');
  document.getElementById('shuffle-btn').classList.add('hidden');
  renderHome();
}

function showCardScreen() {
  state.view = 'cards';
  document.getElementById('home-screen').classList.remove('active');
  document.getElementById('card-screen').classList.add('active');
  document.getElementById('back-btn').classList.remove('hidden');
  document.getElementById('shuffle-btn').classList.remove('hidden');
}

function goNext() {
  state.index++;
  if (state.index >= state.deck.length) {
    // Append review queue to deck if any
    if (state.reviewQueue.length > 0) {
      state.deck   = [...state.reviewQueue];
      state.reviewQueue = [];
      state.index  = 0;
    } else {
      // End of deck
      state.index = state.deck.length - 1;
      showSync('All cards reviewed!');
      return;
    }
  }
  persistProgress();
  renderCard();
}

function goPrev() {
  if (state.index > 0) {
    state.index--;
    persistProgress();
    renderCard();
  }
}

/* ── Swipe animation ─────────────────────────────────────────────── */
function animateSwipe(dir, callback) {
  const scene = document.getElementById('card-scene');
  scene.classList.add(dir === 'left' ? 'swipe-left' : 'swipe-right');
  setTimeout(() => {
    scene.classList.remove('swipe-left', 'swipe-right');
    callback();
  }, 300);
}

/* ── Mark actions ────────────────────────────────────────────────── */
function markAgain() {
  const card = state.deck[state.index];
  if (!card) return;
  const p = state.progress[state.level];
  p.review.add(card.id);
  p.known.delete(card.id);
  state.reviewQueue.push(card);
  state.todayCount++;
  state.todayDate = todayKey();
  persistProgress();
  animateSwipe('left', goNext);
}

function markKnown() {
  const card = state.deck[state.index];
  if (!card) return;
  const p = state.progress[state.level];
  p.known.add(card.id);
  p.review.delete(card.id);
  state.todayCount++;
  state.todayDate = todayKey();
  persistProgress();
  animateSwipe('right', goNext);
}

/* ── Swipe detection ─────────────────────────────────────────────── */
function initSwipe(el) {
  let startX = 0, startY = 0, moved = false;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    moved  = false;
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    moved = true;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (!moved) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return; // mostly vertical = scroll
    if (Math.abs(dx) < 50) return;
    if (dx < 0) markAgain();
    else markKnown();
  }, { passive: true });
}

/* ── Theme ───────────────────────────────────────────────────────── */
function getTheme() {
  return localStorage.getItem('cccc-theme') || 'auto';
}

function setTheme(theme) {
  localStorage.setItem('cccc-theme', theme);
  const html = document.documentElement;
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
  } else {
    html.removeAttribute('data-theme');
  }
  updateThemeIcon();
}

function isDark() {
  const t = getTheme();
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-btn');
  btn.innerHTML = isDark() ? ICON.sun : ICON.moon;
  btn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
}

function cycleTheme() {
  const current = getTheme();
  const next = current === 'auto'
    ? (isDark() ? 'light' : 'dark')
    : (current === 'dark' ? 'light' : 'dark');
  setTheme(next);
}

/* ── Init ────────────────────────────────────────────────────────── */
async function init() {
  // Apply saved theme
  setTheme(getTheme());

  // Load data
  const [vocabRes, posRes] = await Promise.all([
    fetch('data/vocabulary.json'),
    fetch('data/pos.json'),
  ]);
  vocab  = await vocabRes.json();
  posMap = await posRes.json();

  // Load local progress
  loadLocal();

  // Render
  renderHome();
  setupIcons();
  setupEvents();

  // Firebase (optional)
  initFirebase().catch(() => {});

  // Fade out loader
  const loader = document.getElementById('loading-overlay');
  loader.classList.add('fade-out');
  setTimeout(() => loader.remove(), 400);
}

function setupIcons() {
  document.getElementById('back-btn').innerHTML    = ICON.chevLeft;
  document.getElementById('shuffle-btn').innerHTML = ICON.shuffle;
  document.getElementById('pinyin-btn').innerHTML  = ICON.eye;
  document.getElementById('prev-btn').innerHTML    = ICON.chevLeft;
  document.getElementById('next-btn').innerHTML    = ICON.chevRight;
  updateThemeIcon();
}

function setupEvents() {
  // Back to home
  document.getElementById('back-btn').addEventListener('click', showHome);

  // Shuffle toggle
  const shuffleBtn = document.getElementById('shuffle-btn');
  shuffleBtn.addEventListener('click', () => {
    state.isShuffled = !state.isShuffled;
    shuffleBtn.classList.toggle('active', state.isShuffled);
    if (state.level) {
      const cat = state.category;
      startLevel(state.level, cat);
    }
  });

  // Theme toggle
  document.getElementById('theme-btn').addEventListener('click', cycleTheme);

  // Card flip (tap on card-inner, excluding pinyin button)
  const cardInner = document.getElementById('card-inner');
  cardInner.addEventListener('click', () => {
    setFlipped(!state.isFlipped);
  });

  // Pinyin button (stopPropagation)
  const pinyinBtn = document.getElementById('pinyin-btn');
  pinyinBtn.addEventListener('click', e => {
    e.stopPropagation();
    setPinyinVisible(!state.showPinyin);
  });

  // Prev / Next
  document.getElementById('prev-btn').addEventListener('click', goPrev);
  document.getElementById('next-btn').addEventListener('click', () => {
    persistProgress();
    goNext();
  });

  // Again / Known
  document.getElementById('again-btn').addEventListener('click', markAgain);
  document.getElementById('known-btn').addEventListener('click', markKnown);

  // Swipe on card scene
  initSwipe(document.getElementById('card-scene'));

  // Keyboard
  document.addEventListener('keydown', e => {
    if (state.view !== 'cards') return;
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault();
        setFlipped(!state.isFlipped);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        goPrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        goNext();
        break;
      case '1':
        markAgain();
        break;
      case '2':
        markKnown();
        break;
      case 'p':
      case 'P':
        setPinyinVisible(!state.showPinyin);
        break;
    }
  });
}

// Start
document.addEventListener('DOMContentLoaded', init);
