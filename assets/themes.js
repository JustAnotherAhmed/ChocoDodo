// =====================================================
// ChocoDoDo — Festive Themes
//   Auto-detects current Egyptian holiday/season and applies
//   a CSS class to <html>. Admin can force a specific theme
//   via the /api/admin/settings endpoint (key = "theme_override").
// =====================================================
//
// Detected themes (by date in Africa/Cairo):
//   ramadan    — Ramadan month (uses approximate Hijri-to-Gregorian table)
//   eid-fitr   — Eid al-Fitr (~3 days after end of Ramadan)
//   eid-adha   — Eid al-Adha (~70 days later, Dhu al-Hijjah 10–13)
//   moulid     — Mawlid (Prophet's birthday, Rabi' al-awwal 12)
//   christmas  — Dec 23 – Jan 2 (Coptic Christmas Jan 7 too)
//   newyear    — Dec 28 – Jan 5
//   valentine  — Feb 10 – Feb 16
//   mothers    — Mar 18 – Mar 24 (Egypt Mother's Day Mar 21)
//   summer     — Jun 21 – Sep 22
//   halloween  — Oct 25 – Nov 2
//   default    — none of the above

window.CHOCODODO_THEMES = (function () {
  const SUPPORTED = [
    'default', 'ramadan', 'eid-fitr', 'eid-adha', 'moulid',
    'christmas', 'newyear', 'valentine', 'mothers', 'summer', 'halloween'
  ];

  // Approximate Hijri dates in Gregorian (good through 2030).
  // Each entry: [theme, startISO, endISO]
  // Update yearly when new moon sightings change things.
  const HIJRI_WINDOWS = [
    // 2025
    ['ramadan',  '2025-03-01', '2025-03-29'],
    ['eid-fitr', '2025-03-30', '2025-04-01'],
    ['eid-adha', '2025-06-06', '2025-06-09'],
    ['moulid',   '2025-09-04', '2025-09-05'],
    // 2026
    ['ramadan',  '2026-02-18', '2026-03-19'],
    ['eid-fitr', '2026-03-20', '2026-03-22'],
    ['eid-adha', '2026-05-27', '2026-05-30'],
    ['moulid',   '2026-08-25', '2026-08-26'],
    // 2027
    ['ramadan',  '2027-02-08', '2027-03-09'],
    ['eid-fitr', '2027-03-10', '2027-03-12'],
    ['eid-adha', '2027-05-17', '2027-05-20'],
    ['moulid',   '2027-08-15', '2027-08-16'],
    // 2028
    ['ramadan',  '2028-01-28', '2028-02-26'],
    ['eid-fitr', '2028-02-27', '2028-02-29'],
    ['eid-adha', '2028-05-05', '2028-05-08'],
    ['moulid',   '2028-08-04', '2028-08-05'],
    // 2029
    ['ramadan',  '2029-01-16', '2029-02-14'],
    ['eid-fitr', '2029-02-15', '2029-02-17'],
    ['eid-adha', '2029-04-25', '2029-04-28'],
    ['moulid',   '2029-07-25', '2029-07-26'],
    // 2030
    ['ramadan',  '2030-01-06', '2030-02-04'],
    ['eid-fitr', '2030-02-05', '2030-02-07'],
    ['eid-adha', '2030-04-14', '2030-04-17'],
    ['moulid',   '2030-07-15', '2030-07-16'],
  ];

  function cairoNow() {
    // Best-effort Africa/Cairo date in YYYY-MM-DD form
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Cairo',
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
      return fmt.format(new Date()); // 'YYYY-MM-DD'
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function detectTheme(date = cairoNow()) {
    // 1. Hijri-derived windows
    for (const [name, start, end] of HIJRI_WINDOWS) {
      if (date >= start && date <= end) return name;
    }
    // 2. Fixed date windows
    const md = date.slice(5);  // 'MM-DD'
    if (md >= '12-23' || md <= '01-02') return 'christmas';
    if (md >= '12-28' || md <= '01-05') return 'newyear';
    if (md >= '02-10' && md <= '02-16') return 'valentine';
    if (md >= '03-18' && md <= '03-24') return 'mothers';
    if (md >= '10-25' && md <= '11-02') return 'halloween';
    if (md >= '06-21' && md <= '09-22') return 'summer';
    return 'default';
  }

  async function fetchOverride() {
    try {
      const apiBase = window.CHOCODODO_API_BASE || '';
      const r = await fetch(apiBase + '/api/config-public');
      if (!r.ok) return null;
      const j = await r.json();
      return j.theme_override || null;
    } catch { return null; }
  }

  /* === DECORATION GENERATORS === */
  // Each theme injects a fixed-position layer with floating decorations.
  // Layer is purely visual — pointer-events:none so it never blocks clicks.

  // Festive banner text in BOTH languages — only one shows
  // based on the current <html lang> via the standard i18n CSS.
  function bilingualBanner(en, ar) {
    return `<div class="festive-banner">
      <span lang="en">${en}</span><span lang="ar">${ar}</span>
    </div>`;
  }

  const DECOR = {
    ramadan: () => `
      ${bilingualBanner('🌙 Ramadan Kareem 🌙', '🌙 رمضان كريم 🌙')}
      <div class="festive-deco festive-corner-tl">
        <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true">
          <circle cx="40" cy="40" r="28" fill="#F5D478"/>
          <circle cx="50" cy="36" r="26" fill="rgba(255,248,231,0.95)"/>
          <circle cx="22" cy="22" r="2" fill="#F5D478"/>
          <circle cx="60" cy="14" r="1.5" fill="#F5D478"/>
          <circle cx="14" cy="50" r="1.5" fill="#F5D478"/>
        </svg>
      </div>
      <div class="festive-deco festive-corner-tr lantern">${lanternSvg('#C9A95C', '#1B5E20')}</div>
      <div class="festive-deco festive-corner-bl lantern lantern-2">${lanternSvg('#D4AF37', '#3E2723')}</div>
      <div class="festive-deco festive-corner-br"><span style="font-size:2rem;">🕌</span></div>
      <div class="festive-stars">${starsSvg(8, '#F5D478')}</div>
    `,
    'eid-fitr': () => `
      ${bilingualBanner('🕌 Eid Mubarak 🕌', '🕌 عيد مبارك 🕌')}
      <div class="festive-deco festive-corner-tl"><span class="bounce-soft" style="font-size:2.5rem;">🎉</span></div>
      <div class="festive-deco festive-corner-tr"><span class="bounce-soft" style="font-size:2.5rem;">🎁</span></div>
      <div class="festive-deco festive-corner-bl lantern">${lanternSvg('#D4AF37', '#C2185B')}</div>
      <div class="festive-deco festive-corner-br"><span class="bounce-soft" style="font-size:2.5rem;">🌙</span></div>
      <div class="festive-confetti">${confettiSvg(12)}</div>
    `,
    'eid-adha': () => `
      ${bilingualBanner('🐑 Eid al-Adha Mubarak 🐑', '🐑 عيد الأضحى مبارك 🐑')}
      <div class="festive-deco festive-corner-tl"><span class="bounce-soft" style="font-size:2.5rem;">🐑</span></div>
      <div class="festive-deco festive-corner-tr"><span class="bounce-soft" style="font-size:2.5rem;">🎉</span></div>
      <div class="festive-deco festive-corner-bl lantern">${lanternSvg('#1B5E20', '#D4AF37')}</div>
      <div class="festive-deco festive-corner-br"><span style="font-size:2.5rem;">🕌</span></div>
    `,
    moulid: () => `
      ${bilingualBanner('🍬 Mawlid Mubarak 🍬', '🍬 مولد النبي 🍬')}
      <div class="festive-deco festive-corner-tl"><span class="bounce-soft" style="font-size:2.5rem;">🍬</span></div>
      <div class="festive-deco festive-corner-tr"><span class="bounce-soft" style="font-size:2.5rem;">🎀</span></div>
      <div class="festive-deco festive-corner-bl"><span class="bounce-soft" style="font-size:2.5rem;">🌹</span></div>
      <div class="festive-deco festive-corner-br"><span class="bounce-soft" style="font-size:2.5rem;">💝</span></div>
    `,
    christmas: () => `
      ${bilingualBanner('🎄 Merry Christmas 🎄', '🎄 عيد ميلاد مجيد 🎄')}
      <div class="festive-deco festive-corner-tl"><span class="bounce-soft" style="font-size:3rem;">🎄</span></div>
      <div class="festive-deco festive-corner-tr"><span class="bounce-soft" style="font-size:3rem;">🎅</span></div>
      <div class="festive-deco festive-corner-bl"><span class="bounce-soft" style="font-size:3rem;">🎁</span></div>
      <div class="festive-deco festive-corner-br"><span class="bounce-soft" style="font-size:3rem;">⛄</span></div>
      <div class="festive-snow">${snowSvg(20)}</div>
      <div class="festive-lights"></div>
    `,
    newyear: () => `
      ${bilingualBanner('🎆 Happy New Year 🎆', '🎆 سنة سعيدة 🎆')}
      <div class="festive-deco festive-corner-tl"><span class="bounce-soft" style="font-size:3rem;">🎆</span></div>
      <div class="festive-deco festive-corner-tr"><span class="bounce-soft" style="font-size:3rem;">🥂</span></div>
      <div class="festive-deco festive-corner-bl"><span class="bounce-soft" style="font-size:3rem;">🎊</span></div>
      <div class="festive-deco festive-corner-br"><span class="bounce-soft" style="font-size:3rem;">🎇</span></div>
      <div class="festive-confetti">${confettiSvg(20)}</div>
    `,
    valentine: () => `
      ${bilingualBanner('💕 Spread some love 💕', '💕 انشر الحب 💕')}
      <div class="festive-hearts">${heartsSvg(15)}</div>
      <div class="festive-deco festive-corner-tl"><span class="bounce-soft" style="font-size:3rem;">💝</span></div>
      <div class="festive-deco festive-corner-tr"><span class="bounce-soft" style="font-size:3rem;">💌</span></div>
      <div class="festive-deco festive-corner-bl"><span class="bounce-soft" style="font-size:3rem;">🌹</span></div>
      <div class="festive-deco festive-corner-br"><span class="bounce-soft" style="font-size:3rem;">💕</span></div>
    `,
    mothers: () => `
      ${bilingualBanner("💐 Happy Mother's Day 💐", '💐 عيد الأم سعيد 💐')}
      <div class="festive-deco festive-corner-tl"><span class="bounce-soft" style="font-size:3rem;">💐</span></div>
      <div class="festive-deco festive-corner-tr"><span class="bounce-soft" style="font-size:3rem;">🌷</span></div>
      <div class="festive-deco festive-corner-bl"><span class="bounce-soft" style="font-size:3rem;">🌹</span></div>
      <div class="festive-deco festive-corner-br"><span class="bounce-soft" style="font-size:3rem;">💝</span></div>
      <div class="festive-petals">${petalsSvg(12)}</div>
    `,
    summer: () => `
      <div class="festive-deco festive-corner-tl"><span class="bounce-soft" style="font-size:3rem;">☀️</span></div>
      <div class="festive-deco festive-corner-tr"><span class="bounce-soft" style="font-size:3rem;">🌴</span></div>
      <div class="festive-deco festive-corner-bl"><span class="bounce-soft" style="font-size:3rem;">🍦</span></div>
      <div class="festive-deco festive-corner-br"><span class="bounce-soft" style="font-size:3rem;">🌊</span></div>
    `,
    halloween: () => `
      ${bilingualBanner('🎃 Spooky season 🎃', '🎃 موسم الرعب 🎃')}
      <div class="festive-deco festive-corner-tl"><span class="bounce-soft" style="font-size:3rem;">🎃</span></div>
      <div class="festive-deco festive-corner-tr"><span class="bounce-soft" style="font-size:3rem;">🦇</span></div>
      <div class="festive-deco festive-corner-bl"><span class="bounce-soft" style="font-size:3rem;">👻</span></div>
      <div class="festive-deco festive-corner-br"><span class="bounce-soft" style="font-size:3rem;">🕸️</span></div>
    `,
    default: () => '',
  };

  function lanternSvg(body, top) {
    return `
      <svg viewBox="0 0 60 90" width="48" height="72" aria-hidden="true">
        <line x1="30" y1="0" x2="30" y2="14" stroke="#3E2723" stroke-width="2"/>
        <ellipse cx="30" cy="14" rx="14" ry="4" fill="${top}"/>
        <path d="M16 14 Q12 35 16 60 L44 60 Q48 35 44 14 Z" fill="${body}"/>
        <rect x="22" y="20" width="16" height="3" fill="${top}"/>
        <rect x="22" y="48" width="16" height="3" fill="${top}"/>
        <ellipse cx="30" cy="38" rx="6" ry="9" fill="#FFE082"/>
        <circle cx="30" cy="38" r="3" fill="#FFC107"/>
        <ellipse cx="30" cy="60" rx="14" ry="4" fill="${top}"/>
        <path d="M30 64 L30 78 M27 78 L33 78 M28 82 L32 82" stroke="${top}" stroke-width="2" fill="none"/>
        <circle cx="30" cy="86" r="3" fill="${body}"/>
      </svg>
    `;
  }

  function starsSvg(n, color) {
    return Array.from({ length: n }, (_, i) => {
      const x = Math.random() * 100;
      const y = Math.random() * 60;
      const delay = Math.random() * 4;
      return `<span class="festive-star" style="left:${x}vw;top:${y}vh;animation-delay:${delay}s;color:${color}">✦</span>`;
    }).join('');
  }

  function snowSvg(n) {
    return Array.from({ length: n }, (_, i) => {
      const x = Math.random() * 100;
      const dur = 8 + Math.random() * 8;
      const delay = Math.random() * 8;
      const size = 0.8 + Math.random() * 1.4;
      return `<span class="festive-flake" style="left:${x}vw;animation-duration:${dur}s;animation-delay:${delay}s;font-size:${size}rem;">❄</span>`;
    }).join('');
  }

  function heartsSvg(n) {
    return Array.from({ length: n }, () => {
      const x = Math.random() * 100;
      const dur = 6 + Math.random() * 8;
      const delay = Math.random() * 8;
      const size = 1 + Math.random() * 1.6;
      const heart = ['💕', '💖', '💗', '❤️'][Math.floor(Math.random() * 4)];
      return `<span class="festive-heart" style="left:${x}vw;animation-duration:${dur}s;animation-delay:${delay}s;font-size:${size}rem;">${heart}</span>`;
    }).join('');
  }

  function petalsSvg(n) {
    return Array.from({ length: n }, () => {
      const x = Math.random() * 100;
      const dur = 8 + Math.random() * 6;
      const delay = Math.random() * 8;
      return `<span class="festive-petal" style="left:${x}vw;animation-duration:${dur}s;animation-delay:${delay}s;">🌸</span>`;
    }).join('');
  }

  function confettiSvg(n) {
    const colors = ['#F5B7B1', '#A8DADC', '#D4AF37', '#C2185B', '#5DADE2'];
    return Array.from({ length: n }, () => {
      const x = Math.random() * 100;
      const dur = 5 + Math.random() * 6;
      const delay = Math.random() * 5;
      const c = colors[Math.floor(Math.random() * colors.length)];
      return `<span class="festive-confetto" style="left:${x}vw;background:${c};animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
    }).join('');
  }

  function applyTheme(name) {
    if (!SUPPORTED.includes(name)) name = 'default';
    const html = document.documentElement;
    SUPPORTED.forEach(t => html.classList.remove('theme-' + t));
    html.classList.add('theme-' + name);
    document.body?.classList.remove(...SUPPORTED.map(t => 'theme-' + t));
    document.body?.classList.add('theme-' + name);

    // Inject decorations layer
    let layer = document.getElementById('festive-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'festive-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body?.appendChild(layer);
    }
    const builder = DECOR[name] || DECOR.default;
    layer.innerHTML = builder();

    window.CHOCODODO_CURRENT_THEME = name;
    window.dispatchEvent(new CustomEvent('chocododo:theme', { detail: { theme: name } }));
  }

  async function init() {
    // 1. Apply auto-detected theme immediately so there's no flicker
    const auto = detectTheme();
    applyTheme(auto);
    // 2. Optionally override based on admin settings
    const override = await fetchOverride();
    if (override && override !== 'auto') applyTheme(override);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { applyTheme, detectTheme, SUPPORTED };
})();
