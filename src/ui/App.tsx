import React, { useCallback, useEffect, useState } from 'react';
import type { Difficulty } from '../core/types';
import { BottomToolbar } from './components/BottomToolbar';
import { BottomZones } from './components/BottomZones';
import {
  DifficultyModal,
  MenuDrawer,
  VictoryModal,
} from './components/DrawersAndModals';
import { TableauBoard, type BoardMetrics } from './components/TableauBoard';
import { TopHud } from './components/TopHud';
import { useGameController } from './hooks/useGameController';
import { useSolver } from './hooks/useSolver';

export const App: React.FC = () => {
  const {
    gameState,
    preferences,
    stats,
    activeHint,
    setActiveHint,
    emptyColWarnings,
    shakingCol,
    flyingPackets,
    toast,
    showToast,
    setTimerPaused,
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
  } = useGameController();

  const { solverStatus, startSolver, togglePause, stopSolver } = useSolver({
    gameState,
    executeMove,
    handleDealStock,
    setActiveHint,
    showToast,
    handleUndoSteps,
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [difficultyModalOpen, setDifficultyModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [boardMetrics, setBoardMetrics] = useState<BoardMetrics | null>(null);

  const handleMetricsChange = useCallback((m: BoardMetrics) => {
    setBoardMetrics((prev) =>
      prev &&
      prev.cardWidth === m.cardWidth &&
      prev.cardHeight === m.cardHeight &&
      prev.availHeight === m.availHeight
        ? prev
        : m
    );
  }, []);

  // Pause game clock whenever drawers or modals are open
  useEffect(() => {
    setTimerPaused(menuOpen || difficultyModalOpen || gameState.won);
  }, [menuOpen, difficultyModalOpen, gameState.won, setTimerPaused]);

  // Sync fullscreen state
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {
        showToast('当前环境不支持全屏 API', 'info');
      });
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, [showToast]);

  // Global keyboard shortcuts: Ctrl/Cmd+Z, H, Space, F
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (menuOpen || difficultyModalOpen || gameState.won) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        stopSolver();
        handleUndo();
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === 'h') {
        e.preventDefault();
        stopSolver();
        handleHint();
      } else if (e.code === 'Space') {
        e.preventDefault();
        stopSolver();
        handleDealStock();
      } else if (key === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    menuOpen,
    difficultyModalOpen,
    gameState.won,
    stopSolver,
    handleUndo,
    handleHint,
    handleDealStock,
    toggleFullscreen,
  ]);

  const handleUserMove = useCallback(
    (move: Parameters<typeof executeMove>[0]) => {
      if (solverStatus !== 'idle') {
        stopSolver();
      }
      executeMove(move, false);
    },
    [solverStatus, stopSolver, executeMove]
  );

  const handleUserSmartClick = useCallback(
    (fromCol: number, cardIndex: number) => {
      if (solverStatus !== 'idle') {
        stopSolver();
      }
      handleSmartClick(fromCol, cardIndex);
    },
    [solverStatus, stopSolver, handleSmartClick]
  );

  const handleUserDeal = useCallback(() => {
    if (solverStatus !== 'idle') {
      stopSolver();
    }
    handleDealStock();
  }, [solverStatus, stopSolver, handleDealStock]);

  const handleStartDifficulty = useCallback(
    (diff: Difficulty) => {
      stopSolver();
      setDifficultyModalOpen(false);
      handleStartNewGame(diff);
    },
    [stopSolver, handleStartNewGame]
  );

  const hasEmptyColumns = gameState.columns.some((c) => c.length === 0);
  const feltClass = `felt-table felt-table--${preferences.feltTheme}`;

  return (
    <div
      className={`relative w-screen h-dvh flex flex-col overflow-hidden ${feltClass}`}
    >
      {/* Felt micro-grain texture & classic dark casino vignette */}
      <div className="felt-noise absolute inset-0 z-0" />
      <div className="felt-vignette absolute inset-0 z-0" />

      {/* Top HUD */}
      <TopHud
        score={gameState.score}
        moves={gameState.moves}
        elapsedSeconds={gameState.elapsedSeconds}
        difficulty={gameState.difficulty}
        solverStatus={solverStatus}
        isFullscreen={isFullscreen}
        onOpenMenu={() => setMenuOpen(true)}
        onReturnHome={() => {
          stopSolver();
          setDifficultyModalOpen(true);
        }}
        onToggleSolverPause={togglePause}
        onStopSolver={stopSolver}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Toast Notification Banner */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-40 max-w-[92vw] px-4 py-2 rounded-full bg-[#0a140f]/92 backdrop-blur-md border border-[#d4af37]/55 shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center gap-3 text-xs sm:text-sm"
        >
          <span
            className={
              toast.tone === 'warning'
                ? 'text-amber-200'
                : toast.tone === 'gold'
                ? 'text-[#ffe694]'
                : 'text-stone-100'
            }
          >
            {toast.text}
          </span>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={toast.onAction}
              className="px-2.5 py-0.5 rounded-full bg-[#f3c950] text-[#111] font-semibold text-xs hover:brightness-105 cursor-pointer shrink-0"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* Main 10-Column Tableau */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col">
        <TableauBoard
          columns={gameState.columns}
          cardBack={preferences.cardBack}
          activeHint={activeHint}
          emptyColWarnings={emptyColWarnings}
          shakingCol={shakingCol}
          flyingPackets={flyingPackets}
          toolbarCollapsed={preferences.toolbarCollapsed}
          interactionLocked={gameState.won}
          onAttemptMove={handleUserMove}
          onSmartClick={handleUserSmartClick}
          onMetricsChange={handleMetricsChange}
          getColumnMetricsRef={getColPosRef}
        />
      </main>

      {/* Bottom Corner Completed Runs & Stock Piles */}
      <BottomZones
        completedRuns={gameState.completedRuns}
        stockCount={gameState.stockDeals.length}
        cardBack={preferences.cardBack}
        cardWidth={boardMetrics?.cardWidth ?? 86}
        hasEmptyColumns={hasEmptyColumns}
        onDealStock={handleUserDeal}
        completedZoneRef={completedZoneRef}
        stockZoneRef={stockZoneRef}
      />

      {/* Collapsible Bottom Control Dock */}
      <BottomToolbar
        collapsed={preferences.toolbarCollapsed}
        canUndo={gameState.history.length > 0}
        solverActive={solverStatus !== 'idle'}
        onToggleCollapse={() =>
          updatePreferences({
            toolbarCollapsed: !preferences.toolbarCollapsed,
          })
        }
        onNewGame={() => {
          stopSolver();
          setDifficultyModalOpen(true);
        }}
        onStartSolver={() => {
          if (solverStatus === 'running' || solverStatus === 'searching') {
            togglePause();
          } else {
            startSolver();
          }
        }}
        onHint={() => {
          stopSolver();
          handleHint();
        }}
        onUndoAll={() => {
          stopSolver();
          handleUndoAll();
        }}
        onUndo={() => {
          stopSolver();
          handleUndo();
        }}
        onMore={() => setMenuOpen(true)}
      />

      {/* Drawers & Modals */}
      <MenuDrawer
        open={menuOpen}
        preferences={preferences}
        stats={stats}
        onClose={() => setMenuOpen(false)}
        onUpdatePreferences={updatePreferences}
        onResetStats={handleResetStats}
      />

      <DifficultyModal
        open={difficultyModalOpen}
        canResume={!gameState.won}
        currentDifficulty={gameState.difficulty}
        onResume={() => setDifficultyModalOpen(false)}
        onStartNew={handleStartDifficulty}
        onClose={() => setDifficultyModalOpen(false)}
      />

      <VictoryModal
        open={gameState.won}
        score={gameState.score}
        moves={gameState.moves}
        elapsedSeconds={gameState.elapsedSeconds}
        difficulty={gameState.difficulty}
        onPlayAgain={handleStartDifficulty}
        onChooseDifficulty={() => setDifficultyModalOpen(true)}
      />
    </div>
  );
};

export default App;
