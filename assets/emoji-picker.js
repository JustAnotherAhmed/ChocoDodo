// Reusable emoji picker — attaches to any element with [data-emoji-picker].
// Use it next to text inputs / on buttons. Click it to open a popup,
// click an emoji to insert it into the target field (data-emoji-target).

window.CHOCODODO_EMOJI = (function () {
  const EMOJI_GROUPS = [
    {
      name: 'Sweets',
      items: ['🍫','🍩','🍪','🧁','🎂','🍰','🍮','🍯','🍭','🍬','🍡','🥮','🍦','🍨','🍧','🥧','🥐','🥖','🍞'],
    },
    {
      name: 'Fruits',
      items: ['🍓','🍒','🍑','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🥝','🥥','🫐','🥑'],
    },
    {
      name: 'Nuts & seeds',
      items: ['🥜','🌰','🫘','🌽','🍫','🥄'],
    },
    {
      name: 'Drinks',
      items: ['☕','🍵','🥛','🧋','🥤','🧃','🍶','🍾','🍷','🍸'],
    },
    {
      name: 'Hearts & sparkles',
      items: ['❤️','🧡','💛','💚','💙','💜','🤍','🤎','💖','💗','💝','💕','✨','⭐','🌟','💫','🍀','🎀','🎁'],
    },
    {
      name: 'Holidays',
      items: ['🎄','🎅','🎆','🎇','🎉','🎊','🎈','🍀','🪔','🕎','🕊️','🐰','🥚','🌷','🌸','🍂','🎃'],
    },
    {
      name: 'Other',
      items: ['🍴','🥄','🥢','🍽️','🧂','🧈','🥚','🥯','🥨','🌶️','🫒','🌿','🌱','🌾','🥥','🥥'],
    },
  ];

  let activePopup = null;
  let activeTarget = null;

  function ensurePopup() {
    if (activePopup) return activePopup;
    activePopup = document.createElement('div');
    activePopup.className = 'emoji-popup';
    activePopup.hidden = true;
    activePopup.innerHTML = `
      <div class="emoji-popup-head">
        <input type="search" class="emoji-search" placeholder="Search emoji…" />
        <button type="button" class="emoji-close" aria-label="Close">×</button>
      </div>
      <div class="emoji-groups">
        ${EMOJI_GROUPS.map((g, gi) => `
          <div class="emoji-group" data-group="${gi}">
            <h4>${g.name}</h4>
            <div class="emoji-grid">
              ${g.items.map(e => `<button type="button" class="emoji-cell" data-e="${e}">${e}</button>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    document.body.appendChild(activePopup);

    activePopup.addEventListener('click', (e) => {
      if (e.target.classList.contains('emoji-close')) {
        return close();
      }
      if (e.target.classList.contains('emoji-cell')) {
        insert(e.target.dataset.e);
      }
    });
    activePopup.querySelector('.emoji-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      activePopup.querySelectorAll('.emoji-cell').forEach(b => {
        // Pretty crude — emojis don't have plain-text labels, so we filter
        // by group name match. Show all when query is empty.
        if (!q) { b.style.display = ''; }
      });
      activePopup.querySelectorAll('.emoji-group').forEach(g => {
        const groupName = g.querySelector('h4').textContent.toLowerCase();
        g.style.display = !q || groupName.includes(q) ? '' : 'none';
      });
    });
    document.addEventListener('click', (e) => {
      if (!activePopup) return;
      if (activePopup.contains(e.target)) return;
      if (e.target.matches('[data-emoji-picker]')) return;
      close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    return activePopup;
  }

  function open(triggerBtn) {
    const pop = ensurePopup();
    const targetSel = triggerBtn.dataset.emojiTarget;
    activeTarget = targetSel ? document.querySelector(targetSel) : null;
    if (!activeTarget) {
      // Fallback: previous-sibling input
      activeTarget = triggerBtn.previousElementSibling;
    }
    // Position near the button
    const rect = triggerBtn.getBoundingClientRect();
    pop.style.position = 'absolute';
    pop.style.top = (window.scrollY + rect.bottom + 8) + 'px';
    pop.style.left = Math.min(rect.left, window.innerWidth - 360) + 'px';
    pop.hidden = false;
    pop.querySelector('.emoji-search').focus();
  }

  function close() {
    if (activePopup) activePopup.hidden = true;
    activeTarget = null;
  }

  function insert(emoji) {
    if (!activeTarget) return close();
    if (activeTarget.tagName === 'INPUT' || activeTarget.tagName === 'TEXTAREA') {
      // Replace selection with emoji
      const start = activeTarget.selectionStart || 0;
      const end = activeTarget.selectionEnd || 0;
      const v = activeTarget.value;
      activeTarget.value = v.slice(0, start) + emoji + v.slice(end);
      activeTarget.selectionStart = activeTarget.selectionEnd = start + emoji.length;
      activeTarget.dispatchEvent(new Event('input', { bubbles: true }));
      activeTarget.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      activeTarget.textContent = emoji;
      activeTarget.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close();
  }

  function bindAll() {
    document.querySelectorAll('[data-emoji-picker]').forEach(btn => {
      if (btn._emojiBound) return;
      btn._emojiBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        open(btn);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll);
  } else {
    bindAll();
  }

  // Re-bind whenever new triggers get inserted
  const observer = new MutationObserver(() => bindAll());
  observer.observe(document.body, { childList: true, subtree: true });

  return { open, close, bindAll };
})();
