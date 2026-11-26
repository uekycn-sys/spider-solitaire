import { describe, expect, it } from 'vitest';
import { createNewGame } from '../deck';
import {
  applyMove,
  canDealFromStock,
  canPlaceSequence,
  dealFromStock,
  findSmartClickTarget,
  isMovableSequence,
  undoAll,
  undoMove,
} from '../rules';
import type { Card, GameState, Rank, Suit } from '../types';

let nextCardId = 1000;
function makeCard(rank: Rank, suit: Suit = 'spades', faceUp = true): Card {
  return { id: nextCardId++, rank, suit, faceUp };
}

function makeEmptyState(): GameState {
  const base = createNewGame('medium', 1);
  return {
    ...base,
    columns: Array.from({ length: 10 }, () => []),
    stockDeals: [Array.from({ length: 10 }, (_, i) => makeCard(((i % 13) + 1) as Rank, 'spades', false))],
    completedRuns: [],
    moves: 0,
    penalties: 0,
    score: 500,
    won: false,
    history: [],
    initialSnapshot: {
      columns: Array.from({ length: 10 }, () => []),
      stockDeals: [],
    },
  };
}

describe('rules engine', () => {
  it('validates same-suit descending sequences and rejects mixed-suit drags', () => {
    const sameSuitCol = [
      makeCard(9, 'spades', false),
      makeCard(8, 'spades', true),
      makeCard(7, 'spades', true),
      makeCard(6, 'spades', true),
    ];
    expect(isMovableSequence(sameSuitCol, 0)).toBe(false);
    expect(isMovableSequence(sameSuitCol, 1)).toBe(true);
    expect(isMovableSequence(sameSuitCol, 2)).toBe(true);

    const mixedSuitCol = [
      makeCard(8, 'spades', true),
      makeCard(7, 'hearts', true),
      makeCard(6, 'hearts', true),
    ];
    expect(isMovableSequence(mixedSuitCol, 0)).toBe(false);
    expect(isMovableSequence(mixedSuitCol, 1)).toBe(true);
  });

  it('allows placement on rank+1 (any suit) or empty column', () => {
    const moving7H = makeCard(7, 'hearts', true);
    expect(canPlaceSequence(moving7H, [])).toBe(true);
    expect(canPlaceSequence(moving7H, [makeCard(8, 'spades', true)])).toBe(true);
    expect(canPlaceSequence(moving7H, [makeCard(8, 'hearts', true)])).toBe(true);
    expect(canPlaceSequence(moving7H, [makeCard(9, 'spades', true)])).toBe(false);
  });

  it('blocks stock deal when any column is empty and reports empty column indices', () => {
    const state = makeEmptyState();
    state.columns[0] = [makeCard(5)];
    // columns 1..9 are empty
    const check = canDealFromStock(state);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('empty_columns');
    expect(check.emptyColumns).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (let i = 1; i < 10; i++) {
      state.columns[i] = [makeCard(4)];
    }
    const okCheck = canDealFromStock(state);
    expect(okCheck.ok).toBe(true);

    const dealt = dealFromStock(state);
    expect(dealt.state.stockDeals).toHaveLength(0);
    expect(dealt.state.columns.every((c) => c.length === 2 && c[1].faceUp)).toBe(true);
  });

  it('auto-collects K->A runs, flips hidden card, scores +100, and prevents undo-farming', () => {
    const state = makeEmptyState();
    state.columns[0] = [
      makeCard(4, 'spades', false),
      ...([13, 12, 11, 10, 9, 8, 7, 6, 5, 4] as Rank[]).map((r) => makeCard(r, 'spades', true)),
    ];
    state.columns[1] = [
      makeCard(3, 'spades', true),
      makeCard(2, 'spades', true),
      makeCard(1, 'spades', true),
    ];

    const res = applyMove(state, { type: 'move', fromCol: 1, cardIndex: 0, toCol: 0 });
    expect(res.extractedRuns).toHaveLength(1);
    expect(res.state.completedRuns).toHaveLength(1);
    expect(res.state.columns[0]).toHaveLength(1);
    expect(res.state.columns[0][0].faceUp).toBe(true);
    expect(res.flippedCols).toEqual([0]);
    // 500 + 100 (completed) - 1 (move) = 599
    expect(res.state.score).toBe(599);

    // Undo restores board and applies -1 penalty (500 - 2 = 498), no +100 retained
    const undone = undoMove(res.state)!;
    expect(undone.completedRuns).toHaveLength(0);
    expect(undone.score).toBe(498);
    expect(undone.columns[0][0].faceUp).toBe(false);
  });

  it('marks game as won when 8th run is completed and resets cleanly on undoAll', () => {
    const state = makeEmptyState();
    state.completedRuns = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      suit: 'spades',
      cards: [],
    }));
    state.columns[0] = ([13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as Rank[]).map((r) =>
      makeCard(r, 'spades', true)
    );
    state.columns[1] = [makeCard(1, 'spades', true)];
    state.initialSnapshot = {
      columns: state.columns.map((c) => c.map((x) => ({ ...x }))),
      stockDeals: [],
    };

    const res = applyMove(state, { type: 'move', fromCol: 1, cardIndex: 0, toCol: 0 });
    expect(res.state.won).toBe(true);
    expect(res.state.completedRuns).toHaveLength(8);

    const reset = undoAll(res.state);
    expect(reset.won).toBe(false);
    expect(reset.score).toBe(500);
    expect(reset.moves).toBe(0);
    expect(reset.completedRuns).toHaveLength(0);
  });

  it('selects smart-click target in strict priority: same suit > different suit > empty col', () => {
    const columns: Card[][] = Array.from({ length: 10 }, () => []);
    columns[0] = [makeCard(9, 'clubs', true), makeCard(5, 'spades', true)];
    columns[1] = []; // empty
    columns[2] = [makeCard(6, 'hearts', true)]; // mixed suit
    columns[3] = [makeCard(6, 'spades', true)]; // same suit

    expect(findSmartClickTarget(columns, 0, 1)).toBe(3);

    columns[3] = [makeCard(10, 'spades', true)]; // remove same-suit option
    expect(findSmartClickTarget(columns, 0, 1)).toBe(2);

    columns[2] = [makeCard(10, 'hearts', true)]; // remove mixed-suit option
    expect(findSmartClickTarget(columns, 0, 1)).toBe(1);
  });
});
