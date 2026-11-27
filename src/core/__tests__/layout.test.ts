import { describe, expect, it } from 'vitest';
import type { Card } from '../types';
import { computeColumnLayout } from '../../ui/components/TableauBoard';

function makeColumn(downCount: number, upCount: number): Card[] {
  const cards: Card[] = [];
  let id = 1;
  for (let i = 0; i < downCount; i++) {
    cards.push({ id: id++, suit: 'spades', rank: 13, faceUp: false });
  }
  for (let i = 0; i < upCount; i++) {
    cards.push({
      id: id++,
      suit: 'spades',
      rank: ((13 - (i % 13)) as Card['rank']),
      faceUp: true,
    });
  }
  return cards;
}

describe('computeColumnLayout mobile legibility guarantees', () => {
  it('never crushes face-up card spacing below minUp on long landscape stacks', () => {
    const col = makeColumn(1, 16); // 17 cards total
    const layout = computeColumnLayout(col, 84, 220, {
      idealUp: 23,
      minUp: 17,
      idealDown: 5,
      minDown: 3,
    });

    expect(layout.upStep).toBeGreaterThanOrEqual(17);
    expect(layout.downStep).toBeGreaterThanOrEqual(3);
    expect(layout.totalHeight).toBeGreaterThan(220);
    expect(layout.ys).toHaveLength(17);
    // Consecutive face-up cards stay separated by at least minUp
    expect(layout.ys[2] - layout.ys[1]).toBeGreaterThanOrEqual(17);
  });

  it('compresses face-down cards to minDown before compressing face-up cards', () => {
    const col = makeColumn(5, 4); // 5 face-down, 4 face-up
    const layout = computeColumnLayout(col, 80, 175, {
      idealUp: 24,
      minUp: 17,
      idealDown: 10,
      minDown: 4,
    });

    // maxSpan = 175 - 80 = 95; idealSpan = 5*10 + 3*24 = 122 -> excess = 27
    // 5*(10-4) = 30 maxDownSavings >= 27, so downStep absorbs all compression
    expect(layout.downStep).toBeCloseTo(4.6, 1);
    expect(layout.upStep).toBe(24);
    expect(layout.totalHeight).toBeLessThanOrEqual(175.01);
  });

  it('preserves readable vertical step for portrait mobile stacks', () => {
    const col = makeColumn(4, 12);
    const layout = computeColumnLayout(col, 56, 480, {
      idealUp: 25,
      minUp: 20,
      idealDown: 7,
      minDown: 3.5,
    });

    expect(layout.upStep).toBeGreaterThanOrEqual(20);
    expect(layout.downStep).toBeGreaterThanOrEqual(3.5);
  });

  it('keeps ideal spacing and fits within availHeight for short desktop columns', () => {
    const col = makeColumn(4, 3);
    const layout = computeColumnLayout(col, 120, 620, {
      idealUp: 32,
      minUp: 20,
      idealDown: 12,
      minDown: 4,
    });

    expect(layout.downStep).toBe(12);
    expect(layout.upStep).toBe(32);
    expect(layout.totalHeight).toBeLessThanOrEqual(620);
  });
});
