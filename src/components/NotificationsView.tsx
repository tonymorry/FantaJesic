import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trophy, Heart, MessageCircle, Flag, Sparkles } from 'lucide-react';
import { apiFetch, formatRelativeDate } from '../lib/api';
import { AppTab, NotificationItem } from '../types';

interface NotificationsViewProps {
  onNavigate: (tab: AppTab, targetId?: string) => void;
  onUnreadCountChange: (count: number) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onNavigate,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>(
        '/notifications'
      );
      setNotifications(res.notifications);
      onUnreadCountChange(res.unreadCount);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (notification?: NotificationItem) => {
    await apiFetch('/notifications/read', {
      method: 'POST',
      body: JSON.stringify(notification ? { notificationId: notification._id } : {}),
    });

    if (notification) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n))
      );
      const unread = notifications.filter((n) => !n.isRead && n._id !== notification._id).length;
      onUnreadCountChange(unread);
      if (notification.linkTab) {
        onNavigate(notification.linkTab as AppTab, notification.linkId);
      }
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      onUnreadCountChange(0);
    }
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-[#E12D27]" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-sky-600" />;
      case 'points_awarded':
        return <Trophy className="w-4 h-4 text-[#C89B3C]" />;
      case 'new_challenge':
      case 'voting_started':
      case 'challenge_ended':
        return <Flag className="w-4 h-4 text-[#E12D27]" />;
      default:
        return <Sparkles className="w-4 h-4 text-[#5A6170]" />;
    }
  };

  const unreadList = notifications.filter((n) => !n.isRead);
  const readList = notifications.filter((n) => n.isRead);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-[#E6E8EC] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#111318]">Notifiche</h1>
          <p className="text-sm text-[#5A6170] mt-0.5">
            Interazioni, nuove sfide, proposte e aggiornamenti punti.
          </p>
        </div>

        {unreadList.length > 0 && (
          <button
            onClick={() => markRead()}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#F8F9FA] border border-[#E6E8EC] text-sm font-medium text-[#111318] hover:bg-[#ECEEF2] transition-colors cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-[#E12D27]" />
            Segna tutte come lette
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-[#E6E8EC] animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6E8EC] p-10 text-center">
          <Bell className="w-8 h-8 text-[#9AA1B0] mx-auto mb-3" />
          <p className="font-display text-lg font-semibold text-[#111318]">Nessuna notifica</p>
          <p className="text-sm text-[#5A6170] mt-1">
            Quando riceverai like, commenti, nuove sfide o punti li troverai qui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {unreadList.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E6E8EC] overflow-hidden">
              <div className="px-5 py-3 bg-[#FFF8F7] border-b border-[#F3D8D6] text-xs font-semibold text-[#B91C1C]">
                Da leggere ({unreadList.length})
              </div>
              <div className="divide-y divide-[#ECEEF2]">
                {unreadList.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => markRead(n)}
                    className="w-full text-left px-5 py-4 flex items-start gap-3.5 hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#FFF0EF] flex items-center justify-center shrink-0 mt-0.5">
                      {renderIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#111318]">{n.title}</span>
                        <span className="text-xs text-[#5A6170] shrink-0">
                          {formatRelativeDate(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-[#333945] mt-0.5 leading-snug">{n.body}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {readList.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E6E8EC] overflow-hidden">
              <div className="px-5 py-3 bg-[#F8F9FA] border-b border-[#ECEEF2] text-xs font-semibold text-[#5A6170]">
                Già lette ({readList.length})
              </div>
              <div className="divide-y divide-[#ECEEF2]">
                {readList.map((n) => (
                  <button
                    key={n._id}
                    onClick={() => {
                      if (n.linkTab) onNavigate(n.linkTab as AppTab, n.linkId);
                    }}
                    className="w-full text-left px-5 py-4 flex items-start gap-3.5 hover:bg-[#F8F9FA] transition-colors opacity-80 cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#F1F3F6] flex items-center justify-center shrink-0 mt-0.5">
                      {renderIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[#111318]">{n.title}</span>
                        <span className="text-xs text-[#5A6170] shrink-0">
                          {formatRelativeDate(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-[#5A6170] mt-0.5 leading-snug">{n.body}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
