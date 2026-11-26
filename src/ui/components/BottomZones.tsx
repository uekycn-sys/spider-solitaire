import React from 'react';
import type { CardBackTheme, CompletedRun } from '../../core/types';
import { CardBackSvg, CardFaceSvg } from './CardSvg';

interface BottomZonesProps {
  completedRuns: CompletedRun[];
  stockCount: number;
  cardBack: CardBackTheme;
  cardWidth: number;
  hasEmptyColumns: boolean;
  highlightDeal?: boolean;
  onDealStock: () => void;
  completedZoneRef?: React.RefObject<HTMLDivElement | null>;
  stockZoneRef?: React.RefObject<HTMLDivElement | null>;
}

export const BottomZones: React.FC<BottomZonesProps> = ({
  completedRuns,
  stockCount,
  cardBack,
  cardWidth,
  hasEmptyColumns,
  highlightDeal = false,
  onDealStock,
  completedZoneRef,
  stockZoneRef,
}) => {
  // Scale down corner stacks nicely on tight viewports while keeping proportions crisp
  const w = Math.max(42, Math.min(76, Math.round(cardWidth * 0.78)));
  const h = Math.round(w * 1.4);
  const completedStep = Math.max(10, Math.round(w * 0.22));
  const stockStep = Math.max(8, Math.round(w * 0.16));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 sm:bottom-3 z-20 px-3 sm:px-6 flex items-end justify-between">
      {/* Bottom-Left: Completed K->A Suit Stacks (max 8) */}
      <div
        ref={completedZoneRef}
        data-testid="completed-zone"
        className="relative flex items-end"
        style={{
          height: h,
          width: w + 7 * completedStep,
        }}
        title={`已收牌组：${completedRuns.length} / 8`}
      >
        {completedRuns.length === 0 ? (
          <div
            style={{ width: w, height: h }}
            className="rounded-[7px] border border-dashed border-white/18 bg-black/15 flex items-center justify-center"
          >
            <span className="text-[10px] sm:text-xs font-medium text-white/35 tracking-wider">
              收牌区
            </span>
          </div>
        ) : (
          completedRuns.map((run, idx) => {
            const kingCard = run.cards[0];
            return (
              <div
                key={run.id}
                style={{
                  width: w,
                  height: h,
                  left: idx * completedStep,
                  zIndex: idx + 1,
                }}
                className="absolute bottom-0 rounded-[7px] shadow-[0_4px_12px_rgba(0,0,0,0.55)] ring-1 ring-[#d4af37]/65 overflow-hidden transition-all duration-300"
              >
                {kingCard ? (
                  <CardFaceSvg
                    suit={kingCard.suit}
                    rank={kingCard.rank}
                    className="w-full h-full block"
                  />
                ) : (
                  <CardFaceSvg suit={run.suit} rank={13} className="w-full h-full block" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom-Right: Stock Piles (5 staggered piles) */}
      <div
        ref={stockZoneRef}
        data-testid="stock-zone"
        className="pointer-events-auto relative flex items-end justify-end"
        style={{
          height: h,
          width: w + 4 * stockStep,
        }}
      >
        {stockCount === 0 ? (
          <div
            style={{ width: w, height: h }}
            className="rounded-[7px] border border-dashed border-white/18 bg-black/15 flex items-center justify-center"
          >
            <span className="text-[10px] sm:text-xs text-white/30">已发完</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDealStock}
            data-testid="deal-stock-btn"
            title={
              hasEmptyColumns
                ? '存在空列，请先补齐空列再发牌 (Space)'
                : `发一轮牌 (剩余 ${stockCount} 次 · 快捷键 Space)`
            }
            className="group relative w-full h-full cursor-pointer focus:outline-none"
          >
            {Array.from({ length: stockCount }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: w,
                  height: h,
                  right: (stockCount - 1 - idx) * stockStep,
                  zIndex: idx + 1,
                }}
                className={[
                  'absolute bottom-0 rounded-[7px] transition-transform duration-150 group-hover:-translate-y-1 group-active:translate-y-0 overflow-hidden',
                  highlightDeal && idx === stockCount - 1
                    ? 'hint-source-glow'
                    : 'shadow-[0_4px_12px_rgba(0,0,0,0.55)]',
                ].join(' ')}
              >
                <CardBackSvg theme={cardBack} className="w-full h-full block" />
              </div>
            ))}
            <span className="absolute -top-2 -right-1.5 z-20 min-w-5 h-5 px-1 rounded-full bg-[#0c1611] border border-[#d4af37]/80 text-[#f3c950] text-[11px] font-bold flex items-center justify-center shadow">
              {stockCount}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
