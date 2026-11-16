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

  const first = standings[0];
  const second = standings[1];
  const third = standings[2];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header & Season Selector */}
      <div className="bg-white rounded-2xl border border-[#E6E8EC] p-4 sm:p-5 space-y-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A6170]">
            <Calendar className="w-3.5 h-3.5 text-[#E12D27]" />
            <span>
              {currentSeason?.status === 'archived' ? 'Stagione Archiviata' : 'Stagione Attiva'}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-[#111318] mt-0.5">
            Classifica {currentSeason?.name || 'FantaJESic'}
          </h1>
        </div>

        {seasons.length > 0 && (
          <select
            value={selectedSeasonId}
            onChange={(e) => loadData(e.target.value)}
            className="w-full h-12 px-3.5 rounded-xl bg-[#F8F9FA] border border-[#D8DCE3] text-base font-semibold text-[#111318] focus:outline-none focus:border-[#E12D27]"
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
          {/* Smartphone-Native Top 3 Podium (#1 Featured + #2/#3 Grid) */}
          {first && (
            <section className="space-y-3">
              <button
                type="button"
                onClick={() => onOpenProfile(first.userId)}
                className="w-full text-left rounded-2xl bg-[#111318] text-white border border-[#C89B3C] p-5 flex items-center justify-between gap-4 active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    <Avatar src={first.avatarUrl} name={first.fullName} size="lg" />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#C89B3C] text-black font-mono text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#E5B85C]">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>1° Posto</span>
                    </div>
                    <div className="font-display text-lg font-bold truncate mt-0.5">
                      {first.fullName}
                    </div>
                    <div className="text-xs text-white/70 truncate">{first.area}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-2xl font-bold text-[#E5B85C] tabular-nums">
                    {first.points}
                  </div>
                  <div className="text-[11px] text-white/60">punti</div>
                </div>
              </button>

              {(second || third) && (
                <div className="grid grid-cols-2 gap-3">
                  {[second, third].filter(Boolean).map((entry) => (
                    <button
                      key={entry.userId}
                      type="button"
                      onClick={() => onOpenProfile(entry.userId)}
                      className="text-left rounded-2xl bg-white border border-[#E6E8EC] p-4 space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-[#ECEEF2] text-[#111318]">
                          #{entry.rank}
                        </span>
                        <Medal
                          className={`w-4 h-4 ${
                            entry.rank === 2 ? 'text-[#64748B]' : 'text-[#B45309]'
                          }`}
                        />
                      </div>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={entry.avatarUrl} name={entry.fullName} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#111318] truncate">
                            {entry.fullName}
                          </div>
                          <div className="text-[11px] text-[#5A6170] truncate">{entry.area}</div>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-[#F1F3F6] font-mono text-lg font-bold text-[#111318] tabular-nums">
                        {entry.points} <span className="text-xs font-normal text-[#5A6170]">pt</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Full Standings List */}
          <section className="bg-white rounded-2xl border border-[#E6E8EC] overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#ECEEF2] flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#111318]">
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
                    className="w-full min-h-[60px] px-4 py-3 flex items-center justify-between gap-3 active:bg-[#F8F9FA] text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`font-mono text-sm font-bold w-7 text-center tabular-nums shrink-0 ${
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
            <div className="px-4 py-3.5 border-b border-[#ECEEF2] flex items-center gap-2">
              <History className="w-4 h-4 text-[#E12D27]" />
              <h2 className="font-display text-base font-bold text-[#111318]">
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
                      className="px-4 py-3.5 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#111318]">
                          <button
                            type="button"
                            onClick={() => tx.recipientId?._id && onOpenProfile(tx.recipientId._id)}
                            className="active:text-[#E12D27] cursor-pointer"
                          >
                            {recName}
                          </button>
                        </div>
                        <p className="text-xs text-[#333945] mt-0.5">{tx.reason}</p>
                        <div className="text-[11px] text-[#7D8594] mt-1">
                          Da {presName} · {formatDateTime(tx.createdAt)}
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
