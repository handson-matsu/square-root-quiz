/* Integer-only question generation. Also exported for dependency-free Node tests. */
(function (root) {
  'use strict';
  const ranges = [[32, 99], [32, 99], [100, 999], [100, 999], [100, 999],
    [1000, 9999], [1000, 9999], [1000, 9999], [10000, 99999], [10000, 99999]];
  const integer = (min, max, random) => min + Math.floor(random() * (max - min + 1));
  const pick = (items, random) => items[integer(0, items.length - 1, random)];
  const digits = n => String(n).length;
  const unitSquare = n => (n % 10) ** 2 % 10;
  function shuffle(items, random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = integer(0, i, random);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  // Generous separation: at least 1.5 times, or at most 0.65 times, the root.
  function obviousReasons(value, answer) {
    const reasons = [];
    if (unitSquare(value) !== unitSquare(answer)) reasons.push('units');
    if (digits(value) !== digits(answer)) reasons.push('digits');
    if (value * 2 >= answer * 3 || value * 100 <= answer * 65) {
      reasons.push('magnitude');
      if (digits(value) === digits(answer) && String(value)[0] !== String(answer)[0]) reasons.push('leading');
    }
    return reasons;
  }
  function validateQuestion(question) {
    const { answer, number, choices } = question;
    if (!Number.isSafeInteger(answer) || answer <= 0 || !Number.isSafeInteger(number) || answer * answer !== number) return false;
    if (choices.length !== 4 || new Set(choices.map(c => c.value)).size !== 4) return false;
    if (!choices.every(c => Number.isSafeInteger(c.value) && c.value > 0 && Number.isSafeInteger(c.value * c.value))) return false;
    if (choices.filter(c => c.value * c.value === number).length !== 1) return false;
    const correct = choices.filter(c => c.kind === 'correct');
    const near = choices.filter(c => c.kind === 'near');
    const easy = choices.filter(c => c.kind === 'easy');
    if (correct.length !== 1 || correct[0].value !== answer || near.length !== 1 || easy.length !== 2) return false;
    if (choices.some(c => c.kind !== 'correct' && (c.value === answer || c.value * c.value === number))) return false;
    if (Math.abs(near[0].value - answer) > 10 || Math.abs(near[0].value - answer) * 5 > answer || obviousReasons(near[0].value, answer).length) return false;
    return easy.every(c => obviousReasons(c.value, answer).includes(c.reason));
  }
  function buildQuestion(answer, random) {
    const nearby = [];
    const wrongUnits = [];
    for (let value = Math.max(1, answer - 10); value <= answer + 10; value++) {
      if (value === answer || digits(value) !== digits(answer)) continue;
      if (unitSquare(value) === unitSquare(answer) && Math.abs(value - answer) * 5 <= answer) nearby.push(value);
      if (Math.abs(value - answer) <= 4 && unitSquare(value) !== unitSquare(answer)) wrongUnits.push(value);
    }
    if (!nearby.length || !wrongUnits.length) return null;
    // Choose the closest alternative with a compatible squared last digit.
    const distance = Math.min(...nearby.map(value => Math.abs(value - answer)));
    const near = pick(nearby.filter(value => Math.abs(value - answer) === distance), random);
    const reason = pick(['digits', 'magnitude', 'leading'], random);
    const far = [];
    if (reason === 'digits') {
      far.push(answer * 10 + answer % 10);
    } else {
      // Compatible last digits make magnitude/leading digits the useful clue here.
      for (const percent of [40, 50, 60, 160, 180, 200]) {
        const center = Math.floor(answer * percent / 100);
        for (let value = Math.max(1, center - 5); value <= center + 5; value++) {
          if (unitSquare(value) === unitSquare(answer) && obviousReasons(value, answer).includes(reason)) far.push(value);
        }
      }
    }
    if (!far.length) return null;
    return { answer, number: answer * answer, choices: shuffle([
      { value: answer, kind: 'correct' },
      { value: near, kind: 'near' },
      { value: pick(wrongUnits, random), kind: 'easy', reason: 'units' },
      { value: pick(far, random), kind: 'easy', reason }
    ], random) };
  }
  function generateSet(previousAnswers = [], random = Math.random) {
    const used = new Set(previousAnswers);
    return ranges.map(([min, max]) => {
      for (let attempt = 0; attempt < 2000; attempt++) {
        const answer = integer(min, max, random);
        if (used.has(answer)) continue;
        const question = buildQuestion(answer, random);
        if (!question || !validateQuestion(question)) continue;
        used.add(answer);
        return question;
      }
      throw new Error('問題の生成に失敗しました。もう一度お試しください。');
    });
  }
  const api = { generateSet, validateQuestion, obviousReasons, ranges };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SquareRootQuiz = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
