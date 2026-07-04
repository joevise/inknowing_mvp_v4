const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function flatten(obj, prefix = '') {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, fullKey));
    } else {
      out[fullKey] = typeof v;
    }
  }
  return out;
}

const zh = JSON.parse(fs.readFileSync(path.join(root, 'messages/zh.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'messages/en.json'), 'utf8'));

const zhKeys = Object.keys(flatten(zh));
const enKeys = Object.keys(flatten(en));

const zhSet = new Set(zhKeys);
const enSet = new Set(enKeys);

const onlyInZh = zhKeys.filter(k => !enSet.has(k));
const onlyInEn = enKeys.filter(k => !zhSet.has(k));

console.log(`zh keys: ${zhKeys.length}`);
console.log(`en keys: ${enKeys.length}`);
console.log(`only-in-zh (${onlyInZh.length}):`, onlyInZh);
console.log(`only-in-en (${onlyInEn.length}):`, onlyInEn);

if (onlyInZh.length > 0 || onlyInEn.length > 0) {
  process.exit(1);
}
console.log('\nPASS: zh and en key sets are identical.');
