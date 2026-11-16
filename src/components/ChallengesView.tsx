import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Clock,
  Users,
  Vote,
  Plus,
  ArrowLeft,
  ImagePlus,
  Video,
  Send,
  Loader2,
  CheckCircle2,
  Lock,
  Sparkles,
  Award,
  X,
} from 'lucide-react';
import { apiFetch, formatDateTime, uploadMediaFile } from '../lib/api';
import {
  ChallengeItem,
  ChallengeProposalItem,
  PostItem,
  UserProfile,
  VoteTally,
} from '../types';
import { Avatar } from './Avatar';
import { PostCard } from './PostCard';

interface ChallengesViewProps {
  currentUser: UserProfile;
  selectedChallengeId: string | null;
  onSelectChallenge: (id: string | null) => void;
  onOpenProfile: (userId: string) => void;
  onGoToPresidentCreate?: () => void;
}

function useCountdown(targetDate?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetDate) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!targetDate) return null;
  const diff = new Date(targetDate).getTime() - now;
  if (diff <= 0) return { expired: true, text: 'Tempo scaduto' };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    expired: false,
    text: `${days > 0 ? `${days}g ` : ''}${pad(hours)}:${pad(mins)}:${pad(secs)}`,
  };
}

const PARTICIPATION_LABELS: Record<string, string> = {
  open: 'Aperta a tutti',
  registration: 'Con iscrizione',
  selected: 'Partecipanti selezionati',
};

const EVALUATION_LABELS: Record<string, string> = {
  vote: 'Votazione associati',
  president_pick: 'Scelta del Presidente',
  direct_points: 'Assegnazione diretta punti',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'In corso',
  evaluating: 'In valutazione',
  voting: 'Votazione aperta',
  completed: 'Conclusa',
};

export const ChallengesView: React.FC<ChallengesViewProps> = ({
  currentUser,
  selectedChallengeId,
  onSelectChallenge,
  onOpenProfile,
  onGoToPresidentCreate,
}) => {
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [proposals, setProposals] = useState<ChallengeProposalItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'voting' | 'completed'>('all');
  const [loading, setLoading] = useState(true);

  // Proposal Modal
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [propTitle, setPropTitle] = useState('');
  const [propDesc, setPropDesc] = useState('');
  const [propPoints, setPropPoints] = useState(50);
  const [propPartMode, setPropPartMode] = useState<'open' | 'registration' | 'selected'>('open');
  const [propEvalMode, setPropEvalMode] = useState<'vote' | 'president_pick' | 'direct_points'>('vote');
  const [submittingProp, setSubmittingProp] = useState(false);
  const [propMessage, setPropMessage] = useState<string | null>(null);

  // Challenge Detail State
  const [detail, setDetail] = useState<{
    challenge: ChallengeItem;
    submissions: PostItem[];
    voteTallies: VoteTally[];
    totalVotes: number;
    myVote: { targetUserId: string; targetPostId?: string } | null;
    canVote: boolean;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Challenge Submission Composer
  const [subCaption, setSubCaption] = useState('');
  const [subMediaUrl, setSubMediaUrl] = useState('');
  const [subMediaPublicId, setSubMediaPublicId] = useState('');
  const [subMediaType, setSubMediaType] = useState<'none' | 'image' | 'video'>('none');
  const [uploadingSub, setUploadingSub] = useState(false);
  const [postingSub, setPostingSub] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // President Inline Controls in Detail
  const [votingScope, setVotingScope] = useState<'all' | 'participants' | 'non_participants'>('all');
  const [votingHours, setVotingHours] = useState(24);
  const [selectedAwardUsers, setSelectedAwardUsers] = useState<Record<string, number>>({});
  const [awardBadge, setAwardBadge] = useState('');
  const [allMembers, setAllMembers] = useState<Array<{ userId: string; fullName: string; area: string }>>([]);

  const countdown = useCountdown(
    detail?.challenge.hasTimer && detail?.challenge.status === 'active'
      ? detail.challenge.deadline
      : undefined
  );

  const loadList = async () => {
    setLoading(true);
    try {
      const [chRes, propRes] = await Promise.all([
        apiFetch<{ challenges: ChallengeItem[] }>('/challenges'),
        apiFetch<{ proposals: ChallengeProposalItem[] }>('/proposals'),
      ]);
      setChallenges(chRes.challenges);
      setProposals(propRes.proposals);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await apiFetch<NonNullable<typeof detail>>(`/challenges/${id}`);
      setDetail(res);
      setVotingScope(res.challenge.voterScope || 'all');

      if (currentUser.role === 'president') {
        const usersRes = await apiFetch<{ users: Array<{ userId: string; fullName: string; area: string }> }>('/users');
        setAllMembers(usersRes.users);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Errore caricamento sfida.');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!selectedChallengeId) {
      loadList();
    } else {
      loadDetail(selectedChallengeId);
    }
  }, [selectedChallengeId]);

  useEffect(() => {
    if (countdown?.expired && selectedChallengeId && detail?.challenge.status === 'active') {
      loadDetail(selectedChallengeId);
    }
  }, [countdown?.expired]);

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingProp(true);
    try {
      await apiFetch('/proposals', {
        method: 'POST',
        body: JSON.stringify({
          title: propTitle,
          description: propDesc,
          suggestedPoints: propPoints,
          suggestedParticipationMode: propPartMode,
          suggestedEvaluationMode: propEvalMode,
        }),
      });
      setPropTitle('');
      setPropDesc('');
      setShowProposalModal(false);
      setPropMessage('Proposta inviata al Presidente! Potrai seguirne lo stato qui sotto.');
      loadList();
    } finally {
      setSubmittingProp(false);
    }
  };

  const handleJoinChallenge = async () => {
    if (!detail) return;
    setDetailError(null);
    try {
      await apiFetch(`/challenges/${detail.challenge._id}/join`, { method: 'POST' });
      await loadDetail(detail.challenge._id);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Iscrizione non riuscita.');
    }
  };

  const handleSubFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDetailError(null);
    setUploadingSub(true);
    try {
      const res = await uploadMediaFile(file, '/upload');
      setSubMediaUrl(res.url);
      setSubMediaPublicId(res.publicId);
      setSubMediaType(res.resourceType);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Caricamento file fallito.');
    } finally {
      setUploadingSub(false);
    }
  };

  const handleCreateSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || (!subCaption.trim() && !subMediaUrl)) return;
    setDetailError(null);
    setPostingSub(true);
    try {
      await apiFetch('/posts', {
        method: 'POST',
        body: JSON.stringify({
          caption: subCaption,
          mediaUrl: subMediaUrl,
          mediaPublicId: subMediaPublicId,
          mediaType: subMediaType,
          challengeId: detail.challenge._id,
        }),
      });
      setSubCaption('');
      setSubMediaUrl('');
      setSubMediaPublicId('');
      setSubMediaType('none');
      await loadDetail(detail.challenge._id);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Invio contributo non riuscito.');
    } finally {
      setPostingSub(false);
    }
  };

  const handleVote = async (targetUserId: string, targetPostId?: string) => {
    if (!detail) return;
    setDetailError(null);
    try {
      await apiFetch(`/challenges/${detail.challenge._id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId, targetPostId }),
      });
      await loadDetail(detail.challenge._id);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Errore durante il voto.');
    }
  };

  const handleCloseChallenge = async () => {
    if (!detail) return;
    await apiFetch(`/challenges/${detail.challenge._id}/close`, { method: 'POST' });
    await loadDetail(detail.challenge._id);
  };

  const handleStartVoting = async () => {
    if (!detail) return;
    const votingDeadline =
      votingHours > 0 ? new Date(Date.now() + votingHours * 3600 * 1000).toISOString() : undefined;
    await apiFetch(`/challenges/${detail.challenge._id}/start-voting`, {
      method: 'POST',
      body: JSON.stringify({ voterScope: votingScope, votingDeadline }),
    });
    await loadDetail(detail.challenge._id);
  };

  const handleConfirmWinners = async () => {
    if (!detail) return;
    const awards = Object.entries(selectedAwardUsers)
      .filter(([, pts]) => Number(pts) !== 0)
      .map(([userId, points]) => ({
        userId,
        points: Number(points),
        reason: `Premio sfida "${detail.challenge.title}"`,
        badge: awardBadge.trim() || undefined,
      }));
    if (awards.length === 0) {
      setDetailError('Seleziona almeno un vincitore/destinatario e i punti da assegnare.');
      return;
    }
    await apiFetch(`/challenges/${detail.challenge._id}/confirm-winner`, {
      method: 'POST',
      body: JSON.stringify({
        awards,
        winnerIds: awards.map((a) => a.userId),
      }),
    });
    setSelectedAwardUsers({});
    setAwardBadge('');
    await loadDetail(detail.challenge._id);
  };

  // ---------------------------------------------------------------------------
  // CHALLENGE DETAIL PAGE
  // ---------------------------------------------------------------------------
  if (selectedChallengeId) {
    if (loadingDetail || !detail) {
      return (
        <div className="max-w-4xl mx-auto space-y-4">
          <button
            type="button"
            onClick={() => onSelectChallenge(null)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#5A6170] hover:text-[#111318] min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" /> Torna alle sfide
          </button>
          <div className="h-64 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
        </div>
      );
    }

    const ch = detail.challenge;
    const isParticipant = ch.participants?.some((p) => p._id === currentUser._id);
    const canSubmit =
      ch.status === 'active' &&
      (ch.participationMode === 'open' || isParticipant);
    const needsJoin = ch.status === 'active' && ch.participationMode === 'registration' && !isParticipant;
    const lockedOut = ch.status === 'active' && ch.participationMode === 'selected' && !isParticipant;

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => onSelectChallenge(null)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5A6170] hover:text-[#111318] min-h-[44px] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Tutte le sfide
        </button>

        {/* Challenge Hero Header */}
        <section className="bg-white rounded-2xl border border-[#E6E8EC] overflow-hidden">
          {ch.coverImageUrl && (
            <div className="h-52 sm:h-64 bg-[#111318] overflow-hidden">
              <img
                src={ch.coverImageUrl}
                alt={ch.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#5A6170]">
                <span
                  className={
                    ch.status === 'active'
                      ? 'text-emerald-700'
                      : ch.status === 'voting'
                      ? 'text-[#E12D27]'
                      : 'text-[#5A6170]'
                  }
                >
                  {STATUS_LABELS[ch.status]}
                </span>
                <span aria-hidden="true">·</span>
                <span>{PARTICIPATION_LABELS[ch.participationMode]}</span>
                <span aria-hidden="true">·</span>
                <span>{EVALUATION_LABELS[ch.evaluationMode]}</span>
              </div>

              <div className="font-mono text-base font-bold text-[#E12D27] tabular-nums">
                +{ch.pointsReward} pt in palio
              </div>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111318] mt-2 [text-wrap:balance]">
              {ch.title}
            </h1>

            <p className="mt-3 text-[15px] text-[#333945] leading-relaxed whitespace-pre-line">
              {ch.description}
            </p>

            {/* Key Metrics Row */}
            <div className="mt-6 pt-5 border-t border-[#ECEEF2] grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-[#5A6170]">Partecipanti</div>
                <div className="font-mono font-bold text-[#111318] mt-0.5 tabular-nums">
                  {ch.participants?.length || 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#5A6170]">Contributi inviati</div>
                <div className="font-mono font-bold text-[#111318] mt-0.5 tabular-nums">
                  {detail.submissions.length}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#5A6170]">Scadenza</div>
                <div className="font-mono font-bold text-[#111318] mt-0.5 tabular-nums">
                  {ch.hasTimer && countdown ? countdown.text : 'Chiusura manuale'}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#5A6170]">Stagione</div>
                <div className="font-semibold text-[#111318] mt-0.5 truncate">
                  {typeof ch.seasonId === 'object' ? ch.seasonId.name : 'Attiva'}
                </div>
              </div>
            </div>

            {/* Join Action for Registration Challenges */}
            {needsJoin && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleJoinChallenge}
                  className="min-h-[48px] px-6 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  Iscriviti alla sfida
                </button>
              </div>
            )}

            {lockedOut && (
              <div className="mt-6 p-4 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] flex items-center gap-2.5 text-sm text-[#5A6170]">
                <Lock className="w-4 h-4 shrink-0" />
                <span>I partecipanti di questa sfida sono stati selezionati dal Presidente.</span>
              </div>
            )}

            {/* Winners Banner if Completed */}
            {ch.status === 'completed' && ch.winnerIds?.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-[#FFFDF5] border border-[#EAD9AA]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#9A701E] mb-2">
                  <Trophy className="w-4 h-4 text-[#C89B3C]" />
                  <span>Vincitori Proclamati</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {ch.winnerIds.map((w) => (
                    <button
                      key={w._id}
                      type="button"
                      onClick={() => onOpenProfile(w._id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#EAD9AA] hover:border-[#C89B3C] cursor-pointer"
                    >
                      <Avatar src={w.avatarUrl} name={`${w.firstName} ${w.lastName}`} size="xs" />
                      <span className="text-sm font-semibold text-[#111318]">
                        {w.firstName} {w.lastName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {detailError && (
          <div className="rounded-xl bg-[#E12D27]/5 border border-[#E12D27]/25 px-4 py-3 text-sm text-[#B91C1C]">
            {detailError}
          </div>
        )}

        {/* President Challenge Management Box */}
        {currentUser.role === 'president' && ch.status !== 'completed' && (
          <section className="bg-[#111318] text-white rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Gestione Presidente</h2>
                <p className="text-xs text-white/70 mt-0.5">
                  Controlla stato della sfida, votazioni e assegnazione ufficiale punti.
                </p>
              </div>
              {ch.status === 'active' && (
                <button
                  type="button"
                  onClick={handleCloseChallenge}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Chiudi Partecipazioni
                </button>
              )}
            </div>

            {(ch.status === 'active' || ch.status === 'evaluating') && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <h3 className="text-sm font-semibold">Apri Votazione Community</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={votingScope}
                    onChange={(e) => setVotingScope(e.target.value as typeof votingScope)}
                    className="h-11 px-3 rounded-xl bg-[#1C2029] border border-white/15 text-sm text-white"
                  >
                    <option value="all">Tutti gli associati</option>
                    <option value="participants">Solo i partecipanti</option>
                    <option value="non_participants">Solo i non partecipanti</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={votingHours}
                    onChange={(e) => setVotingHours(Number(e.target.value))}
                    placeholder="Durata ore (0 = illimitata)"
                    className="h-11 px-3 rounded-xl bg-[#1C2029] border border-white/15 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={handleStartVoting}
                    className="h-11 px-4 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-sm font-semibold cursor-pointer"
                  >
                    Avvia Votazione
                  </button>
                </div>
              </div>
            )}

            {/* Proclaim Winner / Award Points */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <h3 className="text-sm font-semibold">
                Concludi Sfida e Assegna Punti
              </h3>
              <p className="text-xs text-white/65">
                Seleziona uno o più associati (es. vincitori o partecipanti) e imposta i punti da assegnare.
              </p>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {(ch.participants?.length ? ch.participants : []).map((p) => {
                  const pid = p._id;
                  const pts = selectedAwardUsers[pid] ?? 0;
                  return (
                    <div
                      key={pid}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#1C2029]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={p.avatarUrl} name={`${p.firstName} ${p.lastName}`} size="xs" />
                        <span className="text-sm truncate">
                          {p.firstName} {p.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAwardUsers((prev) => ({
                              ...prev,
                              [pid]: prev[pid] ? 0 : ch.pointsReward,
                            }))
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            pts > 0 ? 'bg-[#C89B3C] text-black' : 'bg-white/10 text-white'
                          }`}
                        >
                          {pts > 0 ? 'Selezionato' : `+${ch.pointsReward} pt`}
                        </button>
                        <input
                          type="number"
                          value={pts}
                          onChange={(e) =>
                            setSelectedAwardUsers((prev) => ({
                              ...prev,
                              [pid]: Number(e.target.value),
                            }))
                          }
                          className="w-20 h-9 px-2 rounded-lg bg-[#111318] border border-white/15 font-mono text-xs text-white text-right tabular-nums"
                        />
                      </div>
                    </div>
                  );
                })}

                {ch.participants?.length === 0 &&
                  allMembers.map((m) => {
                    const pts = selectedAwardUsers[m.userId] ?? 0;
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#1C2029]"
                      >
                        <span className="text-sm truncate">{m.fullName}</span>
                        <input
                          type="number"
                          value={pts}
                          onChange={(e) =>
                            setSelectedAwardUsers((prev) => ({
                              ...prev,
                              [m.userId]: Number(e.target.value),
                            }))
                          }
                          placeholder="Punti"
                          className="w-24 h-9 px-2 rounded-lg bg-[#111318] border border-white/15 font-mono text-xs text-white text-right tabular-nums"
                        />
                      </div>
                    );
                  })}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <input
                  type="text"
                  value={awardBadge}
                  onChange={(e) => setAwardBadge(e.target.value)}
                  placeholder="Badge premio opzionale (es. Artista JESic)"
                  className="flex-1 h-11 px-3 rounded-xl bg-[#1C2029] border border-white/15 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={handleConfirmWinners}
                  className="h-11 px-5 rounded-xl bg-[#C89B3C] hover:bg-[#B88B2E] text-black font-bold text-sm cursor-pointer shrink-0"
                >
                  Conferma Vincitori &amp; Punti
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Voting Box (When status === 'voting' or tallies exist) */}
        {(ch.status === 'voting' || detail.totalVotes > 0) && (
          <section className="bg-white rounded-2xl border border-[#E6E8EC] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Vote className="w-5 h-5 text-[#E12D27]" />
                <h2 className="font-display text-lg font-bold text-[#111318]">
                  Votazione ({detail.totalVotes} voti espressi)
                </h2>
              </div>
              {detail.myVote && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> Hai già votato
                </span>
              )}
            </div>

            {detail.voteTallies.length > 0 && (
              <div className="space-y-2.5">
                {detail.voteTallies.map((t) => {
                  const pct = detail.totalVotes
                    ? Math.round((t.count / detail.totalVotes) * 100)
                    : 0;
                  return (
                    <div key={t.targetUserId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#111318]">{t.fullName}</span>
                        <span className="font-mono text-xs font-semibold text-[#5A6170] tabular-nums">
                          {t.count} voti ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#ECEEF2] overflow-hidden">
                        <div
                          className="h-full bg-[#E12D27] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Direct Submission Composer inside Challenge Page */}
        {canSubmit && (
          <section className="bg-white rounded-2xl border border-[#E6E8EC] p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold text-[#111318] mb-1">
              Partecipa a questa sfida
            </h2>
            <p className="text-xs text-[#5A6170] mb-4">
              Il tuo contributo sarà visibile sia qui che nel feed principale della community.
            </p>
            <form onSubmit={handleCreateSubmission} className="space-y-3">
              <textarea
                rows={3}
                value={subCaption}
                onChange={(e) => setSubCaption(e.target.value)}
                placeholder="Descrivi la tua opera o partecipazione..."
                className="w-full p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] text-sm focus:outline-none focus:bg-white focus:border-[#E12D27]"
              />

              {subMediaUrl && (
                <div className="relative rounded-xl overflow-hidden bg-[#111318] border border-[#E6E8EC]">
                  <button
                    type="button"
                    onClick={() => {
                      setSubMediaUrl('');
                      setSubMediaPublicId('');
                      setSubMediaType('none');
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/75 text-white flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {subMediaType === 'video' ? (
                    <video src={subMediaUrl} controls className="w-full max-h-64" />
                  ) : (
                    <img
                      src={subMediaUrl}
                      alt="Anteprima sfida"
                      referrerPolicy="no-referrer"
                      className="w-full max-h-64 object-contain"
                    />
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="min-h-[44px] px-3.5 rounded-xl border border-[#E6E8EC] bg-[#F8F9FA] hover:bg-[#ECEEF2] text-xs font-semibold text-[#111318] flex items-center gap-2 cursor-pointer">
                    {uploadingSub ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#E12D27]" />
                    ) : (
                      <ImagePlus className="w-4 h-4 text-[#E12D27]" />
                    )}
                    Allega Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSubFileUpload}
                      disabled={uploadingSub}
                      className="hidden"
                    />
                  </label>
                  <label className="min-h-[44px] px-3.5 rounded-xl border border-[#E6E8EC] bg-[#F8F9FA] hover:bg-[#ECEEF2] text-xs font-semibold text-[#111318] flex items-center gap-2 cursor-pointer">
                    <Video className="w-4 h-4 text-[#111318]" />
                    Allega Video
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleSubFileUpload}
                      disabled={uploadingSub}
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={postingSub || uploadingSub || (!subCaption.trim() && !subMediaUrl)}
                  className="min-h-[44px] px-5 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-45 cursor-pointer"
                >
                  {postingSub ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Invia Contributo
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Submissions Feed & Vote Buttons */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-[#111318]">
            Contributi ({detail.submissions.length})
          </h2>

          {detail.submissions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E6E8EC] p-8 text-center text-sm text-[#5A6170]">
              Nessun contributo caricato finora per questa sfida.
            </div>
          ) : (
            <div className="space-y-5">
              {detail.submissions.map((post) => (
                <div key={post._id} className="space-y-2">
                  <PostCard
                    post={post}
                    currentUser={currentUser}
                    onOpenProfile={onOpenProfile}
                    onPostUpdated={(u) =>
                      setDetail((prev) =>
                        prev
                          ? {
                              ...prev,
                              submissions: prev.submissions.map((p) => (p._id === u._id ? u : p)),
                            }
                          : prev
                      )
                    }
                    onPostDeleted={(pid) =>
                      setDetail((prev) =>
                        prev
                          ? { ...prev, submissions: prev.submissions.filter((p) => p._id !== pid) }
                          : prev
                      )
                    }
                  />

                  {detail.canVote && (
                    <button
                      type="button"
                      onClick={() => handleVote(post.authorId._id, post._id)}
                      className="w-full min-h-[46px] rounded-xl bg-[#111318] hover:bg-[#E12D27] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Award className="w-4 h-4" />
                      Vota {post.authorId.firstName} {post.authorId.lastName}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CHALLENGES HUB & PROPOSALS
  // ---------------------------------------------------------------------------
  const filteredChallenges =
    statusFilter === 'all'
      ? challenges
      : challenges.filter((c) => c.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-[#E6E8EC] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111318]">
            Arena delle Sfide
          </h1>
          <p className="text-sm text-[#5A6170] mt-1">
            Competi con gli altri associati, invia le tue creazioni e conquista punti per la stagione.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowProposalModal(true)}
            className="min-h-[44px] px-4 rounded-xl border border-[#D8DCE3] bg-white hover:bg-[#F8F9FA] text-sm font-semibold text-[#111318] flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#E12D27]" />
            Proponi una Sfida
          </button>

          {currentUser.role === 'president' && onGoToPresidentCreate && (
            <button
              type="button"
              onClick={onGoToPresidentCreate}
              className="min-h-[44px] px-4 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crea Sfida
            </button>
          )}
        </div>
      </div>

      {propMessage && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between gap-3">
          <span>{propMessage}</span>
          <button type="button" onClick={() => setPropMessage(null)} className="text-emerald-700 font-bold">
            OK
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="inline-flex items-center p-1 bg-[#ECEEF2] rounded-xl overflow-x-auto max-w-full">
        {(
          [
            { id: 'all', label: 'Tutte' },
            { id: 'active', label: 'Attive' },
            { id: 'voting', label: 'In Votazione' },
            { id: 'completed', label: 'Concluse' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === tab.id
                ? 'bg-white text-[#111318] shadow-sm'
                : 'text-[#5A6170] hover:text-[#111318]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Challenges Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
          ))}
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6E8EC] p-10 text-center">
          <Trophy className="w-8 h-8 text-[#9AA1B0] mx-auto mb-3" />
          <h3 className="font-display text-lg font-bold text-[#111318]">Nessuna sfida presente</h3>
          <p className="text-sm text-[#5A6170] mt-1">
            Proponi una nuova sfida al Presidente usando il pulsante in alto!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredChallenges.map((ch) => (
            <button
              key={ch._id}
              type="button"
              onClick={() => onSelectChallenge(ch._id)}
              className="group text-left bg-white rounded-2xl border border-[#E6E8EC] hover:border-[#111318]/30 overflow-hidden flex flex-col transition-all cursor-pointer"
            >
              {ch.coverImageUrl ? (
                <div className="h-40 w-full bg-[#111318] overflow-hidden">
                  <img
                    src={ch.coverImageUrl}
                    alt={ch.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="h-24 w-full bg-gradient-to-br from-[#161922] to-[#2B1518] p-5 flex items-end justify-between">
                  <Trophy className="w-6 h-6 text-[#E5B85C]" />
                  <span className="font-mono text-sm font-bold text-white tabular-nums">
                    +{ch.pointsReward} pt
                  </span>
                </div>
              )}

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span
                      className={
                        ch.status === 'active'
                          ? 'text-emerald-700'
                          : ch.status === 'voting'
                          ? 'text-[#E12D27]'
                          : 'text-[#5A6170]'
                      }
                    >
                      {STATUS_LABELS[ch.status]}
                    </span>
                    {ch.coverImageUrl && (
                      <span className="font-mono text-[#E12D27] tabular-nums">
                        +{ch.pointsReward} pt
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#111318] mt-1.5 line-clamp-2">
                    {ch.title}
                  </h3>
                  <p className="text-sm text-[#5A6170] mt-1.5 line-clamp-2">{ch.description}</p>
                </div>

                <div className="pt-3 border-t border-[#F1F3F6] flex items-center justify-between text-xs text-[#5A6170]">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-mono tabular-nums">{ch.participants?.length || 0}</span>
                  </span>
                  {ch.hasTimer && ch.deadline ? (
                    <span className="flex items-center gap-1 text-[#111318] font-medium">
                      <Clock className="w-3.5 h-3.5 text-[#E12D27]" />
                      {formatDateTime(ch.deadline)}
                    </span>
                  ) : (
                    <span>{PARTICIPATION_LABELS[ch.participationMode]}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* User Proposals Status Section */}
      {proposals.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E6E8EC] p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-[#111318] mb-3">
            {currentUser.role === 'president' ? 'Ultime Proposte Ricevute' : 'Le tue Proposte'}
          </h2>
          <div className="divide-y divide-[#ECEEF2]">
            {proposals.slice(0, 6).map((p) => (
              <div key={p._id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-[#111318]">{p.title}</div>
                  <p className="text-xs text-[#5A6170] mt-0.5 line-clamp-1">{p.description}</p>
                  {p.presidentNote && (
                    <p className="text-xs text-[#333945] mt-1">Nota Presidente: {p.presidentNote}</p>
                  )}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    p.status === 'approved'
                      ? 'text-emerald-700'
                      : p.status === 'rejected'
                      ? 'text-[#B91C1C]'
                      : 'text-amber-700'
                  }`}
                >
                  {p.status === 'approved'
                    ? 'Approvata'
                    : p.status === 'rejected'
                    ? 'Rifiutata'
                    : 'In attesa'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Proposal Modal */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-[#111318]">
                Proponi una nuova sfida
              </h2>
              <button
                type="button"
                onClick={() => setShowProposalModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#5A6170] hover:bg-[#F8F9FA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#5A6170]">
              La proposta sarà inviata al Presidente per l’approvazione e la configurazione finale.
            </p>

            <form onSubmit={handleSubmitProposal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">
                  Titolo sfida *
                </label>
                <input
                  type="text"
                  required
                  value={propTitle}
                  onChange={(e) => setPropTitle(e.target.value)}
                  placeholder="Es. Miglior disegno a distanza"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm focus:outline-none focus:border-[#E12D27]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">
                  Descrizione e regole *
                </label>
                <textarea
                  required
                  rows={3}
                  value={propDesc}
                  onChange={(e) => setPropDesc(e.target.value)}
                  placeholder="Spiega come funziona la sfida..."
                  className="w-full p-3.5 rounded-xl border border-[#D8DCE3] text-sm focus:outline-none focus:border-[#E12D27]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Punti suggeriti (indicativi)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={propPoints}
                    onChange={(e) => setPropPoints(Number(e.target.value))}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1">
                    Partecipazione
                  </label>
                  <select
                    value={propPartMode}
                    onChange={(e) => setPropPartMode(e.target.value as typeof propPartMode)}
                    className="w-full h-11 px-3 rounded-xl border border-[#D8DCE3] text-sm bg-white"
                  >
                    <option value="open">Aperta a tutti</option>
                    <option value="registration">Con iscrizione</option>
                    <option value="selected">Selezionati dal Presidente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#333945] mb-1">
                  Valutazione suggerita
                </label>
                <select
                  value={propEvalMode}
                  onChange={(e) => setPropEvalMode(e.target.value as typeof propEvalMode)}
                  className="w-full h-11 px-3 rounded-xl border border-[#D8DCE3] text-sm bg-white"
                >
                  <option value="vote">Votazione community</option>
                  <option value="president_pick">Scelta del Presidente</option>
                  <option value="direct_points">Assegnazione diretta punti</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submittingProp}
                className="w-full h-12 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {submittingProp && <Loader2 className="w-4 h-4 animate-spin" />}
                Invia Proposta al Presidente
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
