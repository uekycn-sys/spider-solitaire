import { describe, expect, it } from 'vitest';
import { createNewGame } from '../deck';
import { getBestHint, hashBoardState } from '../heuristics';
import { solveFromState } from '../solver';
import type { Card, GameState, Rank, Suit } from '../types';

let idSeq = 5000;
function card(rank: Rank, suit: Suit = 'spades', faceUp = true): Card {
  return { id: idSeq++, rank, suit, faceUp };
}

function emptyState(): GameState {
  const base = createNewGame('medium', 9);
  return {
    ...base,
    columns: Array.from({ length: 10 }, () => []),
    stockDeals: [],
    completedRuns: [],
    moves: 0,
    penalties: 0,
    score: 500,
    won: false,
    history: [],
  };
}

describe('heuristics hint & beam search solver', () => {
  it('prioritizes completing a K->A run over other legal moves', () => {
    const state = emptyState();
    state.columns[0] = ([13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as Rank[]).map((r) =>
      card(r, 'spades', true)
    );
    state.columns[1] = [card(1, 'spades', true)];
    state.columns[2] = [card(2, 'hearts', true)];
    state.columns[3] = [card(7, 'hearts', false), card(5, 'hearts', true)];
    state.columns[4] = [card(6, 'hearts', true)];

    const hint = getBestHint(state);
    expect(hint.status).toBe('move');
    expect(hint.action).toEqual({ type: 'move', fromCol: 1, cardIndex: 0, toCol: 0 });
  });

  it('avoids oscillating back to recently visited hashes', () => {
    const state = emptyState();
    state.columns[0] = [card(8, 'hearts', true), card(7, 'spades', true)];
    state.columns[1] = [card(8, 'clubs', true)];
    state.columns[2] = [card(8, 'spades', true)];

    const avoidHash = hashBoardState(
      [
        [card(8, 'hearts', true)],
        [card(8, 'clubs', true)],
        [card(8, 'spades', true), card(7, 'spades', true)],
        [], [], [], [], [], [], [],
      ],
      0,
      0
    );

    const hint = getBestHint(state, new Set([avoidHash]));
    expect(hint.action).not.toEqual({ type: 'move', fromCol: 0, cardIndex: 1, toCol: 2 });
  });

  it('solves multi-step run assembly and detects deadlock cleanly', () => {
    const state = emptyState();
    state.completedRuns = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      suit: 'spades',
      cards: [],
    }));
    // Needs two moves: move 3-2-1 onto 4, then 7..4..1 onto K..8
    state.columns[0] = ([13, 12, 11, 10, 9, 8] as Rank[]).map((r) => card(r, 'spades', true));
    state.columns[1] = ([7, 6, 5, 4] as Rank[]).map((r) => card(r, 'spades', true));
    state.columns[2] = ([3, 2, 1] as Rank[]).map((r) => card(r, 'spades', true));

    const solved = solveFromState(state);
    expect(solved.status).toBe('won_path');
    expect(solved.steps.length).toBeGreaterThanOrEqual(2);

    // Deadlock test: only unplaceable cards, no stock
    const dead = emptyState();
    dead.columns[0] = [card(2, 'spades', true)];
    dead.columns[1] = [card(9, 'hearts', true)];
    dead.columns[2] = [card(5, 'clubs', true)];
    const deadRes = solveFromState(dead);
    expect(deadRes.status).toBe('deadlock');
    expect(deadRes.steps).toHaveLength(0);
  });
});
