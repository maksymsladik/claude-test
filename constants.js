'use strict';

/* =========================================================
   Звёздные шашки — русские шашки для двух игроков (hot-seat)
   light = Джедаи (снизу, ходят первыми), dark = Ситхи (сверху)
   ========================================================= */

/* ---------- Общие константы и помощники ---------- */
const SIZE = 8;
const PIECE_ROWS = 3; // рядов с шашками у каждой стороны в начале
const SIDES = Object.freeze({ LIGHT: 'light', DARK: 'dark' });
const DIRS = Object.freeze([[-1, -1], [-1, 1], [1, -1], [1, 1]]);

const opposite = (side) => (side === SIDES.LIGHT ? SIDES.DARK : SIDES.LIGHT);
const samePos = (a, b) => a.r === b.r && a.c === b.c;
const hasPos = (list, pos) => list.some((p) => samePos(p, pos));
