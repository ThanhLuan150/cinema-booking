import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactionBar } from './ReactionBar';
import type { ReviewReactions } from './reactions';

const t = ((key: string) => key) as any;

describe('ReactionBar', () => {
  it('shows the generic "like" label when the caller has not reacted', () => {
    const reactions: ReviewReactions = { counts: {}, total: 0, mine: null };
    render(<ReactionBar reactions={reactions} onReact={() => {}} t={t} />);
    expect(screen.getByText('reviews.reactionLike')).toBeInTheDocument();
  });

  it('shows the emoji and label for the caller\'s own reaction', () => {
    const reactions: ReviewReactions = { counts: { love: 1 }, total: 1, mine: 'love' };
    render(<ReactionBar reactions={reactions} onReact={() => {}} t={t} />);
    expect(screen.getByRole('button')).toHaveTextContent('❤️ reviews.reactionLove');
  });

  it('renders reaction counts and the total when there are reactions', () => {
    const reactions: ReviewReactions = { counts: { like: 2, love: 1 }, total: 3, mine: null };
    render(<ReactionBar reactions={reactions} onReact={() => {}} t={t} />);
    expect(screen.getByText(/· 3/)).toBeInTheDocument();
  });

  it('opens the reaction picker and calls onReact when a reaction is picked', () => {
    const onReact = vi.fn();
    const reactions: ReviewReactions = { counts: {}, total: 0, mine: null };
    render(<ReactionBar reactions={reactions} onReact={onReact} t={t} />);
    fireEvent.click(screen.getByText('reviews.reactionLike'));
    fireEvent.click(screen.getByTitle('reviews.reactionHaha'));
    expect(onReact).toHaveBeenCalledWith('haha');
  });
});
