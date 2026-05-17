// Server-side pricing math — option-aware.
// Always re-compute on the server. Never trust totals from the browser.

const { byId } = require('./products');
const dbApi = require('./db');

// These read from the settings table first, falling back to env vars, then to
// the defaults. That means an admin can change delivery fee / tax / deposit %
// live from the admin panel without restarting the server.
function currentTaxRate() {
  const fromDb = dbApi.getSetting('cfg_tax_rate', null);
  if (fromDb !== null && fromDb !== '') {
    const n = Number(fromDb);
    if (!isNaN(n) && n >= 0 && n <= 1) return n;
  }
  return Number(process.env.TAX_RATE || 0);
}
function currentDeliveryMinor() {
  const fromDb = dbApi.getSetting('cfg_delivery_minor', null);
  if (fromDb !== null && fromDb !== '') {
    const n = Number(fromDb);
    if (!isNaN(n) && n >= 0) return n;
  }
  return Number(process.env.DELIVERY_MINOR_UNITS || 3000); // default 30 EGP
}
function currentDepositPct() {
  const fromDb = dbApi.getSetting('cfg_deposit_pct', null);
  if (fromDb !== null && fromDb !== '') {
    const n = Number(fromDb);
    if (!isNaN(n) && n >= 1 && n <= 100) return n;
  }
  return Number(process.env.DEPOSIT_PCT || 50);
}
function currentLeadDays() {
  const fromDb = dbApi.getSetting('cfg_lead_days', null);
  if (fromDb !== null && fromDb !== '') {
    const n = Number(fromDb);
    if (!isNaN(n) && n >= 0 && n <= 60) return n;
  }
  return Number(process.env.LEAD_DAYS || 3);
}

// Default Cairo delivery zones. These are the seed values used the very
// first time someone hits the site; admin can edit them in Settings →
// Server config → Delivery zones to add areas, change fees, or remove rows.
const DEFAULT_DELIVERY_ZONES = [
  { id: 'maadi',          name: 'Maadi',                 name_ar: 'المعادي',        fee_egp: 30 },
  { id: 'zamalek',        name: 'Zamalek',               name_ar: 'الزمالك',        fee_egp: 30 },
  { id: 'mohandessin',    name: 'Mohandessin',           name_ar: 'المهندسين',      fee_egp: 30 },
  { id: 'dokki',          name: 'Dokki',                 name_ar: 'الدقي',          fee_egp: 30 },
  { id: 'downtown',       name: 'Downtown',              name_ar: 'وسط البلد',      fee_egp: 30 },
  { id: 'heliopolis',     name: 'Heliopolis',            name_ar: 'مصر الجديدة',    fee_egp: 30 },
  { id: 'nasr_city',      name: 'Nasr City',             name_ar: 'مدينة نصر',      fee_egp: 35 },
  { id: 'rehab',          name: 'Rehab',                 name_ar: 'الرحاب',         fee_egp: 50 },
  { id: 'new_cairo',      name: 'New Cairo',             name_ar: 'القاهرة الجديدة', fee_egp: 60 },
  { id: 'fifth_settle',   name: '5th Settlement',        name_ar: 'التجمع الخامس',  fee_egp: 60 },
  { id: 'madinaty',       name: 'Madinaty',              name_ar: 'مدينتي',         fee_egp: 70 },
  { id: 'shorouk',        name: 'Shorouk',               name_ar: 'الشروق',         fee_egp: 70 },
  { id: 'obour',          name: 'Obour',                 name_ar: 'العبور',         fee_egp: 70 },
  { id: 'sheikh_zayed',   name: 'Sheikh Zayed',          name_ar: 'الشيخ زايد',     fee_egp: 70 },
  { id: '6th_october',    name: '6th of October',        name_ar: 'السادس من أكتوبر', fee_egp: 70 },
];

/** Returns the live delivery-zone list (parsed from settings, fallback to defaults). */
function currentDeliveryZones() {
  const raw = dbApi.getSetting('delivery_zones_json', null);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return DEFAULT_DELIVERY_ZONES;
}

/**
 * Look up the delivery fee (in piastres) for a given zone id.
 * Falls back to currentDeliveryMinor() when the zone is unknown — which
 * lets us evolve the schema without breaking old in-flight orders.
 */
function deliveryFeeForZone(zoneId) {
  if (!zoneId) return currentDeliveryMinor();
  const zone = currentDeliveryZones().find(z => z.id === zoneId);
  if (!zone) return currentDeliveryMinor();
  const egp = Number(zone.fee_egp);
  if (isNaN(egp) || egp < 0) return currentDeliveryMinor();
  return Math.round(egp * 100);
}

const toMinor = (egp) => Math.round(egp * 100);

/**
 * Validate a selected-options object against a product's option groups.
 * Returns { ok, errors, normalized, surcharge_minor }.
 *
 * Selected shape sent from client:  { groupId: choiceValue }  (or array if multi)
 */
function validateSelectedOptions(product, selected) {
  selected = selected || {};
  const errors = [];
  const normalized = {};
  let surcharge = 0;

  const groups = product?.options?.groups || [];
  for (const g of groups) {
    const raw = selected[g.id];
    if (g.required && (raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0))) {
      errors.push(`${g.label_en || g.id} is required`);
      continue;
    }
    if (raw === undefined) continue;

    if (g.multi) {
      const values = Array.isArray(raw) ? raw : [raw];
      const valid = [];
      for (const v of values) {
        const choice = (g.choices || []).find(c => c.value === v);
        if (!choice) { errors.push(`Invalid option for ${g.label_en || g.id}: ${v}`); continue; }
        valid.push(choice.value);
        surcharge += choice.price_delta_minor || 0;
      }
      normalized[g.id] = valid;
    } else {
      const choice = (g.choices || []).find(c => c.value === raw);
      if (!choice) { errors.push(`Invalid option for ${g.label_en || g.id}: ${raw}`); continue; }
      normalized[g.id] = choice.value;
      surcharge += choice.price_delta_minor || 0;
    }
  }

  return { ok: errors.length === 0, errors, normalized, surcharge_minor: surcharge };
}

/** Returns a human-readable label for a selected options object */
function describeSelected(product, selected) {
  const groups = product?.options?.groups || [];
  const parts = [];
  for (const g of groups) {
    const raw = selected?.[g.id];
    if (raw === undefined || raw === null || raw === '') continue;
    const values = Array.isArray(raw) ? raw : [raw];
    const labels = values.map(v => {
      const c = (g.choices || []).find(c => c.value === v);
      return c ? c.label_en : v;
    });
    parts.push(`${g.label_en}: ${labels.join(', ')}`);
  }
  return parts.join(' · ');
}

/**
 * @param {Array<{id, qty, options?}>} cartItems
 */
function priceCart(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error('Cart is empty');
  }
  const items = [];
  let subtotal = 0;

  // Aggregate qty per product id to validate against stock once
  const qtyByProduct = new Map();
  for (const ci of cartItems) {
    const k = ci.id;
    qtyByProduct.set(k, (qtyByProduct.get(k) || 0) + Math.max(1, Math.min(99, parseInt(ci.qty, 10) || 1)));
  }

  for (const ci of cartItems) {
    const p = byId(ci.id);
    if (!p) throw new Error(`Unknown product: ${ci.id}`);
    if (!p.published) throw new Error(`Product not available: ${p.name}`);

    if (p.track_stock) {
      const requested = qtyByProduct.get(p.id) || 0;
      if (p.stock <= 0) throw new Error(`${p.name} is out of stock`);
      if (requested > p.stock) throw new Error(`${p.name}: only ${p.stock} left in stock`);
    }

    const qty = Math.max(1, Math.min(99, parseInt(ci.qty, 10) || 1));
    const validation = validateSelectedOptions(p, ci.options);
    if (!validation.ok) {
      throw new Error(`${p.name}: ${validation.errors.join('; ')}`);
    }
    const lineUnit = p.price_minor + validation.surcharge_minor;
    subtotal += lineUnit * qty;

    const optionLabel = describeSelected(p, validation.normalized);
    items.push({
      id: p.id,
      name: p.name + (optionLabel ? ` (${optionLabel})` : ''),
      raw_name: p.name,
      qty,
      price_cents: lineUnit,
      selected_options: validation.normalized,
    });
  }

  // Delivery fee: if the cart includes a zone, use the zone's fee; else fall
  // back to the flat default. `cartItems._delivery_zone_id` is set by the
  // server-side checkout handler before calling priceCart (priceCart itself
  // doesn't know about the customer object).
  const zoneId = cartItems._delivery_zone_id || null;
  const delivery = zoneId ? deliveryFeeForZone(zoneId) : currentDeliveryMinor();
  const tax = Math.round(subtotal * currentTaxRate());
  const total = subtotal + delivery + tax;
  return {
    items,
    subtotal_cents: subtotal,
    delivery_cents: delivery,
    tax_cents: tax,
    total_cents: total,
  };
}

module.exports = {
  priceCart,
  validateSelectedOptions,
  describeSelected,
  currentTaxRate,
  currentDeliveryMinor,
  currentDepositPct,
  currentLeadDays,
  currentDeliveryZones,
  deliveryFeeForZone,
  DEFAULT_DELIVERY_ZONES,
};
