import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  Filter,
} from 'lucide-react';
import { notificationService } from '@/services/notifications';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Pagination } from '@/components/ui/Pagination';
import type { Notification } from '@/types';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);
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
      setUnreadCount(data.unread_count || 0);
      setPage(pageNum);
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
      setUnreadCount((prev) => Math.max(0, prev - 1));
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
      console.error('Failed to mark all read', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type === 'build_failure') {
      return <XCircle className="h-5 w-5 text-danger-400" />;
    }
    if (type === 'build_success') {
      return <CheckCircle2 className="h-5 w-5 text-success-400" />;
    }
    if (type === 'warning') {
      return <AlertTriangle className="h-5 w-5 text-warning-400" />;
    }
    return <Info className="h-5 w-5 text-primary-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Notifications Center
          </h1>
          <p className="text-xs text-dark-400">
            Pipeline events, alerts, and workflow completion updates ({unreadCount} unread)
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            isLoading={isMarkingAll}
            leftIcon={<CheckCheck className="h-4 w-4 text-primary-400" />}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setUnreadOnly(false)}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
            !unreadOnly
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-dark-900 border border-dark-800 text-dark-400 hover:text-white hover:bg-dark-800'
          }`}
        >
          All Notifications ({total})
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
            unreadOnly
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-dark-900 border border-dark-800 text-dark-400 hover:text-white hover:bg-dark-800'
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
              className={`flex items-start gap-4 rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                notif.is_read
                  ? 'border-dark-800/80 bg-dark-900/60 opacity-80'
                  : 'border-primary-500/30 bg-dark-900 shadow-md ring-1 ring-primary-500/10'
              }`}
            >
              <div className="mt-0.5 rounded-lg bg-dark-800 p-2 shrink-0 border border-dark-700/60">
                {getNotificationIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-sm font-semibold truncate ${
                        notif.is_read ? 'text-dark-200' : 'text-white'
                      }`}
                    >
                      {notif.title}
                    </h3>
                    {!notif.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary-500 shrink-0" />
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-[10px] text-dark-400 shrink-0">
                    <Clock className="h-3 w-3" />
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="mt-1 text-xs text-dark-300 leading-relaxed">{notif.message}</p>
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
