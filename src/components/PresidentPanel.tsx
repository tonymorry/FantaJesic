import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  Trophy,
  Inbox,
  PlusCircle,
  Coins,
  Calendar,
  Trash2,
  Check,
  X,
  ImagePlus,
  Loader2,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import { apiFetch, formatDateTime, uploadMediaFile } from '../lib/api';
import {
  ChallengeItem,
  ChallengeProposalItem,
  JESIC_AREAS,
  PostItem,
  Season,
  UserProfile,
} from '../types';
import { Avatar } from './Avatar';

interface PresidentPanelProps {
  onOpenChallenge: (challengeId: string) => void;
  onOpenProfile: (userId: string) => void;
}

type AdminSection = 'challenges' | 'proposals' | 'points' | 'members' | 'seasons';

export const PresidentPanel: React.FC<PresidentPanelProps> = ({
  onOpenChallenge,
  onOpenProfile,
}) => {
  const [section, setSection] = useState<AdminSection>('challenges');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeChallengesCount: 0,
    evaluatingOrVotingCount: 0,
    pendingProposalsCount: 0,
    totalPostsCount: 0,
    seasonPointsAwarded: 0,
    seasonTransactionsCount: 0,
  });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [recentPosts, setRecentPosts] = useState<PostItem[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [proposals, setProposals] = useState<ChallengeProposalItem[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create Challenge Form
  const [chTitle, setChTitle] = useState('');
  const [chDesc, setChDesc] = useState('');
  const [chCoverUrl, setChCoverUrl] = useState('');
  const [chCoverPublicId, setChCoverPublicId] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [chPartMode, setChPartMode] = useState<'open' | 'registration' | 'selected'>('open');
  const [chSelectedParticipants, setChSelectedParticipants] = useState<string[]>([]);
  const [chEvalMode, setChEvalMode] = useState<'vote' | 'president_pick' | 'direct_points'>('vote');
  const [chVoterScope, setChVoterScope] = useState<'all' | 'participants' | 'non_participants'>('all');
  const [chPoints, setChPoints] = useState(100);
  const [chHasTimer, setChHasTimer] = useState(false);
  const [chDeadline, setChDeadline] = useState('');
  const [creatingCh, setCreatingCh] = useState(false);

  // Manual Points Form
  const [ptRecipientId, setPtRecipientId] = useState('');
  const [ptAmount, setPtAmount] = useState(20);
  const [ptReason, setPtReason] = useState('');
  const [ptBadge, setPtBadge] = useState('');
  const [assigningPts, setAssigningPts] = useState(false);

  // New Season Form
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonDesc, setNewSeasonDesc] = useState('');
  const [creatingSeason, setCreatingSeason] = useState(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editArea, setEditArea] = useState('');
  const [editBoardRole, setEditBoardRole] = useState('');
  const [editBadges, setEditBadges] = useState('');
  const [editActive, setEditActive] = useState(true);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [overviewRes, chRes, propRes, seasonsRes] = await Promise.all([
        apiFetch<{
          stats: typeof stats;
          users: UserProfile[];
          recentPosts: PostItem[];
        }>('/admin/overview'),
        apiFetch<{ challenges: ChallengeItem[] }>('/challenges'),
        apiFetch<{ proposals: ChallengeProposalItem[] }>('/proposals'),
        apiFetch<{ seasons: Season[] }>('/seasons'),
      ]);
      setStats(overviewRes.stats);
      setUsers(overviewRes.users);
      setRecentPosts(overviewRes.recentPosts);
      setChallenges(chRes.challenges);
      setProposals(propRes.proposals);
      setSeasons(seasonsRes.seasons);
      if (!ptRecipientId && overviewRes.users.length > 0) {
        setPtRecipientId(overviewRes.users[0]._id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento pannello Presidente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const res = await uploadMediaFile(file, '/upload');
      setChCoverUrl(res.url);
      setChCoverPublicId(res.publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload immagine copertina fallito.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatingCh(true);
    try {
      await apiFetch('/challenges', {
        method: 'POST',
        body: JSON.stringify({
          title: chTitle,
          description: chDesc,
          coverImageUrl: chCoverUrl,
          coverPublicId: chCoverPublicId,
          participationMode: chPartMode,
          participants: chPartMode === 'selected' ? chSelectedParticipants : [],
          evaluationMode: chEvalMode,
          voterScope: chVoterScope,
          pointsReward: chPoints,
          hasTimer: chHasTimer,
          deadline: chHasTimer && chDeadline ? new Date(chDeadline).toISOString() : undefined,
        }),
      });
      setChTitle('');
      setChDesc('');
      setChCoverUrl('');
      setChCoverPublicId('');
      setChSelectedParticipants([]);
      setChHasTimer(false);
      setChDeadline('');
      showToast('Nuova sfida pubblicata e notificata alla community!');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione sfida.');
    } finally {
      setCreatingCh(false);
    }
  };

  const handleReviewProposal = async (
    proposal: ChallengeProposalItem,
    action: 'approve' | 'reject'
  ) => {
    setError(null);
    try {
      await apiFetch(`/proposals/${proposal._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          pointsReward: proposal.suggestedPoints,
        }),
      });
      showToast(
        action === 'approve'
          ? `Proposta "${proposal.title}" approvata e pubblicata!`
          : `Proposta "${proposal.title}" rifiutata.`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore valutazione proposta.');
    }
  };

  const handleAssignPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAssigningPts(true);
    try {
      await apiFetch('/points', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: ptRecipientId,
          amount: Number(ptAmount),
          reason: ptReason,
          badge: ptBadge.trim() || undefined,
        }),
      });
      setPtReason('');
      setPtBadge('');
      showToast('Punti aggiornati e registrati nello storico ufficiale!');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore assegnazione punti.');
    } finally {
      setAssigningPts(false);
    }
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    await apiFetch(`/admin/users/${editingUser._id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        area: editArea,
        boardRole: editBoardRole,
        badges: editBadges
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean),
        isActive: editActive,
      }),
    });
    setEditingUser(null);
    showToast('Scheda associato aggiornata.');
    await loadAll();
  };

  const handleDeletePost = async (postId: string) => {
    await apiFetch(`/admin/posts/${postId}`, { method: 'DELETE' });
    showToast('Contenuto rimosso dalla moderazione.');
    await loadAll();
  };

  const handleConcludeSeason = async (seasonId: string) => {
    await apiFetch(`/seasons/${seasonId}/conclude`, { method: 'POST' });
    showToast('Stagione conclusa e classifica finale storicizzata!');
    await loadAll();
  };

  const handleStartSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatingSeason(true);
    try {
      await apiFetch('/seasons', {
        method: 'POST',
        body: JSON.stringify({
          name: newSeasonName,
          description: newSeasonDesc,
          archiveCurrent: true,
        }),
      });
      setNewSeasonName('');
      setNewSeasonDesc('');
      showToast('Nuova stagione avviata!');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore avvio stagione.');
    } finally {
      setCreatingSeason(false);
    }
  };

  const pendingProposals = proposals.filter((p) => p.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <section className="bg-[#111318] text-white rounded-2xl p-6 sm:p-7">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#E5B85C]">
          <ShieldCheck className="w-4 h-4" />
          <span>Area Amministrativa Riservata</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mt-1">
          Pannello Presidenza FantaJESic
        </h1>
        <p className="text-sm text-white/70 mt-1">
          Gestisci sfide, approva proposte, assegna punti, modera i contenuti e amministra le stagioni.
        </p>

        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          <div>
            <div className="text-xs text-white/60">Associati</div>
            <div className="font-mono text-2xl font-bold tabular-nums mt-0.5">
              {stats.totalMembers}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/60">Sfide Attive</div>
            <div className="font-mono text-2xl font-bold tabular-nums mt-0.5 text-emerald-400">
              {stats.activeChallengesCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/60">Da Valutare / Voto</div>
            <div className="font-mono text-2xl font-bold tabular-nums mt-0.5 text-[#E5B85C]">
              {stats.evaluatingOrVotingCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/60">Proposte in Attesa</div>
            <div className="font-mono text-2xl font-bold tabular-nums mt-0.5 text-[#F87171]">
              {stats.pendingProposalsCount}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="text-xs text-white/60">Punti Stagione</div>
            <div className="font-mono text-2xl font-bold tabular-nums mt-0.5">
              {stats.seasonPointsAwarded}
            </div>
          </div>
        </div>
      </section>

      {toast && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-[#E12D27]/5 border border-[#E12D27]/25 px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {/* Section Navigation */}
      <div className="flex items-center gap-1 p-1 bg-[#ECEEF2] rounded-xl overflow-x-auto">
        {(
          [
            { id: 'challenges', label: 'Sfide', icon: Trophy },
            { id: 'proposals', label: `Proposte (${pendingProposals.length})`, icon: Inbox },
            { id: 'points', label: 'Assegna Punti', icon: Coins },
            { id: 'members', label: 'Associati & Moderazione', icon: Users },
            { id: 'seasons', label: 'Stagioni', icon: Calendar },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`min-h-[42px] px-4 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                section === tab.id
                  ? 'bg-white text-[#111318] shadow-sm'
                  : 'text-[#5A6170] hover:text-[#111318]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-64 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
      ) : (
        <>
          {/* SECTION 1: CREATE & MANAGE CHALLENGES */}
          {section === 'challenges' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleCreateChallenge}
                className="lg:col-span-7 bg-white rounded-2xl border border-[#E6E8EC] p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-[#E12D27]" />
                  <h2 className="font-display text-xl font-bold text-[#111318]">
                    Crea Nuova Sfida
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Titolo sfida *
                  </label>
                  <input
                    type="text"
                    required
                    value={chTitle}
                    onChange={(e) => setChTitle(e.target.value)}
                    placeholder="Es. Miglior disegno a distanza"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Descrizione e criteri *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={chDesc}
                    onChange={(e) => setChDesc(e.target.value)}
                    placeholder="Spiega obiettivi, regole e modalità di consegna..."
                    className="w-full p-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="min-h-[44px] px-4 rounded-xl border border-[#D8DCE3] bg-[#F8F9FA] hover:bg-[#ECEEF2] text-xs font-semibold text-[#111318] flex items-center gap-2 cursor-pointer">
                    {uploadingCover ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#E12D27]" />
                    ) : (
                      <ImagePlus className="w-4 h-4 text-[#E12D27]" />
                    )}
                    {chCoverUrl ? 'Cambia immagine illustrativa' : 'Immagine illustrativa (opzionale)'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      disabled={uploadingCover}
                      className="hidden"
                    />
                  </label>
                  {chCoverUrl && (
                    <span className="text-xs font-semibold text-emerald-700">Immagine caricata</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Partecipazione
                    </label>
                    <select
                      value={chPartMode}
                      onChange={(e) => setChPartMode(e.target.value as typeof chPartMode)}
                      className="w-full h-11 px-3 rounded-xl border border-[#D8DCE3] text-sm bg-white"
                    >
                      <option value="open">Aperta a tutti</option>
                      <option value="registration">Richiede iscrizione</option>
                      <option value="selected">Partecipanti selezionati</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Modalità di valutazione
                    </label>
                    <select
                      value={chEvalMode}
                      onChange={(e) => setChEvalMode(e.target.value as typeof chEvalMode)}
                      className="w-full h-11 px-3 rounded-xl border border-[#D8DCE3] text-sm bg-white"
                    >
                      <option value="vote">Votazione associati</option>
                      <option value="president_pick">Scelta diretta Presidente</option>
                      <option value="direct_points">Assegnazione diretta punti</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Premio in punti *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={chPoints}
                      onChange={(e) => setChPoints(Number(e.target.value))}
                      className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Chi può votare (se votazione)
                    </label>
                    <select
                      value={chVoterScope}
                      onChange={(e) => setChVoterScope(e.target.value as typeof chVoterScope)}
                      className="w-full h-11 px-3 rounded-xl border border-[#D8DCE3] text-sm bg-white"
                    >
                      <option value="all">Tutti gli associati</option>
                      <option value="participants">Solo i partecipanti</option>
                      <option value="non_participants">Solo chi non partecipa</option>
                    </select>
                  </div>
                </div>

                {chPartMode === 'selected' && (
                  <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] space-y-2">
                    <div className="text-xs font-semibold text-[#111318]">
                      Seleziona partecipanti ({chSelectedParticipants.length})
                    </div>
                    <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {users.map((u) => {
                        const checked = chSelectedParticipants.includes(u._id);
                        return (
                          <label
                            key={u._id}
                            className="flex items-center gap-2 text-xs p-2 rounded-lg bg-white border border-[#E6E8EC] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setChSelectedParticipants((prev) =>
                                  checked ? prev.filter((id) => id !== u._id) : [...prev, u._id]
                                )
                              }
                            />
                            <span className="truncate">
                              {u.firstName} {u.lastName}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] space-y-2.5">
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-[#111318] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chHasTimer}
                      onChange={(e) => setChHasTimer(e.target.checked)}
                    />
                    Imposta timer di scadenza automatica
                  </label>
                  {chHasTimer && (
                    <input
                      type="datetime-local"
                      required
                      value={chDeadline}
                      onChange={(e) => setChDeadline(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-sm"
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={creatingCh || uploadingCover}
                  className="w-full h-12 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {creatingCh && <Loader2 className="w-4 h-4 animate-spin" />}
                  Pubblica Sfida
                </button>
              </form>

              {/* Existing Challenges Quick Management */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E6E8EC] p-5 space-y-3">
                <h3 className="font-display text-lg font-bold text-[#111318]">
                  Sfide Pubblicate ({challenges.length})
                </h3>
                <div className="divide-y divide-[#ECEEF2] max-h-[560px] overflow-y-auto">
                  {challenges.map((ch) => (
                    <button
                      key={ch._id}
                      type="button"
                      onClick={() => onOpenChallenge(ch._id)}
                      className="w-full py-3 text-left flex items-center justify-between gap-3 hover:bg-[#F8F9FA] px-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[#111318] truncate">
                          {ch.title}
                        </div>
                        <div className="text-xs text-[#5A6170] mt-0.5">
                          {ch.status} · +{ch.pointsReward} pt · {ch.submissionsCount ?? 0} contributi
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[#E12D27] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: PROPOSALS */}
          {section === 'proposals' && (
            <section className="bg-white rounded-2xl border border-[#E6E8EC] p-6 space-y-4">
              <h2 className="font-display text-xl font-bold text-[#111318]">
                Proposte di Sfida degli Associati
              </h2>
              {proposals.length === 0 ? (
                <p className="text-sm text-[#5A6170]">Nessuna proposta ricevuta finora.</p>
              ) : (
                <div className="divide-y divide-[#ECEEF2]">
                  {proposals.map((p) => (
                    <div
                      key={p._id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-[#5A6170]">
                          <span className="font-semibold text-[#111318]">
                            {p.proposedBy?.firstName} {p.proposedBy?.lastName}
                          </span>
                          <span>·</span>
                          <span>{p.proposedBy?.area}</span>
                          <span>·</span>
                          <span className="font-mono">{p.suggestedPoints} pt suggeriti</span>
                        </div>
                        <h3 className="font-display text-base font-bold text-[#111318] mt-1">
                          {p.title}
                        </h3>
                        <p className="text-sm text-[#333945] mt-1">{p.description}</p>
                      </div>

                      {p.status === 'pending' ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReviewProposal(p, 'approve')}
                            className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" /> Approva e Pubblica
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewProposal(p, 'reject')}
                            className="min-h-[42px] px-4 rounded-xl bg-[#F8F9FA] border border-[#D8DCE3] hover:bg-[#FFF0EF] hover:text-[#B91C1C] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-4 h-4" /> Rifiuta
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`text-xs font-bold shrink-0 ${
                            p.status === 'approved' ? 'text-emerald-700' : 'text-[#B91C1C]'
                          }`}
                        >
                          {p.status === 'approved' ? 'Approvata' : 'Rifiutata'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: MANUAL POINTS ASSIGNMENT */}
          {section === 'points' && (
            <section className="max-w-2xl bg-white rounded-2xl border border-[#E6E8EC] p-6 space-y-4">
              <h2 className="font-display text-xl font-bold text-[#111318]">
                Assegna o Sottrai Punti
              </h2>
              <p className="text-xs text-[#5A6170]">
                Ogni movimento è registrato nello storico pubblico della stagione attiva con nome
                del Presidente, motivazione e data.
              </p>

              <form onSubmit={handleAssignPoints} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Associato destinatario *
                  </label>
                  <select
                    value={ptRecipientId}
                    onChange={(e) => setPtRecipientId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#D8DCE3] text-sm bg-white"
                  >
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.firstName} {u.lastName} ({u.area})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Quantità punti (+ o -) *
                    </label>
                    <input
                      type="number"
                      required
                      value={ptAmount}
                      onChange={(e) => setPtAmount(Number(e.target.value))}
                      className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Badge onorifico (opzionale)
                    </label>
                    <input
                      type="text"
                      value={ptBadge}
                      onChange={(e) => setPtBadge(e.target.value)}
                      placeholder="Es. MVP Mese"
                      className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Motivazione ufficiale *
                  </label>
                  <input
                    type="text"
                    required
                    value={ptReason}
                    onChange={(e) => setPtReason(e.target.value)}
                    placeholder="Es. Contributo straordinario evento JESic"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={assigningPts}
                  className="h-12 px-6 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-white font-semibold text-sm flex items-center gap-2 cursor-pointer"
                >
                  {assigningPts && <Loader2 className="w-4 h-4 animate-spin" />}
                  Registra Operazione Punti
                </button>
              </form>
            </section>
          )}

          {/* SECTION 4: MEMBERS & CONTENT MODERATION */}
          {section === 'members' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white rounded-2xl border border-[#E6E8EC] p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#111318]">
                  Gestione Associati ({users.length})
                </h2>

                <div className="divide-y divide-[#ECEEF2] max-h-[520px] overflow-y-auto">
                  {users.map((u) => (
                    <div
                      key={u._id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={u.avatarUrl}
                          name={`${u.firstName} ${u.lastName}`}
                          size="sm"
                          onClick={() => onOpenProfile(u._id)}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#111318] truncate">
                            {u.firstName} {u.lastName}
                            {u.role === 'president' && (
                              <span className="ml-1.5 text-xs text-[#C89B3C]">(Presidente)</span>
                            )}
                          </div>
                          <div className="text-xs text-[#5A6170] truncate">
                            {u.area} {u.boardRole ? `· ${u.boardRole}` : ''}
                            {!u.isActive ? ' · Sospeso' : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(u);
                          setEditArea(u.area);
                          setEditBoardRole(u.boardRole || '');
                          setEditBadges((u.badges || []).join(', '));
                          setEditActive(u.isActive !== false);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#D8DCE3] text-xs font-semibold text-[#111318] hover:bg-[#F8F9FA] cursor-pointer shrink-0"
                      >
                        Gestisci
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-[#E6E8EC] p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-[#111318]">
                  Moderazione Contenuti Recenti
                </h2>
                <div className="divide-y divide-[#ECEEF2] max-h-[520px] overflow-y-auto">
                  {recentPosts.map((post) => (
                    <div key={post._id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#111318]">
                          {post.authorId?.firstName} {post.authorId?.lastName}
                          <span className="font-normal text-[#5A6170]">
                            {' '}
                            · {formatDateTime(post.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-[#333945] mt-1 line-clamp-2">
                          {post.caption || (post.mediaUrl ? '[Contenuto multimediale]' : '')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post._id)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#5A6170] hover:text-[#E12D27] hover:bg-[#FFF0EF] cursor-pointer shrink-0"
                        title="Elimina post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* SECTION 5: SEASONS MANAGEMENT */}
          {section === 'seasons' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleStartSeason}
                className="lg:col-span-5 bg-white rounded-2xl border border-[#E6E8EC] p-6 space-y-4"
              >
                <h2 className="font-display text-xl font-bold text-[#111318]">
                  Avvia Nuova Stagione
                </h2>
                <p className="text-xs text-[#5A6170]">
                  L’avvio di una nuova stagione archivia automaticamente la stagione attiva
                  salvando la classifica finale e il campione.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Nome Stagione *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                    placeholder="Es. Stagione Primavera 2027"
                    className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Descrizione
                  </label>
                  <textarea
                    rows={2}
                    value={newSeasonDesc}
                    onChange={(e) => setNewSeasonDesc(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingSeason}
                  className="w-full h-12 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-white font-semibold text-sm cursor-pointer"
                >
                  {creatingSeason ? 'Avvio in corso...' : 'Archivia Attuale & Avvia Nuova'}
                </button>
              </form>

              <section className="lg:col-span-7 bg-white rounded-2xl border border-[#E6E8EC] p-6 space-y-4">
                <h2 className="font-display text-xl font-bold text-[#111318]">
                  Stagioni ({seasons.length})
                </h2>
                <div className="divide-y divide-[#ECEEF2]">
                  {seasons.map((s) => (
                    <div
                      key={s._id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-base text-[#111318]">
                            {s.name}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              s.status === 'active' ? 'text-emerald-700' : 'text-[#5A6170]'
                            }`}
                          >
                            {s.status === 'active' ? 'Attiva' : 'Archiviata'}
                          </span>
                        </div>
                        <div className="text-xs text-[#5A6170] mt-0.5">
                          Inizio: {formatDateTime(s.startDate)}
                          {s.endDate ? ` · Fine: ${formatDateTime(s.endDate)}` : ''}
                        </div>
                        {s.championUserId && (
                          <div className="text-xs font-semibold text-[#9A701E] mt-1">
                            Campione: {s.championUserId.firstName} {s.championUserId.lastName}
                          </div>
                        )}
                      </div>

                      {s.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleConcludeSeason(s._id)}
                          className="min-h-[40px] px-4 rounded-xl border border-[#D8DCE3] text-xs font-semibold text-[#111318] hover:bg-[#F8F9FA] cursor-pointer shrink-0"
                        >
                          Concludi Stagione
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#111318]">
              Modifica {editingUser.firstName} {editingUser.lastName}
            </h3>
            <form onSubmit={handleSaveUserEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">Area</label>
                <select
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
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
                  value={editBoardRole}
                  onChange={(e) => setEditBoardRole(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">
                  Badge (separati da virgola)
                </label>
                <input
                  type="text"
                  value={editBadges}
                  onChange={(e) => setEditBadges(e.target.value)}
                  placeholder="Es. Top Contributor, Creative Star"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#111318] pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                Account attivo
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-[#5A6170]"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#E12D27] text-white text-sm font-semibold cursor-pointer"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
