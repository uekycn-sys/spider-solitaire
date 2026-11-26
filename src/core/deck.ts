import type { Card, Difficulty, Rank, Suit } from './types';
import type { GameState } from './types';

const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/**
 * Mulberry32 deterministic PRNG for reproducible deals and unit testing.
 */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns the suit distribution (8 decks total = 104 cards) for a difficulty.
 */
export function getSuitsForDifficulty(difficulty: Difficulty): Suit[] {
  switch (difficulty) {
    case 'easy':
      return Array.from({ length: 8 }, () => 'spades');
    case 'medium':
      return [
        'spades', 'spades', 'spades', 'spades',
        'hearts', 'hearts', 'hearts', 'hearts',
      ];
    case 'hard':
      return [
        'spades', 'hearts', 'clubs', 'diamonds',
        'spades', 'hearts', 'clubs', 'diamonds',
      ];
  }
}

/**
 * Generates the unshuffled 104-card deck for a given Spider Solitaire difficulty.
 */
export function createDeck(difficulty: Difficulty): Card[] {
  const deckSuits = getSuitsForDifficulty(difficulty);
  const cards: Card[] = [];
  let id = 1;

  for (const suit of deckSuits) {
    for (const rank of RANKS) {
      cards.push({
        id: id++,
        suit,
        rank,
        faceUp: false,
      });
    }
  }

  return cards;
}

/**
 * Fisher-Yates shuffle returning a new array of cloned cards.
 */
export function shuffleCards(cards: Card[], rng: () => number): Card[] {
  const copy = cards.map((card) => ({ ...card }));
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function cloneCols(columns: Card[][]): Card[][] {
  return columns.map((col) => col.map((card) => ({ ...card })));
}

function cloneDeals(deals: Card[][]): Card[][] {
  return deals.map((deal) => deal.map((card) => ({ ...card })));
}

/**
 * Creates a standard Spider Solitaire initial game state:
 * - 54 cards dealt across 10 columns (first 4 cols: 6 cards; last 6 cols: 5 cards; only top card face-up)
 * - 50 cards split into 5 stock deals of 10 cards each
 * - Initial score: 500
 */
export function createNewGame(difficulty: Difficulty, seed?: number): GameState {
  const resolvedSeed =
    seed !== undefined ? seed >>> 0 : (Math.floor(Math.random() * 0xffffffff) >>> 0);
  const rng = createRng(resolvedSeed);
  const shuffled = shuffleCards(createDeck(difficulty), rng);

  const columns: Card[][] = Array.from({ length: 10 }, () => []);
  let cursor = 0;

  for (let colIndex = 0; colIndex < 10; colIndex++) {
    const count = colIndex < 4 ? 6 : 5;
    for (let i = 0; i < count; i++) {
      const card = { ...shuffled[cursor++] };
      card.faceUp = i === count - 1;
      columns[colIndex].push(card);
    }
  }

  const stockDeals: Card[][] = [];
  for (let dealIndex = 0; dealIndex < 5; dealIndex++) {
    const dealBatch: Card[] = [];
    for (let i = 0; i < 10; i++) {
      dealBatch.push({ ...shuffled[cursor++], faceUp: false });
    }
    stockDeals.push(dealBatch);
  }

  return {
    id: `${difficulty}-${resolvedSeed}-${Date.now().toString(36)}`,
    seed: resolvedSeed,
    difficulty,
    columns,
    stockDeals,
    completedRuns: [],
    moves: 0,
    penalties: 0,
    score: 500,
    elapsedSeconds: 0,
    won: false,
    history: [],
    initialSnapshot: {
      columns: cloneCols(columns),
      stockDeals: cloneDeals(stockDeals),
    },
  };
}
