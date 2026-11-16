import React, { useEffect, useState } from 'react';
import {
  ImagePlus,
  Video,
  Send,
  Trophy,
  Loader2,
  X,
  Activity,
  Flame,
  Sparkles,
  Plus,
} from 'lucide-react';
import { apiFetch, formatRelativeDate, uploadMediaFile } from '../lib/api';
import {
  ActivityEventItem,
  AppTab,
  ChallengeItem,
  LeaderboardEntry,
  PostItem,
  UserProfile,
} from '../types';
import { PostCard } from './PostCard';
import { Avatar } from './Avatar';

interface FeedViewProps {
  currentUser: UserProfile;
  composerFocusTrigger: number;
  onOpenProfile: (userId: string) => void;
  onOpenChallenge: (challengeId: string) => void;
  onNavigateTab: (tab: AppTab) => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  currentUser,
  composerFocusTrigger,
  onOpenProfile,
  onOpenChallenge,
  onNavigateTab,
}) => {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'challenges' | 'community'>('all');
  const [loading, setLoading] = useState(true);
  const [activeChallenges, setActiveChallenges] = useState<ChallengeItem[]>([]);
  const [activities, setActivities] = useState<ActivityEventItem[]>([]);
  const [topThree, setTopThree] = useState<LeaderboardEntry[]>([]);

  // Bottom Sheet Composer State
  const [showComposerSheet, setShowComposerSheet] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedChallengeId, setSelectedChallengeId] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaPublicId, setMediaPublicId] = useState('');
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>('none');
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const loadFeedData = async (currentFilter = filter) => {
    setLoading(true);
    try {
      const [postsRes, challengesRes, activityRes, leaderboardRes] = await Promise.all([
        apiFetch<{ posts: PostItem[] }>(`/posts?filter=${currentFilter}`),
        apiFetch<{ challenges: ChallengeItem[] }>('/challenges?status=active'),
        apiFetch<{ events: ActivityEventItem[] }>('/activity'),
        apiFetch<{ standings: LeaderboardEntry[] }>('/leaderboard'),
      ]);
      setPosts(postsRes.posts);
      setActiveChallenges(challengesRes.challenges);
      setActivities(activityRes.events);
      setTopThree(leaderboardRes.standings.slice(0, 3));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedData(filter);
  }, [filter]);

  useEffect(() => {
    if (composerFocusTrigger > 0) {
      setShowComposerSheet(true);
    }
  }, [composerFocusTrigger]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComposerError(null);
    setUploading(true);
    try {
      const res = await uploadMediaFile(file, '/upload');
      setMediaUrl(res.url);
      setMediaPublicId(res.publicId);
      setMediaType(res.resourceType);
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Upload media fallito.');
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim() && !mediaUrl) return;
    setComposerError(null);
    setPublishing(true);
    try {
      const res = await apiFetch<{ post: PostItem }>('/posts', {
        method: 'POST',
        body: JSON.stringify({
          caption,
          mediaUrl,
          mediaPublicId,
          mediaType,
          challengeId: selectedChallengeId || undefined,
        }),
      });
      setPosts((prev) => [res.post, ...prev]);
      setCaption('');
      setMediaUrl('');
      setMediaPublicId('');
      setMediaType('none');
      setSelectedChallengeId('');
      setShowComposerSheet(false);
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Pubblicazione non riuscita.');
    } finally {
      setPublishing(false);
    }
  };

  const eligibleChallenges = activeChallenges.filter((c) => {
    if (c.participationMode === 'open') return true;
    return c.participants?.some((p) => p._id === currentUser._id);
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Compact Tap-to-Post Bar */}
      <button
        type="button"
        onClick={() => setShowComposerSheet(true)}
        className="w-full bg-white rounded-2xl border border-[#E6E8EC] p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform cursor-pointer"
      >
        <Avatar src={currentUser.avatarUrl} name={currentUser.fullName} size="md" />
        <span className="flex-1 text-sm text-[#7D8594] truncate">
          Condividi una foto, video o aggiornamento...
        </span>
        <span className="min-h-[40px] px-3.5 rounded-xl bg-[#E12D27] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0">
          <Plus className="w-4 h-4" />
          Post
        </span>
      </button>

      {/* Horizontal Swipe Carousel: Active Challenges + Top Leader */}
      <div className="flex items-stretch gap-3 overflow-x-auto snap-x no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => onNavigateTab('leaderboard')}
          className="snap-start shrink-0 w-[210px] rounded-2xl bg-[#111318] text-white p-4 text-left flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#E5B85C]">
            <span>Leader Stagione</span>
            <Trophy className="w-4 h-4" />
          </div>
          {topThree[0] ? (
            <div className="mt-3 flex items-center gap-2.5">
              <Avatar src={topThree[0].avatarUrl} name={topThree[0].fullName} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{topThree[0].fullName}</div>
                <div className="font-mono text-xs text-white/70 tabular-nums">
                  {topThree[0].points} pt
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-white/70">Vedi classifica live</div>
          )}
        </button>

        {activeChallenges.map((ch) => (
          <button
            key={ch._id}
            type="button"
            onClick={() => onOpenChallenge(ch._id)}
            className="snap-start shrink-0 w-[230px] rounded-2xl bg-white border border-[#E6E8EC] p-4 text-left flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#E12D27]">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Sfida Attiva
              </span>
              <span className="font-mono tabular-nums">+{ch.pointsReward} pt</span>
            </div>
            <div className="mt-2.5">
              <div className="text-sm font-bold text-[#111318] line-clamp-1">{ch.title}</div>
              <div className="text-xs text-[#5A6170] mt-0.5">
                {ch.submissionsCount ?? 0} contributi
              </div>
            </div>
          </button>
        ))}

        {activeChallenges.length === 0 && (
          <button
            type="button"
            onClick={() => onNavigateTab('challenges')}
            className="snap-start shrink-0 w-[220px] rounded-2xl bg-white border border-[#E6E8EC] p-4 text-left flex flex-col justify-between cursor-pointer"
          >
            <div className="text-xs font-semibold text-[#E12D27]">Arena Sfide</div>
            <div className="mt-2 text-xs text-[#5A6170]">
              Nessuna sfida attiva ora. Proponi una nuova sfida al Presidente!
            </div>
          </button>
        )}
      </div>

      {/* Horizontal Recent Activity Strip */}
      {activities.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E6E8EC] p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#111318] mb-2">
            <Activity className="w-3.5 h-3.5 text-[#E12D27]" />
            <span>Attività recenti</span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto snap-x no-scrollbar">
            {activities.slice(0, 8).map((ev) => (
              <div
                key={ev._id}
                className="snap-start shrink-0 w-[240px] rounded-xl bg-[#F8F9FA] border border-[#ECEEF2] p-2.5 text-xs"
              >
                <p className="text-[#111318] line-clamp-2 leading-snug">{ev.message}</p>
                <span className="text-[10px] text-[#7D8594] mt-1 block">
                  {formatRelativeDate(ev.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Segmented Feed Filter */}
      <div className="grid grid-cols-3 p-1 bg-[#ECEEF2] rounded-xl">
        {(
          [
            { id: 'all', label: 'Tutti' },
            { id: 'challenges', label: 'Sfide' },
            { id: 'community', label: 'Community' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`min-h-[40px] rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === tab.id
                ? 'bg-white text-[#111318] shadow-sm'
                : 'text-[#5A6170]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vertical Social Feed */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-72 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse"
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 text-center">
          <Sparkles className="w-8 h-8 text-[#9AA1B0] mx-auto mb-2.5" />
          <h3 className="font-display text-lg font-bold text-[#111318]">
            Nessun post ancora
          </h3>
          <p className="text-sm text-[#5A6170] mt-1">
            Tocca la barra in alto per condividere il primo momento della community!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              currentUser={currentUser}
              onOpenProfile={onOpenProfile}
              onOpenChallenge={onOpenChallenge}
              onPostUpdated={(updated) =>
                setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)))
              }
              onPostDeleted={(id) => setPosts((prev) => prev.filter((p) => p._id !== id))}
            />
          ))}
        </div>
      )}

      {/* Mobile-First Bottom Sheet Post Composer */}
      {showComposerSheet && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="w-10 h-1.5 bg-[#D8DCE3] rounded-full mx-auto mt-3 sm:hidden" />
            <div className="px-5 py-3.5 border-b border-[#ECEEF2] flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#111318]">Nuovo Post</h2>
              <button
                type="button"
                onClick={() => setShowComposerSheet(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5A6170]"
                aria-label="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublish} className="p-5 space-y-4 overflow-y-auto pb-safe">
              <div className="flex items-start gap-3">
                <Avatar src={currentUser.avatarUrl} name={currentUser.fullName} size="md" />
                <textarea
                  rows={4}
                  autoFocus
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Scrivi qualcosa per gli associati JESic..."
                  className="flex-1 resize-none rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] p-3 text-base focus:outline-none focus:bg-white focus:border-[#E12D27]"
                />
              </div>

              {mediaUrl && (
                <div className="relative rounded-xl overflow-hidden bg-[#111318] border border-[#E6E8EC]">
                  <button
                    type="button"
                    onClick={() => {
                      setMediaUrl('');
                      setMediaPublicId('');
                      setMediaType('none');
                    }}
                    className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-black/75 text-white flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {mediaType === 'video' ? (
                    <video src={mediaUrl} controls playsInline className="w-full max-h-60" />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt="Anteprima"
                      referrerPolicy="no-referrer"
                      className="w-full max-h-60 object-contain"
                    />
                  )}
                </div>
              )}

              {eligibleChallenges.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[#5A6170] mb-1">
                    Collega a una sfida (opzionale)
                  </label>
                  <select
                    value={selectedChallengeId}
                    onChange={(e) => setSelectedChallengeId(e.target.value)}
                    className="w-full h-12 px-3 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] text-base"
                  >
                    <option value="">Post normale nel feed</option>
                    {eligibleChallenges.map((ch) => (
                      <option key={ch._id} value={ch._id}>
                        Sfida: {ch.title} (+{ch.pointsReward} pt)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {composerError && (
                <p className="text-xs font-semibold text-[#B91C1C]">{composerError}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="min-h-[48px] rounded-xl border border-[#E6E8EC] bg-[#F8F9FA] text-sm font-semibold text-[#111318] flex items-center justify-center gap-2 cursor-pointer">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#E12D27]" />
                  ) : (
                    <ImagePlus className="w-4 h-4 text-[#E12D27]" />
                  )}
                  Foto
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>

                <label className="min-h-[48px] rounded-xl border border-[#E6E8EC] bg-[#F8F9FA] text-sm font-semibold text-[#111318] flex items-center justify-center gap-2 cursor-pointer">
                  <Video className="w-4 h-4 text-[#111318]" />
                  Video
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={publishing || uploading || (!caption.trim() && !mediaUrl)}
                className="w-full h-12 rounded-xl bg-[#E12D27] active:scale-[0.99] text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer"
              >
                {publishing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Pubblica nel Feed
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
