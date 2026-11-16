import React, { useEffect, useState } from 'react';
import { BookOpen, Edit3, Plus, Save, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { apiFetch, formatDateTime } from '../lib/api';
import { RegulationDoc, UserProfile } from '../types';

interface RegulationsViewProps {
  currentUser: UserProfile;
}

export const RegulationsView: React.FC<RegulationsViewProps> = ({ currentUser }) => {
  const [regulation, setRegulation] = useState<RegulationDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState<Array<{ id: string; heading: string; content: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const loadRegulation = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ regulation: RegulationDoc }>('/regulations');
      if (res.regulation) {
        setRegulation(res.regulation);
        setTitle(res.regulation.title);
        setSections(res.regulation.sections || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegulation();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      const res = await apiFetch<{ regulation: RegulationDoc }>('/regulations', {
        method: 'PUT',
        body: JSON.stringify({ title, sections }),
      });
      setRegulation(res.regulation);
      setEditing(false);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-24 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-[#E6E8EC] p-5 space-y-5">
        <div className="flex flex-col gap-3 pb-4 border-b border-[#ECEEF2]">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#5A6170]">
              <BookOpen className="w-4 h-4 text-[#E12D27]" />
              <span>Normativa Community</span>
              {regulation?.updatedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatDateTime(regulation.updatedAt)}</span>
                </>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold text-[#111318] mt-1">
              {regulation?.title || 'Regolamento FantaJESic'}
            </h1>
          </div>

          {currentUser.role === 'president' && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl bg-[#111318] text-white text-sm font-semibold cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              Modifica Regolamento
            </button>
          )}
        </div>

        {savedNotice && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Regolamento salvato con successo.</span>
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#333945] mb-1">
                Titolo Regolamento
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-12 px-3.5 rounded-xl border border-[#D8DCE3] text-base focus:outline-none focus:border-[#E12D27]"
              />
            </div>

            <div className="space-y-3.5">
              {sections.map((sec, idx) => (
                <div
                  key={sec.id || idx}
                  className="p-3.5 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      required
                      value={sec.heading}
                      onChange={(e) => {
                        const copy = [...sections];
                        copy[idx] = { ...copy[idx], heading: e.target.value };
                        setSections(copy);
                      }}
                      placeholder="Titolo sezione"
                      className="flex-1 h-11 px-3 rounded-lg bg-white border border-[#D8DCE3] text-base font-semibold focus:outline-none focus:border-[#E12D27]"
                    />
                    <button
                      type="button"
                      onClick={() => setSections(sections.filter((_, i) => i !== idx))}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#5A6170] active:text-[#E12D27]"
                      aria-label="Rimuovi sezione"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    required
                    rows={3}
                    value={sec.content}
                    onChange={(e) => {
                      const copy = [...sections];
                      copy[idx] = { ...copy[idx], content: e.target.value };
                      setSections(copy);
                    }}
                    placeholder="Testo della regola..."
                    className="w-full p-3 rounded-lg bg-white border border-[#D8DCE3] text-base leading-relaxed focus:outline-none focus:border-[#E12D27]"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setSections([
                  ...sections,
                  { id: `sec-${Date.now()}`, heading: `${sections.length + 1}. Nuova Sezione`, content: '' },
                ])
              }
              className="w-full inline-flex items-center justify-center gap-2 px-4 min-h-[46px] rounded-xl border border-[#D8DCE3] bg-white text-sm font-semibold text-[#111318]"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Sezione
            </button>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTitle(regulation?.title || '');
                  setSections(regulation?.sections || []);
                }}
                className="min-h-[46px] rounded-xl border border-[#E6E8EC] text-sm font-semibold text-[#5A6170]"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-xl bg-[#E12D27] text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salva
              </button>
            </div>
          </form>
        ) : (
          <div className="divide-y divide-[#ECEEF2]">
            {regulation?.sections?.map((sec) => (
              <section key={sec.id} className="py-4 first:pt-0 last:pb-0">
                <h2 className="font-display text-lg font-bold text-[#111318]">{sec.heading}</h2>
                <p className="mt-1.5 text-[15px] text-[#333945] leading-relaxed whitespace-pre-line">
                  {sec.content}
                </p>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
