const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const generator = require('../quiz.js');

// A controllable clock checks 30-second boundaries without real-time sleeps.
function setup(fetchMode = 'success') {
  let now = 0;
  let nextId = 0;
  let generated = 0;
  let latest = [];
  const intervals = new Map();
  const requests = [];
  class Element {
    constructor() {
      this.hidden = false;
      this.children = [];
      this.events = {};
      this.textContent = '';
      const classes = new Set();
      this.classList = {
        add: name => classes.add(name), remove: name => classes.delete(name),
        toggle: (name, on) => on ? classes.add(name) : classes.delete(name)
      };
    }
    addEventListener(name, fn) { this.events[name] = fn; }
    setAttribute() {}
    focus() {}
    append(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    click() { if (!this.disabled) this.events.click?.(); }
  }
  const elements = {};
  const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    elements[match[1]] = new Element();
    elements[match[1]].hidden = /\bhidden\b/.test(match[0]);
  }
  const events = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), {
    document: {
      getElementById: id => { assert(elements[id], `Missing element ${id}`); return elements[id]; },
      createElement: () => new Element(),
      addEventListener: (name, fn) => { events[name] = fn; }
    },
    Date: { now: () => now },
    fetch: (url, options) => {
      requests.push({ url, options: { ...options } });
      if (fetchMode === 'throw') throw new Error('Network unavailable');
      if (fetchMode === 'reject') return Promise.reject(new Error('Network unavailable'));
      return Promise.resolve({});
    },
    setInterval: (fn, delay) => { assert.equal(delay, 100); intervals.set(++nextId, fn); return nextId; },
    clearInterval: id => intervals.delete(id),
    SquareRootQuiz: { generateSet: previous => { generated++; latest = generator.generateSet(previous); return latest; } }
  });
  return {
    elements, intervals, events, requests,
    get generated() { return generated; }, get questions() { return latest; },
    advance(ms, runCallbacks = true) { now += ms; if (runCallbacks) [...intervals.values()].forEach(fn => fn()); },
    choose(question, correct = true) {
      const i = latest[question].choices.findIndex(c => (c.value === latest[question].answer) === correct);
      elements.choices.children[i].click();
    }
  };
}

const game = setup();
const el = game.elements;
assert(!el['start-screen'].hidden);
assert(el.quiz.hidden);
assert.equal(game.generated, 0);
assert.equal(game.requests.length, 1);
assert.equal(game.requests[0].url, 'https://script.google.com/macros/s/AKfycbxssCIHsD-N97SHxNC_GN0ihYeC0qy-lb-EY0KmSs6Gnztaph1sITMerLVEnNWOGkYc/exec?app=square-root-quiz');
assert.deepEqual(game.requests[0].options, {
  method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit', keepalive: true
});
game.advance(60000);
assert.equal(game.intervals.size, 0);
el.start.click();
assert(el['start-screen'].hidden);
assert(!el.quiz.hidden);
assert.equal(game.generated, 1);
assert.equal(el.seconds.textContent, '30.0');
assert.equal(game.intervals.size, 1);
game.advance(100);
assert.equal(el.seconds.textContent, '29.9');
game.advance(100);
assert.equal(el.seconds.textContent, '29.8');
// Skip callbacks: the display must catch up from elapsed time, not tick count.
game.advance(1037);
assert.equal(el.seconds.textContent, '28.8');
game.advance(28762);
assert.equal(el.seconds.textContent, '0.1');
assert.equal(el.feedback.textContent, '');
game.advance(1);
assert.equal(el.seconds.textContent, '0.0');
assert.match(el.feedback.textContent, /^時間切れ！　正解は \d+$/);
assert(el.choices.children.every(button => button.disabled));
assert.equal(game.intervals.size, 0);
game.choose(0);
assert.match(el.feedback.textContent, /^時間切れ！/);
game.advance(60000);
assert.equal(el.seconds.textContent, '0.0');
el.next.click();
assert.equal(el.seconds.textContent, '30.0');
game.advance(2300);
assert.equal(el.seconds.textContent, '27.7');
// Answer between refreshes: preserve the time that was actually displayed.
game.advance(37, false);
game.choose(1, false);
assert.match(el.feedback.textContent, /^× 不正解/);
assert.equal(game.intervals.size, 0);
game.advance(60000);
assert.equal(el.seconds.textContent, '27.7');
el.next.click();
for (let i = 2; i < 10; i++) {
  assert.equal(el.seconds.textContent, '30.0');
  assert.equal(game.intervals.size, 1);
  game.choose(i);
  assert.equal(el.feedback.textContent, '○ 正解！');
  assert.equal(game.intervals.size, 0);
  el.next.click();
}
assert(!el.result.hidden);
assert(el.quiz.hidden);
assert.equal(Number(el.score.textContent), 8);
const previous = game.questions.map(q => q.number);
el.restart.click();
assert(!el['start-screen'].hidden);
assert(el.result.hidden);
assert.equal(game.generated, 1);
assert.equal(game.intervals.size, 0);
el.start.click();
assert.equal(game.generated, 2);
assert.equal(game.requests.length, 1, 'Starting, advancing and replaying must not send more requests');
assert(!game.questions.some(q => previous.includes(q.number)));
assert.equal(el.seconds.textContent, '30.0');

// A delayed interval must not allow a correct answer after the deadline.
const delayed = setup();
delayed.elements.start.click();
delayed.advance(30000, false);
delayed.choose(0);
assert.match(delayed.elements.feedback.textContent, /^時間切れ！/);
assert.equal(delayed.intervals.size, 0);

// Returning from a background tab reconciles the timer with elapsed time.
const background = setup();
background.elements.start.click();
background.advance(45000, false);
background.events.visibilitychange();
assert.match(background.elements.feedback.textContent, /^時間切れ！/);
assert.equal(background.intervals.size, 0);
// Check every tenth, including floating-point-sensitive rounding boundaries.
const tenths = setup();
tenths.elements.start.click();
for (let tick = 1; tick <= 300; tick++) {
  tenths.advance(100);
  assert.equal(tenths.elements.seconds.textContent, ((300 - tick) / 10).toFixed(1));
  if (tick < 300) assert.equal(tenths.elements.feedback.textContent, '');
}
assert.match(tenths.elements.feedback.textContent, /^時間切れ！/);
assert.equal(tenths.intervals.size, 0);
for (const mode of ['throw', 'reject']) {
  const failed = setup(mode);
  assert(!failed.elements['start-screen'].hidden);
  failed.elements.start.click();
  failed.choose(0);
  assert.equal(failed.elements.feedback.textContent, '○ 正解！');
  assert.equal(failed.requests.length, 1);
}
assert.equal(setup().requests.length, 1, 'A new page load sends one new request');
console.log('PASS: one access request per page load, matching fetch settings, no interaction requests, network failure isolation.');
console.log('PASS: tenth-second display, exact 30-second boundary, start/restart, countdown, timeout, answer lock, stop/reset, 8/10 scoring, delayed callbacks and background tab.');
