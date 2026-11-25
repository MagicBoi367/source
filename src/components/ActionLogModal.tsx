import {
  AlertTriangle,
  BellRing,
  Bookmark,
  CheckCircle2,
  Clock,
  FileText,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Send,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ExamActionLog, ExamActionType, ExamSubmission } from '../types/exam';
import { formatDurationMMSS, formatScoreVi, getSubjectMeta } from '../utils/scoring2025';

interface ActionLogModalProps {
  submission: ExamSubmission;
  onClose: () => void;
  onViewFullSubmission?: (sub: ExamSubmission) => void;
}

type LogCategoryFilter = 'all' | 'pause' | 'alerts' | 'bookmark' | 'lifecycle';

interface ActionStyleMeta {
  label: string;
  category: Exclude<LogCategoryFilter, 'all'>;
  toneClass: string;
  iconBgClass: string;
  Icon: typeof Clock;
}

function getActionStyleMeta(type: ExamActionType): ActionStyleMeta {
  switch (type) {
    case 'paused_exam':
      return {
        label: 'Tạm dừng bài thi',
        category: 'pause',
        toneClass: 'text-amber-700 dark:text-amber-300',
        iconBgClass:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
        Icon: Pause,
      };
    case 'resumed_exam':
      return {
        label: 'Tiếp tục làm bài',
        category: 'pause',
        toneClass: 'text-blue-700 dark:text-blue-300',
        iconBgClass:
          'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300',
        Icon: Play,
      };
    case 'flagged_question':
      return {
        label: 'Đánh dấu xem lại',
        category: 'bookmark',
        toneClass: 'text-amber-700 dark:text-amber-300',
        iconBgClass:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
        Icon: Bookmark,
      };
    case 'unflagged_question':
      return {
        label: 'Bỏ đánh dấu',
        category: 'bookmark',
        toneClass: 'text-slate-700 dark:text-slate-300',
        iconBgClass:
          'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
        Icon: Bookmark,
      };
    case 'violation':
      return {
        label: 'Cảnh báo giám sát',
        category: 'alerts',
        toneClass: 'text-red-700 dark:text-red-300',
        iconBgClass:
          'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300',
        Icon: ShieldAlert,
      };
    case 'fullscreen_exited':
      return {
        label: 'Thoát toàn màn hình',
        category: 'alerts',
        toneClass: 'text-amber-700 dark:text-amber-300',
        iconBgClass:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
        Icon: Minimize2,
      };
    case 'fullscreen_entered':
      return {
        label: 'Bật toàn màn hình',
        category: 'lifecycle',
        toneClass: 'text-slate-700 dark:text-slate-300',
        iconBgClass:
          'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
        Icon: Maximize2,
      };
    case 'low_time_warning':
      return {
        label: 'Cảnh báo sắp hết giờ',
        category: 'alerts',
        toneClass: 'text-amber-700 dark:text-amber-300',
        iconBgClass:
          'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
        Icon: BellRing,
      };
    case 'sound_muted':
      return {
        label: 'Tắt âm cảnh báo',
        category: 'lifecycle',
        toneClass: 'text-slate-600 dark:text-slate-400',
        iconBgClass:
          'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
        Icon: VolumeX,
      };
    case 'sound_unmuted':
      return {
        label: 'Bật âm cảnh báo',
        category: 'lifecycle',
        toneClass: 'text-slate-700 dark:text-slate-300',
        iconBgClass:
          'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
        Icon: Volume2,
      };
    case 'started_exam':
      return {
        label: 'Bắt đầu làm bài',
        category: 'lifecycle',
        toneClass: 'text-emerald-700 dark:text-emerald-300',
        iconBgClass:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300',
        Icon: Play,
      };
    case 'network_offline':
      return {
        label: 'Mất kết nối mạng',
        category: 'alerts',
        toneClass: 'text-red-700 dark:text-red-300',
        iconBgClass:
          'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300',
        Icon: WifiOff,
      };
    case 'network_online':
      return {
        label: 'Khôi phục kết nối mạng',
        category: 'lifecycle',
        toneClass: 'text-emerald-700 dark:text-emerald-300',
        iconBgClass:
          'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300',
        Icon: Wifi,
      };
    case 'submitted_exam':
      return {
        label: 'Nộp bài thi',
        category: 'lifecycle',
        toneClass: 'text-blue-700 dark:text-blue-300',
        iconBgClass:
          'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300',
        Icon: Send,
      };
  }
}

export function ActionLogModal({
  submission,
  onClose,
  onViewFullSubmission,
}: ActionLogModalProps) {
  const [filter, setFilter] = useState<LogCategoryFilter>('all');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const logs: ExamActionLog[] = useMemo(
    () =>
      [...(submission.actionLogs ?? [])].sort(
        (a, b) => a.elapsedSeconds - b.elapsedSeconds || a.timestamp.localeCompare(b.timestamp),
      ),
    [submission.actionLogs],
  );

  const summary = useMemo(() => {
    const pauseCount = logs.filter((l) => l.type === 'paused_exam').length;
    const flagCount = logs.filter(
      (l) => l.type === 'flagged_question' || l.type === 'unflagged_question',
    ).length;
    const alertCount = logs.filter((l) => getActionStyleMeta(l.type).category === 'alerts').length;
    const lifecycleCount = logs.filter(
      (l) => getActionStyleMeta(l.type).category === 'lifecycle',
    ).length;
    const pauseAndResumeCount = logs.filter(
      (l) => getActionStyleMeta(l.type).category === 'pause',
    ).length;

    return {
      total: logs.length,
      pauseCount,
      flagCount,
      alertCount,
      lifecycleCount,
      pauseAndResumeCount,
      violationCount: submission.violations.length,
    };
  }, [logs, submission.violations.length]);

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter((l) => getActionStyleMeta(l.type).category === filter);
  }, [filter, logs]);

  const subjectName = getSubjectMeta(submission.subject).name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-log-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 dark:bg-slate-950/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400">
              {summary.violationCount === 0 ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <span>Nhật ký thao tác &amp; Giám sát tính liêm chính phòng thi</span>
            </div>
            <h2
              id="action-log-modal-title"
              className="mt-1 truncate font-display text-lg font-bold text-slate-900 dark:text-slate-50"
            >
              {submission.studentName} · SBD {submission.studentSbd}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Lớp {submission.studentClass} · {subjectName} · Mã đề{' '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {submission.variantCode}
              </span>{' '}
              · Điểm:{' '}
              <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                {formatScoreVi(submission.totalScore)}
              </span>{' '}
              · Thời gian làm:{' '}
              <span className="font-mono tabular-nums">
                {formatDurationMMSS(submission.elapsedSeconds)}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng nhật ký giám sát"
            className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Integrity Metrics Strip */}
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 bg-slate-50 sm:grid-cols-4 sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Tổng sự kiện ghi nhận
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums dark:text-slate-100">
              {summary.total}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Số lần tạm dừng
            </p>
            <p
              className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${
                summary.pauseCount > 0
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {summary.pauseCount} lần
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Lượt đánh dấu câu hỏi
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums dark:text-slate-100">
              {summary.flagCount}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Cảnh báo giám sát
            </p>
            <p
              className={`mt-0.5 inline-flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums ${
                summary.violationCount > 0
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {summary.violationCount === 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>0 (Hợp lệ)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  <span>{summary.violationCount} cảnh báo</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
          {(
            [
              { id: 'all', label: `Tất cả (${summary.total})` },
              { id: 'pause', label: `Tạm dừng / Tiếp tục (${summary.pauseAndResumeCount})` },
              { id: 'alerts', label: `Cảnh báo & Toàn màn hình (${summary.alertCount})` },
              { id: 'bookmark', label: `Đánh dấu câu (${summary.flagCount})` },
              { id: 'lifecycle', label: `Phiên thi (${summary.lifecycleCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === tab.id
                  ? 'bg-blue-700 text-white dark:bg-blue-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chronological Audit Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {logs.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Bài thi chưa có nhật ký thao tác chi tiết
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Bài nộp này được ghi nhận trước khi kích hoạt hệ thống nhật ký thao tác chi tiết,
                hoặc chưa phát sinh sự kiện bổ sung ngoài thời điểm nộp bài lúc{' '}
                {new Date(submission.submittedAt).toLocaleString('vi-VN')}.
              </p>
              {submission.violations.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-semibold">
                    Cảnh báo giám sát đã ghi nhận ({submission.violations.length}):
                  </p>
                  <ul className="mt-1.5 space-y-1 font-mono tabular-nums">
                    {submission.violations.map((v, i) => (
                      <li key={i}>
                        [{new Date(v.timestamp).toLocaleTimeString('vi-VN')}] {v.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              Không có sự kiện nào thuộc nhóm bộ lọc này.
            </div>
          ) : (
            <ol className="space-y-3">
              {filteredLogs.map((log, index) => {
                const meta = getActionStyleMeta(log.type);
                const Icon = meta.Icon;
                const isWarning = log.metadata?.severity === 'warning';
                return (
                  <li
                    key={log.id}
                    className={`flex items-start gap-3.5 rounded-lg border px-4 py-3 text-xs ${
                      isWarning
                        ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/25'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.iconBgClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-semibold ${meta.toneClass}`}>{meta.label}</span>
                          {log.metadata?.questionLabel && (
                            <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              · {log.metadata.questionLabel}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                          <span>+{formatDurationMMSS(log.elapsedSeconds)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString('vi-VN')}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400 dark:text-slate-500">#{index + 1}</span>
                        </div>
                      </div>

                      <p className="mt-1 text-slate-700 dark:text-slate-300">{log.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mốc <span className="font-mono font-semibold tabular-nums">+MM:SS</span> tính theo
            thời gian đã trôi qua của bài thi.
          </p>
          <div className="flex items-center gap-2">
            {onViewFullSubmission && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewFullSubmission(submission);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Xem chi tiết bài làm</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
