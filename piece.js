'use strict';

/* ---------- Шашка ---------- */
class Piece {
  #side;
  #king;

  constructor(side, { king = false } = {}) {
    if (!Object.values(SIDES).includes(side)) throw new Error(`Неизвестная сторона: ${side}`);
    this.#side = side;
    this.#king = Boolean(king);
  }

  get side() { return this.#side; }
  get isKing() { return this.#king; }

  /** Направление хода простой шашки по рядам. */
  get forward() { return this.#side === SIDES.LIGHT ? -1 : 1; }

  /** Ряд, на котором шашка становится дамкой. */
  get promoRow() { return this.#side === SIDES.LIGHT ? 0 : SIZE - 1; }

  promote() { this.#king = true; }

  clone() { return new Piece(this.#side, { king: this.#king }); }
}
