# Переписать game.js по правилам skill js-style (.claude/skills/js-style/SKILL.md)

## Context
Пользователь хочет переписать процедурный `game.js` (глобальные `let`, свободные функции, правила и DOM вместе) по правилам skill `js-style`. Правила skill: классы с приватными `#полями` и get/set, `const` по умолчанию, SOLID (правила не трогают DOM), паттерны Observer/Memento/Factory, без ES-модулей (работа через `file://`). Skill разрешает крупный рефакторинг только по явной просьбе, а пользователь об этом попросил. Заодно исправляем найденную на ревью ошибку: таймеры `.boom` не сбрасываются при отмене хода и новой игре.

Поведение игры не меняется. Остаются прежними правила, анимации, тексты и CSS-классы.

## Файлы (подключаются обычными `<script>` по порядку в `index.html:68`)
1. **`constants.js`**: `'use strict'`, `SIZE`, `DIRS`, `SIDES = { LIGHT: 'light', DARK: 'dark' }`, `NAMES`, `EMBLEM`, тайминги анимаций (`WIN_DELAY = 700`, `BOOM_DELAY = 250`, `BOOM_STEP = 90`, `BOOM_LIFE = 650`, `MOVE_MS = 320`, `INTRO_MS = 30000`), helper-функции `opposite(side)`.
2. **`piece.js`**: класс `Piece`. Поля `#side` (сеттер проверяет допустимое значение) и `#king`. Геттеры `side`, `isKing`. Методы `promote()`, `clone()`, `get forward`, `get promoRow`.
3. **`board.js`**: класс `Board` с приватным полем `#cells`.
   - `static initial()` создаёт начальную расстановку (Factory).
   - `get(r, c)`, `set(r, c, piece)`, `remove(r, c)`, `static inside(r, c)`, `static isPlayable(r, c)`, `piecesOf(side)`, `clone()` для Memento.
   - `withTemporaryMove(from, to, piece, fn)` временно переставляет шашку и восстанавливает доску в `try/finally`. Его использует `canContinue`.
4. **`rules.js`**: класс `Rules(board)`, без DOM. Перенос `rawCaptures`, `canContinue`, `captureMoves`, `simpleMoves`, `sideHasCapture`, `sideHasAnyMove`.
   - Ход простой шашки и ход дамки выносятся в отдельные приватные методы (`#manCaptures` / `#kingCaptures`, `#manSteps` / `#kingSteps`). Это лёгкая Strategy без лишних классов (KISS).
   - Логика остаётся 1:1 с текущей, включая турецкий удар и обязательную остановку дамки там, откуда можно бить дальше.
5. **`game.js`**: класс `Game`.
   - Поля `#board`, `#rules`, `#turn`, `#selected`, `#chain`, `#captured`, `#history`, `#lastMove`, `#capturedCount`, `#gameOver`, `#listeners`.
   - Геттеры для View: `turn`, `selected`, `chain`, `lastMove`, `capturedCount`, `isGameOver`, `canUndo`, `mustCapture`, `result` (победитель и причина), `pieceAt`, `isCaptured`, `movesFor(r, c)`.
   - Методы `newGame()`, `select(r, c)` (вместо логики `onCellClick`), `makeMove`, `undo()`, `onChange(fn)` (Observer, передаёт `{ anim }`).
   - Снимок для undo — приватный `#snapshot()` / `#restore()` (Memento).
6. **`renderer.js`**: класс `Renderer(boardEl, hud, game)`, только DOM.
   - Методы `render(anim)`, `#animate`, `#updateHud`, `#showWin`, `hideWin`, `#cellAt`.
   - Хранит `#timers` (Set): сюда попадают таймеры взрывов и победного оверлея. `#clearTimers()` вызывается в начале каждого `render` без `anim`, то есть после undo или новой игры. **Это исправляет баг из ревью.**
   - Тексты победы переезжают сюда из `checkGameOver`. `Game` только сообщает результат.
7. **`main.js`**: связывает объекты.
   - `const game = new Game(...)`, `const view = new Renderer(...)`, `game.onChange(...)`.
   - Обработчики кнопок `newBtn`, `againBtn` и `undoBtn`, интро (`hideIntro`), запуск `game.newGame()`.

После этого в коде не остаётся ни одного module-level `let` и ни одного `var`. Каждый `let` нужен только там, где переменная действительно меняется (счётчики в циклах лучей дамки).

## Прочие правки
- `index.html`: заменить `<script src="game.js">` на 7 тегов в порядке выше.
- `CLAUDE.md`: обновить разделы Architecture и Running под новые файлы и классы, включая новый способ headless-проверки (склеить файлы и работать через `new Game`).

## Проверка
1. Headless в Node. Склеить файлы (без `main.js`) и написать скрипт, который:
   - проверяет взятие назад простой шашкой;
   - проверяет превращение в дамку посреди серии с продолжением взятия;
   - проверяет, что дамка обязана встать на поле, откуда можно бить дальше;
   - проверяет турецкий удар;
   - проверяет обязательное взятие;
   - проверяет, что undo откатывает весь ход;
   - проверяет конец игры (нет фишек или нет ходов).
   - Позиции задаются через `Board.set`.
2. `node --check` на каждом файле.
3. `grep -n "\bvar\b\|^let "` по `*.js` должен вернуть пусто.
4. Открыть `index.html` в браузере (skill `run` или claude-in-chrome) и проверить:
   - интро, обычный ход, взятие со взрывом;
   - быстрый undo после взятия: взрывов поверх восстановленных шашек быть не должно;
   - оверлей победы, «Новая игра», вёрстку на узкой ширине.
