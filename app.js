'use strict';
const $ = id => document.getElementById(id);
let questions = [];
let index = 0;
let score = 0;
let answered = false;
const QUESTION_SECONDS = 30;
let timerId = null;
let deadline = 0;

function stopTimer() {
  if (timerId !== null) clearInterval(timerId);
  timerId = null;
}

function updateTimer() {
  if (answered || $('quiz').hidden) return;
  // Use elapsed time so background-tab throttling cannot extend the deadline.
  const remaining = Math.max(0, deadline - Date.now());
  // Round up to a tenth so 0.0 is shown only once the full 30 seconds elapse.
  $('seconds').textContent = (Math.ceil(remaining / 100) / 10).toFixed(1);
  $('timer').classList.toggle('is-low', remaining <= 5000);
  if (remaining === 0) timeOut();
}

function startTimer() {
  stopTimer();
  deadline = Date.now() + QUESTION_SECONDS * 1000;
  $('seconds').textContent = QUESTION_SECONDS.toFixed(1);
  $('timer').classList.remove('is-low');
  timerId = setInterval(updateTimer, 100);
}

function timeOut() {
  if (answered) return;
  $('seconds').textContent = '0.0';
  $('timer').classList.add('is-low');
  // Reuse the existing incorrect-answer flow, without adding any score.
  answerQuestion(null);
  $('feedback').textContent = `時間切れ！　正解は ${questions[index].answer}`;
}

function submitAnswer(value) {
  if (answered) return;
  if (Date.now() >= deadline) timeOut();
  else answerQuestion(value);
}

function showStart(focus = true) {
  stopTimer();
  $('quiz').hidden = true;
  $('result').hidden = true;
  $('start-screen').hidden = false;
  $('start-error').hidden = true;
  if (focus) $('start').focus();
}

function renderQuestion(focus = true) {
  stopTimer();
  answered = false;
  const question = questions[index];
  $('counter').textContent = `${index + 1} / 10`;
  $('radicand').textContent = question.number;
  $('problem').setAttribute('aria-label', `${question.number}の正の平方根は？`);
  $('feedback').textContent = '';
  $('feedback').className = '';
  $('next').hidden = true;
  $('next').innerHTML = `${index === 9 ? '結果を見る' : '次の問題'} <span aria-hidden="true">→</span>`;
  $('progress').replaceChildren(...questions.map((_, i) => {
    const segment = document.createElement('span');
    segment.className = i < index ? 'complete' : i === index ? 'current' : '';
    return segment;
  }));
  $('choices').replaceChildren(...question.choices.map(choice => {
    const button = document.createElement('button');
    button.className = 'choice';
    button.textContent = choice.value;
    button.addEventListener('click', () => submitAnswer(choice.value));
    return button;
  }));
  if (focus) $('problem').focus();
  startTimer();
}

function answerQuestion(value) {
  if (answered) return;
  stopTimer();
  answered = true;
  const question = questions[index];
  const correct = value === question.answer;
  if (correct) score++;
  [...$('choices').children].forEach((button, i) => {
    const option = question.choices[i].value;
    button.disabled = true;
    if (option === question.answer || option === value) {
      const isCorrect = option === question.answer;
      button.classList.add(isCorrect ? 'correct' : 'wrong');
      button.setAttribute('aria-label', `${option}、${isCorrect ? '正解' : '不正解'}`);
      const symbol = document.createElement('span');
      symbol.className = 'choice-symbol';
      symbol.setAttribute('aria-hidden', 'true');
      symbol.textContent = isCorrect ? '○' : '×';
      button.append(symbol);
    }
  });
  $('feedback').className = correct ? 'correct' : 'wrong';
  $('feedback').textContent = correct ? '○ 正解！' : `× 不正解　正解は ${question.answer}`;
  $('next').hidden = false;
  $('next').focus();
}

function start(focus = true) {
  if ($('start-screen').hidden) return;
  try {
    // Avoid repeats from the immediately preceding set, too. No persistent history.
    questions = SquareRootQuiz.generateSet(questions.map(q => q.answer));
  } catch (error) {
    $('start-error').textContent = error.message;
    $('start-error').hidden = false;
    return;
  }
  index = 0;
  score = 0;
  $('start-screen').hidden = true;
  $('result').hidden = true;
  $('quiz').hidden = false;
  renderQuestion(focus);
}

$('next').addEventListener('click', () => {
  if (!answered) return;
  index++;
  if (index < questions.length) renderQuestion();
  else {
    stopTimer();
    $('quiz').hidden = true;
    $('result').hidden = false;
    $('score').textContent = score;
    $('result-title').focus();
  }
});
$('start').addEventListener('click', () => start());
$('restart').addEventListener('click', () => showStart());
document.addEventListener('visibilitychange', () => {
  if (timerId !== null) updateTimer();
});
showStart(false);

// Record one visit per page load without waiting for the response or retrying.
try {
  fetch('https://script.google.com/macros/s/AKfycbxssCIHsD-N97SHxNC_GN0ihYeC0qy-lb-EY0KmSs6Gnztaph1sITMerLVEnNWOGkYc/exec?app=square-root-quiz', {
    method: 'GET',
    mode: 'no-cors',
    cache: 'no-store',
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
} catch {
  // Access logging must never interrupt the game.
}
