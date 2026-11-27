import React from 'react';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Menu,
  Pause,
  Play,
  X,
} from 'lucide-react';
import type { Difficulty } from '../../core/types';

export type SolverUiStatus = 'idle' | 'searching' | 'running' | 'paused' | 'deadlock';

interface TopHudProps {
  score: number;
  moves: number;
  elapsedSeconds: number;
  difficulty: Difficulty;
  solverStatus: SolverUiStatus;
  isFullscreen: boolean;
  isCompactLandscape: boolean;
  isMobilePortrait: boolean;
  fullscreenSupported: boolean;
  onOpenMenu: () => void;
  onReturnHome: () => void;
  onToggleSolverPause: () => void;
  onStopSolver: () => void;
  onToggleFullscreen: () => void;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function GoldenKeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 drop-shadow-[0_0_6px_rgba(243,201,80,0.65)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="key-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff0a6" />
          <stop offset="50%" stopColor="#f3c950" />
          <stop offset="100%" stopColor="#b58318" />
        </linearGradient>
      </defs>
      <path
        fill="url(#key-gold)"
        d="M15.5 3a5.5 5.5 0 0 0-5.16 7.38L3.3 17.42a1 1 0 0 0-.3.71V20a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-1.5H9a1 1 0 0 0 1-1V16h1.5a1 1 0 0 0 .7-.29l1.42-1.42A5.5 5.5 0 1 0 15.5 3zm0 8a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
      />
    </svg>
  );
}

export const TopHud: React.FC<TopHudProps> = ({
  score,
  moves,
  elapsedSeconds,
  difficulty,
  solverStatus,
  isFullscreen,
  isCompactLandscape,
  isMobilePortrait,
  fullscreenSupported,
  onOpenMenu,
  onReturnHome,
  onToggleSolverPause,
  onStopSolver,
  onToggleFullscreen,
}) => {
  const isSolverActive = solverStatus !== 'idle';

  const rowHeightClass = isCompactLandscape
    ? 'h-9'
    : isMobilePortrait
    ? 'h-11'
    : 'h-12 sm:h-14';

  const navBtnClass = isCompactLandscape
    ? 'flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/12 active:scale-95 border border-white/10 text-xs font-medium text-stone-100 transition cursor-pointer whitespace-nowrap'
    : isMobilePortrait
    ? 'flex items-center justify-center p-1.5 rounded-lg bg-white/5 hover:bg-white/12 active:scale-95 border border-white/10 text-xs font-medium text-stone-100 transition cursor-pointer whitespace-nowrap'
    : 'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/12 active:scale-95 border border-white/10 text-xs sm:text-sm font-medium text-stone-100 transition cursor-pointer whitespace-nowrap';

  return (
    <header className="relative z-30 pt-[env(safe-area-inset-top)] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:px-5 bg-[#090e0c]/92 backdrop-blur-md border-b border-[#d4af37]/50 shadow-[0_4px_20px_rgba(0,0,0,0.55)] shrink-0">
      <div className={`${rowHeightClass} flex items-center justify-between gap-1.5 sm:gap-2`}>
        {/* Left Navigation */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenMenu}
            className={navBtnClass}
            aria-label="菜单"
          >
            <Menu className="w-4 h-4 text-[#e9c46a] shrink-0" />
            <span className={isMobilePortrait ? 'hidden' : 'inline'}>菜单</span>
          </button>

          <button
            type="button"
            onClick={onReturnHome}
            className={navBtnClass}
            aria-label="返回"
          >
            <ArrowLeft className="w-4 h-4 text-[#e9c46a] shrink-0" />
            <span className={isMobilePortrait ? 'hidden' : 'inline'}>返回</span>
          </button>
        </div>

        {/* Center Stats or Active Solver Banner */}
        <div className="flex-1 flex justify-center min-w-0">
          {isSolverActive ? (
            <div
              data-testid="solver-banner"
              className={[
                'flex items-center rounded-full bg-gradient-to-b from-[#1e1b12] to-[#0d0c08] border border-[#f3c950] shadow-[0_0_18px_rgba(243,201,80,0.35)]',
                isCompactLandscape
                  ? 'gap-2 px-3 py-0.5'
                  : 'gap-2 sm:gap-3.5 px-2.5 sm:px-5 py-1 sm:py-1.5',
              ].join(' ')}
            >
              <GoldenKeyIcon />
              <span className="text-xs sm:text-sm font-semibold tracking-wide text-[#fbe28f] whitespace-nowrap">
                {solverStatus === 'paused'
                  ? '求解器 · 已暂停'
                  : solverStatus === 'searching'
                  ? '求解器 · 计算中'
                  : '求解器'}
              </span>
              <button
                type="button"
                onClick={onToggleSolverPause}
                data-testid="solver-pause-btn"
                title={solverStatus === 'paused' ? '继续求解器' : '暂停求解器'}
                className="flex items-center justify-center w-6 h-5 sm:w-8 sm:h-7 rounded-md bg-[#f3c950]/18 hover:bg-[#f3c950]/30 active:scale-95 border border-[#f3c950]/60 text-[#ffe89e] font-bold text-xs transition cursor-pointer shrink-0"
              >
                {solverStatus === 'paused' ? (
                  <Play className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onStopSolver}
                title="退出求解器"
                className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full hover:bg-white/10 text-stone-300 hover:text-white transition cursor-pointer shrink-0"
                aria-label="关闭求解器"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              className={[
                'flex items-center rounded-full bg-black/35 border border-white/8 whitespace-nowrap',
                isCompactLandscape
                  ? 'gap-3 px-3 py-0.5'
                  : isMobilePortrait
                  ? 'gap-2 px-2.5 py-0.5'
                  : 'gap-3 sm:gap-7 px-3 sm:px-6 py-1',
              ].join(' ')}
            >
              <div className="flex items-baseline gap-1 sm:gap-1.5 whitespace-nowrap shrink-0">
                <span className="text-[11px] sm:text-xs text-stone-400">得分</span>
                <span
                  className={[
                    'font-bold tabular-nums text-[#f3c950]',
                    isMobilePortrait || isCompactLandscape ? 'text-xs sm:text-sm' : 'text-sm sm:text-base',
                  ].join(' ')}
                >
                  {score}
                </span>
              </div>
              <div className="w-px h-3 bg-white/15 shrink-0" />
              <div className="flex items-baseline gap-1 sm:gap-1.5 whitespace-nowrap shrink-0">
                <span className="text-[11px] sm:text-xs text-stone-400">步数</span>
                <span
                  className={[
                    'font-semibold tabular-nums text-stone-100',
                    isMobilePortrait || isCompactLandscape ? 'text-xs sm:text-sm' : 'text-sm sm:text-base',
                  ].join(' ')}
                >
                  {moves}
                </span>
              </div>
              <div className="w-px h-3 bg-white/15 shrink-0" />
              <div className="flex items-baseline gap-1 sm:gap-1.5 whitespace-nowrap shrink-0">
                <span className="text-[11px] sm:text-xs text-stone-400 hidden sm:inline">
                  时间
                </span>
                <span
                  className={[
                    'font-semibold tabular-nums text-stone-100',
                    isMobilePortrait || isCompactLandscape ? 'text-xs sm:text-sm' : 'text-sm sm:text-base',
                  ].join(' ')}
                >
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Difficulty & Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <span
            className={[
              'rounded-full font-semibold bg-[#13291e] text-[#f3c950] border border-[#d4af37]/45 shadow-inner whitespace-nowrap shrink-0',
              isCompactLandscape || isMobilePortrait
                ? 'px-2 py-0.5 text-[11px]'
                : 'px-2.5 sm:px-3 py-1 text-xs sm:text-sm',
            ].join(' ')}
          >
            {DIFFICULTY_LABEL[difficulty]}
          </span>
          {fullscreenSupported && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              title="全屏切换 (F)"
              aria-label="全屏切换"
              className={[
                'rounded-lg bg-white/5 hover:bg-white/12 active:scale-95 border border-white/10 text-stone-200 hover:text-[#f3c950] transition cursor-pointer shrink-0',
                isCompactLandscape ? 'p-1' : 'p-1.5 sm:p-2',
              ].join(' ')}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
