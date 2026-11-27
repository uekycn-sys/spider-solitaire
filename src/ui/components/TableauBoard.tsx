import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { Card, CardBackTheme, CardFaceStyle, MoveAction } from '../../core/types';
import {
  canPlaceSequence,
  getMaxMovableTailStart,
  isMovableSequence,
} from '../../core/rules';
import type { ViewportMode } from '../hooks/useViewportMode';
import { CardFaceSvg, type CardFaceVariant } from './CardSvg';
import { CardView } from './CardView';
import { DragOverlay } from './DragOverlay';

export interface ActiveHintVisual {
  type: 'move' | 'deal';
  fromCol?: number;
  cardIndex?: number;
  toCol?: number;
}

export interface FlyingCardPacket {
  id: string;
  kind: 'move' | 'deal' | 'collect';
  cards: Card[];
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  stepY: number;
  durationMs: number;
  delayMs?: number;
  hiddenTarget?: { col: number; fromIndex: number };
}

export interface BoardMetrics {
  stageRect: DOMRect;
  colWidth: number;
  cardWidth: number;
  cardHeight: number;
  colLefts: number[];
  availHeight: number;
}

export interface ColumnLayoutOptions {
  idealUp?: number;
  minUp?: number;
  idealDown?: number;
  minDown?: number;
}

export interface ColumnLayout {
  ys: number[];
  upStep: number;
  downStep: number;
  totalHeight: number;
}

export function computeColumnLayout(
  column: Card[],
  cardHeight: number,
  availHeight: number,
  options?: ColumnLayoutOptions
): ColumnLayout {
  const idealDown = options?.idealDown ?? Math.max(6, Math.min(13, cardHeight * 0.105));
  const minDown = options?.minDown ?? Math.max(3, Math.min(5, cardHeight * 0.045));
  const idealUp = options?.idealUp ?? Math.max(18, Math.min(34, cardHeight * 0.265));
  const minUp = options?.minUp ?? Math.max(16, Math.round(cardHeight * 0.17));

  const n = column.length;
  if (n === 0) {
    return {
      ys: [],
      upStep: idealUp,
      downStep: idealDown,
      totalHeight: cardHeight,
    };
  }
  if (n === 1) {
    return {
      ys: [0],
      upStep: idealUp,
      downStep: idealDown,
      totalHeight: cardHeight,
    };
  }

  let downCount = 0;
  let upCount = 0;
  for (let i = 0; i < n - 1; i++) {
    if (column[i].faceUp) upCount++;
    else downCount++;
  }

  const maxSpan = Math.max(24, availHeight - cardHeight);
  let downStep = idealDown;
  let upStep = idealUp;

  const idealSpan = downCount * idealDown + upCount * idealUp;
  if (idealSpan > maxSpan) {
    // Step 1: Compress face-down cards first down to minDown
    const excess = idealSpan - maxSpan;
    if (downCount > 0 && idealDown > minDown) {
      const maxDownSavings = downCount * (idealDown - minDown);
      const downSavings = Math.min(excess, maxDownSavings);
      downStep = idealDown - downSavings / downCount;
    }

    // Step 2: Compress face-up cards only down to minUp (never crush readability)
    const remainingSpan = maxSpan - downCount * downStep;
    if (upCount > 0 && upCount * idealUp > remainingSpan) {
      const candidateUp = remainingSpan / upCount;
      upStep = Math.max(minUp, Math.min(idealUp, candidateUp));
    }
  }

  const ys: number[] = [0];
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    acc += column[i].faceUp ? upStep : downStep;
    ys.push(acc);
  }

  return {
    ys,
    upStep,
    downStep,
    totalHeight: ys[n - 1] + cardHeight,
  };
}

interface DragState {
  fromCol: number;
  cardIndex: number;
  cards: Card[];
  pointerType: string;
  startX: number;
  startY: number;
  currX: number;
  currY: number;
  offsetX: number;
  offsetY: number;
  stepY: number;
  active: boolean;
  hoveredTargetCol: number | null;
}

interface TableauBoardProps {
  columns: Card[][];
  cardBack: CardBackTheme;
  cardStyle: CardFaceStyle;
  viewportMode: ViewportMode;
  activeHint: ActiveHintVisual | null;
  emptyColWarnings: number[];
  shakingCol: number | null;
  flyingPackets: FlyingCardPacket[];
  toolbarCollapsed: boolean;
  interactionLocked: boolean;
  onAttemptMove: (move: MoveAction) => void;
  onSmartClick: (fromCol: number, cardIndex: number) => void;
  onMetricsChange: (metrics: BoardMetrics) => void;
  getColumnMetricsRef: React.MutableRefObject<
    ((col: number, cardIndex?: number) => { x: number; y: number; stepY: number }) | null
  >;
}

export const TableauBoard: React.FC<TableauBoardProps> = ({
  columns,
  cardBack,
  cardStyle,
  viewportMode,
  activeHint,
  emptyColWarnings,
  shakingCol,
  flyingPackets,
  toolbarCollapsed,
  interactionLocked,
  onAttemptMove,
  onSmartClick,
  onMetricsChange,
  getColumnMetricsRef,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const innerStageRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1000, height: 600 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const scrollEl = stageRef.current;
    const innerEl = innerStageRef.current;
    if (!scrollEl || !innerEl) return;

    const update = () => {
      const innerRect = innerEl.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      setSize({ width: innerRect.width, height: scrollRect.height });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(innerEl);
    ro.observe(scrollEl);
    return () => ro.disconnect();
  }, []);

  const layoutParams = useMemo(() => {
    if (viewportMode.isMobilePortrait) {
      const sidePad = size.width <= 420 ? 1 : 4;
      const gap = 2;
      const usableWidth = Math.max(280, size.width - sidePad * 2);
      const colWidth = Math.floor((usableWidth - gap * 9) / 10);
      const cardWidth = Math.max(28, Math.min(54, colWidth));
      const cardHeight = Math.round(cardWidth * 1.52);
      const bottomZoneHeight = toolbarCollapsed ? 74 : 132;
      const topPad = 6;
      const availHeight = Math.max(cardHeight + 24, size.height - bottomZoneHeight - topPad);
      const layoutOptions: ColumnLayoutOptions = {
        idealUp: Math.max(24, Math.round(cardHeight * 0.45)),
        minUp: Math.max(20, Math.round(cardHeight * 0.37)),
        idealDown: 7,
        minDown: 3.5,
      };
      const autoVariant: CardFaceVariant = 'compact-portrait';
      return {
        gap,
        colWidth,
        cardWidth,
        cardHeight,
        bottomZoneHeight,
        topPad,
        availHeight,
        layoutOptions,
        autoVariant,
      };
    }

    if (viewportMode.isCompactLandscape) {
      const sidePad = 6;
      const gap = 5;
      const usableWidth = Math.max(360, size.width - sidePad * 2);
      const colWidth = Math.floor((usableWidth - gap * 9) / 10);
      const bottomZoneHeight = 52;
      const topPad = 4;
      const availHeight = Math.max(120, size.height - bottomZoneHeight - topPad);
      const maxCardH = Math.max(64, Math.min(92, Math.round(availHeight * 0.31)));
      const cardWidth = Math.max(40, Math.min(colWidth, Math.round(maxCardH / 1.31)));
      const cardHeight = Math.min(maxCardH, Math.round(cardWidth * 1.31));
      const layoutOptions: ColumnLayoutOptions = {
        idealUp: Math.max(20, Math.round(cardHeight * 0.27)),
        minUp: Math.max(17, Math.round(cardHeight * 0.22)),
        idealDown: 5,
        minDown: 3,
      };
      const autoVariant: CardFaceVariant =
        cardWidth < 48 ? 'compact-portrait' : 'compact-landscape';
      return {
        gap,
        colWidth,
        cardWidth,
        cardHeight,
        bottomZoneHeight,
        topPad,
        availHeight,
        layoutOptions,
        autoVariant,
      };
    }

    // Desktop / Tablet
    const gap = size.width < 1024 ? 8 : 12;
    const sidePad = 16;
    const usableWidth = Math.max(280, size.width - sidePad * 2);
    const colWidth = Math.floor((usableWidth - gap * 9) / 10);
    const cardWidth = Math.max(26, Math.min(118, colWidth));
    const cardHeight = Math.round(cardWidth * 1.4);
    const bottomZoneHeight = Math.max(
      toolbarCollapsed ? 62 : 74,
      Math.round(Math.min(106, cardWidth * 0.78 * 1.4 + 24))
    );
    const topPad = 8;
    const availHeight = Math.max(cardHeight + 24, size.height - bottomZoneHeight - topPad - 2);
    const layoutOptions: ColumnLayoutOptions = {
      idealUp: Math.max(18, Math.min(34, cardHeight * 0.265)),
      minUp: Math.max(17, Math.round(cardHeight * 0.17)),
      idealDown: Math.max(6, Math.min(13, cardHeight * 0.105)),
      minDown: 4,
    };
    const autoVariant: CardFaceVariant = cardWidth < 56 ? 'compact-portrait' : 'classic';
    return {
      gap,
      colWidth,
      cardWidth,
      cardHeight,
      bottomZoneHeight,
      topPad,
      availHeight,
      layoutOptions,
      autoVariant,
    };
  }, [viewportMode, size.width, size.height, toolbarCollapsed]);

  const {
    gap,
    colWidth,
    cardWidth,
    cardHeight,
    bottomZoneHeight,
    topPad,
    availHeight,
    layoutOptions,
    autoVariant,
  } = layoutParams;

  const faceVariant: CardFaceVariant =
    cardStyle === 'classic'
      ? 'classic'
      : cardStyle === 'large'
      ? viewportMode.isCompactLandscape
        ? 'compact-landscape'
        : 'compact-portrait'
      : autoVariant;

  const columnLayouts = useMemo(
    () =>
      columns.map((col) =>
        computeColumnLayout(col, cardHeight, availHeight, layoutOptions)
      ),
    [columns, cardHeight, availHeight, layoutOptions]
  );

  const maxColHeight = useMemo(
    () => Math.max(availHeight, ...columnLayouts.map((l) => l.totalHeight)),
    [availHeight, columnLayouts]
  );
  const needsScroll = maxColHeight > availHeight + 2;

  // Update scroll-down indicator visibility
  const updateScrollIndicator = useCallback(() => {
    const el = stageRef.current;
    if (!el || !needsScroll) {
      setCanScrollDown(false);
      return;
    }
    const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
    setCanScrollDown(remaining > 18);
  }, [needsScroll]);

  useEffect(() => {
    updateScrollIndicator();
  }, [updateScrollIndicator, maxColHeight, size.height]);

  // Notify parent of geometry for flying animations & corner scaling
  useEffect(() => {
    const stageEl = stageRef.current;
    const gridEl = gridRef.current;
    if (!stageEl || !gridEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const gridRect = gridEl.getBoundingClientRect();
    const colLefts = Array.from(
      { length: 10 },
      (_, idx) => gridRect.left + idx * (colWidth + gap) + (colWidth - cardWidth) / 2
    );

    onMetricsChange({
      stageRect,
      colWidth,
      cardWidth,
      cardHeight,
      colLefts,
      availHeight,
    });

    getColumnMetricsRef.current = (col: number, cardIndex?: number) => {
      const liveGridRect = gridEl.getBoundingClientRect();
      const x =
        liveGridRect.left + col * (colWidth + gap) + (colWidth - cardWidth) / 2;
      const layout = columnLayouts[col];
      const idx =
        cardIndex !== undefined
          ? Math.max(0, Math.min(cardIndex, Math.max(0, columns[col].length - 1)))
          : columns[col].length;
      let yOffset = 0;
      if (columns[col].length > 0) {
        if (idx < layout.ys.length) {
          yOffset = layout.ys[idx];
        } else {
          const lastIdx = layout.ys.length - 1;
          yOffset =
            layout.ys[lastIdx] +
            (columns[col][lastIdx].faceUp ? layout.upStep : layout.downStep);
        }
      }
      return {
        x,
        y: liveGridRect.top + yOffset,
        stepY: layout.upStep,
      };
    };
  }, [
    size,
    colWidth,
    cardWidth,
    cardHeight,
    gap,
    availHeight,
    columnLayouts,
    columns,
    onMetricsChange,
    getColumnMetricsRef,
  ]);

  const findBestDropColumn = useCallback(
    (clientX: number, clientY: number, fromCol: number, movingTop: Card): number | null => {
      const stageEl = stageRef.current;
      const gridEl = gridRef.current;
      if (!stageEl || !gridEl) return null;
      const stageRect = stageEl.getBoundingClientRect();
      const gridRect = gridEl.getBoundingClientRect();

      let bestCol: number | null = null;
      let bestDist = Infinity;

      for (let col = 0; col < 10; col++) {
        if (col === fromCol) continue;
        if (!canPlaceSequence(movingTop, columns[col])) continue;

        const colCenterX = gridRect.left + col * (colWidth + gap) + colWidth / 2;
        const layout = columnLayouts[col];
        const colBottomY =
          gridRect.top +
          (layout.ys.length > 0 ? layout.ys[layout.ys.length - 1] + cardHeight / 2 : cardHeight / 2);

        const dx = Math.abs(clientX - colCenterX);
        const dy = Math.abs(clientY - colBottomY);

        // Generous magnetic column snap radius horizontally
        if (dx <= colWidth * 0.92 && clientY >= stageRect.top - 40) {
          const weightedDist = dx * 1.4 + dy * 0.25;
          if (weightedDist < bestDist) {
            bestDist = weightedDist;
            bestCol = col;
          }
        }
      }
      return bestCol;
    },
    [colWidth, gap, columns, columnLayouts, cardHeight]
  );

  // Edge auto-scroll while dragging near top or bottom of scrollable stage
  useEffect(() => {
    if (!drag?.active || !needsScroll) return;
    let rafId = 0;

    const tick = () => {
      const el = stageRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const edge = 44;
        if (drag.currY < rect.top + edge && el.scrollTop > 0) {
          el.scrollTop -= 6;
        } else if (
          drag.currY > rect.bottom - edge &&
          el.scrollTop + el.clientHeight < el.scrollHeight
        ) {
          el.scrollTop += 6;
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [drag?.active, drag?.currY, needsScroll]);

  useEffect(() => {
    if (!drag) return;

    const threshold = drag.pointerType === 'touch' ? 9 : 6;
    const touchLiftY = drag.pointerType === 'touch' ? 20 : 0;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const movedEnough = drag.active || Math.hypot(dx, dy) > threshold;

      if (!movedEnough) {
        setDrag((prev) => (prev ? { ...prev, currX: e.clientX, currY: e.clientY } : null));
        return;
      }

      const hovered = findBestDropColumn(
        e.clientX,
        e.clientY - touchLiftY,
        drag.fromCol,
        drag.cards[0]
      );

      setDrag((prev) =>
        prev
          ? {
              ...prev,
              active: true,
              currX: e.clientX,
              currY: e.clientY,
              hoveredTargetCol: hovered,
            }
          : null
      );
    };

    const handlePointerUp = () => {
      if (!drag.active) {
        const { fromCol, cardIndex } = drag;
        setDrag(null);
        onSmartClick(fromCol, cardIndex);
        return;
      }

      const target = drag.hoveredTargetCol;
      const { fromCol, cardIndex } = drag;
      setDrag(null);
      if (target !== null) {
        onAttemptMove({ type: 'move', fromCol, cardIndex, toCol: target });
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [drag, findBestDropColumn, onAttemptMove, onSmartClick]);

  const handleCardPointerDown = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      fromCol: number,
      cardIndex: number
    ) => {
      if (interactionLocked) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const col = columns[fromCol];
      if (!isMovableSequence(col, cardIndex)) return;

      e.preventDefault();
      const cardRect = e.currentTarget.getBoundingClientRect();
      const layout = columnLayouts[fromCol];

      setDrag({
        fromCol,
        cardIndex,
        cards: col.slice(cardIndex),
        pointerType: e.pointerType || 'mouse',
        startX: e.clientX,
        startY: e.clientY,
        currX: e.clientX,
        currY: e.clientY,
        offsetX: e.clientX - cardRect.left,
        offsetY: e.clientY - cardRect.top,
        stepY: layout.upStep,
        active: false,
        hoveredTargetCol: null,
      });
    },
    [interactionLocked, columns, columnLayouts]
  );

  // Determine which cards in destination columns are temporarily hidden while flying in
  const hiddenSlots = useMemo(() => {
    const map = new Map<number, number>();
    for (const pkt of flyingPackets) {
      if (pkt.hiddenTarget) {
        const prev = map.get(pkt.hiddenTarget.col);
        if (prev === undefined || pkt.hiddenTarget.fromIndex < prev) {
          map.set(pkt.hiddenTarget.col, pkt.hiddenTarget.fromIndex);
        }
      }
    }
    return map;
  }, [flyingPackets]);

  const dragTouchLift = drag?.pointerType === 'touch' ? 20 : 0;

  return (
    <div
      ref={stageRef}
      data-testid="tableau-board"
      onScroll={updateScrollIndicator}
      style={{ touchAction: 'pan-y' }}
      className="relative flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain tableau-scroll"
    >
      <div
        ref={innerStageRef}
        className="w-full flex justify-center pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
        style={{
          paddingTop: topPad,
          paddingBottom: bottomZoneHeight + 14,
        }}
      >
        {/* 10-Column Strict Grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-10 items-start"
          style={{
            gap,
            width: colWidth * 10 + gap * 9,
          }}
        >
          {columns.map((col, colIndex) => {
            const layout = columnLayouts[colIndex];
            const maxTailStart = getMaxMovableTailStart(col);
            const isDragHoverTarget =
              drag?.active && drag.hoveredTargetCol === colIndex;
            const isHintTarget =
              activeHint?.type === 'move' && activeHint.toCol === colIndex;
            const isEmptyWarning =
              col.length === 0 && emptyColWarnings.includes(colIndex);
            const hiddenFrom = hiddenSlots.get(colIndex);
            const colContainerHeight = Math.max(availHeight, layout.totalHeight);

            // Landing Y coordinate for the dashed target outline
            let previewTop = 0;
            if (col.length > 0) {
              const lastIdx = col.length - 1;
              previewTop =
                layout.ys[lastIdx] +
                (col[lastIdx].faceUp ? layout.upStep : layout.downStep);
            }

            return (
              <div
                key={colIndex}
                data-testid={`tableau-col-${colIndex}`}
                className="relative flex justify-center"
                style={{ width: colWidth, height: colContainerHeight }}
              >
                {/* Empty Slot Foundation */}
                <div
                  onClick={() => {
                    // Clicking empty slot does nothing directly; drag/smart-click handles drops
                  }}
                  style={{ width: cardWidth, height: cardHeight }}
                  className={[
                    'relative rounded-[6px] sm:rounded-[8px] border transition-colors duration-200 flex items-center justify-center',
                    isEmptyWarning
                      ? 'border-2 border-dashed empty-col-warn bg-amber-400/10'
                      : 'border-white/15 bg-black/18 shadow-inner',
                  ].join(' ')}
                >
                  {col.length === 0 && (
                    <span className="text-[11px] font-serif text-white/18 select-none">
                      K
                    </span>
                  )}
                </div>

                {/* Cards in Column */}
                <div
                  className="absolute top-0"
                  style={{
                    width: cardWidth,
                    left: (colWidth - cardWidth) / 2,
                  }}
                >
                  {col.map((card, cardIdx) => {
                    const movable = card.faceUp && cardIdx >= maxTailStart;
                    const isDraggingOrigin =
                      Boolean(drag?.active) &&
                      drag?.fromCol === colIndex &&
                      cardIdx >= drag.cardIndex;
                    const isHintSource =
                      activeHint?.type === 'move' &&
                      activeHint.fromCol === colIndex &&
                      activeHint.cardIndex !== undefined &&
                      cardIdx >= activeHint.cardIndex;
                    const isHiddenForFlight =
                      hiddenFrom !== undefined && cardIdx >= hiddenFrom;

                    return (
                      <CardView
                        key={card.id}
                        card={card}
                        cardBack={cardBack}
                        faceVariant={faceVariant}
                        width={cardWidth}
                        height={cardHeight}
                        isMovable={movable}
                        isHintSource={isHintSource}
                        isDraggingOrigin={isDraggingOrigin || isHiddenForFlight}
                        isShaking={shakingCol === colIndex && movable}
                        zIndex={cardIdx + 1}
                        style={{ top: layout.ys[cardIdx] }}
                        onPointerDown={(e) =>
                          handleCardPointerDown(e, colIndex, cardIdx)
                        }
                      />
                    );
                  })}

                  {/* Target Drop Preview (Dark Translucent + Golden Dashed Outline) */}
                  {(isHintTarget || isDragHoverTarget) && (
                    <div
                      data-testid={`drop-preview-${colIndex}`}
                      onClick={
                        isHintTarget &&
                        activeHint?.fromCol !== undefined &&
                        activeHint.cardIndex !== undefined
                          ? () =>
                              onAttemptMove({
                                type: 'move',
                                fromCol: activeHint.fromCol!,
                                cardIndex: activeHint.cardIndex!,
                                toCol: colIndex,
                              })
                          : undefined
                      }
                      style={{
                        top: previewTop,
                        width: cardWidth,
                        height: cardHeight,
                        zIndex: col.length + 10,
                      }}
                      className={[
                        'absolute left-0 rounded-[6px] sm:rounded-[8px] bg-black/48 border-2 border-dashed border-[#f7cf54] hint-target-outline flex items-center justify-center',
                        isHintTarget && !isDragHoverTarget
                          ? 'pointer-events-auto cursor-pointer'
                          : 'pointer-events-none',
                      ].join(' ')}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f7cf54]/75 shadow-[0_0_8px_#f7cf54]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subtle Scroll-Down Cue when a long stack extends past the viewport */}
      {needsScroll && canScrollDown && (
        <button
          type="button"
          onClick={() => {
            stageRef.current?.scrollBy({ top: 140, behavior: 'smooth' });
          }}
          style={{ bottom: bottomZoneHeight + 8 }}
          className="fixed left-1/2 -translate-x-1/2 z-25 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#09120d]/85 backdrop-blur-sm border border-[#f3c950]/45 text-[11px] font-medium text-[#ffe694] shadow-lg cursor-pointer hover:bg-[#102118]"
        >
          <span>下滑看更多</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Active Drag Floating Layer */}
      {drag?.active && (
        <DragOverlay
          cards={drag.cards}
          cardBack={cardBack}
          faceVariant={faceVariant}
          x={drag.currX - drag.offsetX}
          y={drag.currY - drag.offsetY - dragTouchLift}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          stepY={drag.stepY}
        />
      )}

      {/* Flying Card Packets (Smart-Click, Solver Move, Stock Deal, K->A Parabolic Arc) */}
      {flyingPackets.map((pkt) => (
        <FlyingPacketView
          key={pkt.id}
          packet={pkt}
          faceVariant={faceVariant}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />
      ))}
    </div>
  );
};

const FlyingPacketView: React.FC<{
  packet: FlyingCardPacket;
  faceVariant: CardFaceVariant;
  cardWidth: number;
  cardHeight: number;
}> = ({ packet, faceVariant, cardWidth, cardHeight }) => {
  const isArc = packet.kind === 'collect';
  const midX = (packet.fromX + packet.toX) / 2 - (isArc ? 35 : 0);
  const arcPeakY = Math.min(packet.fromY, packet.toY) - (isArc ? 80 : 14);
  const totalH = cardHeight + (packet.cards.length - 1) * packet.stepY;

  return (
    <motion.div
      initial={{
        x: packet.fromX,
        y: packet.fromY,
        scale: 1.03,
        opacity: 1,
      }}
      animate={
        isArc
          ? {
              x: [packet.fromX, midX, packet.toX],
              y: [packet.fromY, arcPeakY, packet.toY],
              scale: [1.04, 0.96, 0.78],
              opacity: [1, 1, 0.95],
            }
          : {
              x: packet.toX,
              y: packet.toY,
              scale: 1,
              opacity: 1,
            }
      }
      transition={{
        duration: packet.durationMs / 1000,
        delay: (packet.delayMs ?? 0) / 1000,
        ease: isArc ? 'easeInOut' : [0.22, 1, 0.36, 1],
      }}
      className="fixed top-0 left-0 pointer-events-none z-50"
      style={{
        width: cardWidth,
        height: totalH,
        willChange: 'transform',
      }}
    >
      {packet.cards.map((card, idx) => (
        <div
          key={card.id}
          className="absolute left-0 rounded-[6px] sm:rounded-[8px] shadow-[0_10px_22px_rgba(0,0,0,0.55)]"
          style={{
            top: idx * packet.stepY,
            width: cardWidth,
            height: cardHeight,
          }}
        >
          <CardFaceSvg
            suit={card.suit}
            rank={card.rank}
            variant={faceVariant}
            className="w-full h-full block"
          />
        </div>
      ))}
    </motion.div>
  );
};
