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
  ArrowRight,
  Sparkles,
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
  const [seasonName, setSeasonName] = useState('');

  // Composer state
  const [caption, setCaption] = useState('');
  const [selectedChallengeId, setSelectedChallengeId] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaPublicId, setMediaPublicId] = useState('');
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>('none');
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [showComposerExpanded, setShowComposerExpanded] = useState(false);

  const loadFeedData = async (currentFilter = filter) => {
    setLoading(true);
    try {
      const [postsRes, challengesRes, activityRes, leaderboardRes] = await Promise.all([
        apiFetch<{ posts: PostItem[] }>(`/posts?filter=${currentFilter}`),
        apiFetch<{ challenges: ChallengeItem[] }>('/challenges?status=active'),
        apiFetch<{ events: ActivityEventItem[] }>('/activity'),
        apiFetch<{ standings: LeaderboardEntry[]; season: { name: string } }>('/leaderboard'),
      ]);
      setPosts(postsRes.posts);
      setActiveChallenges(challengesRes.challenges);
      setActivities(activityRes.events);
      setTopThree(leaderboardRes.standings.slice(0, 3));
      setSeasonName(leaderboardRes.season?.name || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedData(filter);
  }, [filter]);

  useEffect(() => {
    if (composerFocusTrigger > 0) {
      setShowComposerExpanded(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      setShowComposerExpanded(true);
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
      setShowComposerExpanded(false);
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Pubblicazione non riuscita.');
    } finally {
      setPublishing(false);
    }
  };

  // Challenges current user can submit to directly from composer
  const eligibleChallenges = activeChallenges.filter((c) => {
    if (c.participationMode === 'open') return true;
    return c.participants?.some((p) => p._id === currentUser._id);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Feed Column */}
      <div className="lg:col-span-8 space-y-5">
        {/* Post Composer Card */}
        <section className="bg-white rounded-2xl border border-[#E6E8EC] p-4 sm:p-5">
          <form onSubmit={handlePublish}>
            <div className="flex items-start gap-3">
              <Avatar src={currentUser.avatarUrl} name={currentUser.fullName} size="md" />
              <div className="flex-1 min-w-0">
                <textarea
                  rows={showComposerExpanded ? 3 : 2}
                  value={caption}
                  onFocus={() => setShowComposerExpanded(true)}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Condividi un momento della vita associativa JESic o partecipa a una sfida..."
                  className="w-full resize-none rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] px-3.5 py-2.5 text-sm text-[#111318] placeholder:text-[#7D8594] focus:outline-none focus:bg-white focus:border-[#E12D27]"
                />
              </div>
            </div>

            {mediaUrl && (
              <div className="relative mt-3 rounded-xl overflow-hidden bg-[#111318] border border-[#E6E8EC]">
                <button
                  type="button"
                  onClick={() => {
                    setMediaUrl('');
                    setMediaPublicId('');
                    setMediaType('none');
                  }}
                  className="absolute top-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black cursor-pointer"
                  aria-label="Rimuovi allegato"
                >
                  <X className="w-4 h-4" />
                </button>
                {mediaType === 'video' ? (
                  <video src={mediaUrl} controls className="w-full max-h-72" />
                ) : (
                  <img
                    src={mediaUrl}
                    alt="Anteprima upload"
                    referrerPolicy="no-referrer"
                    className="w-full max-h-72 object-contain"
                  />
                )}
              </div>
            )}

            {composerError && (
              <p className="mt-2.5 text-xs font-medium text-[#B91C1C]">{composerError}</p>
            )}

            {showComposerExpanded && eligibleChallenges.length > 0 && (
              <div className="mt-3">
                <select
                  value={selectedChallengeId}
                  onChange={(e) => setSelectedChallengeId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] text-xs sm:text-sm text-[#111318] focus:outline-none focus:border-[#E12D27]"
                >
                  <option value="">Post normale nel feed community</option>
                  {eligibleChallenges.map((ch) => (
                    <option key={ch._id} value={ch._id}>
                      Collega alla sfida: {ch.title} (+{ch.pointsReward} pt)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-[#F1F3F6] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="min-h-[44px] px-3 rounded-xl border border-[#E6E8EC] bg-[#F8F9FA] hover:bg-[#ECEEF2] text-xs sm:text-sm font-medium text-[#333945] flex items-center gap-2 cursor-pointer transition-colors">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#E12D27]" />
                  ) : (
                    <ImagePlus className="w-4 h-4 text-[#E12D27]" />
                  )}
                  <span>Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>

                <label className="min-h-[44px] px-3 rounded-xl border border-[#E6E8EC] bg-[#F8F9FA] hover:bg-[#ECEEF2] text-xs sm:text-sm font-medium text-[#333945] flex items-center gap-2 cursor-pointer transition-colors">
                  <Video className="w-4 h-4 text-[#111318]" />
                  <span>Video</span>
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
                className="min-h-[44px] px-5 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-white text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-45 cursor-pointer"
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Pubblica</span>
              </button>
            </div>
          </form>
        </section>

        {/* Mobile Quick Strip: Active Challenges & Top 3 link */}
        <div className="lg:hidden grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('challenges')}
            className="p-3.5 rounded-2xl bg-white border border-[#E6E8EC] text-left hover:border-[#E12D27]/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#E12D27]">
              <span>Sfide Attive</span>
              <Flame className="w-4 h-4" />
            </div>
            <div className="font-mono text-xl font-bold text-[#111318] mt-1 tabular-nums">
              {activeChallenges.length}
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('leaderboard')}
            className="p-3.5 rounded-2xl bg-white border border-[#E6E8EC] text-left hover:border-[#C89B3C]/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-[#C89B3C]">
              <span>Leader Stagione</span>
              <Trophy className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-[#111318] mt-1.5 truncate">
              {topThree[0]?.fullName || 'Classifica live'}
            </div>
          </button>
        </div>

        {/* Feed Filter Tabs */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 bg-[#ECEEF2] rounded-xl">
            {(
              [
                { id: 'all', label: 'Tutti i post' },
                { id: 'challenges', label: 'Solo Sfide' },
                { id: 'community', label: 'Community' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white text-[#111318] shadow-sm'
                    : 'text-[#5A6170] hover:text-[#111318]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feed Stream */}
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
          <div className="bg-white rounded-2xl border border-[#E6E8EC] p-10 text-center">
            <Sparkles className="w-8 h-8 text-[#9AA1B0] mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-[#111318]">
              Il feed è pronto per il primo post
            </h3>
            <p className="text-sm text-[#5A6170] mt-1 max-w-sm mx-auto">
              Condividi una foto, un video o un aggiornamento con gli altri associati JESic!
            </p>
          </div>
        ) : (
          <div className="space-y-5">
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
      </div>

      {/* Right Rail: Leaderboard Preview, Active Challenges & Recent Activity */}
      <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
        {/* Top 3 Standings */}
        <section className="bg-white rounded-2xl border border-[#E6E8EC] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#111318]">
                Top 3 · {seasonName || 'Stagione'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('leaderboard')}
              className="text-xs font-semibold text-[#E12D27] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Classifica <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {topThree.length === 0 ? (
            <p className="text-xs text-[#5A6170]">Nessun associato in classifica al momento.</p>
          ) : (
            <div className="space-y-3">
              {topThree.map((entry) => (
                <button
                  key={entry.userId}
                  type="button"
                  onClick={() => onOpenProfile(entry.userId)}
                  className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-[#F8F9FA] transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`font-mono text-sm font-bold w-5 text-center tabular-nums ${
                        entry.rank === 1
                          ? 'text-[#C89B3C]'
                          : entry.rank === 2
                          ? 'text-[#64748B]'
                          : 'text-[#B45309]'
                      }`}
                    >
                      #{entry.rank}
                    </span>
                    <Avatar src={entry.avatarUrl} name={entry.fullName} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#111318] truncate">
                        {entry.fullName}
                      </div>
                      <div className="text-xs text-[#5A6170] truncate">{entry.area}</div>
                    </div>
                  </div>
                  <div className="font-mono text-sm font-bold text-[#111318] tabular-nums shrink-0">
                    {entry.points} pt
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Active Challenges */}
        <section className="bg-white rounded-2xl border border-[#E6E8EC] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-bold text-[#111318]">Sfide in Corso</h2>
            <button
              type="button"
              onClick={() => onNavigateTab('challenges')}
              className="text-xs font-semibold text-[#E12D27] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Vedi tutte <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {activeChallenges.length === 0 ? (
            <p className="text-xs text-[#5A6170]">
              Nessuna sfida attiva ora. Puoi proporne una al Presidente nella sezione Sfide!
            </p>
          ) : (
            <div className="space-y-3">
              {activeChallenges.slice(0, 3).map((ch) => (
                <button
                  key={ch._id}
                  type="button"
                  onClick={() => onOpenChallenge(ch._id)}
                  className="w-full text-left p-3 rounded-xl bg-[#F8F9FA] hover:bg-[#ECEEF2]/75 border border-[#E6E8EC] transition-colors cursor-pointer"
                >
                  <div className="text-sm font-semibold text-[#111318] line-clamp-1">
                    {ch.title}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#5A6170]">
                    <span className="font-mono font-semibold text-[#E12D27] tabular-nums">
                      +{ch.pointsReward} pt
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{ch.submissionsCount ?? 0} contributi</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity Feed */}
        <section className="bg-white rounded-2xl border border-[#E6E8EC] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#E12D27]" />
            <h2 className="font-display text-base font-bold text-[#111318]">Attività Recenti</h2>
          </div>

          {activities.length === 0 ? (
            <p className="text-xs text-[#5A6170]">Nessuna attività recente registrata.</p>
          ) : (
            <div className="space-y-3.5">
              {activities.slice(0, 8).map((ev) => (
                <div key={ev._id} className="text-xs leading-relaxed pb-3 border-b border-[#F1F3F6] last:border-none last:pb-0">
                  <p className="text-[#111318]">{ev.message}</p>
                  <span className="text-[11px] text-[#7D8594] mt-0.5 block">
                    {formatRelativeDate(ev.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
};
