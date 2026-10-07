'use strict';

/* ---------- Отображение: только DOM и анимации, без правил ---------- */
const NAMES = Object.freeze({ light: 'Джедаи', dark: 'Ситхи' });

const TEXT = Object.freeze({
  motto: { light: 'Да пребудет с тобой Сила', dark: 'Прими тёмную сторону' },
  winTitle: { light: 'Победа Джедаев!', dark: 'Победа Ситхов!' },
  army: { light: 'Джедаев', dark: 'Ситхов' },
  winClosing: { light: 'Да пребудет с вами Сила.', dark: 'Тёмная сторона торжествует.' }
});

const TIMING = Object.freeze({
  MOVE: 320,        // скольжение фишки
  MOVE_END: 340,    // снятие класса .moving
  BOOM_DELAY: 250,  // первый взрыв
  BOOM_STEP: 90,    // пауза между взрывами
  BOOM_LIFE: 650,   // длительность взрыва
  WIN_DELAY: 700    // показ окна победы
});

const EMBLEM = Object.freeze({
  // Упрощённый символ Альянса повстанцев
  light: `<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
    <path d="M50 6 L55 34 L53 60 L58 72 L50 94 L42 72 L47 60 L45 34 Z"/>
    <path d="M36 16 C14 30 10 62 30 82 C38 90 46 93 50 94 C40 86 30 72 30 54 C30 40 34 28 42 20 Z"/>
    <path d="M64 16 C86 30 90 62 70 82 C62 90 54 93 50 94 C60 86 70 72 70 54 C70 40 66 28 58 20 Z"/>
  </svg>`,
  // Упрощённый символ Галактической Империи
  dark: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" aria-hidden="true">
    <circle cx="50" cy="50" r="44" stroke-width="7"/>
    <circle cx="50" cy="50" r="14" stroke-width="7"/>
    <g stroke-width="7">
      <line x1="50" y1="6" x2="50" y2="36"/><line x1="50" y1="64" x2="50" y2="94"/>
      <line x1="12" y1="28" x2="38" y2="43"/><line x1="62" y1="57" x2="88" y2="72"/>
      <line x1="12" y1="72" x2="38" y2="57"/><line x1="62" y1="43" x2="88" y2="28"/>
    </g>
  </svg>`
});

class Renderer {
  static #FILES = 'abcdefgh';

  #game;
  #el;
  #timers = new Set(); // отложенные эффекты: взрывы, окно победы

  /** el — элементы страницы: board, turnText, panelLight, panelDark, capLight, capDark, hint, undoBtn, winOverlay, winTitle, winSub. */
  constructor(game, el) {
    this.#game = game;
    this.#el = el;
  }

  /** Реакция на изменение партии. reset — новая игра или отмена: старые эффекты больше не нужны. */
  update({ anim = null, reset = false } = {}) {
    if (reset) this.#cancelEffects();
    this.#renderBoard();
    if (anim) this.#animate(anim);
    this.#updateHud();
    if (anim && this.#game.isGameOver) this.#later(() => this.#showWin(), TIMING.WIN_DELAY);
  }

  /* ---------- Доска ---------- */
  #renderBoard() {
    const game = this.#game;
    const { selected } = game;
    const targets = selected ? game.movesFor(selected.r, selected.c) : [];
    const mustCapture = game.mustCapture;
    const cells = Array.from({ length: SIZE * SIZE },
      (_, i) => this.#createCell({ r: Math.floor(i / SIZE), c: i % SIZE }, targets, mustCapture));
    this.#el.board.replaceChildren(...cells);
  }

  #createCell(pos, targets, mustCapture) {
    const { r, c } = pos;
    const cell = document.createElement('div');
    cell.className = `cell ${Board.isPlayable(r, c) ? 'dark-sq' : 'light-sq'}`;
    cell.dataset.r = r;
    cell.dataset.c = c;

    if (c === 0) cell.insertAdjacentHTML('beforeend', `<span class="coord rank">${SIZE - r}</span>`);
    if (r === SIZE - 1) cell.insertAdjacentHTML('beforeend', `<span class="coord file">${Renderer.#FILES[c]}</span>`);

    const last = this.#game.lastMove;
    if (last && (samePos(last.from, pos) || samePos(last.to, pos))) cell.classList.add('last');

    const target = targets.find((m) => samePos(m, pos));
    if (target) cell.classList.add('target', ...(target.cap ? ['capture-target'] : []));

    const piece = this.#game.pieceAt(r, c);
    if (piece) cell.appendChild(this.#createPiece(piece, pos, mustCapture));
    return cell;
  }

  #createPiece(piece, pos, mustCapture) {
    const game = this.#game;
    const el = document.createElement('div');
    el.className = `piece ${piece.side}${piece.isKing ? ' king' : ''}`;
    el.innerHTML = EMBLEM[piece.side];
    el.classList.toggle('ghost', game.isCaptured(pos.r, pos.c));
    if (game.isMovable(pos.r, pos.c)) el.classList.add('movable', ...(mustCapture ? ['must'] : []));
    el.classList.toggle('selected', Boolean(game.selected && samePos(game.selected, pos)));
    return el;
  }

  #cellAt(r, c) {
    return this.#el.board.children[r * SIZE + c];
  }

  /* ---------- Анимации ---------- */
  #animate({ from, to, booms }) {
    const pieceEl = this.#cellAt(to.r, to.c).querySelector('.piece');
    if (pieceEl) this.#slide(pieceEl, from, to);
    booms.forEach((b, i) => this.#later(() => this.#explode(b), TIMING.BOOM_DELAY + i * TIMING.BOOM_STEP));
  }

  /** FLIP: ставим фишку на старое место и плавно возвращаем в новое. */
  #slide(pieceEl, from, to) {
    const cellSize = this.#cellAt(0, 0).getBoundingClientRect().width;
    const dx = (from.c - to.c) * cellSize;
    const dy = (from.r - to.r) * cellSize;
    pieceEl.classList.add('moving');
    pieceEl.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      pieceEl.style.transition = `transform ${TIMING.MOVE}ms cubic-bezier(.3,.8,.4,1)`;
      pieceEl.style.transform = '';
      this.#later(() => {
        pieceEl.classList.remove('moving');
        pieceEl.style.transition = '';
      }, TIMING.MOVE_END);
    }));
  }

  #explode({ r, c }) {
    const boom = document.createElement('div');
    boom.className = 'boom';
    this.#cellAt(r, c).appendChild(boom);
    this.#later(() => boom.remove(), TIMING.BOOM_LIFE);
  }

  /** setTimeout, который можно отменить через #cancelEffects. */
  #later(fn, ms) {
    const id = setTimeout(() => {
      this.#timers.delete(id);
      fn();
    }, ms);
    this.#timers.add(id);
  }

  #cancelEffects() {
    this.#timers.forEach(clearTimeout);
    this.#timers.clear();
    this.#el.winOverlay.classList.add('hidden');
  }

  /* ---------- Панель и окно победы ---------- */
  #updateHud() {
    const { turn, isGameOver, capturedCount, canUndo } = this.#game;
    const el = this.#el;
    el.turnText.textContent = `Ход: ${NAMES[turn]}`;
    el.turnText.className = `turn-text ${turn}`;
    el.panelLight.classList.toggle('active', turn === SIDES.LIGHT && !isGameOver);
    el.panelDark.classList.toggle('active', turn === SIDES.DARK && !isGameOver);
    el.capLight.textContent = capturedCount[SIDES.LIGHT];
    el.capDark.textContent = capturedCount[SIDES.DARK];

    const { text, warn } = this.#hint();
    el.hint.textContent = text;
    el.hint.classList.toggle('warn', warn);

    el.undoBtn.disabled = !canUndo;
  }

  #hint() {
    const game = this.#game;
    if (game.isGameOver) return { text: 'Битва окончена', warn: false };
    if (game.inChain) return { text: 'Продолжайте атаку!', warn: true };
    if (game.mustCapture) return { text: 'Обязательное взятие!', warn: true };
    return { text: TEXT.motto[game.turn], warn: false };
  }

  #showWin() {
    const { winner, loser, noPieces } = this.#game.result;
    const { winTitle, winSub, winOverlay } = this.#el;
    winTitle.textContent = TEXT.winTitle[winner];
    winTitle.className = `win-title ${winner}`;
    const reason = noPieces
      ? `Армия ${TEXT.army[loser]} уничтожена. `
      : `${NAMES[loser]} заблокированы и не могут сделать ход. `;
    winSub.textContent = `${reason}${TEXT.winClosing[winner]}`;
    winOverlay.classList.remove('hidden');
  }
}
