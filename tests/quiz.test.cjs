const assert = require('node:assert/strict');
const { generateSet, validateQuestion, ranges } = require('../quiz.js');
let seed = 20260928;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
let previous = [];
const reasons = new Set();
const positions = new Set();
for (let run = 0; run < 10000; run++) {
  const set = generateSet(previous, random);
  assert.equal(set.length, 10);
  assert.equal(new Set(set.map(q => q.number)).size, 10);
  set.forEach((q, index) => {
    assert(validateQuestion(q));
    assert(!previous.includes(q.answer));
    assert(q.answer >= ranges[index][0] && q.answer <= ranges[index][1]);
    assert.equal(BigInt(q.answer) ** 2n, BigInt(q.number));
    assert.equal(new Set(q.choices.map(c => c.value)).size, 4);
    assert.equal(q.choices.filter(c => BigInt(c.value) ** 2n === BigInt(q.number)).length, 1);
    const near = q.choices.find(c => c.kind === 'near').value;
    assert.equal(near ** 2 % 10, q.number % 10);
    assert.equal(String(near).length, String(q.answer).length);
    assert(Math.abs(near - q.answer) <= 10);
    q.choices.filter(c => c.kind === 'easy').forEach(c => {
      reasons.add(c.reason);
      if (c.reason === 'units') assert.notEqual(c.value ** 2 % 10, q.number % 10);
      if (c.reason === 'digits') assert.notEqual(String(c.value).length, String(q.answer).length);
      if (c.reason === 'magnitude' || c.reason === 'leading') assert(c.value >= q.answer * 1.5 || c.value <= q.answer * .65);
      if (c.reason === 'leading') {
        assert.equal(String(c.value).length, String(q.answer).length);
        assert.notEqual(String(c.value)[0], String(q.answer)[0]);
      }
    });
    positions.add(q.choices.findIndex(c => c.kind === 'correct'));
  });
  previous = set.map(q => q.answer);
}
assert.equal(reasons.size, 4);
assert.equal(positions.size, 4);
const sample = generateSet([], random)[0];
const mutate = fn => { const q = JSON.parse(JSON.stringify(sample)); fn(q); assert.equal(validateQuestion(q), false); };
mutate(q => { q.choices[1].value = q.choices[0].value; });
mutate(q => { q.number++; });
mutate(q => { q.choices.find(c => c.kind === 'near').value = q.answer * 10; });
mutate(q => { q.choices.find(c => c.kind === 'easy').reason = 'invalid'; });
mutate(q => { q.choices.find(c => c.kind === 'easy').value = -1; });
// Repeated RNG values hit the retry bound rather than hanging or emitting duplicates.
assert.throws(() => generateSet([], () => 0), /生成に失敗/);
let draws = 0;
const retrySet = generateSet([32], () => draws++ < 5 ? 0 : random());
assert(!retrySet.some(q => q.answer === 32));
assert(draws > 5);
console.log('PASS: 100,000 questions, uniqueness, digit progression, all distractor types, shuffle positions, validation rejection, retry and retry limit.');
