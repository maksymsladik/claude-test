'use strict';

/* ---------- Доска 8×8 ---------- */
class Board {
  #cells = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  static inside(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  static isPlayable(r, c) { return (r + c) % 2 === 1; }

  /** Начальная расстановка. */
  static initial() {
    const board = new Board();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!Board.isPlayable(r, c)) continue;
        if (r < PIECE_ROWS) board.set(r, c, new Piece(SIDES.DARK));
        else if (r >= SIZE - PIECE_ROWS) board.set(r, c, new Piece(SIDES.LIGHT));
      }
    }
    return board;
  }

  get(r, c) {
    Board.#check(r, c);
    return this.#cells[r][c];
  }

  set(r, c, piece) {
    Board.#check(r, c);
    if (!(piece instanceof Piece)) throw new Error(`Ожидалась шашка, получено: ${piece}`);
    this.#cells[r][c] = piece;
  }

  remove(r, c) {
    Board.#check(r, c);
    this.#cells[r][c] = null;
  }

  isEmpty(r, c) { return this.get(r, c) === null; }

  /** Координаты всех шашек стороны. */
  piecesOf(side) {
    return this.#cells.flatMap((row, r) =>
      row.flatMap((p, c) => (p && p.side === side ? [{ r, c }] : [])));
  }

  clone() {
    const copy = new Board();
    copy.restore(this);
    return copy;
  }

  /** Заменяет содержимое глубокой копией другой доски. */
  restore(other) {
    this.#cells = other.#cells.map((row) => row.map((p) => p && p.clone()));
  }

  /** Временно переносит шашку from → to, вызывает fn и возвращает доску как было. */
  withTemporaryMove(from, to, fn) {
    const piece = this.get(from.r, from.c);
    this.remove(from.r, from.c);
    this.set(to.r, to.c, piece);
    try {
      return fn();
    } finally {
      this.remove(to.r, to.c);
      this.set(from.r, from.c, piece);
    }
  }

  static #check(r, c) {
    if (!Board.inside(r, c)) throw new Error(`Клетка вне доски: ${r},${c}`);
  }
}
