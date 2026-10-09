/* ============================================================
   PRICING CONFIG: the one place prices live. Used by the homepage
   estimate (index.html) and the booking page (book.html), so edit
   these numbers here and both stay in step. All prices whole USD.
   ============================================================ */
const PRICING = {
  base: {
    standard:    { label: "Standard Cleaning",                  price: 90  },
    deep:        { label: "Deep Cleaning",                      price: 150 },
    moveinout:   { label: "Move-In / Move-Out Cleaning",        price: 175 },
    turnover:    { label: "Vacation Rental / Airbnb Turnover",  price: 85  },
    commercial:  { label: "Commercial Cleaning (starting at)",  price: 120 },
  },
  sqftFreeAllowance: 1000,   // sqft included in base price
  sqftRate: 0.05,            // $ per sqft above the allowance
  perBedroom: 15,
  perBathroom: 20,
  addons: {
    pets:    { label: "Pets in home",        price: 15 },
    windows: { label: "Interior windows",    price: 25 },
    dishes:  { label: "Dishes",              price: 10 },
    fridge:  { label: "Fridge (interior)",   price: 20 },
    oven:    { label: "Oven (interior)",     price: 20 },
    laundry: { label: "Laundry (per load)",  price: 10 }, // multiplied by load count
  },
  // Recurring-frequency discount, applied to the full visit price.
  // The more consistent the schedule, the bigger the per-visit discount.
  frequency: {
    once:     { label: "One-time",          discount: 0    },
    monthly:  { label: "Monthly",           discount: 0.05 },
    biweekly: { label: "Every 2 weeks",     discount: 0.10 },
    weekly:   { label: "Weekly",            discount: 0.15 },
  }
};

// Checkbox add-ons, in the order they appear in the estimate breakdown.
const ADDON_KEYS = ['pets','windows','dishes','fridge','oven'];

// o = { type, sqft, beds, baths, frequency, addons: [ADDON_KEYS...], laundry }
// Numbers may be strings straight from form inputs or the URL.
function quote(o){
  const sqft = Math.max(parseInt(o.sqft) || 0, 0);
  const beds = Math.max(parseInt(o.beds) || 0, 0);
  const baths = Math.max(parseInt(o.baths) || 0, 0);
  const laundryLoads = Math.max(parseInt(o.laundry) || 0, 0);

  const svc = PRICING.base[o.type];
  let total = svc.price;
  const lines = [{ label: svc.label, amount: svc.price, kind: 'base' }];

  const extraSqft = Math.max(sqft - PRICING.sqftFreeAllowance, 0);
  if (extraSqft > 0){
    const amt = Math.round(extraSqft * PRICING.sqftRate);
    total += amt;
    lines.push({ label: `+${extraSqft} sqft over ${PRICING.sqftFreeAllowance}`, amount: amt, kind: 'size' });
  }
  if (beds > 0){
    const amt = beds * PRICING.perBedroom;
    total += amt;
    lines.push({ label: `${beds} bedroom${beds>1?'s':''}`, amount: amt, kind: 'size' });
  }
  if (baths > 0){
    const amt = baths * PRICING.perBathroom;
    total += amt;
    lines.push({ label: `${baths} bathroom${baths>1?'s':''}`, amount: amt, kind: 'size' });
  }

  ADDON_KEYS.forEach(key => {
    if ((o.addons || []).includes(key)){
      const a = PRICING.addons[key];
      total += a.price;
      lines.push({ label: a.label, amount: a.price, kind: 'addon' });
    }
  });

  if (laundryLoads > 0){
    const amt = laundryLoads * PRICING.addons.laundry.price;
    total += amt;
    lines.push({ label: `Laundry × ${laundryLoads}`, amount: amt, kind: 'addon' });
  }

  const freq = PRICING.frequency[o.frequency];
  let discountAmt = 0;
  if (freq.discount > 0){
    discountAmt = Math.round(total * freq.discount);
    total -= discountAmt;
    lines.push({ label: `${freq.label} recurring discount`, amount: -discountAmt, kind: 'discount' });
  }

  return { total, lines, type: svc.label, frequency: freq.label };
}

if (typeof module !== 'undefined') module.exports = { PRICING, ADDON_KEYS, quote };
