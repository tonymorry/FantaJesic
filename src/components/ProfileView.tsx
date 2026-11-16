import React, { useEffect, useState } from 'react';
import {
  Award,
  Camera,
  Edit3,
  History,
  LogOut,
  Save,
  Loader2,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch, formatDateTime, uploadMediaFile } from '../lib/api';
import { JESIC_AREAS, PointTransactionItem, PostItem, UserProfile } from '../types';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';

interface ProfileViewProps {
  profileUserId: string;
  currentUser: UserProfile;
  onBack?: () => void;
  onProfileUpdated: (updated: UserProfile) => void;
  onOpenProfile: (userId: string) => void;
  onOpenChallenge: (challengeId: string) => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profileUserId,
  currentUser,
  onBack,
  onProfileUpdated,
  onOpenProfile,
  onOpenChallenge,
  onLogout,
}) => {
  const [profile, setProfile] = useState<
    (UserProfile & { points: number; rank: number | null; totalMembers: number }) | null
  >(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [transactions, setTransactions] = useState<PointTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'points'>('posts');

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [area, setArea] = useState('');
  const [boardRole, setBoardRole] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPublicId, setAvatarPublicId] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  const isOwnProfile = profileUserId === currentUser._id;

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        profile: UserProfile & { points: number; rank: number | null; totalMembers: number };
        posts: PostItem[];
        transactions: PointTransactionItem[];
      }>(`/users/${profileUserId}`);
      setProfile(res.profile);
      setPosts(res.posts);
      setTransactions(res.transactions);

      setFirstName(res.profile.firstName);
      setLastName(res.profile.lastName);
      setArea(res.profile.area);
      setBoardRole(res.profile.boardRole || '');
      setBio(res.profile.bio || '');
      setAvatarUrl(res.profile.avatarUrl || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    setEditing(false);
  }, [profileUserId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await uploadMediaFile(file, '/upload/avatar');
      setAvatarUrl(res.url);
      setAvatarPublicId(res.publicId);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch<{ user: UserProfile }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName,
          lastName,
          area,
          boardRole,
          bio,
          avatarUrl,
          avatarPublicId,
        }),
      });
      onProfileUpdated(res.user);
      setEditing(false);
      await loadProfile();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-56 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!isOwnProfile && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5A6170] hover:text-[#111318] min-h-[44px] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Torna indietro
        </button>
      )}

      {/* Profile Header Card */}
      <section className="bg-white rounded-2xl border border-[#E6E8EC] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <Avatar src={profile.avatarUrl} name={profile.fullName} size="xl" />

            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111318]">
                  {profile.fullName}
                </h1>
                {profile.role === 'president' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#9A701E]">
                    <ShieldCheck className="w-4 h-4 text-[#C89B3C]" />
                    Presidente
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm text-[#5A6170]">
                <span className="font-medium text-[#111318]">{profile.area}</span>
                {profile.boardRole && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{profile.boardRole}</span>
                  </>
                )}
              </div>

              {profile.bio && (
                <p className="mt-3 text-sm text-[#333945] max-w-xl leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {profile.badges?.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-[#9A701E]">
                  <Award className="w-4 h-4 text-[#C89B3C]" />
                  <span>{profile.badges.join(' · ')}</span>
                </div>
              )}
            </div>
          </div>

          {isOwnProfile && !editing && (
            <div className="flex items-center justify-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="min-h-[44px] px-4 rounded-xl border border-[#D8DCE3] bg-white hover:bg-[#F8F9FA] text-sm font-semibold text-[#111318] flex items-center gap-2 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Modifica
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="min-h-[44px] px-4 rounded-xl border border-[#E6E8EC] bg-[#F8F9FA] hover:bg-[#FFF0EF] hover:text-[#E12D27] text-sm font-semibold text-[#5A6170] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Esci
              </button>
            </div>
          )}
        </div>

        {/* Stats Strip */}
        <div className="mt-6 pt-6 border-t border-[#ECEEF2] grid grid-cols-3 gap-4 text-center sm:text-left">
          <div>
            <div className="text-xs text-[#5A6170]">Punti Stagione</div>
            <div className="font-mono text-2xl font-bold text-[#E12D27] mt-0.5 tabular-nums">
              {profile.points}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#5A6170]">Posizione Classifica</div>
            <div className="font-mono text-2xl font-bold text-[#111318] mt-0.5 tabular-nums">
              {profile.rank ? `#${profile.rank}` : '—'}
              <span className="text-xs font-normal text-[#5A6170]"> / {profile.totalMembers}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-[#5A6170]">Post Pubblicati</div>
            <div className="font-mono text-2xl font-bold text-[#111318] mt-0.5 tabular-nums">
              {posts.length}
            </div>
          </div>
        </div>

        {/* Inline Edit Form */}
        {editing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-[#ECEEF2] space-y-4">
            <div className="flex items-center gap-4">
              <Avatar src={avatarUrl} name={profile.fullName} size="lg" />
              <label className="min-h-[44px] px-4 rounded-xl border border-[#D8DCE3] bg-[#F8F9FA] hover:bg-[#ECEEF2] text-sm font-semibold text-[#111318] flex items-center gap-2 cursor-pointer">
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#E12D27]" />
                ) : (
                  <Camera className="w-4 h-4 text-[#E12D27]" />
                )}
                Cambia foto profilo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">Cognome</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">Area JESic</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-[#D8DCE3] text-sm bg-white"
                >
                  {JESIC_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">
                  Incarico / Board
                </label>
                <input
                  type="text"
                  value={boardRole}
                  onChange={(e) => setBoardRole(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#333945] mb-1">Bio</label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Racconta qualcosa di te agli associati..."
                className="w-full p-3.5 rounded-xl border border-[#D8DCE3] text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="min-h-[44px] px-4 rounded-xl text-sm font-semibold text-[#5A6170] hover:bg-[#F8F9FA]"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={saving || uploadingAvatar}
                className="min-h-[44px] px-5 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salva Profilo
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Profile Content Tabs */}
      <div className="inline-flex items-center p-1 bg-[#ECEEF2] rounded-xl">
        <button
          type="button"
          onClick={() => setActiveSubTab('posts')}
          className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeSubTab === 'posts'
              ? 'bg-white text-[#111318] shadow-sm'
              : 'text-[#5A6170] hover:text-[#111318]'
          }`}
        >
          Contenuti ({posts.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('points')}
          className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeSubTab === 'points'
              ? 'bg-white text-[#111318] shadow-sm'
              : 'text-[#5A6170] hover:text-[#111318]'
          }`}
        >
          Storico Punti ({transactions.length})
        </button>
      </div>

      {activeSubTab === 'posts' ? (
        posts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 text-center text-sm text-[#5A6170]">
            Nessun contenuto pubblicato finora.
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
                onPostUpdated={(u) =>
                  setPosts((prev) => prev.map((p) => (p._id === u._id ? u : p)))
                }
                onPostDeleted={(id) => setPosts((prev) => prev.filter((p) => p._id !== id))}
              />
            ))}
          </div>
        )
      ) : (
        <section className="bg-white rounded-2xl border border-[#E6E8EC] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#ECEEF2] flex items-center gap-2">
            <History className="w-4 h-4 text-[#E12D27]" />
            <h2 className="font-display text-lg font-bold text-[#111318]">
              Storico Punti Personale
            </h2>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#5A6170]">
              Nessun movimento punti registrato.
            </div>
          ) : (
            <div className="divide-y divide-[#ECEEF2]">
              {transactions.map((tx) => (
                <div
                  key={tx._id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#111318]">{tx.reason}</div>
                    <div className="text-xs text-[#5A6170] mt-0.5">
                      {tx.seasonId?.name || 'Stagione'} · {formatDateTime(tx.createdAt)}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
                      tx.amount >= 0 ? 'text-emerald-700' : 'text-[#B91C1C]'
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount} pt
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
