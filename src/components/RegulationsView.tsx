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
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-24 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#ECEEF2]">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#5A6170]">
              <BookOpen className="w-4 h-4 text-[#E12D27]" />
              <span>Normativa Community</span>
              {regulation?.updatedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Aggiornato il {formatDateTime(regulation.updatedAt)}</span>
                </>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111318] mt-1.5">
              {regulation?.title || 'Regolamento FantaJESic'}
            </h1>
          </div>

          {currentUser.role === 'president' && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#111318] text-white text-sm font-medium hover:bg-[#232730] transition-colors shrink-0 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              Modifica Regolamento
            </button>
          )}
        </div>

        {savedNotice && (
          <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Regolamento salvato e pubblicato con successo.</span>
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSave} className="mt-6 space-y-6">
            <div>
              <label className="block text-xs font-semibold text-[#333945] mb-1.5">
                Titolo Regolamento
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-[#D8DCE3] text-sm focus:outline-none focus:border-[#E12D27]"
              />
            </div>

            <div className="space-y-4">
              {sections.map((sec, idx) => (
                <div
                  key={sec.id || idx}
                  className="p-4 rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
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
                      className="flex-1 h-10 px-3 rounded-lg bg-white border border-[#D8DCE3] text-sm font-semibold focus:outline-none focus:border-[#E12D27]"
                    />
                    <button
                      type="button"
                      onClick={() => setSections(sections.filter((_, i) => i !== idx))}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#5A6170] hover:text-[#E12D27] hover:bg-white transition-colors"
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
                    className="w-full p-3 rounded-lg bg-white border border-[#D8DCE3] text-sm leading-relaxed focus:outline-none focus:border-[#E12D27]"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setSections([
                    ...sections,
                    { id: `sec-${Date.now()}`, heading: `${sections.length + 1}. Nuova Sezione`, content: '' },
                  ])
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#D8DCE3] bg-white text-sm font-medium text-[#111318] hover:bg-[#F8F9FA]"
              >
                <Plus className="w-4 h-4" />
                Aggiungi Sezione
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setTitle(regulation?.title || '');
                    setSections(regulation?.sections || []);
                  }}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-[#5A6170] hover:bg-[#F8F9FA]"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-[#E12D27] text-white text-sm font-semibold hover:bg-[#C9231E] disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salva Modifiche
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-6 divide-y divide-[#ECEEF2]">
            {regulation?.sections?.map((sec) => (
              <section key={sec.id} className="py-5 first:pt-0 last:pb-0">
                <h2 className="font-display text-lg font-bold text-[#111318]">{sec.heading}</h2>
                <p className="mt-2 text-[15px] text-[#333945] leading-relaxed whitespace-pre-line">
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
