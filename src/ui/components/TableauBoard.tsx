import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Card, CardBackTheme, MoveAction } from '../../core/types';
import {
  canPlaceSequence,
  getMaxMovableTailStart,
  isMovableSequence,
} from '../../core/rules';
import { CardFaceSvg } from './CardSvg';
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

interface ColumnLayout {
  ys: number[];
  upStep: number;
  downStep: number;
}

export function computeColumnLayout(
  column: Card[],
  cardHeight: number,
  availHeight: number
): ColumnLayout {
  const n = column.length;
  if (n <= 1) {
    return {
      ys: n === 1 ? [0] : [],
      upStep: Math.max(18, Math.round(cardHeight * 0.26)),
      downStep: Math.max(6, Math.round(cardHeight * 0.1)),
    };
  }

  let downCount = 0;
  let upCount = 0;
  for (let i = 0; i < n - 1; i++) {
    if (column[i].faceUp) upCount++;
    else downCount++;
  }

  const idealDown = Math.max(6, Math.min(13, cardHeight * 0.105));
  const idealUp = Math.max(17, Math.min(34, cardHeight * 0.265));
  const maxSpan = Math.max(24, availHeight - cardHeight);

  let downStep = idealDown;
  let upStep = idealUp;

  const idealSpan = downCount * downStep + upCount * upStep;
  if (idealSpan > maxSpan) {
    const minDown = Math.max(3, Math.min(6, cardHeight * 0.05));
    const fixedDown = downCount * minDown;
    if (upCount > 0 && maxSpan > fixedDown) {
      const remainingForUp = maxSpan - downCount * Math.min(downStep, Math.max(minDown, downStep * 0.7));
      const candidateDown = Math.min(downStep, Math.max(minDown, downStep * 0.7));
      const candidateUp = remainingForUp / upCount;
      if (candidateUp >= Math.max(10, cardHeight * 0.12)) {
        downStep = candidateDown;
        upStep = candidateUp;
      } else {
        // Compress uniformly
        const ratio = maxSpan / idealSpan;
        downStep = Math.max(3, idealDown * ratio);
        upStep = Math.max(8, idealUp * ratio);
      }
    } else {
      const ratio = maxSpan / Math.max(1, idealSpan);
      downStep = Math.max(3, idealDown * ratio);
      upStep = Math.max(8, idealUp * ratio);
    }

    // Final hard clamp so the last card never exceeds availHeight
    const finalSpan = downCount * downStep + upCount * upStep;
    if (finalSpan > maxSpan && finalSpan > 0) {
      const fix = maxSpan / finalSpan;
      downStep *= fix;
      upStep *= fix;
    }
  }

  const ys: number[] = [0];
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    acc += column[i].faceUp ? upStep : downStep;
    ys.push(acc);
  }

  return { ys, upStep, downStep };
}

interface DragState {
  fromCol: number;
  cardIndex: number;
  cards: Card[];
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
  const [size, setSize] = useState({ width: 1000, height: 600 });
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const gap = size.width < 640 ? 4 : size.width < 1024 ? 8 : 12;
  const sidePad = size.width < 640 ? 6 : 16;
  const usableWidth = Math.max(280, size.width - sidePad * 2);
  const colWidth = Math.floor((usableWidth - gap * 9) / 10);
  const cardWidth = Math.max(26, Math.min(118, colWidth));
  const cardHeight = Math.round(cardWidth * 1.4);

  // Reserve top padding (8px) + bottom margin for completed stack, stock badge & floating toolbar
  const bottomZoneHeight = Math.max(
    toolbarCollapsed ? 62 : 74,
    Math.round(Math.min(106, cardWidth * 0.78 * 1.4 + 24))
  );
  const availHeight = Math.max(cardHeight + 24, size.height - bottomZoneHeight - 10);

  const columnLayouts = useMemo(
    () => columns.map((col) => computeColumnLayout(col, cardHeight, availHeight)),
    [columns, cardHeight, availHeight]
  );

  // Notify parent of geometry for flying animations & corner scaling
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const totalGridW = colWidth * 10 + gap * 9;
    const gridStartX = rect.left + (rect.width - totalGridW) / 2;
    const colLefts = Array.from(
      { length: 10 },
      (_, idx) => gridStartX + idx * (colWidth + gap) + (colWidth - cardWidth) / 2
    );

    onMetricsChange({
      stageRect: rect,
      colWidth,
      cardWidth,
      cardHeight,
      colLefts,
      availHeight,
    });

    getColumnMetricsRef.current = (col: number, cardIndex?: number) => {
      const liveRect = el.getBoundingClientRect();
      const liveStartX = liveRect.left + (liveRect.width - totalGridW) / 2;
      const x =
        liveStartX + col * (colWidth + gap) + (colWidth - cardWidth) / 2;
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
        y: liveRect.top + 8 + yOffset,
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
      const el = stageRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const totalGridW = colWidth * 10 + gap * 9;
      const gridStartX = rect.left + (rect.width - totalGridW) / 2;

      let bestCol: number | null = null;
      let bestDist = Infinity;

      for (let col = 0; col < 10; col++) {
        if (col === fromCol) continue;
        if (!canPlaceSequence(movingTop, columns[col])) continue;

        const colCenterX = gridStartX + col * (colWidth + gap) + colWidth / 2;
        const layout = columnLayouts[col];
        const colBottomY =
          rect.top +
          8 +
          (layout.ys.length > 0 ? layout.ys[layout.ys.length - 1] + cardHeight / 2 : cardHeight / 2);

        const dx = Math.abs(clientX - colCenterX);
        const dy = Math.abs(clientY - colBottomY);

        // Generous magnetic column snap radius horizontally
        if (dx <= colWidth * 0.92 && clientY >= rect.top - 40) {
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

  useEffect(() => {
    if (!drag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const movedEnough = drag.active || Math.hypot(dx, dy) > 6;

      if (!movedEnough) {
        setDrag((prev) => (prev ? { ...prev, currX: e.clientX, currY: e.clientY } : null));
        return;
      }

      const hovered = findBestDropColumn(
        e.clientX,
        e.clientY,
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

  return (
    <div
      ref={stageRef}
      data-testid="tableau-board"
      className="relative flex-1 min-h-0 w-full pt-2 flex justify-center overflow-hidden"
    >
      {/* 10-Column Strict Grid */}
      <div
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

          // Landing Y coordinate for the dashed target outline
          let previewTop = 0;
          if (col.length > 0) {
            const lastIdx = col.length - 1;
            previewTop =
              layout.ys[lastIdx] +
              (col[lastIdx].faceUp ? layout.upStep : layout.downStep);
            // Keep preview within visible stage if near bottom
            previewTop = Math.min(previewTop, Math.max(0, availHeight - cardHeight));
          }

          return (
            <div
              key={colIndex}
              data-testid={`tableau-col-${colIndex}`}
              className="relative flex justify-center"
              style={{ width: colWidth, height: availHeight }}
            >
              {/* Empty Slot Foundation */}
              <div
                onClick={() => {
                  // Clicking empty slot does nothing directly; drag/smart-click handles drops
                }}
                style={{ width: cardWidth, height: cardHeight }}
                className={[
                  'relative rounded-[8px] border transition-colors duration-200 flex items-center justify-center',
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
                      'absolute left-0 rounded-[8px] bg-black/48 border-2 border-dashed border-[#f7cf54] hint-target-outline flex items-center justify-center',
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

      {/* Active Drag Floating Layer */}
      {drag?.active && (
        <DragOverlay
          cards={drag.cards}
          cardBack={cardBack}
          x={drag.currX - drag.offsetX}
          y={drag.currY - drag.offsetY}
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
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />
      ))}
    </div>
  );
};

const FlyingPacketView: React.FC<{
  packet: FlyingCardPacket;
  cardWidth: number;
  cardHeight: number;
}> = ({ packet, cardWidth, cardHeight }) => {
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
          className="absolute left-0 rounded-[8px] shadow-[0_10px_22px_rgba(0,0,0,0.55)]"
          style={{
            top: idx * packet.stepY,
            width: cardWidth,
            height: cardHeight,
          }}
        >
          <CardFaceSvg suit={card.suit} rank={card.rank} className="w-full h-full block" />
        </div>
      ))}
    </motion.div>
  );
};
