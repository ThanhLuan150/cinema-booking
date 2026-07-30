import { useState } from 'react';
import type { TFunction } from 'i18next';
import { Avatar } from '@/components/ui/Avatar';
import { MAX_RATING } from '@/constants/rating';
import { confirmDialog } from '@/features/notifications/confirm';
import { ReactionBar } from './ReactionBar';
import { StarRatingInput } from './StarRatingInput';
import type { ReactionType, ReviewReactions } from './reactions';

const REPLIES_PAGE_SIZE = 3;

export interface CommentAuthor {
  id: number;
  name: string;
  avatar: string;
}

export interface CommentItemData {
  id: number;
  author: CommentAuthor;
  createdAt: string;
  comment: string;
  rating?: number | null;
  reactions: ReviewReactions;
  reportedByMe?: boolean;
}

export interface CommentItemProps extends CommentItemData {
  replies?: CommentItemData[];
  currentUserId?: number | null;
  onReact: (type: ReactionType) => void;
  onReplyReact?: (replyId: number, type: ReactionType) => void;
  onReply?: (comment: string) => Promise<unknown> | void;
  onEdit?: (payload: { rating?: number; comment: string }) => Promise<unknown> | void;
  onDelete?: () => Promise<unknown> | void;
  onReport?: (reason: string) => Promise<unknown> | void;
  onReplyEdit?: (replyId: number, payload: { comment: string }) => Promise<unknown> | void;
  onReplyDelete?: (replyId: number) => Promise<unknown> | void;
  onReplyReport?: (replyId: number, reason: string) => Promise<unknown> | void;
  t: TFunction;
}

export function CommentItem({
  author,
  createdAt,
  comment,
  rating,
  reactions,
  replies,
  reportedByMe,
  currentUserId,
  onReact,
  onReplyReact,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onReplyEdit,
  onReplyDelete,
  onReplyReport,
  t,
}: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRating, setEditRating] = useState(rating ?? MAX_RATING);
  const [editText, setEditText] = useState(comment);
  const [savingEdit, setSavingEdit] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const [visibleReplies, setVisibleReplies] = useState(REPLIES_PAGE_SIZE);

  const isOwn = currentUserId != null && currentUserId === author.id;

  const handleReplySubmit = async () => {
    if (!onReply || !replyText.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      await onReply(replyText.trim());
      setReplyText('');
      setReplyOpen(false);
    } finally {
      setSubmittingReply(false);
    }
  };

  const openEdit = () => {
    setEditRating(rating ?? MAX_RATING);
    setEditText(comment);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!onEdit || !editText.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await onEdit(rating != null ? { rating: editRating, comment: editText.trim() } : { comment: editText.trim() });
      setEditOpen(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!(await confirmDialog(t('reviews.deleteConfirm')))) return;
    await onDelete();
  };

  const handleReportSubmit = async () => {
    if (!onReport || !reportReason.trim() || submittingReport) return;
    setSubmittingReport(true);
    try {
      await onReport(reportReason.trim());
      setReportReason('');
      setReportOpen(false);
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="flex gap-3">
      <Avatar src={author.avatar} name={author.name} size="sm" className="mt-1" />
      <div className="min-w-0 flex-1">
        {editOpen ? (
          <div className="rounded-2xl bg-white/5 px-4 py-3">
            {rating != null && (
              <div className="mb-2">
                <StarRatingInput value={editRating} onChange={setEditRating} />
              </div>
            )}
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSave();
                }
              }}
              rows={2}
              className="w-full resize-none rounded-md border border-txt/30 bg-white px-3 py-1.5 text-sm text-main"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleEditSave}
                disabled={savingEdit || !editText.trim()}
                className="rounded bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                {t('reviews.editSave')}
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded px-3 py-1.5 text-xs text-txt/70 hover:bg-white/10"
              >
                {t('reviews.editCancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/5 px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-white">{author.name || '—'}</span>
              {rating != null && (
                <span className="shrink-0 text-accent">
                  {'★'.repeat(rating)}
                  {'☆'.repeat(MAX_RATING - rating)}
                </span>
              )}
            </div>
            {comment && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-txt/80">{comment}</p>}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-3 px-2 text-xs text-txt/50">
          <span>{new Date(createdAt).toLocaleDateString()}</span>
          <ReactionBar reactions={reactions} onReact={onReact} t={t} />
          {onReply && (
            <button type="button" onClick={() => setReplyOpen((open) => !open)} className="font-medium hover:underline">
              {t('reviews.reply')}
            </button>
          )}
          {isOwn && onEdit && !editOpen && (
            <button type="button" onClick={openEdit} className="font-medium hover:underline">
              {t('reviews.edit')}
            </button>
          )}
          {isOwn && onDelete && (
            <button type="button" onClick={handleDelete} className="font-medium text-red-400 hover:underline">
              {t('reviews.delete')}
            </button>
          )}
          {!isOwn && onReport && (
            reportedByMe ? (
              <span className="text-txt/30">{t('reviews.alreadyReported')}</span>
            ) : (
              <button type="button" onClick={() => setReportOpen((open) => !open)} className="font-medium hover:underline">
                {t('reviews.report')}
              </button>
            )
          )}
        </div>

        {onReply && replyOpen && (
          <div className="mt-2 flex items-center gap-2 px-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleReplySubmit();
                }
              }}
              placeholder={t('reviews.replyPlaceholder')}
              rows={1}
              className="w-full resize-none rounded-md border border-txt/30 bg-white px-3 py-1.5 text-sm text-main"
            />
            <button
              type="button"
              onClick={handleReplySubmit}
              disabled={submittingReply || !replyText.trim()}
              className="shrink-0 rounded bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-50"
            >
              {t('reviews.replySubmit')}
            </button>
          </div>
        )}

        {reportOpen && (
          <div className="mt-2 flex items-center gap-2 px-2">
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleReportSubmit();
                }
              }}
              placeholder={t('reviews.reportReasonPlaceholder')}
              rows={1}
              className="w-full resize-none rounded-md border border-txt/30 bg-white px-3 py-1.5 text-sm text-main"
            />
            <button
              type="button"
              onClick={handleReportSubmit}
              disabled={submittingReport || !reportReason.trim()}
              className="shrink-0 rounded bg-red-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
            >
              {t('reviews.reportSubmit')}
            </button>
          </div>
        )}

        {replies && replies.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {replies.slice(0, visibleReplies).map((reply) => (
              <CommentItem
                key={reply.id}
                {...reply}
                currentUserId={currentUserId}
                onReact={(type) => onReplyReact?.(reply.id, type)}
                onReply={onReply}
                onEdit={(payload) => onReplyEdit?.(reply.id, { comment: payload.comment })}
                onDelete={() => onReplyDelete?.(reply.id)}
                onReport={(reason) => onReplyReport?.(reply.id, reason)}
                t={t}
              />
            ))}
            {replies.length > visibleReplies && (
              <button
                type="button"
                onClick={() => setVisibleReplies((v) => v + REPLIES_PAGE_SIZE)}
                className="self-start px-2 text-xs font-medium text-txt/60 hover:underline"
              >
                {t('reviews.viewMoreReplies', { count: replies.length - visibleReplies })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
