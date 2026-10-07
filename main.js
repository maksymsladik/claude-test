'use strict';

/* ---------- Запуск: связываем доску, правила, партию и отображение ---------- */
const INTRO_MS = 30000; // интро скрывается само через 30 секунд

function main() {
  const $ = (id) => document.getElementById(id);

  const board = new Board();
  const game = new Game(board, new Rules(board));
  const view = new Renderer(game, {
    board: $('board'),
    turnText: $('turnText'),
    panelLight: $('panelLight'),
    panelDark: $('panelDark'),
    capLight: $('capLight'),
    capDark: $('capDark'),
    hint: $('hint'),
    undoBtn: $('undoBtn'),
    winOverlay: $('winOverlay'),
    winTitle: $('winTitle'),
    winSub: $('winSub')
  });
  game.onChange((change) => view.update(change));

  // Один обработчик на всю доску: клики по игровым (тёмным) полям
  $('board').addEventListener('click', (e) => {
    const cell = e.target.closest('.dark-sq');
    if (cell) game.chooseSquare(Number(cell.dataset.r), Number(cell.dataset.c));
  });
  $('newBtn').addEventListener('click', () => game.newGame());
  $('againBtn').addEventListener('click', () => game.newGame());
  $('undoBtn').addEventListener('click', () => game.undo());

  const intro = $('intro');
  const hideIntro = () => intro.classList.add('gone');
  $('skipIntro').addEventListener('click', hideIntro);
  intro.addEventListener('click', hideIntro);
  setTimeout(hideIntro, INTRO_MS);

  game.newGame();
}

main();
