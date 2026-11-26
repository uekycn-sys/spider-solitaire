import React from 'react';
import type { Card, CardBackTheme } from '../../core/types';
import { CardFaceSvg } from './CardSvg';

interface DragOverlayProps {
  cards: Card[];
  cardBack: CardBackTheme;
  x: number;
  y: number;
  cardWidth: number;
  cardHeight: number;
  stepY: number;
}

export const DragOverlay: React.FC<DragOverlayProps> = ({
  cards,
  x,
  y,
  cardWidth,
  cardHeight,
  stepY,
}) => {
  if (cards.length === 0) return null;

  const totalHeight = cardHeight + (cards.length - 1) * stepY;

  return (
    <div
      className="fixed top-0 left-0 pointer-events-none z-50"
      style={{
        width: cardWidth,
        height: totalHeight,
        transform: `translate3d(${x}px, ${y}px, 0) scale(1.035)`,
        transformOrigin: 'top center',
        willChange: 'transform',
      }}
    >
      {cards.map((card, idx) => (
        <div
          key={card.id}
          className="absolute left-0 rounded-[8px] shadow-[0_14px_28px_rgba(0,0,0,0.6),0_4px_10px_rgba(0,0,0,0.45)]"
          style={{
            top: idx * stepY,
            width: cardWidth,
            height: cardHeight,
          }}
        >
          <CardFaceSvg suit={card.suit} rank={card.rank} className="w-full h-full block" />
        </div>
      ))}
    </div>
  );
};
