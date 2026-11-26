import {
  cloneColumns,
  extractCompletedRunsInPlace,
  getLegalMoves,
  getMaxMovableTailStart,
} from './rules';
import type { Card, GameState, HintResult, MoveAction, Suit } from './types';

const SUIT_CHAR: Record<Suit, string> = {
  spades: 'S',
  hearts: 'H',
  clubs: 'C',
  diamonds: 'D',
};

/**
 * Produces a canonical permutation-invariant hash of the visible board state.
 * Because Spider Solitaire columns are functionally symmetric, sorting column
 * signatures dramatically reduces redundant branches in Beam Search.
 */
export function hashBoardState(
  columns: Card[][],
  stockCount: number,
  completedCount: number
): string {
  const sigs = columns.map((col) => {
    let downCount = 0;
    const upParts: string[] = [];
    for (const card of col) {
      if (!card.faceUp) {
        downCount++;
      } else {
        upParts.push(`${SUIT_CHAR[card.suit]}${card.rank}`);
      }
    }
    return `${downCount}:${upParts.join(',')}`;
  });
  sigs.sort();
  return `${stockCount}|${completedCount}|${sigs.join(';')}`;
}

/**
 * Evaluates a board position using Spider Solitaire domain heuristics:
 * - Completed K->A runs
 * - Hidden face-down cards remaining
 * - Empty columns (critical mobility)
 * - Same-suit contiguous sequence quadratic bonus
 * - Natural mixed-suit transitions & order inversions penalty
 * - Kings anchored at column base
 */
export function evaluateBoard(
  columns: Card[][],
  completedCount: number,
  _stockCount: number
): number {
  let score = completedCount * 10000;
  let emptyCols = 0;
  let faceDownCount = 0;

  for (const col of columns) {
    if (col.length === 0) {
      emptyCols++;
      continue;
    }

    let firstUpIndex = -1;
    for (let i = 0; i < col.length; i++) {
      if (!col[i].faceUp) {
        faceDownCount++;
      } else if (firstUpIndex === -1) {
        firstUpIndex = i;
      }
    }

    if (firstUpIndex === -1) continue;

    if (firstUpIndex === 0 && col[0].rank === 13) {
      score += 36;
    }

    let runLen = 1;
    for (let i = firstUpIndex + 1; i < col.length; i++) {
      const prev = col[i - 1];
      const curr = col[i];
      if (prev.suit === curr.suit && prev.rank === curr.rank + 1) {
        runLen++;
      } else {
        score += runLen * runLen * 14;
        runLen = 1;
        if (prev.rank === curr.rank + 1) {
          score += 10;
        } else {
          // Order inversion / buried blocker
          score -= 14;
        }
      }
    }
    score += runLen * runLen * 14;
  }

  score += emptyCols * 240;
  score -= faceDownCount * 120;

  return score;
}

export interface EvaluatedMove {
  move: MoveAction;
  nextColumns: Card[][];
  nextCompletedCount: number;
  revealedHidden: boolean;
  completedRun: boolean;
  createdEmpty: boolean;
  extendedSameSuit: boolean;
  splitSameSuit: boolean;
  score: number;
  reason: string;
  isProductive: boolean;
  nextHash: string;
}

/**
 * Simulates a single move and scores it across multiple strategic dimensions.
 */
export function simulateAndScoreMove(
  columns: Card[][],
  move: MoveAction,
  completedCount: number,
  stockCount: number
): EvaluatedMove {
  const baseEval = evaluateBoard(columns, completedCount, stockCount);
  const srcCol = columns[move.fromCol];
  const dstCol = columns[move.toCol];

  const tailStart = getMaxMovableTailStart(srcCol);
  const splitSameSuit = move.cardIndex > tailStart;
  const willRevealHidden =
    move.cardIndex > 0 && !srcCol[move.cardIndex - 1].faceUp;
  const willCreateEmpty = move.cardIndex === 0 && srcCol.length > 0;
  const dstHadSameSuit =
    dstCol.length > 0 &&
    dstCol[dstCol.length - 1].faceUp &&
    dstCol[dstCol.length - 1].suit === srcCol[move.cardIndex].suit &&
    dstCol[dstCol.length - 1].rank === srcCol[move.cardIndex].rank + 1;

  const nextColumns = cloneColumns(columns);
  const moving = nextColumns[move.fromCol].splice(move.cardIndex);
  nextColumns[move.toCol].push(...moving);

  let revealedHidden = willRevealHidden;
  if (
    nextColumns[move.fromCol].length > 0 &&
    !nextColumns[move.fromCol][nextColumns[move.fromCol].length - 1].faceUp
  ) {
    nextColumns[move.fromCol][nextColumns[move.fromCol].length - 1].faceUp = true;
    revealedHidden = true;
  }

  const { extracted, flippedCols } = extractCompletedRunsInPlace(nextColumns, 1);
  if (flippedCols.length > 0) {
    revealedHidden = true;
  }

  const nextCompletedCount = completedCount + extracted.length;
  const completedRun = extracted.length > 0;
  const nextEval = evaluateBoard(nextColumns, nextCompletedCount, stockCount);

  let delta = nextEval - baseEval;
  let reason = '调整牌序以创造更多空间';

  if (completedRun) {
    delta += 15000;
    reason = '凑齐完整 K→A 同花顺并自动收牌';
  } else if (dstHadSameSuit && !splitSameSuit) {
    delta += 520;
    reason = '连接并延长同花色顺子';
  } else if (revealedHidden) {
    delta += 400;
    reason = '移开阻塞牌以翻开下方暗牌';
  } else if (willCreateEmpty) {
    delta += 320;
    reason = '腾出空列以扩展移牌空间';
  } else if (dstCol.length === 0) {
    // Moving a sub-stack into an empty column: check whether it exposes a same-suit partner or non-empty card
    const exposed = srcCol[move.cardIndex - 1];
    if (exposed && exposed.faceUp) {
      delta += 45;
      reason = '暂存至空列以释放被压住的牌';
    }
  } else if (dstHadSameSuit && splitSameSuit) {
    // Only worthwhile if the source tail was shorter than destination or unlocks something
    delta += 60;
    reason = '重组同花色顺子';
  }

  // Discourage splitting an intact same-suit run onto a different-suit card or empty column
  // unless it flips a face-down card or completes a run.
  if (splitSameSuit && !completedRun && !revealedHidden && !dstHadSameSuit) {
    delta -= 650;
  }

  // Discourage moving from a single-suit column onto another single card of a different suit
  // when both have the exact same parent state (pure lateral shuffling).
  const srcParent = move.cardIndex > 0 ? srcCol[move.cardIndex - 1] : null;
  if (
    !completedRun &&
    !revealedHidden &&
    !willCreateEmpty &&
    !dstHadSameSuit &&
    srcParent &&
    srcParent.faceUp &&
    dstCol.length > 0 &&
    srcParent.rank === dstCol[dstCol.length - 1].rank &&
    srcParent.suit !== moving[0].suit
  ) {
    delta -= 180;
  }

  const nextHash = hashBoardState(nextColumns, stockCount, nextCompletedCount);
  const isProductive =
    completedRun ||
    revealedHidden ||
    willCreateEmpty ||
    (dstHadSameSuit && !splitSameSuit) ||
    delta > 15;

  return {
    move,
    nextColumns,
    nextCompletedCount,
    revealedHidden,
    completedRun,
    createdEmpty: willCreateEmpty,
    extendedSameSuit: dstHadSameSuit,
    splitSameSuit,
    score: delta,
    reason,
    isProductive,
    nextHash,
  };
}

/**
 * Computes the best single-step hint using 2-ply lookahead while avoiding
 * previously visited board hashes to prevent endless back-and-forth hints.
 */
export function getBestHint(
  state: GameState,
  recentStateHashes?: Set<string>
): HintResult {
  const legalMoves = getLegalMoves(state.columns);
  const stockCount = state.stockDeals.length;
  const completedCount = state.completedRuns.length;

  let bestEval: EvaluatedMove | null = null;
  let bestCombinedScore = -Infinity;

  for (const move of legalMoves) {
    const first = simulateAndScoreMove(
      state.columns,
      move,
      completedCount,
      stockCount
    );

    if (recentStateHashes?.has(first.nextHash)) {
      continue;
    }

    let combinedScore = first.score;

    // 2-ply lookahead: if the first move doesn't flip an unknown card, evaluate best follow-up
    if (!first.revealedHidden && !first.completedRun) {
      const followUps = getLegalMoves(first.nextColumns);
      let bestFollowScore = 0;
      for (const follow of followUps) {
        const second = simulateAndScoreMove(
          first.nextColumns,
          follow,
          first.nextCompletedCount,
          stockCount
        );
        if (recentStateHashes?.has(second.nextHash)) continue;
        if (second.score > bestFollowScore) {
          bestFollowScore = second.score;
        }
      }
      combinedScore += bestFollowScore * 0.65;
    }

    if (combinedScore > bestCombinedScore) {
      bestCombinedScore = combinedScore;
      bestEval = first;
    }
  }

  if (bestEval && (bestEval.isProductive || bestCombinedScore > 30)) {
    return {
      action: bestEval.move,
      reason: bestEval.reason,
      score: bestCombinedScore,
      status: 'move',
    };
  }

  if (stockCount > 0) {
    const emptyCount = state.columns.filter((c) => c.length === 0).length;
    if (emptyCount === 0) {
      return {
        action: { type: 'deal' },
        reason: '当前桌面暂无明显增益走法，建议点击右下角发牌堆发牌',
        score: 0,
        status: 'deal',
      };
    }

    if (bestEval) {
      return {
        action: bestEval.move,
        reason: '需先填满空列，方可继续从发牌堆发牌',
        score: bestCombinedScore,
        status: 'move',
      };
    }

    return {
      action: null,
      reason: '存在空列无法发牌且暂无可移序列，建议撤销几步',
      score: -100,
      status: 'fill_empty_to_deal',
    };
  }

  if (bestEval && bestCombinedScore > -100) {
    return {
      action: bestEval.move,
      reason: bestEval.reason,
      score: bestCombinedScore,
      status: 'move',
    };
  }

  return {
    action: null,
    reason: '当前已无有效走法，建议撤销几步或重新开局',
    score: -999,
    status: 'stuck',
  };
}
