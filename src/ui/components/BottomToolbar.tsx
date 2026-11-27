import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  KeyRound,
  Lightbulb,
  MoreHorizontal,
  PlusCircle,
  RotateCcw,
  Undo2,
} from 'lucide-react';

interface BottomToolbarProps {
  collapsed: boolean;
  canUndo: boolean;
  solverActive: boolean;
  isCompactLandscape: boolean;
  isMobilePortrait: boolean;
  onToggleCollapse: () => void;
  onNewGame: () => void;
  onStartSolver: () => void;
  onHint: () => void;
  onUndoAll: () => void;
  onUndo: () => void;
  onMore: () => void;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  collapsed,
  canUndo,
  solverActive,
  isCompactLandscape,
  isMobilePortrait,
  onToggleCollapse,
  onNewGame,
  onStartSolver,
  onHint,
  onUndoAll,
  onUndo,
  onMore,
}) => {
  const iconCls = isCompactLandscape
    ? 'w-3.5 h-3.5'
    : isMobilePortrait
    ? 'w-4 h-4'
    : 'w-4 h-4 sm:w-[18px] sm:h-[18px]';

  return (
    <div
      style={{
        bottom: isCompactLandscape
          ? 'calc(4px + env(safe-area-inset-bottom))'
          : 'calc(6px + env(safe-area-inset-bottom))',
      }}
      className="fixed left-1/2 -translate-x-1/2 z-30 flex items-end gap-1 sm:gap-1.5 pointer-events-none"
    >
      {/* Collapse/Expand Arrow Button */}
      <button
        type="button"
        onClick={onToggleCollapse}
        data-testid="toolbar-toggle-btn"
        title={collapsed ? '展开操作栏' : '收起操作栏'}
        aria-label={collapsed ? '展开操作栏' : '收起操作栏'}
        className={[
          'pointer-events-auto rounded-xl bg-[#09110d]/85 hover:bg-[#112018]/95 backdrop-blur-md border border-[#d4af37]/35 text-[#f3c950] flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.45)] transition cursor-pointer shrink-0',
          isCompactLandscape
            ? 'w-8 h-9'
            : isMobilePortrait
            ? 'w-7 h-9'
            : 'w-8 h-9 sm:w-9 sm:h-11',
        ].join(' ')}
      >
        {collapsed ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Main Dock */}
      {!collapsed && (
        <nav
          data-testid="bottom-toolbar"
          aria-label="牌桌操作栏"
          className={[
            'pointer-events-auto flex items-center rounded-2xl bg-[#09110d]/85 backdrop-blur-md border border-[#d4af37]/40 shadow-[0_8px_28px_rgba(0,0,0,0.6)]',
            isCompactLandscape
              ? 'gap-0.5 px-1.5 py-1 h-9'
              : isMobilePortrait
              ? 'gap-0.5 px-1 py-1'
              : 'gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5',
          ].join(' ')}
        >
          <ToolbarButton
            icon={<PlusCircle className={iconCls} />}
            label="新"
            inline={isCompactLandscape}
            compact={isMobilePortrait}
            onClick={onNewGame}
          />
          <ToolbarButton
            icon={<KeyRound className={iconCls} />}
            label="求解器"
            highlight={solverActive}
            inline={isCompactLandscape}
            compact={isMobilePortrait}
            onClick={onStartSolver}
          />
          <ToolbarButton
            icon={<Lightbulb className={iconCls} />}
            label="提示"
            inline={isCompactLandscape}
            compact={isMobilePortrait}
            onClick={onHint}
          />
          <ToolbarButton
            icon={<RotateCcw className={iconCls} />}
            label="撤销全部"
            disabled={!canUndo}
            inline={isCompactLandscape}
            compact={isMobilePortrait}
            onClick={onUndoAll}
          />
          <ToolbarButton
            icon={<Undo2 className={iconCls} />}
            label="撤销"
            disabled={!canUndo}
            inline={isCompactLandscape}
            compact={isMobilePortrait}
            onClick={onUndo}
          />
          <ToolbarButton
            icon={<MoreHorizontal className={iconCls} />}
            label="更多"
            inline={isCompactLandscape}
            compact={isMobilePortrait}
            onClick={onMore}
          />
        </nav>
      )}
    </div>
  );
};

function ToolbarButton({
  icon,
  label,
  disabled = false,
  highlight = false,
  inline = false,
  compact = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  highlight?: boolean;
  inline?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex items-center justify-center rounded-xl font-medium transition cursor-pointer whitespace-nowrap',
        inline
          ? 'flex-row gap-1 px-2 py-1 text-[11px] h-7'
          : compact
          ? 'flex-col gap-0.5 min-w-[42px] px-1 py-1 text-[10px]'
          : 'flex-col gap-0.5 min-w-[44px] sm:min-w-[58px] px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs',
        disabled
          ? 'opacity-35 cursor-not-allowed text-stone-400'
          : highlight
          ? 'bg-[#f3c950]/20 text-[#ffe694] border border-[#f3c950]/60 shadow-[0_0_12px_rgba(243,201,80,0.3)]'
          : 'text-stone-100 hover:bg-white/10 active:scale-95 hover:text-[#f3c950]',
      ].join(' ')}
    >
      <span className={highlight ? 'text-[#f3c950]' : 'text-[#e9c46a]'}>{icon}</span>
      <span className="whitespace-nowrap leading-tight">{label}</span>
    </button>
  );
}
