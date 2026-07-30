import { useState } from 'react';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/cn';
import { REACTION_TYPES, REACTION_EMOJI, type ReactionType, type ReviewReactions } from './reactions';

export interface ReactionBarProps {
  reactions: ReviewReactions;
  onReact: (type: ReactionType) => void;
  t: TFunction;
}

const reactionLabelKey: Record<ReactionType, string> = {
  like: 'reviews.reactionLike',
  love: 'reviews.reactionLove',
  haha: 'reviews.reactionHaha',
  wow: 'reviews.reactionWow',
  sad: 'reviews.reactionSad',
  angry: 'reviews.reactionAngry',
};

export function ReactionBar({ reactions, onReact, t }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeCounts = REACTION_TYPES.filter((type) => (reactions.counts[type] ?? 0) > 0);

  const handlePick = (type: ReactionType) => {
    setPickerOpen(false);
    onReact(type);
  };

  return (
    <div className="relative flex items-center gap-3 text-xs">
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          className={cn(
            'rounded px-2 py-1 font-medium transition-colors hover:bg-white/10',
            reactions.mine ? 'text-accent' : 'text-txt/60',
          )}
        >
          {reactions.mine ? (
            <>
              {REACTION_EMOJI[reactions.mine]} {t(reactionLabelKey[reactions.mine])}
            </>
          ) : (
            t('reviews.reactionLike')
          )}
        </button>

        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
            <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-full bg-main/95 p-1.5 shadow-lg ring-1 ring-white/10">
              {REACTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  title={t(reactionLabelKey[type])}
                  onClick={() => handlePick(type)}
                  className="rounded-full p-1 text-lg transition-transform hover:scale-125"
                >
                  {REACTION_EMOJI[type]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {reactions.total > 0 && (
        <span className="flex items-center gap-1 text-txt/50">
          {activeCounts.map((type) => (
            <span key={type}>
              {REACTION_EMOJI[type]} {reactions.counts[type]}
            </span>
          ))}
          <span>· {reactions.total}</span>
        </span>
      )}
    </div>
  );
}
