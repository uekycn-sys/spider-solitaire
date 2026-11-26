import type {
  Card,
  CompletedRun,
  DealResult,
  ExtractedRunInfo,
  GameState,
  MoveAction,
  MoveResult,
} from './types';

export const INITIAL_SCORE = 500;
export const COMPLETED_RUN_BONUS = 100;
export const TOTAL_RUNS_TO_WIN = 8;

export function cloneColumns(columns: Card[][]): Card[][] {
  return columns.map((col) => col.map((card) => ({ ...card })));
}

export function cloneStock(stockDeals: Card[][]): Card[][] {
  return stockDeals.map((deal) => deal.map((card) => ({ ...card })));
}

export function cloneCompletedRuns(runs: CompletedRun[]): CompletedRun[] {
  return runs.map((run) => ({
    id: run.id,
    suit: run.suit,
    cards: run.cards.map((card) => ({ ...card })),
  }));
}

/**
 * Computes Spider Solitaire score:
 * 500 base + 100 per completed K->A run - 1 per move/undo penalty (clamped at 0).
 */
export function computeScore(completedCount: number, penalties: number): number {
  return Math.max(0, INITIAL_SCORE + completedCount * COMPLETED_RUN_BONUS - penalties);
}

/**
 * Returns true if the sub-stack starting at `startIndex` to the end of `column`
 * is face-up, same-suit, and strictly descending by 1 rank.
 */
export function isMovableSequence(column: Card[], startIndex: number): boolean {
  if (startIndex < 0 || startIndex >= column.length) {
    return false;
  }

  for (let i = startIndex; i < column.length; i++) {
    if (!column[i].faceUp) {
      return false;
    }
    if (i > startIndex) {
      const prev = column[i - 1];
      const curr = column[i];
      if (curr.suit !== prev.suit || prev.rank !== curr.rank + 1) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Returns the index of the first card in the maximal movable tail sequence of `column`,
 * or `column.length` if empty.
 */
export function getMaxMovableTailStart(column: Card[]): number {
  if (column.length === 0) return 0;
  let start = column.length - 1;
  while (start > 0 && column[start - 1].faceUp) {
    const upper = column[start - 1];
    const lower = column[start];
    if (upper.suit === lower.suit && upper.rank === lower.rank + 1) {
      start--;
    } else {
      break;
    }
  }
  return start;
}

/**
 * Checks whether a movable sequence headed by `movingTop` can be placed onto `targetCol`.
 */
export function canPlaceSequence(movingTop: Card, targetCol: Card[]): boolean {
  if (targetCol.length === 0) {
    return true;
  }
  const targetTop = targetCol[targetCol.length - 1];
  return targetTop.faceUp && targetTop.rank === movingTop.rank + 1;
}

/**
 * Enumerates all legal moves on the current tableau (skipping no-op moves of an
 * entire column starting at index 0 onto an empty column).
 */
export function getLegalMoves(columns: Card[][]): MoveAction[] {
  const moves: MoveAction[] = [];

  for (let fromCol = 0; fromCol < columns.length; fromCol++) {
    const col = columns[fromCol];
    if (col.length === 0) continue;

    const tailStart = getMaxMovableTailStart(col);
    for (let cardIndex = tailStart; cardIndex < col.length; cardIndex++) {
      const movingTop = col[cardIndex];
      for (let toCol = 0; toCol < columns.length; toCol++) {
        if (toCol === fromCol) continue;
        const target = columns[toCol];
        // Moving an entire column onto an empty column accomplishes nothing.
        if (cardIndex === 0 && target.length === 0) continue;
        if (canPlaceSequence(movingTop, target)) {
          moves.push({ type: 'move', fromCol, cardIndex, toCol });
        }
      }
    }
  }

  return moves;
}

/**
 * Scans columns in-place for completed same-suit K (13) -> A (1) runs at the tail,
 * extracts them, and flips any newly exposed face-down card.
 */
export function extractCompletedRunsInPlace(
  columns: Card[][],
  nextRunIdStart: number
): { extracted: ExtractedRunInfo[]; flippedCols: number[] } {
  const extracted: ExtractedRunInfo[] = [];
  const flippedCols: number[] = [];
  let nextId = nextRunIdStart;

  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    const col = columns[colIndex];
    while (col.length >= 13) {
      const start = col.length - 13;
      const suit = col[start].suit;
      let isComplete = true;

      for (let offset = 0; offset < 13; offset++) {
        const card = col[start + offset];
        if (!card.faceUp || card.suit !== suit || card.rank !== 13 - offset) {
          isComplete = false;
          break;
        }
      }

      if (!isComplete) break;

      const cards = col.splice(start, 13);
      extracted.push({
        colIndex,
        run: {
          id: nextId++,
          suit,
          cards,
        },
      });

      if (col.length > 0 && !col[col.length - 1].faceUp) {
        col[col.length - 1].faceUp = true;
        if (!flippedCols.includes(colIndex)) {
          flippedCols.push(colIndex);
        }
      }
    }
  }

  return { extracted, flippedCols };
}

/**
 * Applies a validated MoveAction and returns the updated GameState plus animation metadata.
 */
export function applyMove(state: GameState, move: MoveAction): MoveResult {
  const { fromCol, cardIndex, toCol } = move;
  if (fromCol === toCol || fromCol < 0 || fromCol >= 10 || toCol < 0 || toCol >= 10) {
    throw new Error('无效的列索引');
  }

  const sourceCol = state.columns[fromCol];
  const targetCol = state.columns[toCol];

  if (!isMovableSequence(sourceCol, cardIndex)) {
    throw new Error('只能拖动单张或同花色连续递减序列');
  }
  if (!canPlaceSequence(sourceCol[cardIndex], targetCol)) {
    throw new Error('目标列点数不匹配');
  }

  const historyEntry = {
    columns: cloneColumns(state.columns),
    stockDeals: cloneStock(state.stockDeals),
    completedRuns: cloneCompletedRuns(state.completedRuns),
    moves: state.moves,
  };

  const nextColumns = cloneColumns(state.columns);
  const movingCards = nextColumns[fromCol].splice(cardIndex);
  nextColumns[toCol].push(...movingCards);

  const flippedCols: number[] = [];
  const srcAfter = nextColumns[fromCol];
  if (srcAfter.length > 0 && !srcAfter[srcAfter.length - 1].faceUp) {
    srcAfter[srcAfter.length - 1].faceUp = true;
    flippedCols.push(fromCol);
  }

  const nextRunIdStart =
    state.completedRuns.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  const { extracted, flippedCols: postExtractFlips } = extractCompletedRunsInPlace(
    nextColumns,
    nextRunIdStart
  );

  for (const colIdx of postExtractFlips) {
    if (!flippedCols.includes(colIdx)) {
      flippedCols.push(colIdx);
    }
  }

  const nextCompletedRuns = [
    ...cloneCompletedRuns(state.completedRuns),
    ...extracted.map((item) => item.run),
  ];
  const nextMoves = state.moves + 1;
  const nextPenalties = state.penalties + 1;
  const nextScore = computeScore(nextCompletedRuns.length, nextPenalties);
  const won = nextCompletedRuns.length >= TOTAL_RUNS_TO_WIN;

  return {
    state: {
      ...state,
      columns: nextColumns,
      completedRuns: nextCompletedRuns,
      moves: nextMoves,
      penalties: nextPenalties,
      score: nextScore,
      won,
      history: [...state.history, historyEntry],
    },
    extractedRuns: extracted,
    flippedCols,
  };
}

/**
 * Validates whether a stock deal is allowed (requires remaining stock and zero empty columns).
 */
export function canDealFromStock(state: GameState): {
  ok: boolean;
  reason?: 'no_stock' | 'empty_columns';
  emptyColumns: number[];
} {
  if (state.stockDeals.length === 0) {
    return { ok: false, reason: 'no_stock', emptyColumns: [] };
  }

  const emptyColumns: number[] = [];
  for (let i = 0; i < state.columns.length; i++) {
    if (state.columns[i].length === 0) {
      emptyColumns.push(i);
    }
  }

  if (emptyColumns.length > 0) {
    return { ok: false, reason: 'empty_columns', emptyColumns };
  }

  return { ok: true, emptyColumns: [] };
}

/**
 * Deals 10 face-up cards from the stock (1 per column) and checks for completed runs.
 */
export function dealFromStock(state: GameState): DealResult {
  const check = canDealFromStock(state);
  if (!check.ok) {
    throw new Error(
      check.reason === 'no_stock'
        ? '发牌堆已空'
        : '所有空列必须先放牌，才能继续发牌'
    );
  }

  const historyEntry = {
    columns: cloneColumns(state.columns),
    stockDeals: cloneStock(state.stockDeals),
    completedRuns: cloneCompletedRuns(state.completedRuns),
    moves: state.moves,
  };

  const nextStock = cloneStock(state.stockDeals);
  const nextDeal = nextStock.pop()!;
  const dealtCards: Card[] = nextDeal.map((card) => ({ ...card, faceUp: true }));

  const nextColumns = cloneColumns(state.columns);
  for (let colIndex = 0; colIndex < 10; colIndex++) {
    nextColumns[colIndex].push({ ...dealtCards[colIndex] });
  }

  const nextRunIdStart =
    state.completedRuns.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  const { extracted, flippedCols } = extractCompletedRunsInPlace(
    nextColumns,
    nextRunIdStart
  );

  const nextCompletedRuns = [
    ...cloneCompletedRuns(state.completedRuns),
    ...extracted.map((item) => item.run),
  ];
  const nextMoves = state.moves + 1;
  const nextScore = computeScore(nextCompletedRuns.length, state.penalties);
  const won = nextCompletedRuns.length >= TOTAL_RUNS_TO_WIN;

  return {
    state: {
      ...state,
      columns: nextColumns,
      stockDeals: nextStock,
      completedRuns: nextCompletedRuns,
      moves: nextMoves,
      score: nextScore,
      won,
      history: [...state.history, historyEntry],
    },
    dealtCards,
    extractedRuns: extracted,
    flippedCols,
  };
}

/**
 * Undoes the most recent move/deal, applying the standard -1 point penalty
 * so undoing a completed K->A run cannot be exploited for infinite points.
 */
export function undoMove(state: GameState): GameState | null {
  if (state.history.length === 0) {
    return null;
  }

  const nextHistory = state.history.slice(0, -1);
  const prev = state.history[state.history.length - 1];
  const nextPenalties = state.penalties + 1;
  const restoredCompleted = cloneCompletedRuns(prev.completedRuns);

  return {
    ...state,
    columns: cloneColumns(prev.columns),
    stockDeals: cloneStock(prev.stockDeals),
    completedRuns: restoredCompleted,
    moves: prev.moves,
    penalties: nextPenalties,
    score: computeScore(restoredCompleted.length, nextPenalties),
    won: false,
    history: nextHistory,
  };
}

/**
 * Resets the current deal back to its initial opening state.
 */
export function undoAll(state: GameState): GameState {
  return {
    ...state,
    columns: cloneColumns(state.initialSnapshot.columns),
    stockDeals: cloneStock(state.initialSnapshot.stockDeals),
    completedRuns: [],
    moves: 0,
    penalties: 0,
    score: INITIAL_SCORE,
    won: false,
    history: [],
  };
}

function getTailSameSuitRunLength(column: Card[]): number {
  if (column.length === 0) return 0;
  let len = 1;
  for (let i = column.length - 1; i > 0; i--) {
    const upper = column[i - 1];
    const lower = column[i];
    if (upper.faceUp && upper.suit === lower.suit && upper.rank === lower.rank + 1) {
      len++;
    } else {
      break;
    }
  }
  return len;
}

/**
 * Smart-click target selection with strict priority:
 * 1. Same-suit build (preferring longest existing same-suit tail)
 * 2. Different-suit build (preferring columns with fewer face-up cards)
 * 3. Empty column (only if moving a sub-stack with cardIndex > 0)
 */
export function findSmartClickTarget(
  columns: Card[][],
  fromCol: number,
  cardIndex: number
): number | null {
  const sourceCol = columns[fromCol];
  if (!isMovableSequence(sourceCol, cardIndex)) {
    return null;
  }

  const movingTop = sourceCol[cardIndex];
  const sameSuitCandidates: { col: number; runLen: number }[] = [];
  const mixedSuitCandidates: { col: number; faceUpCount: number }[] = [];
  const emptyCandidates: number[] = [];

  for (let toCol = 0; toCol < columns.length; toCol++) {
    if (toCol === fromCol) continue;
    const target = columns[toCol];

    if (target.length === 0) {
      if (cardIndex > 0) {
        emptyCandidates.push(toCol);
      }
      continue;
    }

    const top = target[target.length - 1];
    if (!top.faceUp || top.rank !== movingTop.rank + 1) {
      continue;
    }

    if (top.suit === movingTop.suit) {
      sameSuitCandidates.push({
        col: toCol,
        runLen: getTailSameSuitRunLength(target),
      });
    } else {
      const faceUpCount = target.reduce((acc, c) => acc + (c.faceUp ? 1 : 0), 0);
      mixedSuitCandidates.push({ col: toCol, faceUpCount });
    }
  }

  if (sameSuitCandidates.length > 0) {
    sameSuitCandidates.sort((a, b) => b.runLen - a.runLen || a.col - b.col);
    return sameSuitCandidates[0].col;
  }

  if (mixedSuitCandidates.length > 0) {
    mixedSuitCandidates.sort((a, b) => a.faceUpCount - b.faceUpCount || a.col - b.col);
    return mixedSuitCandidates[0].col;
  }

  if (emptyCandidates.length > 0) {
    return emptyCandidates[0];
  }

  return null;
}
