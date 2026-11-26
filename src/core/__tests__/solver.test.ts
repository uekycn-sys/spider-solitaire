import { describe, expect, it } from 'vitest';
import { createNewGame } from '../deck';
import { getBestHint, hashBoardState } from '../heuristics';
import { applyMove, dealFromStock } from '../rules';
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

  it('solves multi-step run assembly and detects genuine deadlock cleanly', () => {
    const state = emptyState();
    state.completedRuns = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      suit: 'spades',
      cards: [],
    }));
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

  it('regression: fills 4 empty columns without breaking runs and deals on reported screenshot board', () => {
    const state = emptyState();
    state.difficulty = 'easy';
    state.completedRuns = Array.from({ length: 4 }, (_, i) => ({
      id: i + 1,
      suit: 'spades',
      cards: [],
    }));
    state.columns = [
      ([5, 4, 3] as Rank[]).map((r) => card(r, 'spades')),
      [card(9, 'spades')],
      [card(11, 'spades')],
      [],
      ([13, 13, 12, 11, 4] as Rank[]).map((r) => card(r, 'spades')),
      ([7, 11] as Rank[]).map((r) => card(r, 'spades')),
      [],
      [],
      ([7, 9, 8, 7, 6, 5, 4, 3, 2, 1] as Rank[]).map((r) => card(r, 'spades')),
      [],
    ];
    // 3 stock deals remaining
    state.stockDeals = Array.from({ length: 3 }, () =>
      Array.from({ length: 10 }, (_, idx) =>
        card((((idx + 1) % 13) + 1) as Rank, 'spades', false)
      )
    );

    const res = solveFromState(state);
    expect(res.status).toBe('found');
    expect(res.steps.length).toBeGreaterThanOrEqual(5);
    expect(res.steps[res.steps.length - 1].action.type).toBe('deal');

    // Execute every planned step against the real rules engine to verify 100% legality
    let sim = state;
    for (const step of res.steps) {
      if (step.action.type === 'move') {
        sim = applyMove(sim, step.action).state;
      } else {
        sim = dealFromStock(sim).state;
      }
    }
    expect(sim.stockDeals).toHaveLength(2);
    expect(sim.columns.every((c) => c.length > 0)).toBe(true);
  });

  it('fills empty columns by minimally splitting shortest pure run when stock remains', () => {
    const state = emptyState();
    state.difficulty = 'easy';
    // Pure runs with rank gaps (no legal merges anywhere) -> must split shortest run to fill empty cols & deal
    state.columns = [
      ([9, 8, 7, 6, 5, 4] as Rank[]).map((r) => card(r, 'spades')),
      ([2, 1] as Rank[]).map((r) => card(r, 'spades')),
      ([2, 1] as Rank[]).map((r) => card(r, 'spades')),
      [card(13, 'spades')],
      [card(13, 'spades')],
      [card(11, 'spades')],
      [card(11, 'spades')],
      [card(11, 'spades')],
      [],
      [],
    ];
    state.stockDeals = [
      Array.from({ length: 10 }, (_, idx) =>
        card((((idx + 2) % 13) + 1) as Rank, 'spades', false)
      ),
    ];

    const res = solveFromState(state);
    expect(res.status).toBe('found');
    expect(res.steps[res.steps.length - 1].action.type).toBe('deal');

    let sim = state;
    for (const step of res.steps) {
      sim =
        step.action.type === 'move'
          ? applyMove(sim, step.action).state
          : dealFromStock(sim).state;
    }
    expect(sim.stockDeals).toHaveLength(0);
    // The 6-card run [9..4] should remain completely intact (only the shorter [4,3,2] run was split)
    expect(sim.columns[0].slice(0, 6).map((c) => c.rank)).toEqual([9, 8, 7, 6, 5, 4]);
  });

  it('finds multi-step empty-column staging (Tower of Hanoi) to consolidate a run', () => {
    const state = emptyState();
    state.difficulty = 'easy';
    // Col 0: [8♠, 4♠] (4 blocks 8), Col 1: [7♠, 6♠, 5♠], Col 2: empty
    // Optimal sequence: 4♠ -> empty, 7-6-5♠ -> 8♠, 4♠ -> 5♠ (forms 8-7-6-5-4♠ and frees 2 empty cols!)
    state.columns[0] = [card(8, 'spades'), card(4, 'spades')];
    state.columns[1] = [card(7, 'spades'), card(6, 'spades'), card(5, 'spades')];
    state.columns[2] = [];

    const res = solveFromState(state);
    expect(res.status).toBe('found');

    let sim = state;
    for (const step of res.steps) {
      if (step.action.type === 'move') {
        sim = applyMove(sim, step.action).state;
      }
    }

    const hasConsolidated5Run = sim.columns.some(
      (col) =>
        col.length === 5 &&
        col.map((c) => c.rank).join(',') === '8,7,6,5,4'
    );
    expect(hasConsolidated5Run).toBe(true);
  });

  it('plays through a full Easy game seed smoothly without false deadlocks while stock remains', () => {
    let sim = createNewGame('easy', 12345);
    const visited = new Set<string>();
    let batchCount = 0;

    while (!sim.won && batchCount < 60) {
      batchCount++;
      const res = solveFromState(sim, {
        avoidHashes: Array.from(visited).slice(-60),
      });
      if (res.status === 'deadlock' || res.steps.length === 0) {
        // Must NEVER declare deadlock while stock remains and >= 10 cards are on tableau
        const totalCards = sim.columns.reduce((acc, c) => acc + c.length, 0);
        if (sim.stockDeals.length > 0 && totalCards >= 10) {
          throw new Error('Solver falsely deadlocked with stock still dealable!');
        }
        break;
      }

      for (const step of res.steps) {
        visited.add(
          hashBoardState(
            sim.columns,
            sim.stockDeals.length,
            sim.completedRuns.length
          )
        );
        if (step.action.type === 'move') {
          const prevRuns = sim.completedRuns.length;
          sim = applyMove(sim, step.action).state;
          if (sim.completedRuns.length > prevRuns) visited.clear();
        } else {
          sim = dealFromStock(sim).state;
          visited.clear();
        }
      }
    }

    // Should have made substantial progress (completed multiple runs or won outright)
    expect(sim.completedRuns.length).toBeGreaterThanOrEqual(4);
  });
});
