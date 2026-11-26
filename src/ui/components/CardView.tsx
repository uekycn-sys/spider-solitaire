import React from 'react';
import type { Card, CardBackTheme } from '../../core/types';
import { CardBackSvg, CardFaceSvg } from './CardSvg';

interface CardViewProps {
  card: Card;
  cardBack: CardBackTheme;
  width: number;
  height: number;
  isMovable?: boolean;
  isHintSource?: boolean;
  isDraggingOrigin?: boolean;
  isShaking?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
  zIndex?: number;
}

export const CardView: React.FC<CardViewProps> = React.memo(
  ({
    card,
    cardBack,
    width,
    height,
    isMovable = false,
    isHintSource = false,
    isDraggingOrigin = false,
    isShaking = false,
    onPointerDown,
    style,
    zIndex = 1,
  }) => {
    return (
      <div
        onPointerDown={isMovable ? onPointerDown : undefined}
        style={{
          width,
          height,
          zIndex,
          ...style,
        }}
        className={[
          'card-3d-scene absolute left-0 select-none rounded-[8px]',
          isMovable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
          isDraggingOrigin ? 'opacity-0 pointer-events-none' : '',
          isShaking ? 'animate-card-shake' : '',
        ].join(' ')}
      >
        <div
          className={[
            'card-3d-inner relative w-full h-full rounded-[8px]',
            card.faceUp ? '' : '[transform:rotateY(180deg)]',
            isHintSource
              ? 'hint-source-glow'
              : 'shadow-[0_2px_6px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3)]',
            isMovable && !isHintSource
              ? 'hover:brightness-[1.03] transition-[filter] duration-150'
              : '',
            card.faceUp && !isMovable ? 'brightness-[0.93]' : '',
          ].join(' ')}
        >
          <div className="card-3d-face absolute inset-0 rounded-[8px] overflow-hidden">
            <CardFaceSvg suit={card.suit} rank={card.rank} className="w-full h-full block" />
          </div>
          <div className="card-3d-face card-3d-back absolute inset-0 rounded-[8px] overflow-hidden">
            <CardBackSvg theme={cardBack} className="w-full h-full block" />
          </div>
        </div>
      </div>
    );
  }
);

CardView.displayName = 'CardView';
