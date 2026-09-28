'use strict';
const $ = id => document.getElementById(id);
let questions = [];
let index = 0;
let score = 0;
let answered = false;

function renderQuestion(focus = true) {
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
    button.addEventListener('click', () => answerQuestion(choice.value));
    return button;
  }));
  if (focus) $('problem').focus();
}

function answerQuestion(value) {
  if (answered) return;
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
  try {
    // Avoid repeats from the immediately preceding set, too. No persistent history.
    questions = SquareRootQuiz.generateSet(questions.map(q => q.answer));
  } catch (error) {
    $('feedback').textContent = error.message;
    return;
  }
  index = 0;
  score = 0;
  $('result').hidden = true;
  $('quiz').hidden = false;
  renderQuestion(focus);
}

$('next').addEventListener('click', () => {
  if (!answered) return;
  index++;
  if (index < questions.length) renderQuestion();
  else {
    $('quiz').hidden = true;
    $('result').hidden = false;
    $('score').textContent = score;
    $('result-title').focus();
  }
});
$('restart').addEventListener('click', () => start());
start(false);
