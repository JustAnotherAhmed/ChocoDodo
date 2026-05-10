// Visual builder for product option groups (replaces the JSON textarea).
// Mounts on a host element with [data-options-builder].
//
// API:
//   const builder = window.CHOCODODO_OPTIONS.mount(host);
//   builder.set(optionsObject);
//   const result = builder.get();   // → { groups: [...] } or null

window.CHOCODODO_OPTIONS = (function () {
  let groupCounter = 0;

  function uid() { return 'g' + (++groupCounter) + '_' + Math.random().toString(36).slice(2, 6); }

  // Standard 10-filling preset, matches our menu
  const FILLINGS_PRESET = {
    id: 'filling',
    label_en: 'Choose your filling',
    label_ar: 'اختر الحشوة',
    required: true,
    multi: false,
    choices: [
      { value: 'coffee',        label_en: 'Coffee',        label_ar: 'قهوة',                price_delta_minor: 0 },
      { value: 'caramel',       label_en: 'Caramel',       label_ar: 'كراميل',              price_delta_minor: 0 },
      { value: 'almond',        label_en: 'Almond',        label_ar: 'لوز',                 price_delta_minor: 0 },
      { value: 'hazelnut',      label_en: 'Hazelnut',      label_ar: 'بندق',                price_delta_minor: 0 },
      { value: 'cashew',        label_en: 'Cashew',        label_ar: 'كاجو',                price_delta_minor: 0 },
      { value: 'walnut',        label_en: 'Walnut',        label_ar: 'عين جمل',             price_delta_minor: 0 },
      { value: 'peanut',        label_en: 'Peanut',        label_ar: 'سوداني',              price_delta_minor: 0 },
      { value: 'pistachio',     label_en: 'Pistachio',     label_ar: 'بستاشيو',             price_delta_minor: 0 },
      { value: 'lotus',         label_en: 'Lotus',         label_ar: 'لوتس',                price_delta_minor: 0 },
      { value: 'peanut_butter', label_en: 'Peanut Butter', label_ar: 'زبدة فول سوداني',    price_delta_minor: 0 },
    ],
  };

  function slugify(s) {
    return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  }

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function mount(host) {
    if (host._optionsBuilder) return host._optionsBuilder;

    let groups = []; // [{ uid, id, label_en, label_ar, required, multi, choices: [...] }]

    function render() {
      host.innerHTML = `
        <div class="ob">
          <div class="ob-groups">
            ${groups.length === 0
              ? `<div class="ob-empty">
                   <p>No option groups yet. Customers will just click + to add this product to the cart.</p>
                   <div class="ob-empty-actions">
                     <button type="button" class="btn btn-ghost" data-add-group>+ Add option group</button>
                     <button type="button" class="btn btn-ghost" data-preset-fillings>Use the standard fillings preset</button>
                   </div>
                 </div>`
              : groups.map(renderGroup).join('')
            }
          </div>
          ${groups.length > 0 ? `
            <button type="button" class="btn btn-ghost ob-add-group" data-add-group>+ Add another option group</button>
          ` : ''}
        </div>
      `;
      bind();
    }

    function renderGroup(g, idx) {
      return `
        <div class="ob-group" data-uid="${g.uid}">
          <div class="ob-group-head">
            <strong>Option group #${idx + 1}</strong>
            <button type="button" class="btn-link danger" data-remove-group="${g.uid}">Remove group</button>
          </div>
          <div class="ob-group-fields">
            <label class="form-field">
              <span>Group name (English)</span>
              <input type="text" data-field="label_en" value="${escapeHtml(g.label_en)}" placeholder="e.g. Choose your filling" />
            </label>
            <label class="form-field">
              <span>Group name (Arabic)</span>
              <input type="text" data-field="label_ar" dir="rtl" value="${escapeHtml(g.label_ar)}" placeholder="مثال: اختر الحشوة" />
            </label>
            <label class="ob-toggle">
              <input type="checkbox" data-field="required" ${g.required ? 'checked' : ''} />
              <span>Required</span>
            </label>
            <label class="ob-toggle">
              <input type="checkbox" data-field="multi" ${g.multi ? 'checked' : ''} />
              <span>Allow multiple choices</span>
            </label>
          </div>
          <div class="ob-choices">
            <div class="ob-choices-head">
              <strong>Choices</strong>
              <small class="muted">Each choice can have a price difference (e.g. extra topping +10 EGP)</small>
            </div>
            ${g.choices.map((c, ci) => `
              <div class="ob-choice" data-ci="${ci}">
                <input type="text" data-cf="label_en" value="${escapeHtml(c.label_en)}" placeholder="English label" />
                <input type="text" data-cf="label_ar" dir="rtl" value="${escapeHtml(c.label_ar)}" placeholder="Arabic label" />
                <div class="ob-price-wrap">
                  <input type="number" step="1" data-cf="price_delta_egp" value="${(c.price_delta_minor || 0) / 100}" />
                  <span class="ob-price-suffix">EGP</span>
                </div>
                <button type="button" class="btn-link danger" data-remove-choice="${ci}" aria-label="Remove choice">✕</button>
              </div>
            `).join('')}
            <button type="button" class="btn btn-ghost ob-add-choice" data-add-choice>+ Add choice</button>
          </div>
        </div>
      `;
    }

    function bind() {
      // Add group
      host.querySelectorAll('[data-add-group]').forEach(b => b.onclick = () => {
        groups.push({ uid: uid(), label_en: '', label_ar: '', required: true, multi: false, choices: [] });
        render();
      });
      // Preset fillings
      host.querySelectorAll('[data-preset-fillings]').forEach(b => b.onclick = () => {
        groups.push({ uid: uid(), ...JSON.parse(JSON.stringify(FILLINGS_PRESET)) });
        render();
      });

      host.querySelectorAll('.ob-group').forEach(groupEl => {
        const u = groupEl.dataset.uid;
        const g = groups.find(x => x.uid === u);
        if (!g) return;

        groupEl.querySelector('[data-remove-group]').onclick = () => {
          if (!confirm('Remove this option group?')) return;
          groups = groups.filter(x => x.uid !== u);
          render();
        };
        groupEl.querySelectorAll('[data-field]').forEach(input => {
          input.oninput = () => {
            const field = input.dataset.field;
            if (field === 'required' || field === 'multi') g[field] = input.checked;
            else g[field] = input.value;
          };
        });
        groupEl.querySelector('[data-add-choice]').onclick = () => {
          g.choices.push({ value: '', label_en: '', label_ar: '', price_delta_minor: 0 });
          render();
        };
        groupEl.querySelectorAll('.ob-choice').forEach(choiceEl => {
          const ci = Number(choiceEl.dataset.ci);
          choiceEl.querySelector('[data-remove-choice]').onclick = () => {
            g.choices.splice(ci, 1);
            render();
          };
          choiceEl.querySelectorAll('[data-cf]').forEach(input => {
            input.oninput = () => {
              const f = input.dataset.cf;
              if (f === 'price_delta_egp') {
                g.choices[ci].price_delta_minor = Math.round(Number(input.value || 0) * 100);
              } else {
                g.choices[ci][f] = input.value;
              }
            };
          });
        });
      });
    }

    function set(options) {
      groups = [];
      if (options?.groups?.length) {
        for (const g of options.groups) {
          groups.push({
            uid: uid(),
            id: g.id || '',
            label_en: g.label_en || '',
            label_ar: g.label_ar || '',
            required: !!g.required,
            multi: !!g.multi,
            choices: (g.choices || []).map(c => ({
              value: c.value || '',
              label_en: c.label_en || '',
              label_ar: c.label_ar || '',
              price_delta_minor: c.price_delta_minor || 0,
            })),
          });
        }
      }
      render();
    }

    function get() {
      const cleaned = groups
        .filter(g => g.label_en && g.choices.length > 0)
        .map(g => ({
          id: g.id || slugify(g.label_en) || 'group',
          label_en: g.label_en,
          label_ar: g.label_ar || '',
          required: !!g.required,
          multi: !!g.multi,
          choices: g.choices
            .filter(c => c.label_en)
            .map(c => ({
              value: c.value || slugify(c.label_en),
              label_en: c.label_en,
              label_ar: c.label_ar || '',
              price_delta_minor: c.price_delta_minor || 0,
            })),
        }))
        .filter(g => g.choices.length > 0);
      return cleaned.length ? { groups: cleaned } : null;
    }

    function validate() {
      const errs = [];
      groups.forEach((g, i) => {
        if (!g.label_en) errs.push(`Option group #${i + 1}: English name is required`);
        if (g.choices.length === 0) errs.push(`Option group #${i + 1}: at least one choice required`);
        g.choices.forEach((c, ci) => {
          if (!c.label_en) errs.push(`Group #${i + 1} choice #${ci + 1}: English label required`);
        });
      });
      return errs;
    }

    render();
    const api = { set, get, validate };
    host._optionsBuilder = api;
    return api;
  }

  return { mount };
})();
