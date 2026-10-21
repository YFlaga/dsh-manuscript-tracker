const s = require('fs').readFileSync('lib/index.js', 'utf8').split('\n');
console.log('=== callLlmText (1971ish) ===');
const i = s.findIndex(l => l.includes('async function callLlmText('));
console.log(s.slice(i, i + 46).map((l, k) => (i + k + 1) + ': ' + l).join('\n'));
