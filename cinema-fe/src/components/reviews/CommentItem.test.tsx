import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({
  confirmDialog: (...args: unknown[]) => confirmDialogMock(...args),
}));

import { CommentItem } from './CommentItem';
import type { ReviewReactions } from './reactions';

const t = ((key: string) => key) as any;
const noReactions: ReviewReactions = { counts: {}, total: 0, mine: null };

function baseProps() {
  return {
    id: 1,
    author: { id: 10, name: 'Alice', avatar: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
    comment: 'Great movie!',
    rating: 4,
    reactions: noReactions,
    onReact: vi.fn(),
    t,
  };
}

describe('CommentItem', () => {
  beforeEach(() => {
    confirmDialogMock.mockReset();
  });

  it('renders the author, comment and star rating', () => {
    render(<CommentItem {...baseProps()} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Great movie!')).toBeInTheDocument();
    expect(screen.getByText('★★★★☆')).toBeInTheDocument();
  });

  it('shows edit/delete controls only for the comment\'s own author', () => {
    const props = baseProps();
    const { rerender } = render(<CommentItem {...props} currentUserId={999} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('reviews.edit')).not.toBeInTheDocument();

    rerender(<CommentItem {...props} currentUserId={10} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('reviews.edit')).toBeInTheDocument();
    expect(screen.getByText('reviews.delete')).toBeInTheDocument();
  });

  it('calls onDelete only after confirmDialog resolves true', async () => {
    const onDelete = vi.fn();
    confirmDialogMock.mockResolvedValueOnce(false);
    render(<CommentItem {...baseProps()} currentUserId={10} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('reviews.delete'));
    await Promise.resolve();
    expect(onDelete).not.toHaveBeenCalled();

    confirmDialogMock.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByText('reviews.delete'));
    await new Promise((r) => setTimeout(r, 0));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('submits a reply via onReply', async () => {
    const onReply = vi.fn().mockResolvedValue(undefined);
    render(<CommentItem {...baseProps()} onReply={onReply} />);
    fireEvent.click(screen.getByText('reviews.reply'));
    const textarea = screen.getByPlaceholderText('reviews.replyPlaceholder');
    fireEvent.change(textarea, { target: { value: 'Nice reply' } });
    fireEvent.click(screen.getByText('reviews.replySubmit'));
    await waitFor(() => expect(onReply).toHaveBeenCalledWith('Nice reply'));
    await waitFor(() => expect(screen.queryByPlaceholderText('reviews.replyPlaceholder')).not.toBeInTheDocument());
  });

  it('shows report control for others\' comments unless already reported', () => {
    const props = baseProps();
    const { rerender } = render(<CommentItem {...props} currentUserId={999} onReport={vi.fn()} />);
    expect(screen.getByText('reviews.report')).toBeInTheDocument();

    rerender(<CommentItem {...props} currentUserId={999} onReport={vi.fn()} reportedByMe />);
    expect(screen.getByText('reviews.alreadyReported')).toBeInTheDocument();
  });

  it('renders nested replies', () => {
    const props = baseProps();
    render(
      <CommentItem
        {...props}
        replies={[
          {
            id: 2,
            author: { id: 20, name: 'Bob', avatar: '' },
            createdAt: '2026-01-02T00:00:00.000Z',
            comment: 'Totally agree',
            reactions: noReactions,
          },
        ]}
      />,
    );
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Totally agree')).toBeInTheDocument();
  });
});
