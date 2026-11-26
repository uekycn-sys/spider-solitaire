import {
  evaluateBoard,
  hashBoardState,
  isUselessSameSuitTransfer,
  planFillEmptyColumnsAndDeal,
  simulateAndScoreMove,
} from './heuristics';
import { getLegalMoves } from './rules';
import type {
  Card,
  GameState,
  SolverResponse,
  SolverStep,
} from './types';

export interface SolverOptions {
  beamWidth?: number;
  maxDepth?: number;
  maxNodes?: number;
  avoidHashes?: string[];
  requestId?: number;
}

interface BeamNode {
  columns: Card[][];
  completedCount: number;
  stockCount: number;
  path: SolverStep[];
  boardScore: number;
  rankScore: number;
  revealedUnknown: boolean;
  won: boolean;
}

function runBeamSearch(
  columns: Card[][],
  initialCompleted: number,
  stockCount: number,
  beamWidth: number,
  maxDepth: number,
  maxNodes: number,
  avoidHashes: string[]
): { bestNode: BeamNode | null; initialBoardScore: number } {
  const visited = new Set<string>(avoidHashes);
  const rootHash = hashBoardState(columns, stockCount, initialCompleted);
  visited.add(rootHash);

  const initialBoardScore = evaluateBoard(columns, initialCompleted, stockCount);

  let beam: BeamNode[] = [
    {
      columns,
      completedCount: initialCompleted,
      stockCount,
      path: [],
      boardScore: initialBoardScore,
      rankScore: initialBoardScore,
      revealedUnknown: false,
      won: false,
    },
  ];

  let bestNode: BeamNode | null = null;
  let nodesExpanded = 0;

  for (let depth = 0; depth < maxDepth; depth++) {
    const nextCandidates: BeamNode[] = [];

    for (const node of beam) {
      if (node.won || node.revealedUnknown) {
        nextCandidates.push(node);
        continue;
      }

      const moves = getLegalMoves(node.columns);
      for (const move of moves) {
        if (nodesExpanded >= maxNodes) break;
        if (isUselessSameSuitTransfer(node.columns, move)) continue;
        nodesExpanded++;

        const evaluated = simulateAndScoreMove(
          node.columns,
          move,
          node.completedCount,
          node.stockCount
        );

        if (visited.has(evaluated.nextHash)) {
          continue;
        }
        visited.add(evaluated.nextHash);

        const nextBoardScore = evaluateBoard(
          evaluated.nextColumns,
          evaluated.nextCompletedCount,
          node.stockCount
        );

        const stepLen = node.path.length + 1;
        // Pure state-potential ranking: temporary staging into empty columns or
        // tactical splits are NOT permanently penalized once the follow-up pays off!
        const nextRankScore =
          nextBoardScore +
          (evaluated.revealedHidden ? 520 : 0) +
          (evaluated.completedRun ? 6000 : 0) -
          stepLen * 18;

        const candidate: BeamNode = {
          columns: evaluated.nextColumns,
          completedCount: evaluated.nextCompletedCount,
          stockCount: node.stockCount,
          path: [...node.path, { action: move, reason: evaluated.reason }],
          boardScore: nextBoardScore,
          rankScore: nextRankScore,
          revealedUnknown: evaluated.revealedHidden,
          won: evaluated.nextCompletedCount >= 8,
        };

        nextCandidates.push(candidate);

        if (
          !bestNode ||
          candidate.won ||
          (!bestNode.won && candidate.rankScore > bestNode.rankScore)
        ) {
          bestNode = candidate;
        }
      }

      if (nodesExpanded >= maxNodes) break;
    }

    if (nextCandidates.length === 0) break;

    nextCandidates.sort((a, b) => {
      if (a.won !== b.won) return a.won ? -1 : 1;
      return b.rankScore - a.rankScore;
    });

    beam = nextCandidates.slice(0, beamWidth);

    if (beam[0].won) {
      return { bestNode: beam[0], initialBoardScore };
    }

    if (nodesExpanded >= maxNodes) break;
  }

  return { bestNode, initialBoardScore };
}

/**
 * Inspects recent undo history to recommend how many steps back lead to a
 * meaningfully different decision point (e.g. before a deal or before losing an
 * alternative branch), instead of blindly suggesting 3 steps.
 */
function computeSmartUndoSuggestion(state: GameState): number {
  const historyLen = state.history.length;
  if (historyLen === 0) return 0;

  const currStock = state.stockDeals.length;
  const maxInspect = Math.min(historyLen, 12);

  for (let back = 1; back <= maxInspect; back++) {
    const entry = state.history[historyLen - back];
    // Rewinding before the last stock deal or before an empty column was consumed
    // often opens completely new tactical branches.
    if (entry.stockDeals.length > currStock) {
      return back;
    }
    const legalMoves = getLegalMoves(entry.columns);
    if (legalMoves.length >= 3 && back >= 2) {
      return back;
    }
  }

  return Math.min(historyLen, 4);
}

/**
 * Pure TypeScript Beam Search solver with canonical state hashing and an atomic
 * empty-column fill-and-deal planner.
 *
 * Runs cleanly inside both Node (Vitest) and Web Workers.
 */
export function solveFromState(
  state: GameState,
  options: SolverOptions = {}
): SolverResponse {
  const requestId = options.requestId ?? 0;
  const beamWidth = options.beamWidth ?? 80;
  const maxDepth = options.maxDepth ?? 16;
  const maxNodes = options.maxNodes ?? 5500;
  const stockCount = state.stockDeals.length;
  const initialCompleted = state.completedRuns.length;

  if (state.won || initialCompleted >= 8) {
    return {
      requestId,
      steps: [],
      status: 'won_path',
      message: '本局已完成！',
    };
  }

  const avoidHashes = options.avoidHashes ?? [];

  // Phase 1: Pure state-potential Beam Search looking for runs, flips, or strict board improvements
  const { bestNode, initialBoardScore } = runBeamSearch(
    state.columns,
    initialCompleted,
    stockCount,
    beamWidth,
    maxDepth,
    maxNodes,
    avoidHashes
  );

  if (
    bestNode &&
    bestNode.path.length > 0 &&
    (bestNode.won ||
      bestNode.completedCount > initialCompleted ||
      bestNode.revealedUnknown ||
      bestNode.boardScore > initialBoardScore + 15)
  ) {
    return {
      requestId,
      steps: bestNode.path,
      status: bestNode.won ? 'won_path' : 'found',
    };
  }

  // Phase 2: If stock remains, deal directly or atomically fill empty columns then deal!
  const emptyCols = state.columns.filter((c) => c.length === 0).length;
  if (stockCount > 0) {
    if (emptyCols === 0) {
      return {
        requestId,
        steps: [
          {
            action: { type: 'deal' },
            reason: '当前无更优移牌，自动发牌以打开新局面',
          },
        ],
        status: 'found',
      };
    }

    const fillAndDealSteps = planFillEmptyColumnsAndDeal(state.columns);
    if (fillAndDealSteps && fillAndDealSteps.length > 0) {
      return {
        requestId,
        steps: fillAndDealSteps,
        status: 'found',
      };
    }

    const undoSuggestion = computeSmartUndoSuggestion(state);
    return {
      requestId,
      steps: [],
      status: 'deadlock',
      suggestedUndoSteps: undoSuggestion,
      message:
        undoSuggestion > 0
          ? `桌面牌数不足 10 张无法填满空列发牌，建议回退 ${undoSuggestion} 步`
          : '桌面牌数不足 10 张无法填满空列发牌，建议开启新局',
    };
  }

  // Phase 3: Endgame with 0 stock left — retry without avoidHashes & deeper budget
  // in case an unconventional multi-step reshuffle unlocks a completion or flip.
  if (avoidHashes.length > 0) {
    const rescue = runBeamSearch(
      state.columns,
      initialCompleted,
      stockCount,
      Math.max(beamWidth, 100),
      Math.max(maxDepth, 18),
      Math.max(maxNodes, 8000),
      []
    );
    if (
      rescue.bestNode &&
      rescue.bestNode.path.length > 0 &&
      (rescue.bestNode.won ||
        rescue.bestNode.completedCount > initialCompleted ||
        rescue.bestNode.revealedUnknown ||
        rescue.bestNode.boardScore > rescue.initialBoardScore + 25)
    ) {
      return {
        requestId,
        steps: rescue.bestNode.path,
        status: rescue.bestNode.won ? 'won_path' : 'found',
      };
    }
  }

  const undoSuggestion = computeSmartUndoSuggestion(state);
  return {
    requestId,
    steps: [],
    status: 'deadlock',
    suggestedUndoSteps: undoSuggestion,
    message:
      undoSuggestion > 0
        ? `当前牌局暂无可推进解法，建议回退 ${undoSuggestion} 步尝试其他路线`
        : '当前开局暂无可行推进路径，建议开启新局',
  };
}
