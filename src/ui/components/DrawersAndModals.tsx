import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Palette,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AllStats,
  CardBackTheme,
  CardFaceStyle,
  Difficulty,
  FeltTheme,
  UserPreferences,
} from '../../core/types';
import { formatTime } from './TopHud';

interface DrawerProps {
  open: boolean;
  preferences: UserPreferences;
  stats: AllStats;
  onClose: () => void;
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void;
  onResetStats: () => void;
}

const DIFF_LIST: { key: Difficulty; label: string; desc: string }[] = [
  { key: 'easy', label: '简单 · 单花色', desc: '8 副黑桃，轻松上手' },
  { key: 'medium', label: '中等 · 双花色', desc: '4 副黑桃 + 4 副红桃，经典平衡' },
  { key: 'hard', label: '困难 · 四花色', desc: '黑桃/红桃/梅花/方块，大师挑战' },
];

export const MenuDrawer: React.FC<DrawerProps> = ({
  open,
  preferences,
  stats,
  onClose,
  onUpdatePreferences,
  onResetStats,
}) => {
  const [tab, setTab] = useState<'settings' | 'stats' | 'rules'>('settings');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs"
        onClick={onClose}
      />
      <aside className="relative z-10 w-full max-w-md h-full pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] bg-[#0b1410] border-r border-[#d4af37]/40 shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#f3c950] tracking-wide">
            牌桌菜单与设置
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-stone-300 hover:text-white cursor-pointer"
            aria-label="关闭菜单"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-2 border-b border-white/10 pb-3">
          {[
            { id: 'settings' as const, label: '外观与音效', icon: Palette },
            { id: 'stats' as const, label: '战绩统计', icon: Trophy },
            { id: 'rules' as const, label: '规则与快捷键', icon: BookOpen },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition cursor-pointer',
                  active
                    ? 'bg-[#f3c950]/20 text-[#ffe694] border border-[#f3c950]/50'
                    : 'bg-white/5 text-stone-300 hover:bg-white/10',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {tab === 'settings' && (
            <>
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  {preferences.muted ? (
                    <VolumeX className="w-5 h-5 text-stone-400" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-[#f3c950]" />
                  )}
                  <div>
                    <div className="text-sm font-semibold">合成牌桌音效</div>
                    <div className="text-xs text-stone-400">
                      发牌、翻牌、落牌、收牌与提示音效
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePreferences({ muted: !preferences.muted })
                  }
                  className={[
                    'px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer',
                    preferences.muted
                      ? 'bg-stone-700 text-stone-300'
                      : 'bg-[#f3c950] text-[#111]',
                  ].join(' ')}
                >
                  {preferences.muted ? '已静音' : '开启'}
                </button>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                  桌面绒布主题
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'emerald', label: '经典祖母绿', swatch: 'bg-[#155234]' },
                      { id: 'navy', label: '午夜深蓝', swatch: 'bg-[#123359]' },
                      { id: 'burgundy', label: '皇家酒红', swatch: 'bg-[#5c1826]' },
                    ] as { id: FeltTheme; label: string; swatch: string }[]
                  ).map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ feltTheme: theme.id })}
                      className={[
                        'p-2.5 rounded-xl border text-center transition cursor-pointer',
                        preferences.feltTheme === theme.id
                          ? 'border-[#f3c950] bg-[#f3c950]/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10',
                      ].join(' ')}
                    >
                      <div
                        className={`w-full h-7 rounded-md mb-1.5 border border-white/15 ${theme.swatch}`}
                      />
                      <span className="text-xs font-medium">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                  扑克牌背花纹
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'blue', label: '复古蓝纹', swatch: 'bg-[#143868]' },
                      { id: 'crimson', label: '宫廷绯红', swatch: 'bg-[#6b1422]' },
                      { id: 'emerald', label: '翡翠金徽', swatch: 'bg-[#114732]' },
                    ] as { id: CardBackTheme; label: string; swatch: string }[]
                  ).map((back) => (
                    <button
                      key={back.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ cardBack: back.id })}
                      className={[
                        'p-2.5 rounded-xl border text-center transition cursor-pointer',
                        preferences.cardBack === back.id
                          ? 'border-[#f3c950] bg-[#f3c950]/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10',
                      ].join(' ')}
                    >
                      <div
                        className={`w-full h-7 rounded-md mb-1.5 border border-[#e8d294]/50 ${back.swatch}`}
                      />
                      <span className="text-xs font-medium">{back.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">
                  牌面显示风格
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'auto', label: '自动适配', desc: '手机端自动放大' },
                      { id: 'large', label: '大字清晰', desc: '高对比超大字号' },
                      { id: 'classic', label: '经典复古', desc: '传统扑克牌面' },
                    ] as { id: CardFaceStyle; label: string; desc: string }[]
                  ).map((styleItem) => (
                    <button
                      key={styleItem.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ cardStyle: styleItem.id })}
                      className={[
                        'p-2.5 rounded-xl border text-center transition cursor-pointer',
                        preferences.cardStyle === styleItem.id
                          ? 'border-[#f3c950] bg-[#f3c950]/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10',
                      ].join(' ')}
                    >
                      <div className="text-xs font-semibold text-stone-100">
                        {styleItem.label}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-1">
                        {styleItem.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'stats' && (
            <div className="space-y-3">
              {DIFF_LIST.map(({ key, label }) => {
                const s = stats[key];
                const winRate =
                  s.gamesPlayed > 0
                    ? `${Math.round((s.gamesWon / s.gamesPlayed) * 100)}%`
                    : '—';
                return (
                  <div
                    key={key}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#f3c950]">
                        {label}
                      </span>
                      <span className="text-xs text-stone-300">
                        胜率 {winRate} ({s.gamesWon}/{s.gamesPlayed})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="p-2 rounded-lg bg-black/25">
                        <div className="text-[11px] text-stone-400">最高分</div>
                        <div className="text-sm font-bold tabular-nums mt-0.5">
                          {s.bestScore ?? '—'}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/25">
                        <div className="text-[11px] text-stone-400">最少步数</div>
                        <div className="text-sm font-bold tabular-nums mt-0.5">
                          {s.fewestMoves ?? '—'}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-black/25">
                        <div className="text-[11px] text-stone-400">最佳用时</div>
                        <div className="text-sm font-bold tabular-nums mt-0.5">
                          {s.bestTimeSeconds !== null
                            ? formatTime(s.bestTimeSeconds)
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={onResetStats}
                className="w-full py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 text-xs font-medium text-red-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                清空所有难度统计
              </button>
            </div>
          )}

          {tab === 'rules' && (
            <div className="space-y-4 text-sm text-stone-200 leading-relaxed">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <h3 className="font-semibold text-[#f3c950]">核心规则</h3>
                <ul className="list-disc pl-4 space-y-1.5 text-xs text-stone-300">
                  <li>共使用两副牌（104 张），凑齐 8 组同花色 K → A 顺子自动收牌即可获胜。</li>
                  <li>单张或同花色连续递减序列可整体拖动；可放置于任意花色点数大 1 的牌上，或移入空列。</li>
                  <li>单击任意可移动牌叠，将自动按「同花色 &gt; 异花色 &gt; 空列」优先级飞往最佳位置。</li>
                  <li>存在空列时无法从右下角发牌堆发牌，请先补齐空列。</li>
                  <li>初始 500 分，每次移牌或撤销 -1 分，完成一组 K→A +100 分。</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <h3 className="font-semibold text-[#f3c950]">键盘快捷键</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between p-2 rounded bg-black/30">
                    <span className="text-stone-400">撤销一步</span>
                    <kbd className="font-mono text-[#f3c950]">Ctrl / ⌘ + Z</kbd>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-black/30">
                    <span className="text-stone-400">智能提示</span>
                    <kbd className="font-mono text-[#f3c950]">H</kbd>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-black/30">
                    <span className="text-stone-400">发一轮牌</span>
                    <kbd className="font-mono text-[#f3c950]">Space</kbd>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-black/30">
                    <span className="text-stone-400">全屏切换</span>
                    <kbd className="font-mono text-[#f3c950]">F</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

interface DifficultyModalProps {
  open: boolean;
  canResume: boolean;
  currentDifficulty: Difficulty;
  onResume?: () => void;
  onStartNew: (difficulty: Difficulty) => void;
  onClose?: () => void;
}

export const DifficultyModal: React.FC<DifficultyModalProps> = ({
  open,
  canResume,
  currentDifficulty,
  onResume,
  onStartNew,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/72 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-gradient-to-b from-[#112119] to-[#09120d] border border-[#d4af37]/55 shadow-[0_24px_60px_rgba(0,0,0,0.8)] p-5 sm:p-6 space-y-4 sm:space-y-5">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#f3c950]/12 border border-[#f3c950]/35 text-[#f3c950] text-xs font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            经典赌场质感 · 自带 AI 求解器
          </div>
          <h1 className="text-2xl font-bold tracking-wide text-white">
            蜘蛛纸牌
          </h1>
          <p className="text-xs text-stone-400">
            选择花色难度开启新对局
          </p>
        </div>

        <div className="space-y-2.5">
          {DIFF_LIST.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onStartNew(item.key)}
              className={[
                'w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between group cursor-pointer',
                currentDifficulty === item.key
                  ? 'bg-[#f3c950]/12 border-[#f3c950]/70 hover:bg-[#f3c950]/20'
                  : 'bg-white/5 border-white/12 hover:bg-white/10 hover:border-[#d4af37]/50',
              ].join(' ')}
            >
              <div>
                <div className="text-sm font-bold text-stone-100 group-hover:text-[#f3c950] transition">
                  {item.label}
                </div>
                <div className="text-xs text-stone-400 mt-0.5">{item.desc}</div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-black/35 text-[#f3c950] border border-[#d4af37]/30">
                开始
              </span>
            </button>
          ))}
        </div>

        {canResume && onResume ? (
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 text-sm font-medium text-stone-200 transition cursor-pointer"
          >
            继续当前对局
          </button>
        ) : onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 text-sm font-medium text-stone-200 transition cursor-pointer"
          >
            返回结算弹窗
          </button>
        ) : null}
      </div>
    </div>
  );
};

interface VictoryModalProps {
  open: boolean;
  score: number;
  moves: number;
  elapsedSeconds: number;
  difficulty: Difficulty;
  onPlayAgain: (difficulty: Difficulty) => void;
  onChooseDifficulty: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  open,
  score,
  moves,
  elapsedSeconds,
  difficulty,
  onPlayAgain,
  onChooseDifficulty,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-gradient-to-b from-[#172b20] to-[#0a140f] border-2 border-[#f3c950]/80 shadow-[0_0_50px_rgba(243,201,80,0.35)] p-5 sm:p-6 text-center space-y-4 sm:space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#f3c950]/18 border border-[#f3c950] flex items-center justify-center shadow-[0_0_24px_rgba(243,201,80,0.45)]">
          <Award className="w-8 h-8 text-[#f3c950]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#ffe694]">恭喜通关！</h2>
          <p className="text-xs text-stone-300 mt-1">
            8 组同花顺已全部收齐
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
            <div className="text-[11px] text-stone-400">最终得分</div>
            <div className="text-base font-bold text-[#f3c950] tabular-nums mt-0.5">
              {score}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
            <div className="text-[11px] text-stone-400">总步数</div>
            <div className="text-base font-bold text-white tabular-nums mt-0.5">
              {moves}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-black/35 border border-white/10">
            <div className="text-[11px] text-stone-400">用时</div>
            <div className="text-base font-bold text-white tabular-nums mt-0.5">
              {formatTime(elapsedSeconds)}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onChooseDifficulty}
            className="flex-1 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-sm font-medium text-stone-200 transition cursor-pointer"
          >
            切换难度
          </button>
          <button
            type="button"
            onClick={() => onPlayAgain(difficulty)}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-[#f7d86b] to-[#c99b24] hover:brightness-105 text-sm font-bold text-[#151208] shadow-lg transition cursor-pointer"
          >
            再来一局
          </button>
        </div>
      </div>
    </div>
  );
};
