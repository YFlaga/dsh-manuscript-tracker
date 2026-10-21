const s = require('fs').readFileSync('lib/index.js', 'utf8').split('\n');
const i = s.findIndex(l => l.includes('async function buildModelGroupsPC('));
console.log(s.slice(i, i + 76).map((l, k) => (i + k + 1) + ': ' + l).join('\n'));
