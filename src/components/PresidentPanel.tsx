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

  // Edit User Bottom Sheet
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
      showToast('Nuova sfida pubblicata!');
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
          ? `Proposta "${proposal.title}" approvata!`
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
      showToast('Punti registrati nello storico ufficiale!');
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
    showToast('Contenuto rimosso.');
    await loadAll();
  };

  const handleConcludeSeason = async (seasonId: string) => {
    await apiFetch(`/seasons/${seasonId}/conclude`, { method: 'POST' });
    showToast('Stagione archiviata!');
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
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Compact Admin Overview */}
      <section className="bg-[#111318] text-white rounded-2xl p-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E5B85C]">
          <ShieldCheck className="w-4 h-4" />
          <span>Area Presidenza</span>
        </div>
        <h1 className="font-display text-2xl font-bold mt-1">Pannello Controllo</h1>

        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-[11px] text-white/60">Associati</div>
            <div className="font-mono text-lg font-bold tabular-nums mt-0.5">
              {stats.totalMembers}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-white/60">Attive</div>
            <div className="font-mono text-lg font-bold tabular-nums mt-0.5 text-emerald-400">
              {stats.activeChallengesCount}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-white/60">Proposte</div>
            <div className="font-mono text-lg font-bold tabular-nums mt-0.5 text-[#F87171]">
              {stats.pendingProposalsCount}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-white/60">Punti</div>
            <div className="font-mono text-lg font-bold tabular-nums mt-0.5 text-[#E5B85C]">
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

      {/* Horizontal Scrollable Section Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#ECEEF2] rounded-xl overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'challenges', label: 'Sfide', icon: Trophy },
            { id: 'proposals', label: `Proposte (${pendingProposals.length})`, icon: Inbox },
            { id: 'points', label: 'Punti', icon: Coins },
            { id: 'members', label: 'Associati', icon: Users },
            { id: 'seasons', label: 'Stagioni', icon: Calendar },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`min-h-[42px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                section === tab.id
                  ? 'bg-white text-[#111318] shadow-sm'
                  : 'text-[#5A6170]'
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
          {/* SECTION 1: CHALLENGES */}
          {section === 'challenges' && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateChallenge}
                className="bg-white rounded-2xl border border-[#E6E8EC] p-5 space-y-3.5"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-[#E12D27]" />
                  <h2 className="font-display text-lg font-bold text-[#111318]">
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
                    className="w-full h-12 px-3.5 rounded-xl border border-[#D8DCE3] text-base"
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
                    placeholder="Obiettivi, regole e consegna..."
                    className="w-full p-3.5 rounded-xl border border-[#D8DCE3] text-base"
                  />
                </div>

                <label className="min-h-[46px] px-4 rounded-xl border border-[#D8DCE3] bg-[#F8F9FA] text-sm font-semibold text-[#111318] flex items-center justify-center gap-2 cursor-pointer">
                  {uploadingCover ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#E12D27]" />
                  ) : (
                    <ImagePlus className="w-4 h-4 text-[#E12D27]" />
                  )}
                  {chCoverUrl ? 'Copertina caricata' : 'Copertina (opzionale)'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    disabled={uploadingCover}
                    className="hidden"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Partecipazione
                    </label>
                    <select
                      value={chPartMode}
                      onChange={(e) => setChPartMode(e.target.value as typeof chPartMode)}
                      className="w-full h-12 px-3 rounded-xl border border-[#D8DCE3] text-base bg-white"
                    >
                      <option value="open">Aperta</option>
                      <option value="registration">Iscrizione</option>
                      <option value="selected">Selezionati</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Valutazione
                    </label>
                    <select
                      value={chEvalMode}
                      onChange={(e) => setChEvalMode(e.target.value as typeof chEvalMode)}
                      className="w-full h-12 px-3 rounded-xl border border-[#D8DCE3] text-base bg-white"
                    >
                      <option value="vote">Votazione</option>
                      <option value="president_pick">Scelta Presidente</option>
                      <option value="direct_points">Punti diretti</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Premio punti *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={chPoints}
                      onChange={(e) => setChPoints(Number(e.target.value))}
                      className="w-full h-12 px-3.5 rounded-xl border border-[#D8DCE3] text-base font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Chi vota
                    </label>
                    <select
                      value={chVoterScope}
                      onChange={(e) => setChVoterScope(e.target.value as typeof chVoterScope)}
                      className="w-full h-12 px-3 rounded-xl border border-[#D8DCE3] text-base bg-white"
                    >
                      <option value="all">Tutti</option>
                      <option value="participants">Partecipanti</option>
                      <option value="non_participants">Esterni</option>
                    </select>
                  </div>
                </div>

                {chPartMode === 'selected' && (
                  <div className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] space-y-2">
                    <div className="text-xs font-semibold text-[#111318]">
                      Seleziona partecipanti ({chSelectedParticipants.length})
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {users.map((u) => {
                        const checked = chSelectedParticipants.includes(u._id);
                        return (
                          <label
                            key={u._id}
                            className="flex items-center gap-3 min-h-[42px] text-sm px-3 rounded-lg bg-white border border-[#E6E8EC] cursor-pointer"
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
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-[#111318] min-h-[36px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chHasTimer}
                      onChange={(e) => setChHasTimer(e.target.checked)}
                    />
                    Imposta timer scadenza
                  </label>
                  {chHasTimer && (
                    <input
                      type="datetime-local"
                      required
                      value={chDeadline}
                      onChange={(e) => setChDeadline(e.target.value)}
                      className="w-full h-12 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-base"
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={creatingCh || uploadingCover}
                  className="w-full h-12 rounded-xl bg-[#E12D27] text-white font-semibold text-base flex items-center justify-center gap-2 cursor-pointer"
                >
                  {creatingCh && <Loader2 className="w-4 h-4 animate-spin" />}
                  Pubblica Sfida
                </button>
              </form>

              <div className="bg-white rounded-2xl border border-[#E6E8EC] p-4 space-y-2">
                <h3 className="font-display text-base font-bold text-[#111318]">
                  Sfide Pubblicate ({challenges.length})
                </h3>
                <div className="divide-y divide-[#ECEEF2]">
                  {challenges.map((ch) => (
                    <button
                      key={ch._id}
                      type="button"
                      onClick={() => onOpenChallenge(ch._id)}
                      className="w-full min-h-[54px] py-2.5 text-left flex items-center justify-between gap-3 cursor-pointer"
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
            <section className="bg-white rounded-2xl border border-[#E6E8EC] p-4 space-y-3">
              <h2 className="font-display text-lg font-bold text-[#111318]">
                Proposte Ricevute
              </h2>
              {proposals.length === 0 ? (
                <p className="text-sm text-[#5A6170]">Nessuna proposta ricevuta finora.</p>
              ) : (
                <div className="divide-y divide-[#ECEEF2]">
                  {proposals.map((p) => (
                    <div key={p._id} className="py-4 space-y-3">
                      <div>
                        <div className="text-xs text-[#5A6170]">
                          <span className="font-semibold text-[#111318]">
                            {p.proposedBy?.firstName} {p.proposedBy?.lastName}
                          </span>
                          {' · '}
                          <span className="font-mono">{p.suggestedPoints} pt</span>
                        </div>
                        <h3 className="font-display text-base font-bold text-[#111318] mt-1">
                          {p.title}
                        </h3>
                        <p className="text-sm text-[#333945] mt-1">{p.description}</p>
                      </div>

                      {p.status === 'pending' ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleReviewProposal(p, 'approve')}
                            className="min-h-[44px] rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" /> Approva
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewProposal(p, 'reject')}
                            className="min-h-[44px] rounded-xl bg-[#F8F9FA] border border-[#D8DCE3] text-[#B91C1C] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-4 h-4" /> Rifiuta
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`text-xs font-bold ${
                            p.status === 'approved' ? 'text-emerald-700' : 'text-[#B91C1C]'
                          }`}
                        >
                          {p.status === 'approved' ? 'Approvata' : 'Rifiutata'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 3: MANUAL POINTS */}
          {section === 'points' && (
            <section className="bg-white rounded-2xl border border-[#E6E8EC] p-5 space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[#111318]">
                  Assegna o Sottrai Punti
                </h2>
                <p className="text-xs text-[#5A6170] mt-0.5">
                  Registra un’operazione nello storico ufficiale della stagione attiva.
                </p>
              </div>

              <form onSubmit={handleAssignPoints} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Associato *
                  </label>
                  <select
                    value={ptRecipientId}
                    onChange={(e) => setPtRecipientId(e.target.value)}
                    className="w-full h-12 px-3 rounded-xl border border-[#D8DCE3] text-base bg-white"
                  >
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.firstName} {u.lastName} ({u.area})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Punti (+ o -) *
                    </label>
                    <input
                      type="number"
                      required
                      value={ptAmount}
                      onChange={(e) => setPtAmount(Number(e.target.value))}
                      className="w-full h-12 px-3.5 rounded-xl border border-[#D8DCE3] text-base font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1">
                      Badge (opzionale)
                    </label>
                    <input
                      type="text"
                      value={ptBadge}
                      onChange={(e) => setPtBadge(e.target.value)}
                      placeholder="Es. MVP Mese"
                      className="w-full h-12 px-3.5 rounded-xl border border-[#D8DCE3] text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Motivazione *
                  </label>
                  <input
                    type="text"
                    required
                    value={ptReason}
                    onChange={(e) => setPtReason(e.target.value)}
                    placeholder="Es. Contributo evento JESic"
                    className="w-full h-12 px-3.5 rounded-xl border border-[#D8DCE3] text-base"
                  />
                </div>

                <button
                  type="submit"
                  disabled={assigningPts}
                  className="w-full h-12 rounded-xl bg-[#E12D27] text-white font-semibold text-base flex items-center justify-center gap-2 cursor-pointer"
                >
                  {assigningPts && <Loader2 className="w-4 h-4 animate-spin" />}
                  Registra Operazione
                </button>
              </form>
            </section>
          )}

          {/* SECTION 4: MEMBERS & MODERATION */}
          {section === 'members' && (
            <div className="space-y-5">
              <section className="bg-white rounded-2xl border border-[#E6E8EC] p-4 space-y-3">
                <h2 className="font-display text-base font-bold text-[#111318]">
                  Associati ({users.length})
                </h2>

                <div className="divide-y divide-[#ECEEF2]">
                  {users.map((u) => (
                    <div
                      key={u._id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenProfile(u._id)}
                        className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                      >
                        <Avatar
                          src={u.avatarUrl}
                          name={`${u.firstName} ${u.lastName}`}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#111318] truncate">
                            {u.firstName} {u.lastName}
                            {u.role === 'president' && (
                              <span className="ml-1 text-xs text-[#C89B3C]">(Pres.)</span>
                            )}
                          </div>
                          <div className="text-xs text-[#5A6170] truncate">
                            {u.area}
                            {!u.isActive ? ' · Sospeso' : ''}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(u);
                          setEditArea(u.area);
                          setEditBoardRole(u.boardRole || '');
                          setEditBadges((u.badges || []).join(', '));
                          setEditActive(u.isActive !== false);
                        }}
                        className="min-h-[40px] px-3.5 rounded-xl border border-[#D8DCE3] text-xs font-semibold text-[#111318] cursor-pointer shrink-0"
                      >
                        Gestisci
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-[#E6E8EC] p-4 space-y-3">
                <h2 className="font-display text-base font-bold text-[#111318]">
                  Moderazione Post Recenti
                </h2>
                <div className="divide-y divide-[#ECEEF2]">
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
                          {post.caption || (post.mediaUrl ? '[Media]' : '')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post._id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5A6170] active:text-[#E12D27] cursor-pointer shrink-0"
                        aria-label="Elimina post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* SECTION 5: SEASONS */}
          {section === 'seasons' && (
            <div className="space-y-5">
              <form
                onSubmit={handleStartSeason}
                className="bg-white rounded-2xl border border-[#E6E8EC] p-5 space-y-3.5"
              >
                <h2 className="font-display text-lg font-bold text-[#111318]">
                  Avvia Nuova Stagione
                </h2>
                <p className="text-xs text-[#5A6170]">
                  Archivia la stagione attiva salvando classifica e campione, poi avvia la nuova.
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
                    className="w-full h-12 px-3.5 rounded-xl border border-[#D8DCE3] text-base"
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
                    className="w-full p-3.5 rounded-xl border border-[#D8DCE3] text-base"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingSeason}
                  className="w-full h-12 rounded-xl bg-[#E12D27] text-white font-semibold text-base cursor-pointer"
                >
                  {creatingSeason ? 'Avvio in corso...' : 'Archivia & Avvia Nuova Stagione'}
                </button>
              </form>

              <section className="bg-white rounded-2xl border border-[#E6E8EC] p-4 space-y-3">
                <h2 className="font-display text-base font-bold text-[#111318]">
                  Stagioni ({seasons.length})
                </h2>
                <div className="divide-y divide-[#ECEEF2]">
                  {seasons.map((s) => (
                    <div key={s._id} className="py-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
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
                      <div className="text-xs text-[#5A6170]">
                        Inizio: {formatDateTime(s.startDate)}
                        {s.endDate ? ` · Fine: ${formatDateTime(s.endDate)}` : ''}
                      </div>
                      {s.championUserId && (
                        <div className="text-xs font-semibold text-[#9A701E]">
                          Campione: {s.championUserId.firstName} {s.championUserId.lastName}
                        </div>
                      )}

                      {s.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => handleConcludeSeason(s._id)}
                          className="w-full min-h-[42px] rounded-xl border border-[#D8DCE3] text-xs font-semibold text-[#111318] cursor-pointer"
                        >
                          Concludi Stagione Attuale
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

      {/* Edit User Bottom Sheet */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 space-y-4 pb-safe">
            <div className="w-10 h-1.5 bg-[#D8DCE3] rounded-full mx-auto sm:hidden" />
            <h3 className="font-display text-lg font-bold text-[#111318]">
              Modifica {editingUser.firstName} {editingUser.lastName}
            </h3>
            <form onSubmit={handleSaveUserEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">Area</label>
                <select
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl border border-[#D8DCE3] text-base bg-white"
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
                  className="w-full h-12 px-3.5 rounded-xl border border-[#D8DCE3] text-base"
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
                  className="w-full h-12 px-3.5 rounded-xl border border-[#D8DCE3] text-base"
                />
              </div>
              <label className="flex items-center gap-2.5 min-h-[44px] text-sm text-[#111318] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
                Account attivo
              </label>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="min-h-[46px] rounded-xl border border-[#E6E8EC] text-sm font-semibold text-[#5A6170]"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="min-h-[46px] rounded-xl bg-[#E12D27] text-white text-sm font-semibold cursor-pointer"
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
