import React from 'react';
import type { CardBackTheme, Rank, Suit } from '../../core/types';

interface SuitIconProps {
  suit: Suit;
  x: number;
  y: number;
  size: number;
  color: string;
  flip?: boolean;
}

function SuitSymbol({ suit, x, y, size, color, flip = false }: SuitIconProps) {
  const half = size / 2;
  const transform = flip
    ? `translate(${x}, ${y}) rotate(180) scale(${size / 24}) translate(-12, -12)`
    : `translate(${x - half}, ${y - half}) scale(${size / 24})`;

  switch (suit) {
    case 'spades':
      return (
        <path
          transform={transform}
          fill={color}
          d="M12 2C8 7 3.5 10.6 3.5 14.8a4.7 4.7 0 0 0 7.4 3.7c-.3 1.7-1.1 3.1-2.6 4.2h7.4c-1.5-1.1-2.3-2.5-2.6-4.2a4.7 4.7 0 0 0 7.4-3.7C20.5 10.6 16 7 12 2z"
        />
      );
    case 'hearts':
      return (
        <path
          transform={transform}
          fill={color}
          d="M12 21.3C6.8 17 2.8 13.1 2.8 8.7A4.9 4.9 0 0 1 12 6.2a4.9 4.9 0 0 1 9.2 2.5c0 4.4-4 8.3-9.2 12.6z"
        />
      );
    case 'clubs':
      return (
        <path
          transform={transform}
          fill={color}
          d="M12 2.4a4.2 4.2 0 0 0-3.2 6.9 4.3 4.3 0 0 0-5.4 4.1 4.2 4.2 0 0 0 7.3 2.8c-.3 2.1-1.1 3.8-2.4 5.1h7.4c-1.3-1.3-2.1-3-2.4-5.1a4.2 4.2 0 0 0 7.3-2.8 4.3 4.3 0 0 0-5.4-4.1A4.2 4.2 0 0 0 12 2.4z"
        />
      );
    case 'diamonds':
      return (
        <path
          transform={transform}
          fill={color}
          d="M12 2L20.5 12L12 22L3.5 12Z"
        />
      );
  }
}

export function getRankLabel(rank: Rank): string {
  switch (rank) {
    case 1:
      return 'A';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    default:
      return String(rank);
  }
}

export function getSuitColor(suit: Suit): string {
  return suit === 'hearts' || suit === 'diamonds' ? '#c81e2b' : '#14181f';
}

export function getSuitNameZh(suit: Suit): string {
  switch (suit) {
    case 'spades':
      return '黑桃';
    case 'hearts':
      return '红桃';
    case 'clubs':
      return '梅花';
    case 'diamonds':
      return '方块';
  }
}

// Standard pip coordinates inside 140x196 card canvas
const PIP_LAYOUTS: Record<number, Array<[number, number, boolean?]>> = {
  2: [
    [70, 58, false],
    [70, 138, true],
  ],
  3: [
    [70, 56, false],
    [70, 98, false],
    [70, 140, true],
  ],
  4: [
    [48, 58, false],
    [92, 58, false],
    [48, 138, true],
    [92, 138, true],
  ],
  5: [
    [48, 58, false],
    [92, 58, false],
    [70, 98, false],
    [48, 138, true],
    [92, 138, true],
  ],
  6: [
    [48, 56, false],
    [92, 56, false],
    [48, 98, false],
    [92, 98, false],
    [48, 140, true],
    [92, 140, true],
  ],
  7: [
    [48, 56, false],
    [92, 56, false],
    [70, 77, false],
    [48, 98, false],
    [92, 98, false],
    [48, 140, true],
    [92, 140, true],
  ],
  8: [
    [48, 56, false],
    [92, 56, false],
    [70, 77, false],
    [48, 98, false],
    [92, 98, false],
    [70, 119, true],
    [48, 140, true],
    [92, 140, true],
  ],
  9: [
    [48, 54, false],
    [92, 54, false],
    [48, 83, false],
    [92, 83, false],
    [70, 98, false],
    [48, 113, true],
    [92, 113, true],
    [48, 142, true],
    [92, 142, true],
  ],
  10: [
    [48, 54, false],
    [92, 54, false],
    [70, 68, false],
    [48, 83, false],
    [92, 83, false],
    [48, 113, true],
    [92, 113, true],
    [70, 128, true],
    [48, 142, true],
    [92, 142, true],
  ],
};

function VintageCourtArt({
  rank,
  suit,
  color,
}: {
  rank: 11 | 12 | 13;
  suit: Suit;
  color: string;
}) {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const primary = isRed ? '#b91c1c' : '#1e3a5f';
  const secondary = isRed ? '#1e293b' : '#b45309';
  const gold = '#d4af37';

  const halfFigure = (
    <g>
      {/* Royal cloak shoulders */}
      <path
        d="M36 98 L45 72 Q70 64 95 72 L104 98 Z"
        fill={primary}
        stroke={gold}
        strokeWidth="1.2"
      />
      {/* Diagonal royal sash */}
      <path d="M52 71 L86 98 L75 98 L44 74 Z" fill={secondary} opacity="0.9" />
      <path d="M47 73 L79 98" stroke={gold} strokeWidth="1.3" />
      {/* Face & hair silhouette */}
      <circle cx="70" cy="60" r="10.5" fill="#f5deb3" stroke="#7c5c38" strokeWidth="0.9" />
      <path
        d="M59.5 59 Q60 49 70 49 Q80 49 80.5 59"
        fill={rank === 12 ? '#6b4226' : '#3a2b20'}
      />
      {/* Eyes */}
      <circle cx="66.5" cy="59.5" r="1.1" fill="#2d241c" />
      <circle cx="73.5" cy="59.5" r="1.1" fill="#2d241c" />
      {rank === 13 && (
        /* King beard */
        <path d="M62 63 Q70 72 78 63 Q74 68 70 68 Q66 68 62 63 Z" fill="#3a2b20" />
      )}
      {/* Crown / Cap / Tiara */}
      {rank === 13 && (
        <path
          d="M58 51 L60 41 L65 46 L70 39 L75 46 L80 41 L82 51 Z"
          fill={gold}
          stroke="#7c580d"
          strokeWidth="1"
        />
      )}
      {rank === 12 && (
        <path
          d="M59 51 L63 43 L70 40 L77 43 L81 51 Z"
          fill={gold}
          stroke="#7c580d"
          strokeWidth="1"
        />
      )}
      {rank === 11 && (
        <path
          d="M59 51 Q70 42 81 51 L78 46 Q70 40 62 46 Z"
          fill={primary}
          stroke={gold}
          strokeWidth="1.1"
        />
      )}
      {/* Weapon / Rose emblem in hand */}
      {rank === 13 && (
        <g stroke={gold} strokeWidth="1.6" strokeLinecap="round">
          <line x1="94" y1="68" x2="94" y2="96" />
          <line x1="89" y1="74" x2="99" y2="74" />
        </g>
      )}
      {rank === 12 && (
        <circle cx="94" cy="77" r="4.2" fill="#e11d48" stroke={gold} strokeWidth="1" />
      )}
      {rank === 11 && (
        <g stroke="#64748b" strokeWidth="1.6" strokeLinecap="round">
          <line x1="94" y1="67" x2="94" y2="96" />
          <polygon points="94,63 97,69 91,69" fill={gold} stroke="none" />
        </g>
      )}
    </g>
  );

  return (
    <g>
      {/* Ornate court frame */}
      <rect
        x="26"
        y="37"
        width="88"
        height="122"
        rx="6"
        fill="#faf6ea"
        stroke={gold}
        strokeWidth="1.5"
      />
      <rect
        x="29"
        y="40"
        width="82"
        height="116"
        rx="4"
        fill="none"
        stroke={primary}
        strokeWidth="0.8"
        strokeDasharray="3 2"
        opacity="0.7"
      />
      <clipPath id={`court-top-${rank}-${suit}`}>
        <rect x="29" y="40" width="82" height="58" />
      </clipPath>
      <g clipPath={`url(#court-top-${rank}-${suit})`}>{halfFigure}</g>
      <g transform="rotate(180 70 98)">
        <g clipPath={`url(#court-top-${rank}-${suit})`}>{halfFigure}</g>
      </g>
      {/* Diagonal divider & corner suit pips */}
      <line x1="29" y1="98" x2="111" y2="98" stroke={gold} strokeWidth="1.1" opacity="0.8" />
      <SuitSymbol suit={suit} x={39} y={50} size={13} color={color} />
      <SuitSymbol suit={suit} x={101} y={146} size={13} color={color} flip />
    </g>
  );
}

export const CardFaceSvg: React.FC<{
  suit: Suit;
  rank: Rank;
  className?: string;
}> = React.memo(({ suit, rank, className }) => {
  const color = getSuitColor(suit);
  const label = getRankLabel(rank);
  const isTen = rank === 10;

  return (
    <svg
      viewBox="0 0 140 196"
      className={className}
      aria-label={`${getSuitNameZh(suit)} ${label}`}
    >
      <defs>
        <linearGradient id="card-paper" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3efe3" />
        </linearGradient>
      </defs>

      {/* Card body */}
      <rect
        x="1"
        y="1"
        width="138"
        height="194"
        rx="10"
        fill="url(#card-paper)"
        stroke="#c9c2b2"
        strokeWidth="1.5"
      />

      {/* Top header: bold rank left + bold suit right (always visible even under tight compression) */}
      <text
        x={isTen ? 9 : 12}
        y={isTen ? 27 : 29}
        fill={color}
        fontSize={isTen ? '23' : '27'}
        fontWeight="800"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing={isTen ? '-1.6' : '0'}
      >
        {label}
      </text>
      <SuitSymbol suit={suit} x={isTen ? 45 : 42} y={20} size={17} color={color} />
      <SuitSymbol suit={suit} x={119} y={20} size={22} color={color} />

      {/* Mirrored bottom corner */}
      <g transform="rotate(180 70 98)">
        <text
          x={isTen ? 9 : 12}
          y={isTen ? 27 : 29}
          fill={color}
          fontSize={isTen ? '23' : '27'}
          fontWeight="800"
          fontFamily="Georgia, 'Times New Roman', serif"
          letterSpacing={isTen ? '-1.6' : '0'}
        >
          {label}
        </text>
        <SuitSymbol suit={suit} x={isTen ? 45 : 42} y={20} size={17} color={color} />
      </g>

      {/* Subtle header separator line */}
      <line x1="12" y1="35" x2="128" y2="35" stroke="#e5dfd0" strokeWidth="0.9" />

      {/* Center artwork */}
      {rank === 1 && (
        <g>
          <SuitSymbol suit={suit} x={70} y={100} size={suit === 'spades' ? 66 : 60} color={color} />
          {suit === 'spades' && (
            <circle cx="70" cy="100" r="38" fill="none" stroke="#d4af37" strokeWidth="0.9" opacity="0.55" />
          )}
        </g>
      )}

      {rank >= 2 && rank <= 10 &&
        PIP_LAYOUTS[rank].map(([px, py, flip], idx) => (
          <SuitSymbol
            key={idx}
            suit={suit}
            x={px}
            y={py}
            size={rank >= 9 ? 22 : 25}
            color={color}
            flip={flip}
          />
        ))}

      {(rank === 11 || rank === 12 || rank === 13) && (
        <VintageCourtArt rank={rank} suit={suit} color={color} />
      )}
    </svg>
  );
});

CardFaceSvg.displayName = 'CardFaceSvg';

const BACK_PALETTES: Record<
  CardBackTheme,
  { outer: string; inner: string; accent: string; pattern: string }
> = {
  blue: {
    outer: '#143868',
    inner: '#0c2344',
    accent: '#9ec5f8',
    pattern: '#275ca1',
  },
  crimson: {
    outer: '#6b1422',
    inner: '#430914',
    accent: '#f5b8c2',
    pattern: '#962235',
  },
  emerald: {
    outer: '#114732',
    inner: '#092b1e',
    accent: '#a7e3c8',
    pattern: '#1d694b',
  },
};

export const CardBackSvg: React.FC<{
  theme?: CardBackTheme;
  className?: string;
}> = React.memo(({ theme = 'blue', className }) => {
  const palette = BACK_PALETTES[theme];
  const patternId = `lattice-${theme}`;

  return (
    <svg viewBox="0 0 140 196" className={className} aria-hidden="true">
      <defs>
        <pattern
          id={patternId}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M7 0 L14 7 L7 14 L0 7 Z"
            fill="none"
            stroke={palette.pattern}
            strokeWidth="1"
          />
          <circle cx="7" cy="7" r="1.4" fill={palette.accent} opacity="0.55" />
        </pattern>
      </defs>

      {/* Ivory outer border */}
      <rect
        x="1"
        y="1"
        width="138"
        height="194"
        rx="10"
        fill="#f7f4ec"
        stroke="#c5beb0"
        strokeWidth="1.5"
      />
      {/* Colored base */}
      <rect
        x="7"
        y="7"
        width="126"
        height="182"
        rx="7"
        fill={palette.outer}
      />
      {/* Guilloche pattern fill */}
      <rect
        x="11"
        y="11"
        width="118"
        height="174"
        rx="5"
        fill={`url(#${patternId})`}
        stroke={palette.accent}
        strokeWidth="1"
        strokeOpacity="0.55"
      />
      {/* Inner double frame */}
      <rect
        x="15"
        y="15"
        width="110"
        height="166"
        rx="4"
        fill="none"
        stroke="#e8d294"
        strokeWidth="0.9"
        strokeOpacity="0.65"
      />
      {/* Corner ornaments */}
      {[
        [20, 20],
        [120, 20],
        [20, 176],
        [120, 176],
      ].map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r="3.2"
          fill={palette.inner}
          stroke="#e8d294"
          strokeWidth="1"
        />
      ))}

      {/* Central vintage rosette medallion */}
      <g transform="translate(70 98)">
        <circle r="24" fill={palette.inner} stroke="#e8d294" strokeWidth="1.4" />
        <circle r="18" fill="none" stroke={palette.accent} strokeWidth="0.9" strokeDasharray="2.5 2" />
        <path
          d="M0 -14 L3.5 -3.5 L14 0 L3.5 3.5 L0 14 L-3.5 3.5 L-14 0 L-3.5 -3.5 Z"
          fill="#e8d294"
          opacity="0.9"
        />
        <circle r="4.2" fill={palette.outer} stroke="#e8d294" strokeWidth="1" />
      </g>
    </svg>
  );
});

CardBackSvg.displayName = 'CardBackSvg';
