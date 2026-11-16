import React, { useState } from 'react';
import { Heart, MessageCircle, Trash2, Send, Trophy, ArrowUpRight, Loader2 } from 'lucide-react';
import { apiFetch, formatRelativeDate } from '../lib/api';
import { PostItem, UserProfile } from '../types';
import { Avatar } from './Avatar';

interface PostCardProps {
  post: PostItem;
  currentUser: UserProfile;
  onOpenProfile: (userId: string) => void;
  onOpenChallenge?: (challengeId: string) => void;
  onPostUpdated: (updated: PostItem) => void;
  onPostDeleted: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onOpenProfile,
  onOpenChallenge,
  onPostUpdated,
  onPostDeleted,
}) => {
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const authorName = `${post.authorId?.firstName || ''} ${post.authorId?.lastName || ''}`.trim();
  const isLiked = post.likes?.includes(currentUser._id);
  const canDelete =
    post.authorId?._id === currentUser._id || currentUser.role === 'president';

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const res = await apiFetch<{ likes: string[] }>(`/posts/${post._id}/like`, {
        method: 'POST',
      });
      onPostUpdated({ ...post, likes: res.likes });
    } finally {
      setLiking(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await apiFetch<{ comments: PostItem['comments'] }>(
        `/posts/${post._id}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ text: commentText.trim() }),
        }
      );
      setCommentText('');
      setShowComments(true);
      onPostUpdated({ ...post, comments: res.comments });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await apiFetch(`/posts/${post._id}`, { method: 'DELETE' });
      onPostDeleted(post._id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="bg-white rounded-2xl border border-[#E6E8EC] overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            src={post.authorId?.avatarUrl}
            name={authorName}
            size="md"
            onClick={() => onOpenProfile(post.authorId._id)}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onOpenProfile(post.authorId._id)}
                className="font-semibold text-sm text-[#111318] hover:text-[#E12D27] transition-colors truncate cursor-pointer"
              >
                {authorName}
              </button>
              {post.authorId?.role === 'president' && (
                <span className="text-[11px] font-semibold text-[#C89B3C]">Presidente</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#5A6170] truncate">
              <span className="truncate">{post.authorId?.area}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{formatRelativeDate(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#9AA1B0] hover:text-[#E12D27] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
            title="Elimina contenuto"
            aria-label="Elimina contenuto"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Challenge Context Link (if linked to a challenge) */}
      {post.challengeId && (
        <div className="px-4 sm:px-5 pb-3">
          <button
            type="button"
            onClick={() => onOpenChallenge?.(post.challengeId!._id)}
            className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#FFF6F5] border border-[#F5D6D4] flex items-center justify-between gap-2 hover:bg-[#FFEDEB] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="w-4 h-4 text-[#E12D27] shrink-0" />
              <span className="text-xs font-semibold text-[#111318] truncate">
                Contributo per la sfida: {post.challengeId.title}
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#E12D27] shrink-0" />
          </button>
        </div>
      )}

      {/* Media Content */}
      {post.mediaUrl && post.mediaType === 'image' && (
        <div className="bg-[#111318] max-h-[540px] overflow-hidden flex items-center justify-center">
          <img
            src={post.mediaUrl}
            alt={post.caption || `Foto di ${authorName}`}
            referrerPolicy="no-referrer"
            className="w-full max-h-[540px] object-contain"
          />
        </div>
      )}

      {post.mediaUrl && post.mediaType === 'video' && (
        <div className="bg-[#111318] max-h-[540px] overflow-hidden">
          <video
            src={post.mediaUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[540px]"
          />
        </div>
      )}

      {/* Caption & Actions */}
      <div className="px-4 sm:px-5 py-3.5">
        {post.caption && (
          <p className="text-[15px] text-[#111318] leading-relaxed whitespace-pre-line mb-3">
            {post.caption}
          </p>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-[#F1F3F6]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleLike}
              disabled={liking}
              className={`min-h-[44px] px-3 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${
                isLiked
                  ? 'text-[#E12D27] bg-[#FFF0EF]'
                  : 'text-[#5A6170] hover:text-[#111318] hover:bg-[#F8F9FA]'
              }`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-[#E12D27]' : ''}`} />
              <span className="font-mono tabular-nums text-xs">{post.likes?.length || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowComments((s) => !s)}
              className="min-h-[44px] px-3 rounded-xl flex items-center gap-2 text-sm font-medium text-[#5A6170] hover:text-[#111318] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="font-mono tabular-nums text-xs">
                {post.comments?.length || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Comments Drawer */}
        {(showComments || (post.comments?.length || 0) > 0) && (
          <div className="mt-3 pt-3 border-t border-[#F1F3F6] space-y-2.5">
            {(showComments ? post.comments : post.comments.slice(-2)).map((c) => {
              const cName = `${c.authorId?.firstName || ''} ${c.authorId?.lastName || ''}`.trim();
              return (
                <div key={c._id} className="flex items-start gap-2.5 text-sm">
                  <Avatar
                    src={c.authorId?.avatarUrl}
                    name={cName}
                    size="xs"
                    onClick={() => c.authorId?._id && onOpenProfile(c.authorId._id)}
                  />
                  <div className="flex-1 min-w-0 bg-[#F8F9FA] rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => c.authorId?._id && onOpenProfile(c.authorId._id)}
                        className="font-semibold text-xs text-[#111318] hover:text-[#E12D27] cursor-pointer"
                      >
                        {cName}
                      </button>
                      <span className="text-[11px] text-[#5A6170]">
                        {formatRelativeDate(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#333945] mt-0.5 break-words">{c.text}</p>
                  </div>
                </div>
              );
            })}

            {!showComments && post.comments.length > 2 && (
              <button
                type="button"
                onClick={() => setShowComments(true)}
                className="text-xs font-semibold text-[#5A6170] hover:text-[#111318] py-1 cursor-pointer"
              >
                Mostra tutti i {post.comments.length} commenti
              </button>
            )}

            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Scrivi un commento..."
                className="flex-1 h-10 px-3.5 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] text-sm focus:outline-none focus:border-[#E12D27] focus:bg-white"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submittingComment}
                className="min-h-[40px] min-w-[40px] px-3 rounded-xl bg-[#111318] text-white flex items-center justify-center hover:bg-[#E12D27] transition-colors disabled:opacity-40 cursor-pointer"
                aria-label="Invia commento"
              >
                {submittingComment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
};
