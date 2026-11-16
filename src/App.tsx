import { useCallback, useEffect, useState } from 'react';
import {
  Home,
  Trophy,
  BarChart3,
  BookOpen,
  ShieldCheck,
  Bell,
  Plus,
  Loader2,
} from 'lucide-react';
import { apiFetch, getAuthToken, setAuthToken } from './lib/api';
import { AppTab, DbStatus, UserProfile } from './types';
import { AuthScreen } from './components/AuthScreen';
import { FeedView } from './components/FeedView';
import { ChallengesView } from './components/ChallengesView';
import { LeaderboardView } from './components/LeaderboardView';
import { RegulationsView } from './components/RegulationsView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { PresidentPanel } from './components/PresidentPanel';
import { Avatar } from './components/Avatar';
import logoImg from './assets/images/fantajesic_logo_1794764905106.jpg';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activeTab, setActiveTab] = useState<AppTab>('feed');
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [composerFocusTrigger, setComposerFocusTrigger] = useState(0);

  const syncSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await apiFetch<{
        user: UserProfile;
        unreadNotifications: number;
      }>('/auth/me');
      setUser((prev) =>
        prev && JSON.stringify(prev) === JSON.stringify(me.user) ? prev : me.user
      );
      setUnreadNotifications((prev) =>
        prev === (me.unreadNotifications || 0) ? prev : me.unreadNotifications || 0
      );
    } catch {
      const health = await fetch('/api/health')
        .then((r) => r.json())
        .catch(() => null);
      if (health?.db?.connected) {
        setAuthToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const health = await fetch('/api/health')
          .then((r) => r.json())
          .catch(() => null);
        if (health?.db) setDbStatus(health.db);
        await syncSession();
      } finally {
        setBooting(false);
      }
    })();
  }, [syncSession]);

  // Live role & notification polling (picks up manual MongoDB role changes immediately)
  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      syncSession();
    };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(() => {
      syncSession();
    }, 20000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [user?._id, syncSession]);

  const handleNavigate = (tab: AppTab, targetId?: string) => {
    setActiveTab(tab);
    if (tab === 'challenges') {
      setSelectedChallengeId(targetId || null);
    } else {
      setSelectedChallengeId(null);
    }
    if (tab === 'profile') {
      setSelectedProfileId(targetId || user?._id || null);
    } else {
      setSelectedProfileId(null);
    }
    window.scrollTo(0, 0);
  };

  const handleOpenProfile = (userId: string) => {
    setSelectedProfileId(userId);
    setActiveTab('profile');
    window.scrollTo(0, 0);
  };

  const handleOpenChallenge = (challengeId: string) => {
    setSelectedChallengeId(challengeId);
    setActiveTab('challenges');
    window.scrollTo(0, 0);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setActiveTab('feed');
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#E12D27]" />
        <span className="text-sm font-medium text-[#5A6170]">Caricamento FantaJESic...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        dbStatus={dbStatus}
        onAuthenticated={(loggedUser) => {
          setUser(loggedUser);
          setActiveTab('feed');
          syncSession();
        }}
      />
    );
  }

  const isPresident = user.role === 'president';

  const navItems: Array<{ id: AppTab; label: string; icon: typeof Home }> = [
    { id: 'feed', label: 'Home', icon: Home },
    { id: 'challenges', label: 'Sfide', icon: Trophy },
    { id: 'leaderboard', label: 'Classifica', icon: BarChart3 },
    { id: 'regulations', label: 'Regole', icon: BookOpen },
    ...(isPresident ? [{ id: 'president' as AppTab, label: 'Presidenza', icon: ShieldCheck }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111318] pb-24 overflow-x-clip">
      {/* Smartphone-First Sticky Top App Bar */}
      <header className="sticky top-0 z-40 min-h-[54px] pt-safe bg-white/95 backdrop-blur-md border-b border-[#E6E8EC]">
        <div className="max-w-2xl mx-auto h-[54px] px-3.5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleNavigate('feed')}
            className="flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer min-h-[44px]"
          >
            <img
              src={logoImg}
              alt="FantaJESic"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-black/5"
            />
            <span className="font-display text-lg font-bold tracking-tight text-[#111318]">
              FantaJESic
            </span>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('feed');
                setComposerFocusTrigger((c) => c + 1);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#E12D27] active:bg-[#FFF0EF] cursor-pointer"
              aria-label="Nuovo Post"
            >
              <Plus className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigate('notifications')}
              className={`relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl cursor-pointer ${
                activeTab === 'notifications' ? 'text-[#E12D27]' : 'text-[#333945]'
              }`}
              aria-label="Notifiche"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-2 right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#E12D27] text-white font-mono text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOpenProfile(user._id)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Profilo"
            >
              <Avatar src={user.avatarUrl} name={user.fullName} size="xs" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile-First Main Viewport */}
      <main className="max-w-2xl mx-auto px-3.5 py-4">
        {activeTab === 'feed' && (
          <FeedView
            currentUser={user}
            composerFocusTrigger={composerFocusTrigger}
            onOpenProfile={handleOpenProfile}
            onOpenChallenge={handleOpenChallenge}
            onNavigateTab={(tab) => handleNavigate(tab)}
          />
        )}

        {activeTab === 'challenges' && (
          <ChallengesView
            currentUser={user}
            selectedChallengeId={selectedChallengeId}
            onSelectChallenge={(id) => setSelectedChallengeId(id)}
            onOpenProfile={handleOpenProfile}
            onGoToPresidentCreate={
              isPresident ? () => handleNavigate('president') : undefined
            }
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView onOpenProfile={handleOpenProfile} />
        )}

        {activeTab === 'regulations' && <RegulationsView currentUser={user} />}

        {activeTab === 'notifications' && (
          <NotificationsView
            onNavigate={handleNavigate}
            onUnreadCountChange={(count) => setUnreadNotifications(count)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            profileUserId={selectedProfileId || user._id}
            currentUser={user}
            onBack={() => handleNavigate('feed')}
            onProfileUpdated={(updated) => setUser(updated)}
            onOpenProfile={handleOpenProfile}
            onOpenChallenge={handleOpenChallenge}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'president' && isPresident && (
          <PresidentPanel
            onOpenChallenge={handleOpenChallenge}
            onOpenProfile={handleOpenProfile}
          />
        )}
      </main>

      {/* Fixed Thumb-Zone Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E6E8EC] pb-safe"
        aria-label="Navigazione principale"
      >
        <div
          className={`max-w-2xl mx-auto grid h-16 items-center ${
            isPresident ? 'grid-cols-5' : 'grid-cols-4'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active ? 'text-[#E12D27]' : 'text-[#5A6170]'
                }`}
              >
                <Icon className="w-[21px] h-[21px]" />
                <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
