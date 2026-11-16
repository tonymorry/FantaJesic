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
      {/* Left Hero Column (Desktop) */}
      <div className="relative lg:w-[48%] xl:w-[52%] bg-[#111318] text-white overflow-hidden flex flex-col justify-between p-6 sm:p-10 lg:p-14 min-h-[260px] lg:min-h-screen">
        <img
          src={bannerImg}
          alt="FantaJESic Arena"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111318] via-[#111318]/75 to-[#111318]/45" />

        <div className="relative z-10 flex items-center gap-3.5">
          <img
            src={logoImg}
            alt="Logo FantaJESic"
            referrerPolicy="no-referrer"
            className="w-12 h-12 rounded-xl object-cover bg-white p-0.5 shadow-lg"
          />
          <div>
            <span className="font-display text-2xl font-bold tracking-tight block leading-none">
              FantaJESic
            </span>
            <span className="text-xs text-white/70 mt-1 block">
              Community League &amp; Social Arena
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-8 lg:mt-0 max-w-xl">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.08] [text-wrap:balance]">
            La vita associativa diventa una competizione di squadra.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-white/75 leading-relaxed max-w-lg">
            Partecipa alle sfide tra aree, condividi foto e video nel feed della community,
            vota le creazioni migliori e scala la classifica stagionale di JESic.
          </p>

          <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="font-mono text-base font-semibold text-white">Sfide</div>
              <div className="text-white/65 mt-0.5">Timer e votazioni live</div>
            </div>
            <div>
              <div className="font-mono text-base font-semibold text-[#E5B85C]">Classifica</div>
              <div className="text-white/65 mt-0.5">Punti e storico stagioni</div>
            </div>
            <div>
              <div className="font-mono text-base font-semibold text-white">Social</div>
              <div className="text-white/65 mt-0.5">Feed foto, video e commenti</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Column */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-10 lg:p-14">
        <div className="w-full max-w-md">
          {dbStatus && !dbStatus.connected && (
            <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Connessione MongoDB Atlas richiesta</p>
                  <p className="mt-1 text-amber-900/80 leading-relaxed">
                    {dbStatus.error || 'Imposta MONGODB_URI nelle variabili d’ambiente per abilitare registrazione, login e persistenza reale.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Segmented Mode Toggle */}
          <div className="flex items-center p-1 bg-[#ECEEF2] rounded-xl mb-7">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 min-h-[44px] text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-[#111318] shadow-sm'
                  : 'text-[#5A6170] hover:text-[#111318]'
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
              className={`flex-1 min-h-[44px] text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-[#111318] shadow-sm'
                  : 'text-[#5A6170] hover:text-[#111318]'
              }`}
            >
              Crea Account
            </button>
          </div>

          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-[#111318]">
              {mode === 'login' ? 'Bentornato in FantaJESic' : 'Registrati come associato'}
            </h2>
            <p className="text-sm text-[#5A6170] mt-1">
              {mode === 'login'
                ? 'Inserisci le tue credenziali per accedere alla community.'
                : 'Tutti i nuovi account partono come associati JESic.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-[#E12D27]/25 bg-[#E12D27]/5 px-4 py-3 text-sm text-[#B91C1C] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                {/* Optional Profile Photo Upload */}
                <div className="flex items-center gap-4 pb-2">
                  <label className="relative cursor-pointer group">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[#ECEEF2] border border-[#D8DCE3] flex items-center justify-center text-[#5A6170] group-hover:border-[#E12D27] transition-colors">
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
                  <div className="text-xs text-[#5A6170]">
                    <p className="font-semibold text-[#111318]">Foto profilo (facoltativa)</p>
                    <p className="mt-0.5">
                      {avatarUrl ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Foto caricata su Cloudinary
                        </span>
                      ) : (
                        'Clicca sull’icona per caricare un’immagine'
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
                      className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-sm focus:outline-none focus:border-[#E12D27] focus:ring-2 focus:ring-[#E12D27]/15"
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
                      className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-sm focus:outline-none focus:border-[#E12D27] focus:ring-2 focus:ring-[#E12D27]/15"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#333945] mb-1.5">
                Email JESic o personale *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome.cognome@jesic.it"
                className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-sm focus:outline-none focus:border-[#E12D27] focus:ring-2 focus:ring-[#E12D27]/15"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl bg-white border border-[#D8DCE3] text-sm focus:outline-none focus:border-[#E12D27] focus:ring-2 focus:ring-[#E12D27]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-[#5A6170] hover:text-[#111318]"
                  aria-label="Mostra o nascondi password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-sm focus:outline-none focus:border-[#E12D27] focus:ring-2 focus:ring-[#E12D27]/15"
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
                    Incarico o appartenenza al Board (opzionale)
                  </label>
                  <input
                    type="text"
                    value={boardRole}
                    onChange={(e) => setBoardRole(e.target.value)}
                    placeholder="Es. Responsabile Area, Membro Board, Project Manager"
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-[#D8DCE3] text-sm focus:outline-none focus:border-[#E12D27] focus:ring-2 focus:ring-[#E12D27]/15"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || uploadingAvatar}
              className="w-full h-12 mt-2 rounded-xl bg-[#E12D27] hover:bg-[#C9231E] active:scale-[0.99] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Accedi a FantaJESic' : 'Completa Registrazione'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
