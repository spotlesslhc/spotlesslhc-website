// Proves the homepage estimate is unchanged by the move to /pricing.js.
// Runs the OLD inline PRICING + calculate() from git (commit before the move)
// and the NEW index.html calculate() + pricing.js, over a grid of inputs,
// and asserts identical totals, breakdown lines and labels.
// Run from the repo root:  node tools/pricing-equality.mjs [oldRef]
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const OLD_REF = process.argv[2] || 'bde5834';
const grab = (src, start, end) => {
  const a = src.indexOf(start); const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('could not find ' + start);
  return src.slice(a, b + end.length);
};

const oldHtml = execSync(`git show ${OLD_REF}:index.html`).toString().replace(/\r\n/g, '\n');
const newHtml = readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
const oldCode = grab(oldHtml, 'const PRICING = {', '\n};\n') + grab(oldHtml, 'function calculate(){', '\n}\n');
const newCode = readFileSync('pricing.js', 'utf8') + '\n' + grab(newHtml, 'function calculate(){', '\n}\n');

// A fake page: $('qType') etc. return the input values; querySelector('[name=pets]') returns a checkbox.
function sandbox(code){
  const ctx = { input: {}, laundryLoads: 0, module: undefined };
  ctx.$ = (id) => ({ value: ctx.input[id] });
  ctx.document = { querySelector: (sel) => ({ checked: ctx.input.addons.includes(sel.match(/name=(\w+)/)[1]) }) };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.calculate = calculate;', ctx);
  return (input) => { ctx.input = input; ctx.laundryLoads = input.laundry; return JSON.parse(JSON.stringify(ctx.calculate())); };
}
const oldCalc = sandbox(oldCode), newCalc = sandbox(newCode);

const types = ['standard', 'deep', 'moveinout', 'commercial', 'turnover'];
const sqfts = ['', 'abc', '0', '100', '999', '1000', '1001', '1010', '1500', '1525', '2750', '4999', '-50', '1500.7'];
const beds = ['', '0', '1', '2', '3', '5', '12'];
const baths = ['', '0', '1', '2', '4', '12'];
const freqs = ['once', 'monthly', 'biweekly', 'weekly'];
const keys = ['pets', 'windows', 'dishes', 'fridge', 'oven'];
const addonSets = [...Array(32).keys()].map(m => keys.filter((_, i) => m & (1 << i)));
const laundry = [0, 1, 3, 10];

let n = 0;
for (const qType of types) for (const qSqft of sqfts) for (const qBeds of beds) for (const qBaths of baths)
for (const qFreq of freqs) for (const addons of addonSets) for (const l of laundry) {
  const input = { qType, qSqft, qBeds, qBaths, qFreq, addons, laundry: l };
  assert.deepEqual(newCalc(input), oldCalc(input), JSON.stringify(input));
  n++;
}
console.log(`OK: ${n} input combinations, old (${OLD_REF}) and new homepage estimates identical.`);
