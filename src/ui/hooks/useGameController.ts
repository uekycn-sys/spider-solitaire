import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../audio/soundEngine';
import { createNewGame } from '../../core/deck';
import { getBestHint, hashBoardState } from '../../core/heuristics';
import {
  applyMove,
  canDealFromStock,
  dealFromStock,
  findSmartClickTarget,
  undoAll,
  undoMove,
} from '../../core/rules';
import type {
  AllStats,
  Difficulty,
  ExtractedRunInfo,
  GameState,
  MoveAction,
  UserPreferences,
} from '../../core/types';
import {
  loadActiveGame,
  loadPreferences,
  loadStats,
  recordGameStarted,
  recordGameWon,
  resetAllStats,
  saveActiveGame,
  savePreferences,
} from '../../storage/persistence';
import type {
  ActiveHintVisual,
  BoardMetrics,
  FlyingCardPacket,
} from '../components/TableauBoard';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'warning' | 'gold';
  actionLabel?: string;
  onAction?: () => void;
}

export function useGameController() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const loaded = loadPreferences();
    soundEngine.setMuted(loaded.muted);
    return loaded;
  });

  const [stats, setStats] = useState<AllStats>(() => loadStats());

  const [gameState, setGameState] = useState<GameState>(() => {
    const existing = loadActiveGame();
    if (existing && !existing.won) {
      return existing;
    }
    const fresh = createNewGame('easy');
    recordGameStarted('easy');
    return fresh;
  });

  const [activeHint, setActiveHint] = useState<ActiveHintVisual | null>(null);
  const [emptyColWarnings, setEmptyColWarnings] = useState<number[]>([]);
  const [shakingCol, setShakingCol] = useState<number | null>(null);
  const [flyingPackets, setFlyingPackets] = useState<FlyingCardPacket[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [timerPaused, setTimerPaused] = useState(false);

  const metricsRef = useRef<BoardMetrics | null>(null);
  const getColPosRef = useRef<
    ((col: number, cardIndex?: number) => { x: number; y: number; stepY: number }) | null
  >(null);
  const completedZoneRef = useRef<HTMLDivElement | null>(null);
  const stockZoneRef = useRef<HTMLDivElement | null>(null);

  const recentHintHashesRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);
  const recordedWinIdRef = useRef<string | null>(null);

  const showToast = useCallback(
    (
      text: string,
      tone: ToastMessage['tone'] = 'info',
      action?: { label: string; handler: () => void },
      durationMs = 3200
    ) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({
        id: Date.now(),
        text,
        tone,
        actionLabel: action?.label,
        onAction: action?.handler,
      });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, durationMs);
    },
    []
  );

  // Persist active game whenever gameState updates
  useEffect(() => {
    saveActiveGame(gameState);
  }, [gameState]);

  // Tick timer once per second while playing
  useEffect(() => {
    if (gameState.won || timerPaused) return;
    const id = window.setInterval(() => {
      setGameState((prev) =>
        prev.won ? prev : { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [gameState.won, timerPaused]);

  const enqueueFlyingPackets = useCallback((packets: FlyingCardPacket[], clearAfterMs: number) => {
    if (packets.length === 0) return;
    setFlyingPackets((prev) => [...prev, ...packets]);
    const ids = new Set(packets.map((p) => p.id));
    window.setTimeout(() => {
      setFlyingPackets((prev) => prev.filter((p) => !ids.has(p.id)));
    }, clearAfterMs);
  }, []);

  const spawnCompletedRunAnimation = useCallback(
    (extractedRuns: ExtractedRunInfo[], nextState: GameState) => {
      if (extractedRuns.length === 0) return;
      soundEngine.playCompleteRun();

      const completedRect = completedZoneRef.current?.getBoundingClientRect();
      const getPos = getColPosRef.current;
      if (!completedRect || !getPos) return;

      const packets: FlyingCardPacket[] = [];
      let maxDuration = 0;

      extractedRuns.forEach((item, runOffset) => {
        const origin = getPos(item.colIndex);
        const destX = completedRect.left + Math.min(7, nextState.completedRuns.length - extractedRuns.length + runOffset) * 14;
        const destY = completedRect.top;

        // Fly cards from Ace up to King in a cascading parabolic arc
        const reversed = [...item.run.cards].reverse();
        reversed.forEach((card, idx) => {
          const delayMs = runOffset * 140 + idx * 24;
          const durationMs = 430;
          maxDuration = Math.max(maxDuration, delayMs + durationMs + 40);
          packets.push({
            id: `collect-${item.run.id}-${card.id}-${Date.now()}`,
            kind: 'collect',
            cards: [card],
            fromX: origin.x,
            fromY: origin.y - Math.min(idx * 10, 60),
            toX: destX,
            toY: destY,
            stepY: 0,
            durationMs,
            delayMs,
          });
        });
      });

      enqueueFlyingPackets(packets, maxDuration);
    },
    [enqueueFlyingPackets]
  );

  const handleWinIfReached = useCallback(
    (nextState: GameState) => {
      if (nextState.won && recordedWinIdRef.current !== nextState.id) {
        recordedWinIdRef.current = nextState.id;
        const updatedStats = recordGameWon(
          nextState.difficulty,
          nextState.score,
          nextState.moves,
          nextState.elapsedSeconds
        );
        setStats(updatedStats);
        window.setTimeout(() => {
          soundEngine.playVictory();
        }, 420);
      }
    },
    []
  );

  const executeMove = useCallback(
    (move: MoveAction, animateFlight = false): boolean => {
      setActiveHint(null);
      setEmptyColWarnings([]);

      try {
        const prevState = gameState;
        const movingCards = prevState.columns[move.fromCol].slice(move.cardIndex);
        const targetIndexBefore = prevState.columns[move.toCol].length;
        const getPos = getColPosRef.current;
        const startPos = animateFlight && getPos ? getPos(move.fromCol, move.cardIndex) : null;

        const result = applyMove(prevState, move);
        setGameState(result.state);
        recentHintHashesRef.current.clear();

        if (animateFlight && startPos && getPos && result.extractedRuns.length === 0) {
          const endPos = getPos(move.toCol, targetIndexBefore);
          const durationMs = 210;
          enqueueFlyingPackets(
            [
              {
                id: `move-${Date.now()}-${Math.random()}`,
                kind: 'move',
                cards: movingCards,
                fromX: startPos.x,
                fromY: startPos.y,
                toX: endPos.x,
                toY: endPos.y,
                stepY: startPos.stepY,
                durationMs,
                hiddenTarget: { col: move.toCol, fromIndex: targetIndexBefore },
              },
            ],
            durationMs + 30
          );
        }

        soundEngine.playCardPlace();
        if (result.flippedCols.length > 0) {
          window.setTimeout(() => soundEngine.playCardFlip(), 90);
        }

        if (result.extractedRuns.length > 0) {
          spawnCompletedRunAnimation(result.extractedRuns, result.state);
        }

        handleWinIfReached(result.state);
        return true;
      } catch {
        soundEngine.playError();
        setShakingCol(move.fromCol);
        window.setTimeout(() => setShakingCol(null), 320);
        return false;
      }
    },
    [gameState, enqueueFlyingPackets, spawnCompletedRunAnimation, handleWinIfReached]
  );

  const handleSmartClick = useCallback(
    (fromCol: number, cardIndex: number) => {
      const target = findSmartClickTarget(gameState.columns, fromCol, cardIndex);
      if (target === null) {
        soundEngine.playError();
        setShakingCol(fromCol);
        window.setTimeout(() => setShakingCol(null), 300);
        return;
      }
      executeMove({ type: 'move', fromCol, cardIndex, toCol: target }, true);
    },
    [gameState.columns, executeMove]
  );

  const handleDealStock = useCallback((): boolean => {
    setActiveHint(null);
    const check = canDealFromStock(gameState);
    if (!check.ok) {
      soundEngine.playError();
      if (check.reason === 'empty_columns') {
        setEmptyColWarnings(check.emptyColumns);
        showToast('存在空列时不可发牌，请先将牌移入高亮的空列中', 'warning');
        window.setTimeout(() => setEmptyColWarnings([]), 2200);
      } else {
        showToast('发牌堆已全部发完', 'info');
      }
      return false;
    }

    const stockRect = stockZoneRef.current?.getBoundingClientRect();
    const getPos = getColPosRef.current;
    const prevLengths = gameState.columns.map((c) => c.length);

    const result = dealFromStock(gameState);
    setGameState(result.state);
    recentHintHashesRef.current.clear();
    soundEngine.playDeal(10);

    if (stockRect && getPos) {
      const packets: FlyingCardPacket[] = [];
      let maxWait = 0;
      for (let col = 0; col < 10; col++) {
        const dest = getPos(col, prevLengths[col]);
        const delayMs = col * 26;
        const durationMs = 230;
        maxWait = Math.max(maxWait, delayMs + durationMs + 30);
        packets.push({
          id: `deal-${Date.now()}-${col}`,
          kind: 'deal',
          cards: [result.dealtCards[col]],
          fromX: stockRect.left,
          fromY: stockRect.top,
          toX: dest.x,
          toY: dest.y,
          stepY: 0,
          durationMs,
          delayMs,
          hiddenTarget: { col, fromIndex: prevLengths[col] },
        });
      }
      enqueueFlyingPackets(packets, maxWait);
    }

    if (result.extractedRuns.length > 0) {
      spawnCompletedRunAnimation(result.extractedRuns, result.state);
    }
    handleWinIfReached(result.state);
    return true;
  }, [gameState, enqueueFlyingPackets, spawnCompletedRunAnimation, handleWinIfReached, showToast]);

  const handleUndo = useCallback(() => {
    setActiveHint(null);
    setEmptyColWarnings([]);
    const prev = undoMove(gameState);
    if (!prev) return;
    setGameState(prev);
    recentHintHashesRef.current.clear();
    soundEngine.playCardFlip();
  }, [gameState]);

  const handleUndoSteps = useCallback(
    (steps: number) => {
      setActiveHint(null);
      let curr = gameState;
      let undone = 0;
      for (let i = 0; i < steps; i++) {
        const next = undoMove(curr);
        if (!next) break;
        curr = next;
        undone++;
      }
      if (undone > 0) {
        setGameState(curr);
        recentHintHashesRef.current.clear();
        soundEngine.playCardFlip();
        showToast(`已回退 ${undone} 步，可尝试其他走法`, 'info');
      }
    },
    [gameState, showToast]
  );

  const handleUndoAll = useCallback(() => {
    if (gameState.history.length === 0) return;
    setActiveHint(null);
    setEmptyColWarnings([]);
    setGameState((prev) => undoAll(prev));
    recentHintHashesRef.current.clear();
    soundEngine.playShuffle();
    showToast('已重置本局至开局状态', 'info');
  }, [gameState.history.length, showToast]);

  const handleStartNewGame = useCallback(
    (difficulty: Difficulty) => {
      setActiveHint(null);
      setEmptyColWarnings([]);
      setFlyingPackets([]);
      recentHintHashesRef.current.clear();
      recordedWinIdRef.current = null;

      const fresh = createNewGame(difficulty);
      setGameState(fresh);
      setStats(recordGameStarted(difficulty));
      soundEngine.playShuffle();
    },
    []
  );

  const handleHint = useCallback(() => {
    const currHash = hashBoardState(
      gameState.columns,
      gameState.stockDeals.length,
      gameState.completedRuns.length
    );
    recentHintHashesRef.current.add(currHash);

    let hint = getBestHint(gameState, recentHintHashesRef.current);
    if (!hint.action && recentHintHashesRef.current.size > 1) {
      // Allow revisiting if exhausted
      recentHintHashesRef.current.clear();
      hint = getBestHint(gameState);
    }

    if (hint.status === 'move' && hint.action?.type === 'move') {
      soundEngine.playHint();
      setActiveHint({
        type: 'move',
        fromCol: hint.action.fromCol,
        cardIndex: hint.action.cardIndex,
        toCol: hint.action.toCol,
      });
      showToast(`提示：${hint.reason}`, 'gold', undefined, 3600);
    } else if (hint.status === 'deal') {
      soundEngine.playHint();
      setActiveHint({ type: 'deal' });
      showToast(hint.reason, 'gold', undefined, 3600);
    } else if (hint.status === 'fill_empty_to_deal') {
      soundEngine.playError();
      const empties = gameState.columns
        .map((c, idx) => (c.length === 0 ? idx : -1))
        .filter((idx) => idx !== -1);
      setEmptyColWarnings(empties);
      showToast(hint.reason, 'warning', {
        label: '撤销一步',
        handler: handleUndo,
      });
    } else {
      soundEngine.playError();
      showToast(hint.reason, 'warning', gameState.history.length > 0 ? {
        label: '撤销一步',
        handler: handleUndo,
      } : undefined);
    }
  }, [gameState, showToast, handleUndo]);

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      if (patch.muted !== undefined) {
        soundEngine.setMuted(patch.muted);
      }
      savePreferences(next);
      return next;
    });
  }, []);

  const handleResetStats = useCallback(() => {
    setStats(resetAllStats());
    showToast('已清空战绩统计', 'info');
  }, [showToast]);

  return {
    gameState,
    preferences,
    stats,
    activeHint,
    setActiveHint,
    emptyColWarnings,
    shakingCol,
    flyingPackets,
    toast,
    setToast,
    showToast,
    setTimerPaused,
    metricsRef,
    getColPosRef,
    completedZoneRef,
    stockZoneRef,
    executeMove,
    handleSmartClick,
    handleDealStock,
    handleUndo,
    handleUndoSteps,
    handleUndoAll,
    handleStartNewGame,
    handleHint,
    updatePreferences,
    handleResetStats,
  };
}
