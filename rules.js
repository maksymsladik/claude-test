'use strict';

/* ---------- Правила русских шашек (без DOM) ---------- */
class Rules {
  #board;

  constructor(board) {
    this.#board = board;
  }

  /** Шаги взятия с учётом правила: дамка обязана встать туда, откуда можно бить дальше. */
  captureMoves(r, c, caps) {
    const piece = this.#board.get(r, c);
    const raw = this.#rawCaptures(r, c, piece, caps);
    if (!piece.isKing) return raw;
    // Группируем по сбиваемой фишке: внутри направления оставляем только «продолжающие» поля, если такие есть
    const groups = new Map();
    for (const m of raw) {
      const key = `${m.cap.r},${m.cap.c}`;
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    return [...groups.values()].flatMap((list) => {
      const cont = list.filter((m) => this.#canContinue({ r, c }, m, piece, [...caps, m.cap]));
      return cont.length ? cont : list;
    });
  }

  /** Тихие ходы (без взятия). */
  simpleMoves(r, c) {
    const piece = this.#board.get(r, c);
    return piece.isKing ? this.#kingSteps(r, c) : this.#manSteps(r, c, piece);
  }

  sideHasCapture(side) {
    return this.#board.piecesOf(side)
      .some(({ r, c }) => this.#rawCaptures(r, c, this.#board.get(r, c), []).length > 0);
  }

  sideHasAnyMove(side) {
    return this.sideHasCapture(side) ||
      this.#board.piecesOf(side).some(({ r, c }) => this.simpleMoves(r, c).length > 0);
  }

  /** Сырые шаги взятия (без фильтра продолжения) с позиции (r,c). */
  #rawCaptures(r, c, piece, caps) {
    return piece.isKing ? this.#kingCaptures(r, c, piece, caps) : this.#manCaptures(r, c, piece, caps);
  }

  #manCaptures(r, c, piece, caps) {
    return DIRS.flatMap(([dr, dc]) => {
      const mid = { r: r + dr, c: c + dc };
      const land = { r: r + 2 * dr, c: c + 2 * dc };
      if (!Board.inside(land.r, land.c)) return [];
      const enemy = this.#board.get(mid.r, mid.c);
      const ok = enemy && enemy.side !== piece.side && !hasPos(caps, mid) && this.#board.isEmpty(land.r, land.c);
      return ok ? [{ ...land, cap: mid }] : [];
    });
  }

  #kingCaptures(r, c, piece, caps) {
    return DIRS.flatMap(([dr, dc]) => {
      const { stop } = this.#ray(r, c, dr, dc);
      if (!stop) return [];
      // Свои фишки и уже сбитые (турецкий удар) перепрыгивать нельзя
      if (this.#board.get(stop.r, stop.c).side === piece.side || hasPos(caps, stop)) return [];
      return this.#ray(stop.r, stop.c, dr, dc).empty.map((land) => ({ ...land, cap: stop }));
    });
  }

  #manSteps(r, c, piece) {
    return DIRS
      .filter(([dr]) => dr === piece.forward)
      .map(([dr, dc]) => ({ r: r + dr, c: c + dc }))
      .filter((to) => Board.inside(to.r, to.c) && this.#board.isEmpty(to.r, to.c));
  }

  #kingSteps(r, c) {
    return DIRS.flatMap(([dr, dc]) => this.#ray(r, c, dr, dc).empty);
  }

  /** Луч от (r,c): подряд идущие пустые поля и первое занятое поле (или null у края). */
  #ray(r, c, dr, dc) {
    const empty = [];
    let cr = r + dr;
    let cc = c + dc;
    while (Board.inside(cr, cc) && this.#board.isEmpty(cr, cc)) {
      empty.push({ r: cr, c: cc });
      cr += dr;
      cc += dc;
    }
    return { empty, stop: Board.inside(cr, cc) ? { r: cr, c: cc } : null };
  }

  /** Может ли фишка продолжить бой, приземлившись на (to) после взятия. */
  #canContinue(from, to, piece, caps) {
    return this.#board.withTemporaryMove(from, to, () => {
      const becomesKing = !piece.isKing && to.r === piece.promoRow;
      const p = becomesKing ? new Piece(piece.side, { king: true }) : piece;
      return this.#rawCaptures(to.r, to.c, p, caps).length > 0;
    });
  }
}
