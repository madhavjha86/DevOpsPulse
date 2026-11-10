import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
} from 'lucide-react';
import { notificationService } from '@/services/notifications';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Notification } from '@/types';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

  const fetchNotifications = async (pageNum: number = 1, onlyUnread: boolean = false) => {
    setIsLoading(true);
    try {
      const { data } = await notificationService.getAll(pageNum, onlyUnread);
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setPage(pageNum);

      // Fetch unread count
      const { data: countData } = await notificationService.getUnreadCount();
      setUnreadCount(countData.unread_count || 0);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(1, unreadOnly);
  }, [unreadOnly]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead([id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type === 'success') {
      return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    }
    if (type === 'error' || type === 'failure') {
      return <XCircle className="h-5 w-5 text-rose-600" />;
    }
    if (type === 'warning') {
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    }
    return <Info className="h-5 w-5 text-primary-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-dark-100">
            Notifications Center
          </h1>
          <p className="text-xs font-medium text-dark-400 mt-0.5">
            Pipeline events, alerts, and workflow completion updates ({unreadCount} unread)
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            isLoading={isMarkingAll}
            leftIcon={<CheckCheck className="h-4 w-4 text-primary-600" />}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setUnreadOnly(false)}
          className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-all duration-150 ${
            !unreadOnly
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
              : 'bg-white border border-[#E5E7EB] text-dark-400 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          All Notifications ({total})
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition-all duration-150 ${
            unreadOnly
              ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/25'
              : 'bg-white border border-[#E5E7EB] text-dark-400 hover:text-dark-100 hover:bg-slate-50'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" message="Loading notifications..." />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="All Caught Up!"
          description={
            unreadOnly
              ? 'You have zero unread notifications.'
              : 'No alerts or events to display yet. Pipeline alerts will appear here.'
          }
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
              className={`flex items-start gap-4 rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
                notif.is_read
                  ? 'border-[#E5E7EB] bg-slate-50/60 opacity-80 hover:bg-slate-100/70'
                  : 'border-primary-200 bg-white shadow-subtle ring-1 ring-primary-500/15 hover:shadow-card-hover'
              }`}
            >
              <div className="mt-0.5 rounded-xl bg-white p-2 shrink-0 border border-[#E5E7EB] shadow-2xs">
                {getNotificationIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-sm font-bold truncate ${
                        notif.is_read ? 'text-dark-200' : 'text-dark-100'
                      }`}
                    >
                      {notif.title}
                    </h3>
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary-600 shrink-0" />
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-dark-400 shrink-0 font-medium">
                    <Clock className="h-3 w-3" />
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="mt-1 text-xs text-dark-300 leading-relaxed font-medium">{notif.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / 20)}
          onPageChange={(p) => fetchNotifications(p, unreadOnly)}
        />
      )}
    </div>
  );
};

export default NotificationsPage;
