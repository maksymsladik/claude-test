# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Звёздные шашки" — Russian draughts (русские шашки) for two players on one computer (hot-seat), styled after Star Wars. Plain HTML/CSS/JS: no build step, no dependencies, no package.json. All UI text and code comments are in Russian — keep it that way.

## Running

Open `index.html` directly in a browser (`open index.html` on macOS). The only external resource is the Orbitron font from Google Fonts; without network it falls back to a system font.

There is no test suite or linter. To check rule logic headlessly, concatenate `constants.js piece.js board.js rules.js game.js` and append test code; run it in Node. These files don't touch the DOM, so no stubs are needed. Create `const board = new Board(); const game = new Game(board, new Rules(board));`. Clear the squares with `board.remove(r, c)` and place pieces with `board.set(r, c, new Piece(side, { king }))`. Then call `game.movesFor` / `game.makeMove(from, to)`. `makeMove` throws on an illegal move.

Code style is defined by the `js-style` skill (`.claude/skills/js-style/SKILL.md`): ES6+ classes with private `#fields` and getters/setters, `const` by default, no ES modules (the page must work from `file://`).

## Architecture

Scripts are plain `<script>` tags loaded in this order (they share the global scope): `constants.js` → `piece.js` → `board.js` → `rules.js` → `game.js` → `renderer.js` → `main.js`.

- **`constants.js`**: `SIZE`, `PIECE_ROWS`, `SIDES`, `DIRS`, and the helpers `opposite`, `samePos`, `hasPos`.
- **Sides**: `light` = Джедаи (bottom rows 5–7, moves first, `Piece#forward` is -1), `dark` = Ситхи (top rows 0–2). Playable squares are those where `Board.isPlayable(r, c)`, i.e. `(r + c) % 2 === 1`.
- **`Piece`** (`piece.js`): side, `isKing`, `forward`, `promoRow`, `promote()`, `clone()`.
- **`Board`** (`board.js`): private 8×8 cells.
  - Access through `get`/`set`/`remove`, which throw outside the board.
  - Also provides `Board.initial()`, `piecesOf(side)`, and `clone()`/`restore(other)` for undo snapshots.
  - `withTemporaryMove(from, to, fn)` moves a piece temporarily and restores the board in `try/finally`.
- **`Rules`** (`rules.js`): no DOM.
  - `#rawCaptures` produces single capture steps (`#manCaptures` / `#kingCaptures`). Men capture in all four directions; kings capture at any distance (`#ray`).
  - `captureMoves` adds the Russian rule: a king must land on a square from which it can keep capturing, if such a square exists (`#canContinue` uses `withTemporaryMove`).
  - Also provides `simpleMoves`, `sideHasCapture`, `sideHasAnyMove`.
- **`Game`** (`game.js`): all game state is in private fields: turn, selection, `#chain` (the piece in the middle of a multi-capture), `#captured`, history, `#result`.
  - `movesFor(r, c)` is the single source of legal moves. It locks input to the chain during a capture series and enforces mandatory capture.
  - `chooseSquare(r, c)` handles a click.
  - `onChange(fn)` is an Observer. It emits `{anim, reset}`, where `reset` is true for `newGame`/`undo`.
- **Capture series**: `makeMove` handles one jump at a time. Jumped pieces stay on the board until the chain ends. They are listed in `#captured` and rendered as `.ghost`. This enforces the Turkish-strike rule: a captured piece blocks and cannot be jumped twice. Promotion happens immediately on reaching the last rank, so the chain continues as a king.
- **Undo**: a snapshot (`#snapshot`) is pushed only at the start of a turn, not per jump. So undo during or after a chain reverts the whole turn.
- **Game over**: `#passTurn` sets `result = {winner, loser, noPieces}` when the side to move has no pieces or no legal moves.
- **`Renderer`** (`renderer.js`): DOM only. It also holds the UI texts (`NAMES`, `TEXT`), the `TIMING` constants and the `EMBLEM` SVGs.
  - `update({anim, reset})` rebuilds the board DOM on every change. Cell index is `r * 8 + c` (see `#cellAt`).
  - Movement is FLIP-style in `#slide`. Explosions are `.boom` elements.
  - All delayed effects go through `#later`. On `reset` they are cancelled, so explosions don't play over a restored board.
- **`main.js`**: wires everything together, adds one delegated click listener on `#board` plus the button and intro handlers, then calls `game.newGame()`.

## Styling (`style.css`)

The board cell size comes from the `--cell` CSS variable, which is overridden under `max-width: 520px` for phones. Piece states are CSS classes that `Renderer` toggles: `light`/`dark`, `king`, `movable`, `must`, `selected`, `ghost`. Target squares use `.target` and `.capture-target`. The side emblems are inline SVGs in the `EMBLEM` constant in `renderer.js`.
