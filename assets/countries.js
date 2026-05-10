// Country / phone-format dictionary used by the phone-input widget.
// minLen / maxLen = number of digits AFTER the country dial code.
// Default = Egypt (matches our home market).

window.CHOCODODO_COUNTRIES = (function () {
  const COUNTRIES = [
    { iso: 'EG', name: 'Egypt',          name_ar: 'مصر',          flag: '🇪🇬', dial: '+20',  minLen: 10, maxLen: 10 },
    { iso: 'AE', name: 'United Arab Emirates', name_ar: 'الإمارات', flag: '🇦🇪', dial: '+971', minLen: 9,  maxLen: 9 },
    { iso: 'SA', name: 'Saudi Arabia',    name_ar: 'السعودية',     flag: '🇸🇦', dial: '+966', minLen: 9,  maxLen: 9 },
    { iso: 'KW', name: 'Kuwait',          name_ar: 'الكويت',       flag: '🇰🇼', dial: '+965', minLen: 8,  maxLen: 8 },
    { iso: 'QA', name: 'Qatar',           name_ar: 'قطر',          flag: '🇶🇦', dial: '+974', minLen: 8,  maxLen: 8 },
    { iso: 'BH', name: 'Bahrain',         name_ar: 'البحرين',      flag: '🇧🇭', dial: '+973', minLen: 8,  maxLen: 8 },
    { iso: 'OM', name: 'Oman',            name_ar: 'عُمان',        flag: '🇴🇲', dial: '+968', minLen: 8,  maxLen: 8 },
    { iso: 'JO', name: 'Jordan',          name_ar: 'الأردن',       flag: '🇯🇴', dial: '+962', minLen: 9,  maxLen: 9 },
    { iso: 'LB', name: 'Lebanon',         name_ar: 'لبنان',        flag: '🇱🇧', dial: '+961', minLen: 7,  maxLen: 8 },
    { iso: 'SY', name: 'Syria',           name_ar: 'سوريا',        flag: '🇸🇾', dial: '+963', minLen: 9,  maxLen: 9 },
    { iso: 'IQ', name: 'Iraq',            name_ar: 'العراق',       flag: '🇮🇶', dial: '+964', minLen: 10, maxLen: 10 },
    { iso: 'PS', name: 'Palestine',       name_ar: 'فلسطين',       flag: '🇵🇸', dial: '+970', minLen: 9,  maxLen: 9 },
    { iso: 'YE', name: 'Yemen',           name_ar: 'اليمن',        flag: '🇾🇪', dial: '+967', minLen: 9,  maxLen: 9 },
    { iso: 'LY', name: 'Libya',           name_ar: 'ليبيا',        flag: '🇱🇾', dial: '+218', minLen: 9,  maxLen: 10 },
    { iso: 'TN', name: 'Tunisia',         name_ar: 'تونس',         flag: '🇹🇳', dial: '+216', minLen: 8,  maxLen: 8 },
    { iso: 'DZ', name: 'Algeria',         name_ar: 'الجزائر',      flag: '🇩🇿', dial: '+213', minLen: 9,  maxLen: 9 },
    { iso: 'MA', name: 'Morocco',         name_ar: 'المغرب',       flag: '🇲🇦', dial: '+212', minLen: 9,  maxLen: 9 },
    { iso: 'SD', name: 'Sudan',           name_ar: 'السودان',      flag: '🇸🇩', dial: '+249', minLen: 9,  maxLen: 9 },
    { iso: 'TR', name: 'Turkey',          name_ar: 'تركيا',        flag: '🇹🇷', dial: '+90',  minLen: 10, maxLen: 10 },
    { iso: 'GB', name: 'United Kingdom',  name_ar: 'المملكة المتحدة', flag: '🇬🇧', dial: '+44',  minLen: 10, maxLen: 10 },
    { iso: 'US', name: 'United States',   name_ar: 'الولايات المتحدة', flag: '🇺🇸', dial: '+1',   minLen: 10, maxLen: 10 },
    { iso: 'CA', name: 'Canada',          name_ar: 'كندا',         flag: '🇨🇦', dial: '+1',   minLen: 10, maxLen: 10 },
    { iso: 'FR', name: 'France',          name_ar: 'فرنسا',        flag: '🇫🇷', dial: '+33',  minLen: 9,  maxLen: 9 },
    { iso: 'DE', name: 'Germany',         name_ar: 'ألمانيا',      flag: '🇩🇪', dial: '+49',  minLen: 7,  maxLen: 11 },
    { iso: 'ES', name: 'Spain',           name_ar: 'إسبانيا',      flag: '🇪🇸', dial: '+34',  minLen: 9,  maxLen: 9 },
    { iso: 'IT', name: 'Italy',           name_ar: 'إيطاليا',      flag: '🇮🇹', dial: '+39',  minLen: 9,  maxLen: 11 },
    { iso: 'NL', name: 'Netherlands',     name_ar: 'هولندا',       flag: '🇳🇱', dial: '+31',  minLen: 9,  maxLen: 9 },
    { iso: 'AU', name: 'Australia',       name_ar: 'أستراليا',     flag: '🇦🇺', dial: '+61',  minLen: 9,  maxLen: 9 },
    { iso: 'IN', name: 'India',           name_ar: 'الهند',        flag: '🇮🇳', dial: '+91',  minLen: 10, maxLen: 10 },
    { iso: 'PK', name: 'Pakistan',        name_ar: 'باكستان',      flag: '🇵🇰', dial: '+92',  minLen: 10, maxLen: 10 },
    { iso: 'BD', name: 'Bangladesh',      name_ar: 'بنغلاديش',     flag: '🇧🇩', dial: '+880', minLen: 10, maxLen: 10 },
    { iso: 'NG', name: 'Nigeria',         name_ar: 'نيجيريا',      flag: '🇳🇬', dial: '+234', minLen: 10, maxLen: 11 },
    { iso: 'ZA', name: 'South Africa',    name_ar: 'جنوب أفريقيا', flag: '🇿🇦', dial: '+27',  minLen: 9,  maxLen: 9 },
  ];

  function getDefault() {
    const stored = localStorage.getItem('chocododo_country');
    if (stored) {
      const found = COUNTRIES.find(c => c.iso === stored);
      if (found) return found;
    }
    return COUNTRIES[0]; // Egypt
  }

  function setDefault(iso) {
    localStorage.setItem('chocododo_country', iso);
  }

  /**
   * Mounts a country picker + phone input pair onto a host element.
   * The host element should have data-phone-mount attribute.
   * Returns an object with { getValue, setValue, isValid }.
   */
  function mount(host, opts = {}) {
    if (host._chocoMounted) return host._chocoMounted;
    const initial = opts.value || '';
    const fieldName = opts.name || 'phone';

    // Try to detect country from initial value
    let country = getDefault();
    if (initial) {
      const match = COUNTRIES
        .slice()
        .sort((a, b) => b.dial.length - a.dial.length)
        .find(c => initial.startsWith(c.dial));
      if (match) country = match;
    }
    const initialDigits = initial && initial.startsWith(country.dial)
      ? initial.slice(country.dial.length).replace(/[^\d]/g, '')
      : initial.replace(/[^\d]/g, '');

    host.innerHTML = `
      <div class="phone-input">
        <button type="button" class="phone-country" aria-label="Choose country">
          <span class="phone-flag">${country.flag}</span>
          <span class="phone-dial">${country.dial}</span>
          <span class="phone-caret">▾</span>
        </button>
        <input type="tel" class="phone-number" inputmode="numeric"
               placeholder="${'0'.repeat(Math.min(country.maxLen, 10))}"
               value="${initialDigits}" />
        <input type="hidden" class="phone-hidden" name="${fieldName}" />
        <div class="phone-dropdown" hidden>
          <input type="search" class="phone-search" placeholder="Search country…" />
          <div class="phone-list">
            ${COUNTRIES.map(c => `
              <button type="button" class="phone-option" data-iso="${c.iso}">
                <span class="phone-flag">${c.flag}</span>
                <span class="phone-name">${c.name}</span>
                <span class="phone-dial-small">${c.dial}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const btn   = host.querySelector('.phone-country');
    const num   = host.querySelector('.phone-number');
    const hid   = host.querySelector('.phone-hidden');
    const drop  = host.querySelector('.phone-dropdown');
    const search = host.querySelector('.phone-search');
    const opts2 = host.querySelectorAll('.phone-option');

    function syncHidden() {
      const digits = num.value.replace(/[^\d]/g, '');
      hid.value = digits ? `${country.dial} ${digits}` : '';
    }
    function setCountry(iso) {
      const found = COUNTRIES.find(c => c.iso === iso);
      if (!found) return;
      country = found;
      setDefault(iso);
      btn.querySelector('.phone-flag').textContent = country.flag;
      btn.querySelector('.phone-dial').textContent = country.dial;
      num.placeholder = '0'.repeat(Math.min(country.maxLen, 10));
      syncHidden();
    }
    function isValid() {
      const digits = num.value.replace(/[^\d]/g, '');
      if (!digits && !opts.required) return true;
      return digits.length >= country.minLen && digits.length <= country.maxLen;
    }

    btn.addEventListener('click', () => {
      const open = !drop.hasAttribute('hidden');
      if (open) drop.setAttribute('hidden', '');
      else { drop.removeAttribute('hidden'); search.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (!host.contains(e.target)) drop.setAttribute('hidden', '');
    });
    opts2.forEach(o => o.addEventListener('click', () => {
      setCountry(o.dataset.iso);
      drop.setAttribute('hidden', '');
    }));
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      opts2.forEach(o => {
        const txt = o.textContent.toLowerCase();
        o.style.display = !q || txt.includes(q) ? '' : 'none';
      });
    });
    num.addEventListener('input', () => {
      // Strip non-digits
      const cleaned = num.value.replace(/[^\d]/g, '');
      if (cleaned !== num.value) num.value = cleaned;
      // Cap to max length
      if (num.value.length > country.maxLen) num.value = num.value.slice(0, country.maxLen);
      syncHidden();
      num.classList.toggle('invalid', num.value.length > 0 && !isValid());
    });

    // Initial sync
    syncHidden();

    const api = {
      getValue: () => hid.value,
      setValue: (v) => {
        if (!v) { num.value = ''; syncHidden(); return; }
        const sorted = COUNTRIES.slice().sort((a, b) => b.dial.length - a.dial.length);
        const match = sorted.find(c => v.startsWith(c.dial));
        if (match) {
          setCountry(match.iso);
          num.value = v.slice(match.dial.length).replace(/[^\d]/g, '');
        } else {
          num.value = v.replace(/[^\d]/g, '');
        }
        syncHidden();
      },
      isValid,
    };
    host._chocoMounted = api;
    return api;
  }

  function mountAll() {
    document.querySelectorAll('[data-phone-mount]').forEach(host => {
      mount(host, {
        name: host.dataset.phoneName || 'phone',
        required: host.dataset.phoneRequired === 'true',
        value: host.dataset.phoneValue || '',
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }

  return { COUNTRIES, mount, mountAll, getDefault, setDefault };
})();
