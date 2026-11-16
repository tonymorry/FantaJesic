import React, { useEffect, useState } from 'react';
import { Trophy, Medal, History, Calendar } from 'lucide-react';
import { apiFetch, formatDateTime } from '../lib/api';
import { LeaderboardEntry, PointTransactionItem, Season } from '../types';
import { Avatar } from './Avatar';

interface LeaderboardViewProps {
  onOpenProfile: (userId: string) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ onOpenProfile }) => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [standings, setStandings] = useState<LeaderboardEntry[]>([]);
  const [history, setHistory] = useState<PointTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (seasonId?: string) => {
    setLoading(true);
    try {
      const qs = seasonId ? `?seasonId=${seasonId}` : '';
      const [lbRes, histRes] = await Promise.all([
        apiFetch<{ season: Season; seasons: Season[]; standings: LeaderboardEntry[] }>(
          `/leaderboard${qs}`
        ),
        apiFetch<{ transactions: PointTransactionItem[] }>(
          `/points/history${seasonId ? `?seasonId=${seasonId}` : ''}`
        ),
      ]);
      setSeasons(lbRes.seasons);
      setCurrentSeason(lbRes.season);
      setSelectedSeasonId(lbRes.season._id);
      setStandings(lbRes.standings);
      setHistory(histRes.transactions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const top3 = standings.slice(0, 3);
  // Podium display order on desktop: #2, #1, #3
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header & Season Selector */}
      <div className="bg-white rounded-2xl border border-[#E6E8EC] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#5A6170]">
            <Calendar className="w-4 h-4 text-[#E12D27]" />
            <span>
              {currentSeason?.status === 'archived' ? 'Stagione Archiviata' : 'Stagione Attiva'}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111318] mt-1">
            Classifica {currentSeason?.name || 'FantaJESic'}
          </h1>
        </div>

        {seasons.length > 0 && (
          <select
            value={selectedSeasonId}
            onChange={(e) => loadData(e.target.value)}
            className="h-11 px-4 rounded-xl bg-[#F8F9FA] border border-[#D8DCE3] text-sm font-semibold text-[#111318] focus:outline-none focus:border-[#E12D27]"
          >
            {seasons.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.status === 'active' ? 'In corso' : 'Archiviata'})
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="h-64 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
      ) : (
        <>
          {/* Top 3 Championship Podium */}
          {podiumOrder.length > 0 && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {podiumOrder.map((entry) => {
                const isFirst = entry.rank === 1;
                const isSecond = entry.rank === 2;
                return (
                  <button
                    key={entry.userId}
                    type="button"
                    onClick={() => onOpenProfile(entry.userId)}
                    className={`text-left rounded-2xl border p-6 transition-all cursor-pointer ${
                      isFirst
                        ? 'bg-[#111318] text-white border-[#C89B3C] md:order-2 md:pb-9'
                        : isSecond
                        ? 'bg-white text-[#111318] border-[#D8DCE3] md:order-1'
                        : 'bg-white text-[#111318] border-[#E6E8EC] md:order-3'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg ${
                          isFirst
                            ? 'bg-[#C89B3C] text-black'
                            : isSecond
                            ? 'bg-[#ECEEF2] text-[#333945]'
                            : 'bg-[#FEF3C7] text-[#92400E]'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      {isFirst ? (
                        <Trophy className="w-6 h-6 text-[#C89B3C]" />
                      ) : (
                        <Medal
                          className={`w-5 h-5 ${isSecond ? 'text-[#64748B]' : 'text-[#B45309]'}`}
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-3.5">
                      <Avatar src={entry.avatarUrl} name={entry.fullName} size="lg" />
                      <div className="min-w-0">
                        <div className="font-display text-lg font-bold truncate">
                          {entry.fullName}
                        </div>
                        <div
                          className={`text-xs truncate ${
                            isFirst ? 'text-white/70' : 'text-[#5A6170]'
                          }`}
                        >
                          {entry.area}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-current/10 flex items-baseline justify-between">
                      <span
                        className={`text-xs ${isFirst ? 'text-white/65' : 'text-[#5A6170]'}`}
                      >
                        Punteggio totale
                      </span>
                      <span className="font-mono text-2xl font-bold tabular-nums">
                        {entry.points} <span className="text-xs font-normal">pt</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </section>
          )}

          {/* Full Standings Table */}
          <section className="bg-white rounded-2xl border border-[#E6E8EC] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#ECEEF2] flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#111318]">
                Classifica Generale ({standings.length})
              </h2>
            </div>

            {standings.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5A6170]">
                Nessun associato registrato in questa stagione.
              </div>
            ) : (
              <div className="divide-y divide-[#ECEEF2]">
                {standings.map((entry) => (
                  <button
                    key={entry.userId}
                    type="button"
                    onClick={() => onOpenProfile(entry.userId)}
                    className="w-full px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F8F9FA] transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`font-mono text-sm font-bold w-8 text-center tabular-nums shrink-0 ${
                          entry.rank === 1
                            ? 'text-[#C89B3C]'
                            : entry.rank <= 3
                            ? 'text-[#E12D27]'
                            : 'text-[#5A6170]'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <Avatar src={entry.avatarUrl} name={entry.fullName} size="md" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[#111318] truncate">
                          {entry.fullName}
                        </div>
                        <div className="text-xs text-[#5A6170] truncate">
                          {entry.area}
                          {entry.boardRole ? ` · ${entry.boardRole}` : ''}
                        </div>
                        {entry.badges && entry.badges.length > 0 && (
                          <div className="text-[11px] font-medium text-[#9A701E] mt-0.5 truncate">
                            {entry.badges.join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="font-mono text-base font-bold text-[#111318] tabular-nums shrink-0">
                      {entry.points} pt
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Points Ledger History */}
          <section className="bg-white rounded-2xl border border-[#E6E8EC] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#ECEEF2] flex items-center gap-2">
              <History className="w-4 h-4 text-[#E12D27]" />
              <h2 className="font-display text-lg font-bold text-[#111318]">
                Storico Operazioni Punti
              </h2>
            </div>

            {history.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5A6170]">
                Nessuna assegnazione di punti registrata in questa stagione.
              </div>
            ) : (
              <div className="divide-y divide-[#ECEEF2]">
                {history.map((tx) => {
                  const recName = `${tx.recipientId?.firstName || ''} ${tx.recipientId?.lastName || ''}`.trim();
                  const presName = `${tx.awardedBy?.firstName || ''} ${tx.awardedBy?.lastName || ''}`.trim();
                  return (
                    <div
                      key={tx._id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#111318]">
                          <button
                            type="button"
                            onClick={() => tx.recipientId?._id && onOpenProfile(tx.recipientId._id)}
                            className="hover:text-[#E12D27] cursor-pointer"
                          >
                            {recName}
                          </button>
                          <span className="font-normal text-[#5A6170]"> — {tx.reason}</span>
                        </div>
                        <div className="text-xs text-[#7D8594] mt-0.5">
                          Assegnati da {presName} · {formatDateTime(tx.createdAt)}
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
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
