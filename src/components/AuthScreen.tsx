import React, { useState } from 'react';
import { Camera, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiFetch, setAuthToken, uploadMediaFile } from '../lib/api';
import { DbStatus, JESIC_AREAS, UserProfile } from '../types';
import logoImg from '../assets/images/fantajesic_logo_1794764905106.jpg';
import bannerImg from '../assets/images/fantajesic_arena_banner_1794764905038.jpg';

interface AuthScreenProps {
  dbStatus: DbStatus | null;
  onAuthenticated: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ dbStatus, onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [area, setArea] = useState<string>(JESIC_AREAS[0]);
  const [boardRole, setBoardRole] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPublicId, setAvatarPublicId] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingAvatar(true);
    try {
      const res = await uploadMediaFile(file, '/upload/avatar');
      setAvatarUrl(res.url);
      setAvatarPublicId(res.publicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento foto non riuscito.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiFetch<{ token: string; user: UserProfile }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await apiFetch<{ token: string; user: UserProfile }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            password,
            area,
            boardRole,
            avatarUrl,
            avatarPublicId,
          }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col lg:flex-row">
      {/* Compact Mobile Hero Header / Desktop Split Hero */}
      <div className="relative lg:w-[46%] bg-[#111318] text-white overflow-hidden flex flex-col justify-between px-5 py-6 sm:p-10 lg:p-12 min-h-[138px] lg:min-h-screen">
        <img
          src={bannerImg}
          alt="FantaJESic Arena"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111318] via-[#111318]/80 to-[#111318]/50" />

        <div className="relative z-10 flex items-center gap-3">
          <img
            src={logoImg}
            alt="Logo FantaJESic"
            referrerPolicy="no-referrer"
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover bg-white p-0.5 shadow-lg shrink-0"
          />
          <div>
            <span className="font-display text-2xl font-bold tracking-tight block leading-none">
              FantaJESic
            </span>
            <span className="text-xs text-white/75 mt-1 block">
              La community competitiva di JESic
            </span>
          </div>
        </div>

        <div className="relative z-10 hidden lg:block max-w-lg">
          <h1 className="font-display text-4xl font-bold tracking-tight leading-[1.1] [text-wrap:balance]">
            Sfide, punti e vita associativa in tasca.
          </h1>
          <p className="mt-4 text-base text-white/75 leading-relaxed">
            Partecipa alle sfide tra aree, condividi foto e video nel feed, vota le creazioni
            migliori e scala la classifica di stagione.
          </p>
        </div>
      </div>

      {/* Form Area (Immediately visible above the fold on mobile) */}
      <div className="flex-1 flex items-start lg:items-center justify-center px-4 py-6 sm:p-8 pb-safe">
        <div className="w-full max-w-md">
          {dbStatus && !dbStatus.connected && (
            <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Connessione MongoDB Atlas richiesta</p>
                  <p className="mt-0.5 text-amber-900/80 leading-relaxed">
                    {dbStatus.error || 'Imposta MONGODB_URI nelle variabili d’ambiente per abilitare registrazione e login.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Segmented Mode Toggle */}
          <div className="grid grid-cols-2 p-1 bg-[#ECEEF2] rounded-2xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`min-h-[46px] text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#111318] shadow-sm'
                  : 'text-[#5A6170]'
              }`}
            >
              Accedi
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`min-h-[46px] text-sm font-semibold rounded-xl transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-[#111318] shadow-sm'
                  : 'text-[#5A6170]'
              }`}
            >
              Registrati
            </button>
          </div>

          <div className="mb-5">
            <h2 className="font-display text-2xl font-bold text-[#111318]">
              {mode === 'login' ? 'Bentornato in FantaJESic' : 'Crea il tuo account'}
            </h2>
            <p className="text-sm text-[#5A6170] mt-0.5">
              {mode === 'login'
                ? 'Accedi con la tua email e password.'
                : 'Tutti i nuovi iscritti iniziano come associati JESic.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-[#E12D27]/25 bg-[#E12D27]/5 px-4 py-3 text-sm text-[#B91C1C] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="flex items-center gap-4 p-3 rounded-2xl bg-white border border-[#E6E8EC]">
                  <label className="relative cursor-pointer shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-[#ECEEF2] border border-[#D8DCE3] flex items-center justify-center text-[#5A6170]">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Anteprima profilo"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : uploadingAvatar ? (
                        <Loader2 className="w-5 h-5 animate-spin text-[#E12D27]" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                  </label>
                  <div className="text-xs text-[#5A6170] min-w-0">
                    <p className="font-semibold text-sm text-[#111318]">Foto profilo (opzionale)</p>
                    <p className="mt-0.5 truncate">
                      {avatarUrl ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Caricata su Cloudinary
                        </span>
                      ) : (
                        'Tocca l’icona per scegliere una foto'
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1.5">
                      Nome *
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Mario"
                      className="w-full h-12 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-base focus:outline-none focus:border-[#E12D27]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#333945] mb-1.5">
                      Cognome *
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Rossi"
                      className="w-full h-12 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-base focus:outline-none focus:border-[#E12D27]"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#333945] mb-1.5">
                Email *
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome.cognome@jesic.it"
                className="w-full h-12 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-base focus:outline-none focus:border-[#E12D27]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#333945] mb-1.5">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  className="w-full h-12 pl-3.5 pr-12 rounded-xl bg-white border border-[#D8DCE3] text-base focus:outline-none focus:border-[#E12D27]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-[#5A6170]"
                  aria-label="Mostra o nascondi password"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1.5">
                    Area organizzativa JESic *
                  </label>
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-base focus:outline-none focus:border-[#E12D27]"
                  >
                    {JESIC_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#333945] mb-1.5">
                    Incarico o Board (opzionale)
                  </label>
                  <input
                    type="text"
                    value={boardRole}
                    onChange={(e) => setBoardRole(e.target.value)}
                    placeholder="Es. Responsabile Area, Membro Board"
                    className="w-full h-12 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-base focus:outline-none focus:border-[#E12D27]"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || uploadingAvatar}
              className="w-full h-12 mt-2 rounded-xl bg-[#E12D27] active:scale-[0.98] text-white font-semibold text-base transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {mode === 'login' ? 'Accedi' : 'Completa Registrazione'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
