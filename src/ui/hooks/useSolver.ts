import { useCallback, useEffect, useRef, useState } from 'react';
import { hashBoardState } from '../../core/heuristics';
import { solveFromState } from '../../core/solver';
import type {
  GameAction,
  GameState,
  SolverRequest,
  SolverResponse,
  SolverStep,
} from '../../core/types';
import type { ActiveHintVisual } from '../components/TableauBoard';
import type { SolverUiStatus } from '../components/TopHud';
import type { ToastMessage } from './useGameController';

interface UseSolverOptions {
  gameState: GameState;
  executeMove: (move: Extract<GameAction, { type: 'move' }>, animate?: boolean) => boolean;
  handleDealStock: () => boolean;
  setActiveHint: (hint: ActiveHintVisual | null) => void;
  showToast: (
    text: string,
    tone?: ToastMessage['tone'],
    action?: { label: string; handler: () => void },
    durationMs?: number
  ) => void;
  handleUndoSteps: (steps: number) => void;
}

export function useSolver({
  gameState,
  executeMove,
  handleDealStock,
  setActiveHint,
  showToast,
  handleUndoSteps,
}: UseSolverOptions) {
  const [status, setStatus] = useState<SolverUiStatus>('idle');
  const [queue, setQueue] = useState<SolverStep[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const visitedHashesRef = useRef<Set<string>>(new Set());
  const phaseTimerRef = useRef<number | null>(null);

  // Keep latest callbacks/state in refs so 1-second timer ticks on elapsedSeconds
  // NEVER reset or cancel the 350ms step preview timer!
  const latestStateRef = useRef(gameState);
  latestStateRef.current = gameState;
  const executeMoveRef = useRef(executeMove);
  executeMoveRef.current = executeMove;
  const handleDealStockRef = useRef(handleDealStock);
  handleDealStockRef.current = handleDealStock;

  const boardSignature = `${gameState.id}|${gameState.moves}|${gameState.completedRuns.length}|${gameState.stockDeals.length}`;

  const clearPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current !== null) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  }, []);

  const stopSolver = useCallback(() => {
    clearPhaseTimer();
    requestIdRef.current += 1;
    setQueue([]);
    setStatus('idle');
    setActiveHint(null);
  }, [clearPhaseTimer, setActiveHint]);

  // Spawn ES module Web Worker
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(
        new URL('../../core/solver.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }
    return () => {
      clearPhaseTimer();
      worker?.terminate();
      workerRef.current = null;
    };
  }, [clearPhaseTimer]);

  const handleWorkerResponse = useCallback(
    (res: SolverResponse) => {
      if (res.requestId !== requestIdRef.current) return;

      if (res.status === 'deadlock' || res.steps.length === 0) {
        clearPhaseTimer();
        setQueue([]);
        setStatus('idle');
        setActiveHint(null);

        const undoCount = res.suggestedUndoSteps ?? 0;
        showToast(
          res.message ?? '当前牌局暂无可推进解法，建议回退几步或开启新局',
          'warning',
          undoCount > 0
            ? {
                label: `回退 ${undoCount} 步`,
                handler: () => handleUndoSteps(undoCount),
              }
            : undefined,
          5000
        );
        return;
      }

      setQueue(res.steps);
      setStatus((prev) => (prev === 'paused' ? 'paused' : 'running'));
    },
    [clearPhaseTimer, setActiveHint, showToast, handleUndoSteps]
  );

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    const onMessage = (e: MessageEvent<SolverResponse>) => {
      handleWorkerResponse(e.data);
    };
    worker.addEventListener('message', onMessage);
    return () => worker.removeEventListener('message', onMessage);
  }, [handleWorkerResponse]);

  const requestNextBatch = useCallback(
    (stateSnapshot: GameState) => {
      if (stateSnapshot.won) {
        stopSolver();
        return;
      }

      const nextId = ++requestIdRef.current;
      setStatus('searching');

      const avoid = Array.from(visitedHashesRef.current).slice(-80);
      if (workerRef.current) {
        const req: SolverRequest = {
          requestId: nextId,
          state: stateSnapshot,
          avoidHashes: avoid,
        };
        workerRef.current.postMessage(req);
      } else {
        window.setTimeout(() => {
          const res = solveFromState(stateSnapshot, {
            requestId: nextId,
            avoidHashes: avoid,
          });
          handleWorkerResponse(res);
        }, 16);
      }
    },
    [stopSolver, handleWorkerResponse]
  );

  const startSolver = useCallback(() => {
    const curr = latestStateRef.current;
    if (curr.won) return;
    if (status === 'running' || status === 'searching') {
      return;
    }
    if (status === 'paused') {
      setStatus('running');
      return;
    }

    clearPhaseTimer();
    visitedHashesRef.current = new Set([
      hashBoardState(
        curr.columns,
        curr.stockDeals.length,
        curr.completedRuns.length
      ),
    ]);
    setQueue([]);
    requestNextBatch(curr);
  }, [status, clearPhaseTimer, requestNextBatch]);

  const togglePause = useCallback(() => {
    if (status === 'running' || status === 'searching') {
      clearPhaseTimer();
      setActiveHint(null);
      setStatus('paused');
    } else if (status === 'paused') {
      if (queue.length > 0) {
        setStatus('running');
      } else {
        requestNextBatch(latestStateRef.current);
      }
    }
  }, [status, queue.length, clearPhaseTimer, setActiveHint, requestNextBatch]);

  // Step demonstration cadence: highlight source + dashed target for 350ms, then execute move
  useEffect(() => {
    if (status !== 'running') return;
    const curr = latestStateRef.current;
    if (curr.won) {
      stopSolver();
      return;
    }

    if (queue.length === 0) {
      requestNextBatch(curr);
      return;
    }

    const nextStep = queue[0];
    const currHash = hashBoardState(
      curr.columns,
      curr.stockDeals.length,
      curr.completedRuns.length
    );
    visitedHashesRef.current.add(currHash);

    if (nextStep.action.type === 'move') {
      const move = nextStep.action;
      setActiveHint({
        type: 'move',
        fromCol: move.fromCol,
        cardIndex: move.cardIndex,
        toCol: move.toCol,
      });

      phaseTimerRef.current = window.setTimeout(() => {
        setActiveHint(null);
        const beforeCompleted = latestStateRef.current.completedRuns.length;
        const ok = executeMoveRef.current(move, true);
        if (!ok) {
          setQueue([]);
          requestNextBatch(latestStateRef.current);
          return;
        }
        // Clear visited loop memory whenever a K->A run completes (irreversible progress)
        if (latestStateRef.current.completedRuns.length > beforeCompleted) {
          visitedHashesRef.current.clear();
        }
        setQueue((prev) => prev.slice(1));
      }, 350);
    } else {
      setActiveHint({ type: 'deal' });
      phaseTimerRef.current = window.setTimeout(() => {
        setActiveHint(null);
        const ok = handleDealStockRef.current();
        if (!ok) {
          stopSolver();
          return;
        }
        // Dealing adds 10 new cards — reset visited hashes & re-plan immediately
        visitedHashesRef.current.clear();
        setQueue([]);
      }, 350);
    }

    return () => {
      clearPhaseTimer();
    };
  }, [
    status,
    queue,
    boardSignature,
    setActiveHint,
    requestNextBatch,
    stopSolver,
    clearPhaseTimer,
  ]);

  return {
    solverStatus: status,
    startSolver,
    togglePause,
    stopSolver,
  };
}
