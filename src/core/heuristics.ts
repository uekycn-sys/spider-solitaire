import {
  cloneColumns,
  extractCompletedRunsInPlace,
  getLegalMoves,
  getMaxMovableTailStart,
} from './rules';
import type {
  Card,
  GameState,
  HintResult,
  MoveAction,
  SolverStep,
  Suit,
} from './types';

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
 * Pure potential-function board evaluator for Spider Solitaire:
 * - Completed K->A runs (+15000 each)
 * - Remaining face-down cards (-160 each)
 * - Empty columns with diminishing marginal utility (+320, +270, +210, +150...)
 * - Contiguous same-suit descending sequences (quadratic bonus + playable tail bonus)
 * - Pure single-run columns & King-anchored columns
 * - Natural (mixed-suit) descending links (+14)
 * - Order breaks / buried cards penalty (-28 per break)
 */
export function evaluateBoard(
  columns: Card[][],
  completedCount: number,
  _stockCount: number
): number {
  let score = completedCount * 15000;
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
      score += 55;
    }

    let runLen = 1;
    let breakCount = 0;

    for (let i = firstUpIndex + 1; i < col.length; i++) {
      const prev = col[i - 1];
      const curr = col[i];
      if (prev.suit === curr.suit && prev.rank === curr.rank + 1) {
        runLen++;
      } else {
        score += runLen * runLen * 18;
        runLen = 1;
        if (prev.rank === curr.rank + 1) {
          score += 14;
        } else {
          breakCount++;
          score -= 28;
        }
      }
    }

    // Tail same-suit run gets a slight extra bonus because it is directly movable
    score += runLen * runLen * 18 + runLen * 6;

    // Reward clean pure-run columns with zero hidden cards
    if (firstUpIndex === 0 && breakCount === 0) {
      score += 35;
    }
  }

  // Diminishing returns for multiple empty columns so the solver values the
  // 1st/2nd empty column highly for maneuvering, without hoarding 4+ empty columns
  const emptyWeights = [320, 270, 210, 150, 100, 80, 60, 50, 40, 30];
  for (let i = 0; i < emptyCols; i++) {
    score += emptyWeights[i] ?? 30;
  }

  score -= faceDownCount * 160;

  return score;
}

/**
 * Plans a minimal-damage sequence of moves to fill all empty columns so the
 * player/solver can legally deal from stock, and appends the `{ type: 'deal' }` step.
 *
 * Strategy:
 * 1. Prefer unblocking moves (moving the maximal movable tail of a column where
 *    `tailStart > 0`), which breaks ZERO same-suit runs while unburying hidden or
 *    trapped cards.
 * 2. If all non-empty columns are already pure runs from index 0, split a single
 *    bottom card from the shortest run (length >= 2) into each remaining empty column.
 */
export function planFillEmptyColumnsAndDeal(
  columns: Card[][]
): SolverStep[] | null {
  const totalCards = columns.reduce((sum, c) => sum + c.length, 0);
  if (totalCards < 10) {
    return null;
  }

  const sim = cloneColumns(columns);
  const steps: SolverStep[] = [];

  for (let guard = 0; guard < 12; guard++) {
    const emptyCol = sim.findIndex((c) => c.length === 0);
    if (emptyCol === -1) {
      steps.push({
        action: { type: 'deal' },
        reason: '空列已填满，自动发牌以打开新局面',
      });
      return steps;
    }

    // Tier 1: Unblocking moves that split ZERO same-suit runs (tailStart > 0)
    let bestMove: MoveAction | null = null;
    let bestPriority = -Infinity;
    let bestReason = '将阻塞牌移入空列以准备发牌';

    for (let src = 0; src < sim.length; src++) {
      const col = sim[src];
      if (col.length < 2) continue;

      const tailStart = getMaxMovableTailStart(col);
      if (tailStart > 0) {
        const exposed = col[tailStart - 1];
        const tailLen = col.length - tailStart;
        let priority = 1000;

        if (!exposed.faceUp) {
          // Flipping a hidden card while filling an empty column is strictly best
          priority += 500;
        } else {
          // Prefer removing a short blocker (e.g. single 4♠ sitting on K-Q-J)
          priority += Math.max(0, 80 - tailLen * 6);
          // Bonus if the exposed card is part of a longer run or is a high card (K/Q/J)
          priority += exposed.rank * 3;
          // Extra bonus if the exposed card immediately matches another column's tail
          const exposedIsOrderBreak = exposed.rank !== col[tailStart].rank + 1;
          if (exposedIsOrderBreak) {
            priority += 120;
          }
        }

        if (priority > bestPriority) {
          bestPriority = priority;
          bestMove = {
            type: 'move',
            fromCol: src,
            cardIndex: tailStart,
            toCol: emptyCol,
          };
          bestReason = !exposed.faceUp
            ? '填补空列并翻开下方暗牌，准备发牌'
            : '移开阻塞牌填补空列以准备发牌';
        }
      }
    }

    // Tier 2: Every non-empty column is a pure run from index 0.
    // Split just the bottom 1 card from the shortest multi-card column so long runs stay intact.
    if (!bestMove) {
      let bestSrc = -1;
      let bestScore = -Infinity;

      for (let src = 0; src < sim.length; src++) {
        const col = sim[src];
        if (col.length < 2) continue;
        // Prefer shortest run (avoid splitting a 9-card run when a 2- or 3-card run exists)
        // and prefer lower-rank bottom card (easier to re-attach after dealing)
        const bottomCard = col[col.length - 1];
        const candidateScore = -col.length * 25 - bottomCard.rank;
        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestSrc = src;
        }
      }

      if (bestSrc === -1) {
        return null;
      }

      bestMove = {
        type: 'move',
        fromCol: bestSrc,
        cardIndex: sim[bestSrc].length - 1,
        toCol: emptyCol,
      };
      bestReason = '拆分短牌尾填补空列以准备发牌';
    }

    // Apply simulated move
    const moving = sim[bestMove.fromCol].splice(bestMove.cardIndex);
    sim[bestMove.toCol].push(...moving);
    const srcAfter = sim[bestMove.fromCol];
    if (srcAfter.length > 0 && !srcAfter[srcAfter.length - 1].faceUp) {
      srcAfter[srcAfter.length - 1].faceUp = true;
    }
    extractCompletedRunsInPlace(sim, 1);

    steps.push({ action: bestMove, reason: bestReason });
  }

  return null;
}

/**
 * Returns true if `move` is a strictly useless / oscillating transfer:
 * - Moving a whole column (cardIndex === 0) into an empty column, OR
 * - Splitting an intact same-suit run ONLY to place its sub-tail onto an equal
 *   or shorter same-suit run of the exact same suit & rank (e.g. moving 2♠-A♠
 *   back and forth between two [4♠, 3♠] columns).
 *
 * Conversely, moving a sub-tail onto a STRICTLY LONGER same-suit run
 * (`dstRunLen > srcPrefixLen`, e.g. moving 2♠-A♠ from [3♠, 2♠, A♠] onto
 * [K♠..4♠, 3♠]) IS allowed because it genuinely consolidates a longer run.
 */
export function isUselessSameSuitTransfer(
  columns: Card[][],
  move: MoveAction
): boolean {
  const srcCol = columns[move.fromCol];
  const dstCol = columns[move.toCol];

  if (move.cardIndex === 0 && dstCol.length === 0) {
    return true;
  }

  const tailStart = getMaxMovableTailStart(srcCol);
  const splitSameSuit = move.cardIndex > tailStart;
  if (!splitSameSuit || dstCol.length === 0) {
    return false;
  }

  const movingTop = srcCol[move.cardIndex];
  const dstTop = dstCol[dstCol.length - 1];
  if (dstTop.suit === movingTop.suit && dstTop.rank === movingTop.rank + 1) {
    const srcPrefixLen = move.cardIndex - tailStart;
    const dstRunLen = dstCol.length - getMaxMovableTailStart(dstCol);
    if (dstRunLen <= srcPrefixLen) {
      return true;
    }
  }

  return false;
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
  boardDelta: number;
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
  const boardDelta = nextEval - baseEval;

  const uselessTransfer = isUselessSameSuitTransfer(columns, move);

  let delta = boardDelta;
  let reason = '调整牌序以创造更多空间';

  if (uselessTransfer) {
    delta = -999;
    reason = '无效的同花色来回倒腾';
  } else if (completedRun) {
    delta += 15000;
    reason = '凑齐完整 K→A 同花顺并自动收牌';
  } else if (dstHadSameSuit && !splitSameSuit) {
    delta += 520;
    reason = '连接并延长同花色顺子';
  } else if (revealedHidden) {
    delta += 420;
    reason = '移开阻塞牌以翻开下方暗牌';
  } else if (willCreateEmpty) {
    delta += 300;
    reason = '腾出空列以扩展移牌空间';
  } else if (dstCol.length === 0) {
    const exposed = srcCol[move.cardIndex - 1];
    if (exposed && exposed.faceUp) {
      delta += 40;
      reason = '暂存至空列以释放被压住的牌';
    }
  } else if (dstHadSameSuit && splitSameSuit && boardDelta > 0) {
    reason = '合并至更长的同花色顺子';
  }

  // Discourage splitting an intact same-suit run onto a different-suit card or empty column
  // unless it flips a face-down card or completes a run.
  if (
    !uselessTransfer &&
    splitSameSuit &&
    !completedRun &&
    !revealedHidden &&
    !dstHadSameSuit
  ) {
    delta -= 520;
  }

  // Discourage pure lateral shuffling between two different-suit cards of identical rank
  const srcParent = move.cardIndex > 0 ? srcCol[move.cardIndex - 1] : null;
  if (
    !uselessTransfer &&
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
    delta -= 200;
  }

  const nextHash = hashBoardState(nextColumns, stockCount, nextCompletedCount);
  const isProductive =
    !uselessTransfer &&
    (completedRun ||
      revealedHidden ||
      willCreateEmpty ||
      (dstHadSameSuit && !splitSameSuit) ||
      boardDelta > 15);

  return {
    move,
    nextColumns,
    nextCompletedCount,
    revealedHidden,
    completedRun,
    createdEmpty: willCreateEmpty,
    extendedSameSuit: dstHadSameSuit,
    splitSameSuit,
    boardDelta,
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

  const initialBoardScore = evaluateBoard(
    state.columns,
    completedCount,
    stockCount
  );

  let bestEval: EvaluatedMove | null = null;
  let bestCombinedScore = -Infinity;
  let bestHasTrueProgress = false;

  for (const move of legalMoves) {
    if (isUselessSameSuitTransfer(state.columns, move)) {
      continue;
    }

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
    let hasTrueProgress = first.isProductive;

    // 2-ply lookahead: if the first move doesn't flip an unknown card, evaluate best follow-up
    if (!first.revealedHidden && !first.completedRun) {
      const followUps = getLegalMoves(first.nextColumns);
      let bestFollowScore = 0;
      for (const follow of followUps) {
        if (isUselessSameSuitTransfer(first.nextColumns, follow)) {
          continue;
        }
        const second = simulateAndScoreMove(
          first.nextColumns,
          follow,
          first.nextCompletedCount,
          stockCount
        );
        if (recentStateHashes?.has(second.nextHash)) continue;

        const netBoardGain =
          evaluateBoard(second.nextColumns, second.nextCompletedCount, stockCount) -
          initialBoardScore;
        const followMakesRealProgress =
          second.completedRun || second.revealedHidden || netBoardGain > 15;

        if (followMakesRealProgress && second.score > bestFollowScore) {
          bestFollowScore = second.score;
          hasTrueProgress = true;
        }
      }
      combinedScore += bestFollowScore * 0.68;
    }

    if (
      hasTrueProgress &&
      (!bestHasTrueProgress || combinedScore > bestCombinedScore)
    ) {
      bestHasTrueProgress = true;
      bestCombinedScore = combinedScore;
      bestEval = first;
    } else if (!bestHasTrueProgress && combinedScore > bestCombinedScore) {
      bestCombinedScore = combinedScore;
      bestEval = first;
    }
  }

  if (bestEval && bestHasTrueProgress && combinedScoreIsPositive(bestCombinedScore)) {
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

    const fillPlan = planFillEmptyColumnsAndDeal(state.columns);
    if (fillPlan && fillPlan.length > 0 && fillPlan[0].action.type === 'move') {
      return {
        action: fillPlan[0].action,
        reason: fillPlan[0].reason,
        score: 0,
        status: 'move',
      };
    }

    return {
      action: null,
      reason: '桌面牌数不足 10 张，无法填满空列发牌，建议撤销几步',
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

function combinedScoreIsPositive(score: number): boolean {
  return score > 15;
}
