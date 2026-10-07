'use strict';

/* ---------- Партия: очередь хода, серия взятий, отмена, конец игры ---------- */
class Game {
  #board;
  #rules;
  #listeners = new Set();
  #turn;
  #selected;      // {r, c}
  #chain;         // {r, c} — фишка в середине серии взятий
  #captured;      // [{r, c}] — сбитые в текущей серии (снимаются в конце)
  #history;       // снимки на начало каждого хода
  #lastMove;
  #capturedCount;
  #result;        // {winner, loser, noPieces} или null

  constructor(board, rules) {
    this.#board = board;
    this.#rules = rules;
    this.#reset();
  }

  /* ---------- Чтение состояния ---------- */
  get turn() { return this.#turn; }
  get selected() { return this.#selected && { ...this.#selected }; }
  get lastMove() { return this.#lastMove; }
  get capturedCount() { return { ...this.#capturedCount }; }
  get inChain() { return this.#chain !== null; }
  get isGameOver() { return this.#result !== null; }
  get result() { return this.#result && { ...this.#result }; }
  get canUndo() { return this.#history.length > 0; }
  get mustCapture() { return this.inChain || this.#rules.sideHasCapture(this.#turn); }

  pieceAt(r, c) { return this.#board.get(r, c); }
  isCaptured(r, c) { return hasPos(this.#captured, { r, c }); }
  isMovable(r, c) { return !this.isGameOver && this.movesFor(r, c).length > 0; }

  /** Все допустимые ходы для фишки на (r,c) в текущем состоянии. */
  movesFor(r, c) {
    const piece = this.#board.get(r, c);
    if (!piece || piece.side !== this.#turn) return [];
    if (this.#chain) {
      return samePos(this.#chain, { r, c }) ? this.#rules.captureMoves(r, c, this.#captured) : [];
    }
    if (this.#rules.sideHasCapture(this.#turn)) return this.#rules.captureMoves(r, c, []);
    return this.#rules.simpleMoves(r, c);
  }

  /* ---------- Действия ---------- */
  /** Подписка на изменения (Observer). Слушатель получает {anim, reset}. */
  onChange(fn) { this.#listeners.add(fn); }

  newGame() {
    this.#reset();
    this.#emit({ reset: true });
  }

  /** Игрок выбрал поле: ход выбранной фишкой или выбор/снятие выбора фишки. */
  chooseSquare(r, c) {
    if (this.isGameOver) return;
    const pos = { r, c };
    if (this.#selected && hasPos(this.movesFor(this.#selected.r, this.#selected.c), pos)) {
      this.makeMove(this.#selected, pos);
      return;
    }
    if (this.#chain) return; // во время серии выбрать другую фишку нельзя

    const reselect = this.#selected && samePos(this.#selected, pos);
    this.#selected = this.movesFor(r, c).length && !reselect ? pos : null;
    this.#emit();
  }

  /** Один шаг хода (при взятии — один прыжок серии). */
  makeMove(from, to) {
    const move = this.movesFor(from.r, from.c).find((m) => samePos(m, to));
    if (!move) throw new Error(`Недопустимый ход: ${from.r},${from.c} → ${to.r},${to.c}`);
    if (!this.#chain) this.#history.push(this.#snapshot());

    const piece = this.#board.get(from.r, from.c);
    const dest = { r: move.r, c: move.c };
    this.#board.remove(from.r, from.c);
    this.#board.set(dest.r, dest.c, piece);
    const promoted = !piece.isKing && dest.r === piece.promoRow;
    if (promoted) piece.promote();
    this.#lastMove = { from: { ...from }, to: dest };

    if (move.cap) {
      this.#captured.push(move.cap);
      if (this.#rules.captureMoves(dest.r, dest.c, this.#captured).length) {
        // Серия продолжается той же фишкой
        this.#chain = dest;
        this.#selected = dest;
        this.#emit({ anim: { from, to: dest, booms: [], promoted } });
        return;
      }
    }

    const booms = this.#removeCaptured();
    this.#passTurn();
    this.#emit({ anim: { from, to: dest, booms, promoted } });
  }

  /** Отменяет весь последний ход (вместе с серией взятий). */
  undo() {
    if (!this.canUndo) return;
    const s = this.#history.pop();
    this.#board.restore(s.board);
    this.#turn = s.turn;
    this.#lastMove = s.lastMove;
    this.#capturedCount = s.capturedCount;
    this.#chain = null;
    this.#captured = [];
    this.#selected = null;
    this.#result = null;
    this.#emit({ reset: true });
  }

  /* ---------- Внутреннее ---------- */
  #reset() {
    this.#board.restore(Board.initial());
    this.#turn = SIDES.LIGHT;
    this.#selected = null;
    this.#chain = null;
    this.#captured = [];
    this.#history = [];
    this.#lastMove = null;
    this.#capturedCount = { [SIDES.LIGHT]: 0, [SIDES.DARK]: 0 };
    this.#result = null;
  }

  /** Конец серии — снимаем сбитые фишки. */
  #removeCaptured() {
    const removed = this.#captured;
    removed.forEach(({ r, c }) => this.#board.remove(r, c));
    this.#capturedCount[this.#turn] += removed.length;
    this.#captured = [];
    return removed;
  }

  #passTurn() {
    this.#chain = null;
    this.#selected = null;
    this.#turn = opposite(this.#turn);
    // Сторона без фишек или без ходов проигрывает
    if (this.#rules.sideHasAnyMove(this.#turn)) return;
    this.#result = {
      winner: opposite(this.#turn),
      loser: this.#turn,
      noPieces: this.#board.piecesOf(this.#turn).length === 0
    };
  }

  /** Снимок на начало хода (Memento). */
  #snapshot() {
    return {
      board: this.#board.clone(),
      turn: this.#turn,
      lastMove: this.#lastMove,
      capturedCount: { ...this.#capturedCount }
    };
  }

  #emit({ anim = null, reset = false } = {}) {
    this.#listeners.forEach((fn) => fn({ anim, reset }));
  }
}
