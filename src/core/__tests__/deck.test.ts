import { describe, expect, it } from 'vitest';
import { createDeck, createNewGame } from '../deck';

describe('deck & initial deal', () => {
  it('creates 104 cards for each difficulty with exact suit counts', () => {
    const easy = createDeck('easy');
    expect(easy).toHaveLength(104);
    expect(easy.every((c) => c.suit === 'spades')).toBe(true);

    const medium = createDeck('medium');
    expect(medium).toHaveLength(104);
    expect(medium.filter((c) => c.suit === 'spades')).toHaveLength(52);
    expect(medium.filter((c) => c.suit === 'hearts')).toHaveLength(52);

    const hard = createDeck('hard');
    expect(hard).toHaveLength(104);
    expect(hard.filter((c) => c.suit === 'spades')).toHaveLength(26);
    expect(hard.filter((c) => c.suit === 'hearts')).toHaveLength(26);
    expect(hard.filter((c) => c.suit === 'clubs')).toHaveLength(26);
    expect(hard.filter((c) => c.suit === 'diamonds')).toHaveLength(26);
  });

  it('deals 54 tableau cards (4x6 + 6x5) and 5x10 stock cards deterministically', () => {
    const gameA = createNewGame('medium', 42);
    const gameB = createNewGame('medium', 42);

    expect(gameA.columns).toHaveLength(10);
    expect(gameA.stockDeals).toHaveLength(5);
    expect(gameA.score).toBe(500);
    expect(gameA.moves).toBe(0);

    let tableauCount = 0;
    gameA.columns.forEach((col, colIndex) => {
      const expectedLen = colIndex < 4 ? 6 : 5;
      expect(col).toHaveLength(expectedLen);
      tableauCount += col.length;
      col.forEach((card, cardIdx) => {
        expect(card.faceUp).toBe(cardIdx === col.length - 1);
      });
    });

    expect(tableauCount).toBe(54);
    gameA.stockDeals.forEach((deal) => expect(deal).toHaveLength(10));

    // Deterministic seed check
    expect(gameA.columns.map((c) => c.map((x) => x.id))).toEqual(
      gameB.columns.map((c) => c.map((x) => x.id))
    );
  });
});
