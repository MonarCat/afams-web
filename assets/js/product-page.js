const P = new URLSearchParams(window.location.search);
const v = P.get('v') || 'rtd';
const f = P.get('f') || 'plain';
const s = P.get('s') || '100g';
const b = P.get('b') || 'SC-001';
const exp = P.get('exp') || 'Dec 2026';
const mfg = P.get('mfg') || 'Jan 2026';

const FLAVOR_ACCENT = { plain: '#C9A020', ginger: '#E07820', lemon: '#A0B808' };
const FLAVOR_LABEL = { plain: 'Plain', ginger: 'Ginger (Tangawizi)', lemon: 'Lemon' };
const VARIETY_LABEL = { rtd: 'Ready to Drink', ordinary: 'Ordinary' };

const INGREDIENTS = {
  plain: 'Black tea, sugar. No artificial flavours or preservatives.',
  ginger: 'Black tea, sugar, ginger extract (Tangawizi). No artificial preservatives.',
  lemon: 'Black tea, sugar, natural lemon flavouring. No artificial preservatives.',
};

const BREW = {
  rtd: [
    'Add 1–2 tsp (5–10g) to your cup.',
    'Pour freshly boiled water.',
    'Stir gently for 10–15 seconds.',
    'Enjoy immediately. No sieving required.',
  ],
  ordinary: [
    'Combine water and milk in a pot (ratio to taste).',
    'Add 1–2 tsp SuChai per cup.',
    'Bring to a gentle boil for 3–5 minutes.',
    'Pour directly into cup. No sieving needed.',
  ],
};

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

setText('badge-variety', VARIETY_LABEL[v] || VARIETY_LABEL.rtd);
setText('badge-flavor', FLAVOR_LABEL[f] || FLAVOR_LABEL.plain);
setText('badge-size', s);
setText('val-batch', b);
setText('val-mfg', mfg);
setText('val-exp', exp);
setText('val-exp2', exp);
setText('val-variety', VARIETY_LABEL[v] || VARIETY_LABEL.rtd);
setText('val-flavor', FLAVOR_LABEL[f] || FLAVOR_LABEL.plain);
setText('val-size', s);
setText('val-ingredients', INGREDIENTS[f] || INGREDIENTS.plain);

const accent = FLAVOR_ACCENT[f] || FLAVOR_ACCENT.plain;
document.getElementById('badge-flavor').style.background = `${accent}22`;
document.getElementById('badge-flavor').style.borderColor = accent;
document.getElementById('badge-size').style.background = `${accent}22`;
document.getElementById('badge-size').style.borderColor = accent;

const yearMatch = exp.match(/\d{4}/);
const currentYear = new Date().getFullYear();
const isGood = !yearMatch || parseInt(yearMatch[0], 10) >= currentYear;
document.getElementById('fresh-dot').style.background = isGood ? '#34C759' : '#F59E0B';
setText('fresh-text', isGood ? 'Good to use' : 'Check before use');

const brewSteps = BREW[v] || BREW.rtd;
document.getElementById('brew-steps').innerHTML = brewSteps
  .map((step, idx) => `<li><span class="num">${idx + 1}</span><span>${step}</span></li>`)
  .join('');
