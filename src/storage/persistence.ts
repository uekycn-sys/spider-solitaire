import type {
  AllStats,
  Difficulty,
  DifficultyStats,
  GameState,
  UserPreferences,
} from '../core/types';

const ACTIVE_GAME_KEY = 'spider_solitaire_active_v1';
const STATS_KEY = 'spider_solitaire_stats_v1';
const PREFS_KEY = 'spider_solitaire_prefs_v1';

const EMPTY_DIFFICULTY_STATS = (): DifficultyStats => ({
  gamesPlayed: 0,
  gamesWon: 0,
  bestScore: null,
  fewestMoves: null,
  bestTimeSeconds: null,
});

export function getDefaultStats(): AllStats {
  return {
    easy: EMPTY_DIFFICULTY_STATS(),
    medium: EMPTY_DIFFICULTY_STATS(),
    hard: EMPTY_DIFFICULTY_STATS(),
  };
}

export function getDefaultPreferences(): UserPreferences {
  return {
    muted: false,
    feltTheme: 'emerald',
    cardBack: 'blue',
    toolbarCollapsed: false,
    cardStyle: 'auto',
  };
}

export function loadActiveGame(): GameState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (
      !parsed ||
      !Array.isArray(parsed.columns) ||
      parsed.columns.length !== 10 ||
      !Array.isArray(parsed.stockDeals) ||
      !parsed.initialSnapshot
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveGame(state: GameState | null): void {
  try {
    if (!state) {
      localStorage.removeItem(ACTIVE_GAME_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors safely
  }
}

export function loadStats(): AllStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return getDefaultStats();
    const parsed = JSON.parse(raw) as Partial<AllStats>;
    return {
      easy: { ...EMPTY_DIFFICULTY_STATS(), ...parsed.easy },
      medium: { ...EMPTY_DIFFICULTY_STATS(), ...parsed.medium },
      hard: { ...EMPTY_DIFFICULTY_STATS(), ...parsed.hard },
    };
  } catch {
    return getDefaultStats();
  }
}

export function saveStats(stats: AllStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota errors safely
  }
}

export function recordGameStarted(difficulty: Difficulty): AllStats {
  const stats = loadStats();
  stats[difficulty].gamesPlayed += 1;
  saveStats(stats);
  return stats;
}

export function recordGameWon(
  difficulty: Difficulty,
  score: number,
  moves: number,
  elapsedSeconds: number
): AllStats {
  const stats = loadStats();
  const entry = stats[difficulty];
  entry.gamesWon += 1;
  entry.bestScore = entry.bestScore === null ? score : Math.max(entry.bestScore, score);
  entry.fewestMoves =
    entry.fewestMoves === null ? moves : Math.min(entry.fewestMoves, moves);
  entry.bestTimeSeconds =
    entry.bestTimeSeconds === null
      ? elapsedSeconds
      : Math.min(entry.bestTimeSeconds, elapsedSeconds);
  saveStats(stats);
  return stats;
}

export function resetAllStats(): AllStats {
  const empty = getDefaultStats();
  saveStats(empty);
  return empty;
}

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return getDefaultPreferences();
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...getDefaultPreferences(), ...parsed };
  } catch {
    return getDefaultPreferences();
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore
  }
}
