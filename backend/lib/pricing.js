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

  const delivery = currentDeliveryMinor();
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
};
