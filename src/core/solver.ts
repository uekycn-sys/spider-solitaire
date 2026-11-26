import {
  evaluateBoard,
  hashBoardState,
  simulateAndScoreMove,
} from './heuristics';
import { getLegalMoves } from './rules';
import type { Card, GameState, SolverResponse, SolverStep } from './types';

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
  cumulativeScore: number;
  boardScore: number;
  revealedUnknown: boolean;
  won: boolean;
}

/**
 * Pure TypeScript Beam Search solver with canonical state hashing.
 * Runs cleanly inside both Node (Vitest) and Web Workers.
 *
 * Design detail: when a simulated branch flips a previously hidden face-down card,
 * the solver does not peek at the card's value ahead of time; instead it awards the
 * reveal bonus and stops expanding that branch so the UI applies the move, reveals
 * the real card, and requests the next solver batch seamlessly.
 */
export function solveFromState(
  state: GameState,
  options: SolverOptions = {}
): SolverResponse {
  const requestId = options.requestId ?? 0;
  const beamWidth = options.beamWidth ?? 44;
  const maxDepth = options.maxDepth ?? 12;
  const maxNodes = options.maxNodes ?? 1600;
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

  const visited = new Set<string>(options.avoidHashes ?? []);
  const rootHash = hashBoardState(state.columns, stockCount, initialCompleted);
  visited.add(rootHash);

  const initialBoardScore = evaluateBoard(
    state.columns,
    initialCompleted,
    stockCount
  );

  let beam: BeamNode[] = [
    {
      columns: state.columns,
      completedCount: initialCompleted,
      stockCount,
      path: [],
      cumulativeScore: 0,
      boardScore: initialBoardScore,
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
        nodesExpanded++;

        const evaluated = simulateAndScoreMove(
          node.columns,
          move,
          node.completedCount,
          node.stockCount
        );

        // Prune clearly destructive splits unless it is the very first depth fallback
        if (evaluated.score < -350 && depth > 0) {
          continue;
        }

        if (visited.has(evaluated.nextHash)) {
          continue;
        }
        visited.add(evaluated.nextHash);

        const nextBoardScore = evaluateBoard(
          evaluated.nextColumns,
          evaluated.nextCompletedCount,
          node.stockCount
        );

        // Slight step cost (-12) encourages shorter, crisp move sequences
        const nextCumulative =
          node.cumulativeScore + evaluated.score - 12;

        const candidate: BeamNode = {
          columns: evaluated.nextColumns,
          completedCount: evaluated.nextCompletedCount,
          stockCount: node.stockCount,
          path: [
            ...node.path,
            { action: move, reason: evaluated.reason },
          ],
          cumulativeScore: nextCumulative,
          boardScore: nextBoardScore,
          revealedUnknown: evaluated.revealedHidden,
          won: evaluated.nextCompletedCount >= 8,
        };

        nextCandidates.push(candidate);

        if (
          !bestNode ||
          candidate.won ||
          candidate.cumulativeScore > bestNode.cumulativeScore
        ) {
          bestNode = candidate;
        }
      }

      if (nodesExpanded >= maxNodes) break;
    }

    if (nextCandidates.length === 0) break;

    nextCandidates.sort((a, b) => {
      if (a.won !== b.won) return a.won ? -1 : 1;
      return b.cumulativeScore - a.cumulativeScore;
    });

    beam = nextCandidates.slice(0, beamWidth);

    if (beam[0].won) {
      return {
        requestId,
        steps: beam[0].path,
        status: 'won_path',
      };
    }

    if (nodesExpanded >= maxNodes) break;
  }

  // Accept the best path if it achieves meaningful positive progress
  if (
    bestNode &&
    bestNode.path.length > 0 &&
    (bestNode.completedCount > initialCompleted ||
      bestNode.revealedUnknown ||
      bestNode.boardScore > initialBoardScore + 20 ||
      bestNode.cumulativeScore > 30)
  ) {
    return {
      requestId,
      steps: bestNode.path,
      status: bestNode.won ? 'won_path' : 'found',
    };
  }

  // Otherwise consider dealing from stock if possible
  const emptyCols = state.columns.filter((c) => c.length === 0).length;
  if (stockCount > 0 && emptyCols === 0) {
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

  // If stock remains and empty columns block dealing, try filling empty columns
  if (stockCount > 0 && emptyCols > 0 && bestNode && bestNode.path.length > 0) {
    const fillsEmpty = bestNode.columns.filter((c) => c.length === 0).length < emptyCols;
    if (fillsEmpty) {
      return {
        requestId,
        steps: bestNode.path,
        status: 'found',
      };
    }
  }

  return {
    requestId,
    steps: [],
    status: 'deadlock',
    suggestedUndoSteps: Math.min(state.history.length, 3),
    message:
      state.history.length > 0
        ? '当前牌局暂无可推进解法，建议回退几步或重新尝试'
        : '当前开局暂无可行推进路径，建议开启新局',
  };
}
