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
  onToggleCollapse,
  onNewGame,
  onStartSolver,
  onHint,
  onUndoAll,
  onUndo,
  onMore,
}) => {
  return (
    <div className="fixed bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-end gap-1.5 pointer-events-none">
      {/* Collapse/Expand Arrow Button */}
      <button
        type="button"
        onClick={onToggleCollapse}
        data-testid="toolbar-toggle-btn"
        title={collapsed ? '展开操作栏' : '收起操作栏'}
        aria-label={collapsed ? '展开操作栏' : '收起操作栏'}
        className="pointer-events-auto w-8 h-9 sm:w-9 sm:h-11 rounded-xl bg-[#09110d]/82 hover:bg-[#112018]/92 backdrop-blur-md border border-[#d4af37]/35 text-[#f3c950] flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.45)] transition cursor-pointer"
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
          className="pointer-events-auto flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-2xl bg-[#09110d]/82 backdrop-blur-md border border-[#d4af37]/40 shadow-[0_8px_28px_rgba(0,0,0,0.6)]"
        >
          <ToolbarButton
            icon={<PlusCircle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
            label="新"
            onClick={onNewGame}
          />
          <ToolbarButton
            icon={<KeyRound className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
            label="求解器"
            highlight={solverActive}
            onClick={onStartSolver}
          />
          <ToolbarButton
            icon={<Lightbulb className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
            label="提示"
            onClick={onHint}
          />
          <ToolbarButton
            icon={<RotateCcw className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
            label="撤销全部"
            disabled={!canUndo}
            onClick={onUndoAll}
          />
          <ToolbarButton
            icon={<Undo2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
            label="撤销"
            disabled={!canUndo}
            onClick={onUndo}
          />
          <ToolbarButton
            icon={<MoreHorizontal className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />}
            label="更多"
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
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex flex-col items-center justify-center gap-0.5 min-w-[44px] sm:min-w-[58px] px-1.5 sm:px-2.5 py-1 rounded-xl text-[10px] sm:text-xs font-medium transition cursor-pointer',
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
