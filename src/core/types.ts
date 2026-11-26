export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Card {
  id: number;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export interface CompletedRun {
  id: number;
  suit: Suit;
  cards: Card[];
}

export interface MoveAction {
  type: 'move';
  fromCol: number;
  cardIndex: number;
  toCol: number;
}

export interface DealAction {
  type: 'deal';
}

export type GameAction = MoveAction | DealAction;

export interface HistoryEntry {
  columns: Card[][];
  stockDeals: Card[][];
  completedRuns: CompletedRun[];
  moves: number;
}

export interface BoardSnapshot {
  columns: Card[][];
  stockDeals: Card[][];
}

export interface GameState {
  id: string;
  seed: number;
  difficulty: Difficulty;
  columns: Card[][];
  stockDeals: Card[][];
  completedRuns: CompletedRun[];
  moves: number;
  penalties: number;
  score: number;
  elapsedSeconds: number;
  won: boolean;
  history: HistoryEntry[];
  initialSnapshot: BoardSnapshot;
}

export interface ExtractedRunInfo {
  colIndex: number;
  run: CompletedRun;
}

export interface MoveResult {
  state: GameState;
  extractedRuns: ExtractedRunInfo[];
  flippedCols: number[];
}

export interface DealResult {
  state: GameState;
  dealtCards: Card[];
  extractedRuns: ExtractedRunInfo[];
  flippedCols: number[];
}

export interface HintResult {
  action: MoveAction | DealAction | null;
  reason: string;
  score: number;
  status: 'move' | 'deal' | 'fill_empty_to_deal' | 'stuck';
}

export interface SolverStep {
  action: GameAction;
  reason: string;
}

export interface SolverRequest {
  requestId: number;
  state: GameState;
  avoidHashes?: string[];
}

export interface SolverResponse {
  requestId: number;
  steps: SolverStep[];
  status: 'found' | 'won_path' | 'deadlock';
  suggestedUndoSteps?: number;
  message?: string;
}

export interface DifficultyStats {
  gamesPlayed: number;
  gamesWon: number;
  bestScore: number | null;
  fewestMoves: number | null;
  bestTimeSeconds: number | null;
}

export type AllStats = Record<Difficulty, DifficultyStats>;

export type FeltTheme = 'emerald' | 'navy' | 'burgundy';
export type CardBackTheme = 'blue' | 'crimson' | 'emerald';

export interface UserPreferences {
  muted: boolean;
  feltTheme: FeltTheme;
  cardBack: CardBackTheme;
  toolbarCollapsed: boolean;
}
