import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  ExternalLink,
  Minimize2,
  Pause,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TeacherAlert } from '../types/exam';

function getAlertVisualMeta(alert: TeacherAlert) {
  if (alert.actionType === 'network_offline') {
    return {
      Icon: WifiOff,
      severityLabel: 'Mất kết nối',
      toneClass: 'text-red-700 dark:text-red-300',
      iconBoxClass:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300',
    };
  }
  if (alert.actionType === 'fullscreen_exited') {
    return {
      Icon: Minimize2,
      severityLabel: 'Thoát toàn màn hình',
      toneClass: 'text-amber-700 dark:text-amber-300',
      iconBoxClass:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
    };
  }
  if (alert.actionType === 'paused_exam') {
    return {
      Icon: Pause,
      severityLabel: 'Tạm dừng bài thi',
      toneClass: 'text-amber-700 dark:text-amber-300',
      iconBoxClass:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
    };
  }
  if (alert.severity === 'critical') {
    return {
      Icon: ShieldAlert,
      severityLabel: 'Cảnh báo nghiêm trọng',
      toneClass: 'text-red-700 dark:text-red-300',
      iconBoxClass:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300',
    };
  }
  return {
    Icon: AlertTriangle,
    severityLabel: 'Cảnh báo giám sát',
    toneClass: 'text-amber-700 dark:text-amber-300',
    iconBoxClass:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
  };
}

interface TeacherNotificationBellProps {
  alerts: TeacherAlert[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onInspectAlert: (alert: TeacherAlert) => void;
  onTriggerTestAlert: () => void;
}

export function TeacherNotificationBell({
  alerts,
  soundEnabled,
  onToggleSound,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onInspectAlert,
  onTriggerTestAlert,
}: TeacherNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts],
  );
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === 'critical').length,
    [alerts],
  );

  const filteredAlerts = useMemo(() => {
    if (filter === 'unread') return alerts.filter((a) => !a.read);
    if (filter === 'critical') return alerts.filter((a) => a.severity === 'critical');
    return alerts;
  }, [alerts, filter]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Thông báo giám sát phòng thi (${unreadCount} chưa đọc)`}
        title="Thông báo cảnh báo hành vi thí sinh"
        className={`relative inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
          unreadCount > 0
            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700/80 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-950'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <Bell className="h-4 w-4 shrink-0" />
        {unreadCount > 0 && (
          <span className="font-mono text-xs font-bold tabular-nums">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Trung tâm thông báo giám sát"
          className="fixed top-18 right-3 left-3 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:top-11 sm:right-0 sm:left-auto sm:w-[420px] dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                Thông báo giám sát phòng thi
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {unreadCount} chưa đọc · {alerts.length} sự kiện đã ghi nhận
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleSound}
                title={soundEnabled ? 'Tắt âm báo đẩy' : 'Bật âm báo đẩy'}
                aria-label={soundEnabled ? 'Tắt âm báo đẩy' : 'Bật âm báo đẩy'}
                className="cursor-pointer rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng thông báo"
                className="cursor-pointer rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs & Quick Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: `Tất cả (${alerts.length})` },
                  { id: 'unread', label: `Chưa đọc (${unreadCount})` },
                  { id: 'critical', label: `Nghiêm trọng (${criticalCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`cursor-pointer whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                    filter === tab.id
                      ? 'bg-blue-700 text-white dark:bg-blue-600'
                      : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onTriggerTestAlert}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              <BellRing className="h-3 w-3" />
              <span>Thử cảnh báo</span>
            </button>
          </div>

          {/* Notification Feed */}
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {filteredAlerts.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Không có thông báo bất thường nào
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Các cảnh báo như chuyển tab, mất kết nối mạng hoặc tạm dừng bài thi sẽ tự động đẩy
                  về đây.
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const visual = getAlertVisualMeta(alert);
                const Icon = visual.Icon;
                return (
                  <div
                    key={alert.id}
                    onClick={() => {
                      onMarkRead(alert.id);
                      onInspectAlert(alert);
                      setOpen(false);
                    }}
                    className={`cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      !alert.read ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${visual.iconBoxClass}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                          <span className={`font-semibold ${visual.toneClass}`}>
                            {alert.title}
                            {!alert.read && ' · Mới'}
                          </span>
                          <span className="font-mono text-slate-400 tabular-nums dark:text-slate-500">
                            {new Date(alert.timestamp).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>

                        <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {alert.studentName} ·{' '}
                          <span className="font-mono tabular-nums">SBD {alert.studentSbd}</span> ·{' '}
                          {alert.roomCode}
                        </p>

                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {alert.detail}
                        </p>

                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                            <ExternalLink className="h-3 w-3" />
                            <span>Xem nhật ký &amp; kết quả</span>
                          </span>
                          {!alert.read && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkRead(alert.id);
                              }}
                              className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                              Đánh dấu đã đọc
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] dark:border-slate-800 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Đọc tất cả</span>
              </button>
              <button
                type="button"
                onClick={onClearAll}
                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-red-600 hover:underline dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa lịch sử</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TeacherAlertToastStackProps {
  toasts: TeacherAlert[];
  onDismiss: (id: string) => void;
  onInspectAlert: (alert: TeacherAlert) => void;
}

export function TeacherAlertToastStack({
  toasts,
  onDismiss,
  onInspectAlert,
}: TeacherAlertToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      aria-label="Thông báo đẩy giám sát phòng thi"
      className="no-print fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5"
    >
      {toasts.slice(0, 3).map((alert) => {
        const visual = getAlertVisualMeta(alert);
        const Icon = visual.Icon;
        return (
          <div
            key={alert.id}
            role="alert"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${visual.iconBoxClass}`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className={`font-bold ${visual.toneClass}`}>
                    {visual.severityLabel}
                  </span>
                  <span className="font-mono text-slate-400 tabular-nums dark:text-slate-500">
                    {new Date(alert.timestamp).toLocaleTimeString('vi-VN')}
                  </span>
                </div>

                <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-slate-50">
                  {alert.studentName} · SBD {alert.studentSbd} ({alert.roomCode})
                </p>
                <p className="mt-1 text-xs leading-snug text-slate-600 dark:text-slate-300">
                  {alert.detail}
                </p>

                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onInspectAlert(alert)}
                    className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-blue-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    <span>Xem giám sát</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(alert.id)}
                    className="cursor-pointer whitespace-nowrap text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    Bỏ qua
                  </button>
                </div>
              </div>

              <button
                type="button"
                aria-label="Đóng thông báo đẩy"
                onClick={() => onDismiss(alert.id)}
                className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
