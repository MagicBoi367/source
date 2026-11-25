import {
  AlertTriangle,
  BellRing,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Keyboard,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AlertSeverity,
  CandidateAnswers,
  Exam,
  ExamActionLog,
  ExamActionType,
  ExamSubmission,
  ExamVariant,
  ViolationLog,
} from '../types/exam';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import {
  COGNITIVE_LEVEL_LABELS,
  formatDurationMMSS,
  getExamDurationMinutes,
  gradeExamSubmission,
  OPTION_LETTERS,
} from '../utils/scoring2025';
import { pushTeacherAlert } from '../utils/teacherAlerts';

interface ExamRoomProps {
  exam: Exam;
  variant: ExamVariant;
  candidate: {
    studentName: string;
    studentSbd: string;
    studentClass: string;
  };
  isDark: boolean;
  onToggleTheme: () => void;
  onSubmitComplete: (submission: ExamSubmission) => void;
  onAbortExit: () => void;
}

const DRAFT_STORAGE_PREFIX = 'kythi2025_draft_';
const LOW_TIME_SOUND_STORAGE_KEY = 'kythi2025_low_time_sound_v1';

interface StoredExamDraft {
  answers: CandidateAnswers;
  startedAt: string;
  deadlineAtMs: number;
  pausedRemainingSeconds?: number | null;
  violations?: ViolationLog[];
  actionLogs?: ExamActionLog[];
}

interface CircularProgressRingProps {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  tone?: 'default' | 'complete' | 'warning';
  showPercent?: boolean;
}

function CircularProgressRing({
  completed,
  total,
  size = 68,
  strokeWidth = 6,
  tone = 'default',
  showPercent = true,
}: CircularProgressRingProps) {
  const safeTotal = Math.max(0, total);
  const clampedCompleted = Math.min(safeTotal, Math.max(0, completed));
  const percent = safeTotal > 0 ? Math.round((clampedCompleted / safeTotal) * 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const arcToneClass =
    tone === 'complete'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-blue-700 dark:text-blue-500';

  return (
    <div
      role="progressbar"
      aria-valuenow={clampedCompleted}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-label={`Tiến độ làm bài: đã hoàn thành ${clampedCompleted} trên ${safeTotal} câu (${percent}%)`}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`${arcToneClass} transition-[stroke-dashoffset,color] duration-300 ease-out motion-reduce:transition-none`}
        />
      </svg>
      {showPercent && (
        <span className="absolute font-mono text-xs font-bold text-slate-900 tabular-nums dark:text-slate-100">
          {percent}%
        </span>
      )}
    </div>
  );
}

export function ExamRoom({
  exam,
  variant,
  candidate,
  isDark,
  onToggleTheme,
  onSubmitComplete,
  onAbortExit,
}: ExamRoomProps) {
  const draftKey = `${DRAFT_STORAGE_PREFIX}${exam.id}_${candidate.studentSbd}_${variant.variantCode}`;
  const durationMinutes = getExamDurationMinutes(exam);
  const totalDurationSeconds = durationMinutes * 60;
  const autoSubmitEnabled = exam.autoSubmitOnTimeout !== false;
  const warningThresholdSeconds = Math.max(30, (exam.warningMinutes ?? 5) * 60);

  const [initialSession] = useState<StoredExamDraft>(() => {
    const nowMs = Date.now();
    const startedIso = new Date(nowMs).toISOString();
    const defaultDraft: StoredExamDraft = {
      answers: { part1: {}, part2: {}, part3: {}, flagged: {} },
      startedAt: startedIso,
      deadlineAtMs: nowMs + totalDurationSeconds * 1000,
      violations: [],
      actionLogs: [
        {
          id: `act_start_${nowMs}`,
          timestamp: startedIso,
          elapsedSeconds: 0,
          type: 'started_exam',
          detail: `Bắt đầu làm bài thi (Mã đề ${variant.variantCode}, thời lượng ${durationMinutes} phút)`,
          metadata: { severity: 'info' },
        },
      ],
    };

    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<StoredExamDraft> & Partial<CandidateAnswers>;
        if (parsed && parsed.answers && typeof parsed.deadlineAtMs === 'number') {
          return {
            answers: {
              part1: parsed.answers.part1 ?? {},
              part2: parsed.answers.part2 ?? {},
              part3: parsed.answers.part3 ?? {},
              flagged: parsed.answers.flagged ?? {},
            },
            startedAt: parsed.startedAt ?? defaultDraft.startedAt,
            deadlineAtMs: parsed.deadlineAtMs,
            pausedRemainingSeconds:
              typeof parsed.pausedRemainingSeconds === 'number'
                ? parsed.pausedRemainingSeconds
                : null,
            violations: Array.isArray(parsed.violations) ? parsed.violations : [],
            actionLogs: Array.isArray(parsed.actionLogs)
              ? parsed.actionLogs
              : defaultDraft.actionLogs,
          };
        }
        if (parsed && parsed.part1) {
          return {
            ...defaultDraft,
            answers: {
              part1: parsed.part1 ?? {},
              part2: parsed.part2 ?? {},
              part3: parsed.part3 ?? {},
              flagged: parsed.flagged ?? {},
            },
          };
        }
      }
    } catch {
      // Ignore draft parse error
    }
    return defaultDraft;
  });

  const [answers, setAnswers] = useState<CandidateAnswers>(initialSession.answers);
  const [startedAt] = useState(initialSession.startedAt);
  const [deadlineAtMs, setDeadlineAtMs] = useState(initialSession.deadlineAtMs);
  const [pausedRemainingSeconds, setPausedRemainingSeconds] = useState<number | null>(
    initialSession.pausedRemainingSeconds ?? null,
  );
  const isPaused = pausedRemainingSeconds !== null;
  const [secondsLeft, setSecondsLeft] = useState(() =>
    initialSession.pausedRemainingSeconds !== undefined &&
    initialSession.pausedRemainingSeconds !== null
      ? Math.max(0, initialSession.pausedRemainingSeconds)
      : Math.max(0, Math.ceil((initialSession.deadlineAtMs - Date.now()) / 1000)),
  );
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [violations, setViolations] = useState<ViolationLog[]>(
    initialSession.violations ?? [],
  );
  const [actionLogs, setActionLogs] = useState<ExamActionLog[]>(
    initialSession.actionLogs ?? [],
  );
  const [proctoringBanner, setProctoringBanner] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenNotice, setFullscreenNotice] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [lastSavedTime, setLastSavedTime] = useState<string>(() =>
    new Date().toLocaleTimeString('vi-VN'),
  );
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [activePartFilter, setActivePartFilter] = useState<'all' | 'p1' | 'p2' | 'p3' | 'flagged'>('all');
  const [activeBookmarkId, setActiveBookmarkId] = useState<string | null>(null);
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null);
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(
    () => variant.part1[0]?.id ?? variant.part2[0]?.id ?? variant.part3[0]?.id ?? null,
  );
  const [lowTimeSoundEnabled, setLowTimeSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(LOW_TIME_SOUND_STORAGE_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [lowTimeBannerDismissed, setLowTimeBannerDismissed] = useState(false);
  const [lowTimeSoundBlocked, setLowTimeSoundBlocked] = useState(false);

  const submittedRef = useRef(false);
  const highlightTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lowTimeSoundTriggeredRef = useRef(false);
  const pendingLowTimeRetryRef = useRef(false);
  const lastFsStateRef = useRef<boolean | null>(null);
  const latestAnswersRef = useRef(answers);
  const latestViolationsRef = useRef(violations);
  const latestActionLogsRef = useRef(actionLogs);

  useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    latestViolationsRef.current = violations;
  }, [violations]);

  useEffect(() => {
    latestActionLogsRef.current = actionLogs;
  }, [actionLogs]);

  const questionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    variant.part1.forEach((q, idx) => map.set(q.id, `Phần I · Câu ${idx + 1}`));
    variant.part2.forEach((q, idx) => map.set(q.id, `Phần II · Câu ${idx + 1}`));
    variant.part3.forEach((q, idx) => map.set(q.id, `Phần III · Câu ${idx + 1}`));
    return map;
  }, [variant.part1, variant.part2, variant.part3]);

  const computeElapsedSeconds = useCallback(() => {
    const rem = isPaused
      ? Math.max(0, pausedRemainingSeconds ?? secondsLeft)
      : Math.max(0, Math.ceil((deadlineAtMs - Date.now()) / 1000));
    return Math.max(0, totalDurationSeconds - rem);
  }, [deadlineAtMs, isPaused, pausedRemainingSeconds, secondsLeft, totalDurationSeconds]);

  const logAction = useCallback(
    (
      type: ExamActionType,
      detail: string,
      metadata?: ExamActionLog['metadata'],
      overrideElapsedSeconds?: number,
    ): ExamActionLog[] => {
      const entry: ExamActionLog = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        elapsedSeconds: overrideElapsedSeconds ?? computeElapsedSeconds(),
        type,
        detail,
        metadata,
      };
      const next = [...latestActionLogsRef.current, entry];
      latestActionLogsRef.current = next;
      setActionLogs(next);
      return next;
    },
    [computeElapsedSeconds],
  );

  // Persist draft (answers + deadline + pause state + audit trail) automatically
  useEffect(() => {
    try {
      const payload: StoredExamDraft = {
        answers,
        startedAt,
        deadlineAtMs,
        pausedRemainingSeconds,
        violations,
        actionLogs,
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
      setLastSavedTime(new Date().toLocaleTimeString('vi-VN'));
    } catch {
      // Ignore quota
    }
  }, [actionLogs, answers, deadlineAtMs, draftKey, pausedRemainingSeconds, startedAt, violations]);

  const finalizeAndSubmit = useCallback(
    (reason: 'manual' | 'timeout' = 'manual') => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // Ignore
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      const remaining = isPaused
        ? Math.max(0, pausedRemainingSeconds ?? secondsLeft)
        : Math.max(0, Math.ceil((deadlineAtMs - Date.now()) / 1000));
      const elapsed =
        reason === 'timeout'
          ? totalDurationSeconds
          : Math.max(1, totalDurationSeconds - remaining);

      const finalActionLogs = logAction(
        'submitted_exam',
        reason === 'timeout'
          ? 'Hệ thống tự động khóa và nộp bài khi hết giờ'
          : 'Thí sinh xác nhận nộp bài thi',
        { severity: reason === 'timeout' ? 'warning' : 'info' },
        elapsed,
      );

      const submission = gradeExamSubmission(exam, variant, latestAnswersRef.current, {
        studentName: candidate.studentName,
        studentSbd: candidate.studentSbd,
        studentClass: candidate.studentClass,
        startedAt,
        submittedAt: new Date().toISOString(),
        elapsedSeconds: elapsed,
        submissionReason: reason,
        violations: latestViolationsRef.current,
        actionLogs: finalActionLogs,
      });
      onSubmitComplete(submission);
    },
    [
      candidate.studentClass,
      candidate.studentName,
      candidate.studentSbd,
      deadlineAtMs,
      draftKey,
      exam,
      isPaused,
      logAction,
      onSubmitComplete,
      pausedRemainingSeconds,
      secondsLeft,
      startedAt,
      totalDurationSeconds,
      variant,
    ],
  );

  const notifyTeacher = useCallback(
    (
      actionType: ExamActionType,
      title: string,
      detail: string,
      severity: AlertSeverity,
    ) => {
      pushTeacherAlert({
        studentName: candidate.studentName,
        studentSbd: candidate.studentSbd,
        studentClass: candidate.studentClass,
        examId: exam.id,
        examTitle: exam.title,
        roomCode: exam.roomCode,
        variantCode: variant.variantCode,
        actionType,
        title,
        detail,
        severity,
      });
    },
    [
      candidate.studentClass,
      candidate.studentName,
      candidate.studentSbd,
      exam.id,
      exam.roomCode,
      exam.title,
      variant.variantCode,
    ],
  );

  const togglePause = useCallback(() => {
    if (submittedRef.current || isTimedOut) return;
    if (isPaused) {
      const rem = Math.max(1, pausedRemainingSeconds ?? secondsLeft);
      const nextDeadline = Date.now() + rem * 1000;
      setDeadlineAtMs(nextDeadline);
      setPausedRemainingSeconds(null);
      setSecondsLeft(rem);
      logAction(
        'resumed_exam',
        `Tiếp tục làm bài (thời gian còn lại ${formatDurationMMSS(rem)})`,
        { severity: 'info' },
        Math.max(0, totalDurationSeconds - rem),
      );
    } else {
      const rem = Math.max(0, Math.ceil((deadlineAtMs - Date.now()) / 1000));
      setPausedRemainingSeconds(rem);
      setSecondsLeft(rem);
      const pauseDetail = `Tạm dừng làm bài (thời gian còn lại ${formatDurationMMSS(rem)})`;
      logAction(
        'paused_exam',
        pauseDetail,
        { severity: 'warning' },
        Math.max(0, totalDurationSeconds - rem),
      );
      notifyTeacher('paused_exam', 'Tạm dừng bài thi', pauseDetail, 'warning');
    }
  }, [
    deadlineAtMs,
    isPaused,
    isTimedOut,
    logAction,
    notifyTeacher,
    pausedRemainingSeconds,
    secondsLeft,
    totalDurationSeconds,
  ]);

  // Wall-clock deadline timer (frozen while paused, resilient against background tab throttling)
  useEffect(() => {
    if (isPaused) return;

    const syncRemaining = () => {
      const remaining = Math.max(0, Math.ceil((deadlineAtMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    syncRemaining();
    const timer = window.setInterval(syncRemaining, 500);
    document.addEventListener('visibilitychange', syncRemaining);
    window.addEventListener('focus', syncRemaining);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncRemaining);
      window.removeEventListener('focus', syncRemaining);
    };
  }, [deadlineAtMs, isPaused]);

  // Persist optional low-time sound preference
  useEffect(() => {
    try {
      localStorage.setItem(LOW_TIME_SOUND_STORAGE_KEY, String(lowTimeSoundEnabled));
    } catch {
      // Ignore storage failure
    }
  }, [lowTimeSoundEnabled]);

  const getOrCreateAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      try {
        audioCtxRef.current = new AudioCtx();
      } catch {
        return null;
      }
    }
    return audioCtxRef.current;
  }, []);

  const playLowTimeChime = useCallback(async (): Promise<boolean> => {
    const ctx = getOrCreateAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    if (ctx.state !== 'running') return false;

    try {
      const now = ctx.currentTime;
      // Gentle, clear 3-note exam alert chime (A5 -> C6 -> A5)
      const notes = [
        { freq: 880, offset: 0, duration: 0.18 },
        { freq: 1046.5, offset: 0.2, duration: 0.2 },
        { freq: 880, offset: 0.44, duration: 0.34 },
      ];

      notes.forEach(({ freq, offset, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + offset);

        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.14, now + offset + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + duration + 0.02);
      });

      setLowTimeSoundBlocked(false);
      pendingLowTimeRetryRef.current = false;
      return true;
    } catch {
      return false;
    }
  }, [getOrCreateAudioContext]);

  // Clean up AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Unlock AudioContext on first user gesture so scheduled < 5 min chime isn't blocked by browser autoplay policy
  useEffect(() => {
    if (!lowTimeSoundEnabled) return;

    const handleUserGesture = () => {
      const ctx = getOrCreateAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx
          .resume()
          .then(() => {
            if (pendingLowTimeRetryRef.current && lowTimeSoundEnabled) {
              void playLowTimeChime();
            }
          })
          .catch(() => {});
      } else if (pendingLowTimeRetryRef.current && ctx.state === 'running') {
        void playLowTimeChime();
      }
    };

    window.addEventListener('pointerdown', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, [getOrCreateAudioContext, lowTimeSoundEnabled, playLowTimeChime]);

  const lowTimeSoundThresholdSeconds = Math.min(300, warningThresholdSeconds);

  // Trigger optional Low Time Warning sound notification once when remaining time < 5 minutes
  useEffect(() => {
    if (submittedRef.current || secondsLeft <= 0) return;
    if (secondsLeft >= lowTimeSoundThresholdSeconds) return;
    if (lowTimeSoundTriggeredRef.current) return;

    lowTimeSoundTriggeredRef.current = true;
    logAction(
      'low_time_warning',
      `Kích hoạt cảnh báo sắp hết giờ (còn ${formatDurationMMSS(secondsLeft)})`,
      { severity: 'warning' },
    );

    if (!lowTimeSoundEnabled) return;

    void playLowTimeChime().then((played) => {
      if (!played) {
        pendingLowTimeRetryRef.current = true;
        setLowTimeSoundBlocked(true);
      }
    });
  }, [
    logAction,
    lowTimeSoundEnabled,
    lowTimeSoundThresholdSeconds,
    playLowTimeChime,
    secondsLeft,
  ]);

  const toggleLowTimeSound = useCallback(() => {
    const next = !lowTimeSoundEnabled;
    setLowTimeSoundEnabled(next);
    logAction(
      next ? 'sound_unmuted' : 'sound_muted',
      next ? 'Bật âm thanh cảnh báo sắp hết giờ' : 'Tắt âm thanh cảnh báo sắp hết giờ',
      { severity: 'info' },
    );
    if (next) {
      void playLowTimeChime();
    } else {
      pendingLowTimeRetryRef.current = false;
      setLowTimeSoundBlocked(false);
    }
  }, [logAction, lowTimeSoundEnabled, playLowTimeChime]);

  // Automatic lock & submit when timer expires
  useEffect(() => {
    if (secondsLeft > 0 || submittedRef.current) return;

    setIsTimedOut(true);
    setConfirmSubmitOpen(false);

    if (!autoSubmitEnabled) return;

    const submitDelay = window.setTimeout(() => {
      finalizeAndSubmit('timeout');
    }, 1200);

    return () => window.clearTimeout(submitDelay);
  }, [secondsLeft, autoSubmitEnabled, finalizeAndSubmit]);

  // Real browser proctoring listeners per TT 09/2021
  useEffect(() => {
    if (!exam.strictProctoring || isPaused) return;

    const recordViolation = (
      type: ViolationLog['type'],
      alertTitle: string,
      detail: string,
      severity: AlertSeverity = 'critical',
    ) => {
      const entry: ViolationLog = {
        timestamp: new Date().toISOString(),
        type,
        detail,
      };
      setViolations((prev) => [...prev, entry]);
      setProctoringBanner(detail);
      logAction('violation', detail, { severity: 'warning' });
      notifyTeacher('violation', alertTitle, detail, severity);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        recordViolation(
          'tab_switch',
          'Chuyển tab trình duyệt',
          'Phát hiện rời thẻ trình duyệt phòng thi (visibilitychange)',
          'critical',
        );
      }
    };

    const handleBlur = () => {
      recordViolation(
        'window_blur',
        'Rời cửa sổ phòng thi',
        'Cửa sổ phòng thi mất tiêu điểm thao tác (window blur)',
        'warning',
      );
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      recordViolation(
        'copy_attempt',
        'Cố gắng sao chép đề thi',
        'Cố gắng sao chép nội dung đề thi đã bị hệ thống ngăn chặn',
        'critical',
      );
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopy);
    };
  }, [exam.strictProctoring, isPaused, logAction, notifyTeacher]);

  // Network connectivity loss / recovery monitoring
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      if (submittedRef.current) return;
      const detail = 'Thí sinh bị mất kết nối mạng trong khi làm bài';
      setViolations((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          type: 'network_offline',
          detail,
        },
      ]);
      logAction('network_offline', detail, { severity: 'warning' });
      notifyTeacher('network_offline', 'Mất kết nối mạng', detail, 'critical');
    };

    const handleOnline = () => {
      setIsOffline(false);
      if (submittedRef.current) return;
      logAction('network_online', 'Kết nối mạng của thí sinh đã được khôi phục', {
        severity: 'info',
      });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [logAction, notifyTeacher]);

  useEffect(() => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
    };
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(active);
      if (active) {
        setFullscreenNotice(null);
      }
      if (lastFsStateRef.current === null) {
        lastFsStateRef.current = active;
        return;
      }
      if (active !== lastFsStateRef.current) {
        lastFsStateRef.current = active;
        if (!submittedRef.current) {
          const detail = active
            ? 'Bật chế độ toàn màn hình tập trung'
            : 'Thoát khỏi chế độ toàn màn hình';
          logAction(
            active ? 'fullscreen_entered' : 'fullscreen_exited',
            detail,
            { severity: active ? 'info' : 'warning' },
          );
          if (!active) {
            notifyTeacher(
              'fullscreen_exited',
              'Thoát chế độ toàn màn hình',
              detail,
              'warning',
            );
          }
        }
      }
    };
    onFsChange();
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [logAction, notifyTeacher]);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const rootEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const currentlyFullscreen = Boolean(
      document.fullscreenElement || doc.webkitFullscreenElement,
    );

    try {
      if (!currentlyFullscreen) {
        if (rootEl.requestFullscreen) {
          await rootEl.requestFullscreen();
        } else if (rootEl.webkitRequestFullscreen) {
          await rootEl.webkitRequestFullscreen();
        } else {
          setFullscreenNotice(
            'Trình duyệt hiện tại không hỗ trợ API toàn màn hình. Bạn có thể nhấn F11 để tập trung làm bài.',
          );
          return;
        }
        setFullscreenNotice(null);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      }
    } catch {
      setFullscreenNotice(
        'Không thể bật toàn màn hình tự động (có thể do trình duyệt hoặc khung nhúng hạn chế). Hãy nhấn F11 hoặc cho phép toàn màn hình.',
      );
    }
  }, []);

  // Answer update handlers (locked when paused or auto-submitting on timeout)
  const selectPart1Option = useCallback(
    (qId: string, optionIndex: number) => {
      if (isPaused || (isTimedOut && autoSubmitEnabled)) return;
      setFocusedQuestionId(qId);
      setAnswers((prev) => ({
        ...prev,
        part1: { ...prev.part1, [qId]: optionIndex },
      }));
    },
    [autoSubmitEnabled, isPaused, isTimedOut],
  );

  const selectPart2Statement = useCallback(
    (qId: string, stmtId: 'a' | 'b' | 'c' | 'd', value: boolean) => {
      if (isPaused || (isTimedOut && autoSubmitEnabled)) return;
      setFocusedQuestionId(qId);
      setAnswers((prev) => ({
        ...prev,
        part2: {
          ...prev.part2,
          [qId]: { ...(prev.part2[qId] ?? {}), [stmtId]: value },
        },
      }));
    },
    [autoSubmitEnabled, isPaused, isTimedOut],
  );

  const togglePart2Statement = useCallback(
    (qId: string, stmtId: 'a' | 'b' | 'c' | 'd') => {
      if (isPaused || (isTimedOut && autoSubmitEnabled)) return;
      setFocusedQuestionId(qId);
      setAnswers((prev) => {
        const current = prev.part2[qId]?.[stmtId];
        const nextVal = current === undefined ? true : !current;
        return {
          ...prev,
          part2: {
            ...prev.part2,
            [qId]: { ...(prev.part2[qId] ?? {}), [stmtId]: nextVal },
          },
        };
      });
    },
    [autoSubmitEnabled, isPaused, isTimedOut],
  );

  const setPart3Input = (qId: string, rawValue: string) => {
    if (isPaused || (isTimedOut && autoSubmitEnabled)) return;
    setFocusedQuestionId(qId);
    // Allow max 4 chars matching MOET 2025 4-column short-answer OMR grid
    const sanitized = rawValue.replace(/[^0-9.,-]/g, '').slice(0, 4);
    setAnswers((prev) => ({
      ...prev,
      part3: { ...prev.part3, [qId]: sanitized },
    }));
  };

  const toggleFlag = useCallback(
    (qId: string) => {
      if (isPaused || (isTimedOut && autoSubmitEnabled)) return;
      const nextFlagged = !answers.flagged?.[qId];
      const qLabel = questionLabelMap.get(qId) ?? qId;
      setAnswers((prev) => ({
        ...prev,
        flagged: { ...(prev.flagged ?? {}), [qId]: nextFlagged },
      }));
      logAction(
        nextFlagged ? 'flagged_question' : 'unflagged_question',
        nextFlagged
          ? `Đánh dấu câu hỏi cần xem lại (${qLabel})`
          : `Bỏ đánh dấu xem lại (${qLabel})`,
        { questionLabel: qLabel, severity: 'info' },
      );
      if (nextFlagged) {
        setActiveBookmarkId(qId);
      } else if (activeBookmarkId === qId) {
        setActiveBookmarkId(null);
      }
    },
    [
      activeBookmarkId,
      answers.flagged,
      autoSubmitEnabled,
      isPaused,
      isTimedOut,
      logAction,
      questionLabelMap,
    ],
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const scrollToQuestion = useCallback((qId: string) => {
    const el = document.getElementById(`question-card-${qId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const jumpToQuestion = useCallback(
    (qId: string, part?: 'p1' | 'p2' | 'p3') => {
      const isCurrentlyFlagged = Boolean(answers.flagged?.[qId]);
      if (activePartFilter === 'flagged' && !isCurrentlyFlagged) {
        setActivePartFilter('all');
      } else if (
        activePartFilter !== 'all' &&
        activePartFilter !== 'flagged' &&
        part &&
        activePartFilter !== part
      ) {
        setActivePartFilter('all');
      }

      if (isCurrentlyFlagged) {
        setActiveBookmarkId(qId);
      }
      setFocusedQuestionId(qId);
      setHighlightedQuestionId(qId);
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedQuestionId(null);
      }, 1800);

      window.setTimeout(() => scrollToQuestion(qId), 40);
    },
    [activePartFilter, answers.flagged, scrollToQuestion],
  );

  const flaggedItems = useMemo(() => {
    const items: Array<{
      id: string;
      part: 'p1' | 'p2' | 'p3';
      partLabel: string;
      numberInPart: number;
      prompt: string;
      isAnswered: boolean;
      answerSummary: string;
    }> = [];

    variant.part1.forEach((q, idx) => {
      if (!answers.flagged?.[q.id]) return;
      const selected = answers.part1[q.id];
      const isAnswered = selected !== undefined;
      items.push({
        id: q.id,
        part: 'p1',
        partLabel: 'Phần I',
        numberInPart: idx + 1,
        prompt: q.prompt,
        isAnswered,
        answerSummary: isAnswered ? `Đã chọn ${OPTION_LETTERS[selected]}` : 'Chưa trả lời',
      });
    });

    variant.part2.forEach((q, idx) => {
      if (!answers.flagged?.[q.id]) return;
      const st = answers.part2[q.id] ?? {};
      const count = ['a', 'b', 'c', 'd'].filter(
        (k) => st[k as 'a' | 'b' | 'c' | 'd'] !== undefined,
      ).length;
      items.push({
        id: q.id,
        part: 'p2',
        partLabel: 'Phần II',
        numberInPart: idx + 1,
        prompt: q.prompt,
        isAnswered: count === 4,
        answerSummary: count === 0 ? 'Chưa trả lời' : `${count}/4 ý`,
      });
    });

    variant.part3.forEach((q, idx) => {
      if (!answers.flagged?.[q.id]) return;
      const val = (answers.part3[q.id] ?? '').trim();
      items.push({
        id: q.id,
        part: 'p3',
        partLabel: 'Phần III',
        numberInPart: idx + 1,
        prompt: q.prompt,
        isAnswered: val.length > 0,
        answerSummary: val.length > 0 ? `Đáp án: ${val}` : 'Chưa trả lời',
      });
    });

    return items;
  }, [answers.flagged, answers.part1, answers.part2, answers.part3, variant]);

  const activeBookmarkIndex = useMemo(() => {
    if (!activeBookmarkId) return -1;
    return flaggedItems.findIndex((item) => item.id === activeBookmarkId);
  }, [activeBookmarkId, flaggedItems]);

  const stepBookmark = useCallback(
    (direction: -1 | 1) => {
      if (flaggedItems.length === 0) return;
      const currentIdx = activeBookmarkIndex;
      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = direction === 1 ? 0 : flaggedItems.length - 1;
      } else {
        nextIdx = (currentIdx + direction + flaggedItems.length) % flaggedItems.length;
      }
      const target = flaggedItems[nextIdx];
      setActiveBookmarkId(target.id);
      jumpToQuestion(target.id, target.part);
    },
    [activeBookmarkIndex, flaggedItems, jumpToQuestion],
  );

  const stats = useMemo(() => {
    const p1Answered = variant.part1.filter(
      (q) => answers.part1[q.id] !== undefined,
    ).length;

    const p2Answered = variant.part2.filter((q) => {
      const st = answers.part2[q.id];
      return st && ['a', 'b', 'c', 'd'].every((k) => st[k as 'a' | 'b' | 'c' | 'd'] !== undefined);
    }).length;

    const p2Partial = variant.part2.filter((q) => {
      const st = answers.part2[q.id];
      if (!st) return false;
      const count = ['a', 'b', 'c', 'd'].filter(
        (k) => st[k as 'a' | 'b' | 'c' | 'd'] !== undefined,
      ).length;
      return count > 0 && count < 4;
    }).length;

    const p3Answered = variant.part3.filter(
      (q) => (answers.part3[q.id] ?? '').trim().length > 0,
    ).length;

    const totalQuestions =
      variant.part1.length + variant.part2.length + variant.part3.length;
    const totalCompleted = p1Answered + p2Answered + p3Answered;
    const flaggedCount = flaggedItems.length;

    return {
      p1Answered,
      p2Answered,
      p2Partial,
      p3Answered,
      totalQuestions,
      totalCompleted,
      flaggedCount,
    };
  }, [answers.part1, answers.part2, answers.part3, flaggedItems.length, variant]);

  const isLowTime = secondsLeft <= warningThresholdSeconds;
  const remainingQuestions = Math.max(0, stats.totalQuestions - stats.totalCompleted);
  const completionPercent =
    stats.totalQuestions > 0
      ? Math.round((stats.totalCompleted / stats.totalQuestions) * 100)
      : 0;
  const progressTone: 'default' | 'complete' | 'warning' =
    stats.totalQuestions > 0 && remainingQuestions === 0
      ? 'complete'
      : isLowTime && remainingQuestions > 0
        ? 'warning'
        : 'default';

  const pacingText = useMemo(() => {
    if (stats.totalQuestions === 0) return 'Chưa có câu hỏi';
    if (remainingQuestions === 0) return 'Đã hoàn thành tất cả câu hỏi';
    if (secondsLeft <= 0) return `Còn ${remainingQuestions} câu chưa hoàn tất`;
    const avgSec = Math.round(secondsLeft / remainingQuestions);
    const mins = Math.floor(avgSec / 60);
    const secs = avgSec % 60;
    const formattedPace =
      mins > 0 ? `${mins}p${secs > 0 ? ` ${secs}s` : ''}` : `${secs}s`;
    return `Còn ${remainingQuestions} câu · ~${formattedPace}/câu`;
  }, [remainingQuestions, secondsLeft, stats.totalQuestions]);

  const visibleQuestions = useMemo(() => {
    const list: Array<{ id: string; part: 'p1' | 'p2' | 'p3' }> = [];
    if (activePartFilter === 'all' || activePartFilter === 'p1' || activePartFilter === 'flagged') {
      variant.part1.forEach((q) => {
        if (activePartFilter !== 'flagged' || answers.flagged?.[q.id]) {
          list.push({ id: q.id, part: 'p1' });
        }
      });
    }
    if (activePartFilter === 'all' || activePartFilter === 'p2' || activePartFilter === 'flagged') {
      variant.part2.forEach((q) => {
        if (activePartFilter !== 'flagged' || answers.flagged?.[q.id]) {
          list.push({ id: q.id, part: 'p2' });
        }
      });
    }
    if (activePartFilter === 'all' || activePartFilter === 'p3' || activePartFilter === 'flagged') {
      variant.part3.forEach((q) => {
        if (activePartFilter !== 'flagged' || answers.flagged?.[q.id]) {
          list.push({ id: q.id, part: 'p3' });
        }
      });
    }
    return list;
  }, [activePartFilter, answers.flagged, variant]);

  useEffect(() => {
    if (visibleQuestions.length === 0) return;
    if (!focusedQuestionId || !visibleQuestions.some((item) => item.id === focusedQuestionId)) {
      setFocusedQuestionId(visibleQuestions[0].id);
    }
  }, [focusedQuestionId, visibleQuestions]);

  // Global ExamRoom keyboard shortcuts for navigation & fast answering
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (isEditable && target) {
          target.blur();
          return;
        }
        if (shortcutsOpen) {
          e.preventDefault();
          setShortcutsOpen(false);
          return;
        }
        if (confirmSubmitOpen) {
          e.preventDefault();
          setConfirmSubmitOpen(false);
          return;
        }
        return;
      }

      if (isEditable) return;

      // Ctrl/Cmd + Enter opens submit confirmation modal
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!isTimedOut && !shortcutsOpen) {
          e.preventDefault();
          setConfirmSubmitOpen(true);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (shortcutsOpen || confirmSubmitOpen || (isTimedOut && autoSubmitEnabled)) return;

      // Space toggles Pause / Resume
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLButtonElement) {
          document.activeElement.blur();
        }
        togglePause();
        return;
      }

      if (isPaused) return;

      const lowerKey = e.key.toLowerCase();

      if (e.key === 'ArrowDown' || lowerKey === 'j') {
        if (visibleQuestions.length === 0) return;
        e.preventDefault();
        const currIdx = visibleQuestions.findIndex((q) => q.id === focusedQuestionId);
        const nextIdx = currIdx === -1 ? 0 : (currIdx + 1) % visibleQuestions.length;
        jumpToQuestion(visibleQuestions[nextIdx].id, visibleQuestions[nextIdx].part);
        return;
      }

      if (e.key === 'ArrowUp' || lowerKey === 'k') {
        if (visibleQuestions.length === 0) return;
        e.preventDefault();
        const currIdx = visibleQuestions.findIndex((q) => q.id === focusedQuestionId);
        const prevIdx =
          currIdx <= 0 ? visibleQuestions.length - 1 : (currIdx - 1) % visibleQuestions.length;
        jumpToQuestion(visibleQuestions[prevIdx].id, visibleQuestions[prevIdx].part);
        return;
      }

      if (e.key === '[') {
        if (flaggedItems.length > 0) {
          e.preventDefault();
          stepBookmark(-1);
        }
        return;
      }

      if (e.key === ']') {
        if (flaggedItems.length > 0) {
          e.preventDefault();
          stepBookmark(1);
        }
        return;
      }

      if (lowerKey === 'b' && focusedQuestionId) {
        e.preventDefault();
        toggleFlag(focusedQuestionId);
        return;
      }

      if (lowerKey === 'f') {
        e.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (lowerKey === 'm') {
        e.preventDefault();
        toggleLowTimeSound();
        return;
      }

      if (lowerKey === 'd') {
        e.preventDefault();
        onToggleTheme();
        return;
      }

      // Quick answer shortcuts for the currently focused question
      const activeItem =
        visibleQuestions.find((q) => q.id === focusedQuestionId) ?? visibleQuestions[0];
      if (!activeItem) return;

      if (activeItem.part === 'p1') {
        const digitMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          a: 0,
          b: 1,
          c: 2,
          d: 3,
        };
        if (digitMap[lowerKey] !== undefined) {
          e.preventDefault();
          selectPart1Option(activeItem.id, digitMap[lowerKey]);
        }
      } else if (activeItem.part === 'p2') {
        const stmtMap: Record<string, 'a' | 'b' | 'c' | 'd'> = {
          '1': 'a',
          '2': 'b',
          '3': 'c',
          '4': 'd',
        };
        if (stmtMap[e.key]) {
          e.preventDefault();
          togglePart2Statement(activeItem.id, stmtMap[e.key]);
        }
      } else if (activeItem.part === 'p3' && e.key === 'Enter') {
        const inputEl = document.getElementById(`short-${activeItem.id}`) as HTMLInputElement | null;
        if (inputEl) {
          e.preventDefault();
          inputEl.focus();
          inputEl.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    autoSubmitEnabled,
    confirmSubmitOpen,
    flaggedItems.length,
    focusedQuestionId,
    isPaused,
    isTimedOut,
    jumpToQuestion,
    onToggleTheme,
    selectPart1Option,
    shortcutsOpen,
    stepBookmark,
    toggleFlag,
    toggleFullscreen,
    toggleLowTimeSound,
    togglePart2Statement,
    togglePause,
    visibleQuestions,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-slate-950 dark:text-slate-100">
      {/* Sticky Top Examination Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-slate-900 sm:text-base dark:text-slate-50">
              {exam.title}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              <span>{candidate.studentName}</span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span className="font-mono tabular-nums">SBD {candidate.studentSbd}</span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span className="font-mono font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                Mã đề {variant.variantCode}
              </span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span className="tabular-nums">{durationMinutes} phút</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              title={`Tiến độ: ${stats.totalCompleted}/${stats.totalQuestions} câu (${completionPercent}%)`}
              className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 sm:inline-flex dark:border-slate-700 dark:bg-slate-800"
            >
              <CircularProgressRing
                completed={stats.totalCompleted}
                total={stats.totalQuestions}
                size={26}
                strokeWidth={3.2}
                tone={progressTone}
                showPercent={false}
              />
              <div className="leading-tight">
                <span className="font-mono text-xs font-bold text-slate-900 tabular-nums dark:text-slate-100">
                  {stats.totalCompleted}/{stats.totalQuestions}
                </span>
                <span className="ml-1 hidden text-[11px] text-slate-500 lg:inline dark:text-slate-400">
                  câu ({completionPercent}%)
                </span>
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${
                isPaused
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  : isLowTime
                    ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
                    : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>{formatDurationMMSS(secondsLeft)}</span>
              {isPaused ? (
                <span className="hidden text-xs font-semibold sm:inline">Tạm dừng</span>
              ) : isTimedOut ? (
                <span className="hidden text-xs font-semibold sm:inline">Hết giờ</span>
              ) : (
                isLowTime && (
                  <span className="hidden text-xs font-semibold sm:inline">Sắp hết giờ</span>
                )
              )}
            </div>

            <button
              type="button"
              disabled={isTimedOut}
              onClick={togglePause}
              aria-pressed={isPaused}
              aria-label={isPaused ? 'Tiếp tục làm bài (Phím Space)' : 'Tạm dừng tính giờ (Phím Space)'}
              title={isPaused ? 'Tiếp tục làm bài (Phím Space)' : 'Tạm dừng tính giờ (Phím Space)'}
              className={`inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isPaused
                  ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isPaused ? <Play className="h-3.5 w-3.5 shrink-0" /> : <Pause className="h-3.5 w-3.5 shrink-0" />}
              <span className="hidden lg:inline">{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
            </button>

            <button
              type="button"
              onClick={toggleLowTimeSound}
              aria-pressed={lowTimeSoundEnabled}
              aria-label={
                lowTimeSoundEnabled
                  ? 'Âm báo sắp hết giờ (< 5 phút): Đang bật. Nhấn để tắt'
                  : 'Âm báo sắp hết giờ (< 5 phút): Đang tắt. Nhấn để bật'
              }
              title={
                lowTimeSoundEnabled
                  ? 'Âm báo sắp hết giờ (< 5 phút): Đang bật (nhấn để tắt)'
                  : 'Âm báo sắp hết giờ (< 5 phút): Đang tắt (nhấn để bật & nghe thử)'
              }
              className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
                lowTimeSoundEnabled
                  ? isLowTime && secondsLeft > 0
                    ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60'
                    : 'border-slate-200 bg-white text-blue-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {lowTimeSoundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? 'Thoát chế độ toàn màn hình' : 'Bật chế độ toàn màn hình'}
              title={
                isFullscreen
                  ? 'Thoát chế độ toàn màn hình (ESC)'
                  : 'Bật chế độ toàn màn hình để tập trung làm bài'
              }
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors sm:px-3 ${
                isFullscreen
                  ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4 shrink-0" />
              ) : (
                <Maximize2 className="h-4 w-4 shrink-0" />
              )}
              <span className="hidden md:inline">
                {isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmSubmitOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Send className="h-4 w-4" />
              <span>Nộp bài</span>
            </button>
          </div>
        </div>
      </header>

      {/* Network Offline Banner */}
      {isOffline && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900 dark:border-red-900/70 dark:bg-red-950/60 dark:text-red-200"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-2 font-medium sm:px-6 lg:px-8">
            <WifiOff className="h-4 w-4 shrink-0 text-red-700 dark:text-red-400" />
            <span>
              Cảnh báo: Mất kết nối mạng Internet. Sự kiện đã được ghi nhận vào nhật ký giám sát —
              bài làm vẫn được tự động lưu tạm trên thiết bị này.
            </span>
          </div>
        </div>
      )}

      {/* Overtime Banner when auto-submit is disabled */}
      {isTimedOut && !autoSubmitEnabled && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900 dark:border-red-900/70 dark:bg-red-950/60 dark:text-red-200">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4 shrink-0 text-red-700 dark:text-red-400" />
              <span>
                Đã hết thời gian làm bài quy định ({durationMinutes} phút). Vui lòng kiểm tra nhanh và nhấn Nộp bài để hoàn tất.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmSubmitOpen(true)}
              className="cursor-pointer whitespace-nowrap font-semibold text-red-800 hover:underline dark:text-red-300"
            >
              Nộp bài ngay
            </button>
          </div>
        </div>
      )}

      {/* Low Time Warning Banner (< 5 minutes remaining) */}
      {secondsLeft > 0 && secondsLeft < lowTimeSoundThresholdSeconds && !lowTimeBannerDismissed && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-200"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 font-medium">
              <BellRing className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>
                Lưu ý thời gian: Chỉ còn{' '}
                <strong className="font-mono font-bold tabular-nums">
                  {formatDurationMMSS(secondsLeft)}
                </strong>{' '}
                nữa là hết giờ làm bài
                {remainingQuestions > 0
                  ? ` (còn ${remainingQuestions} câu chưa hoàn tất).`
                  : ' — hãy kiểm tra lại các câu đã đánh dấu.'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {lowTimeSoundBlocked ? (
                <button
                  type="button"
                  onClick={() => void playLowTimeChime()}
                  className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Phát âm báo</span>
                </button>
              ) : (
                lowTimeSoundEnabled && (
                  <button
                    type="button"
                    onClick={() => void playLowTimeChime()}
                    className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap font-semibold text-amber-800 hover:underline dark:text-amber-300"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Nghe lại chuông</span>
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setLowTimeBannerDismissed(true)}
                className="cursor-pointer whitespace-nowrap font-semibold text-amber-800 hover:underline dark:text-amber-300"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Proctoring Warning Banner */}
      {proctoringBanner && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>
                Cảnh báo giám sát ({violations.length} lần): {proctoringBanner}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setProctoringBanner(null)}
              className="cursor-pointer font-semibold text-amber-800 hover:underline dark:text-amber-300"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Notice Banner (if blocked or unsupported) */}
      {fullscreenNotice && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-200">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 font-medium">
              <Maximize2 className="h-3.5 w-3.5 shrink-0 text-blue-700 dark:text-blue-400" />
              <span>{fullscreenNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setFullscreenNotice(null)}
              className="cursor-pointer whitespace-nowrap font-semibold text-blue-800 hover:underline dark:text-blue-300"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Main Split Exam Workspace */}
      {isPaused ? (
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6 lg:px-8">
          <div className="w-full rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <Pause className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-slate-50">
              Phòng thi đang tạm dừng
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Đồng hồ đếm ngược đã được giữ nguyên tại{' '}
              <strong className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                {formatDurationMMSS(secondsLeft)}
              </strong>{' '}
              và nội dung câu hỏi đang được ẩn để bảo đảm tính công bằng.
            </p>
            <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono tabular-nums">
                Đã hoàn tất: {stats.totalCompleted}/{stats.totalQuestions} câu
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Đánh dấu: {stats.flaggedCount} câu</span>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={togglePause}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Play className="h-4 w-4" />
                <span>Tiếp tục làm bài (Space)</span>
              </button>
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Keyboard className="h-4 w-4" />
                <span>Phím tắt (?)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:px-8">
        {/* Left/Center Question Stage */}
        <main className="space-y-8 lg:col-span-8">
          {/* Section Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div
              role="tablist"
              aria-label="Lọc phần đề thi"
              className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
            >
              {[
                { id: 'all' as const, label: 'Tất cả phần' },
                ...(variant.part1.length > 0
                  ? [{ id: 'p1' as const, label: `Phần I (${variant.part1.length})` }]
                  : []),
                ...(variant.part2.length > 0
                  ? [{ id: 'p2' as const, label: `Phần II (${variant.part2.length})` }]
                  : []),
                ...(variant.part3.length > 0
                  ? [{ id: 'p3' as const, label: `Phần III (${variant.part3.length})` }]
                  : []),
                { id: 'flagged' as const, label: `Đã đánh dấu (${stats.flaggedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activePartFilter === tab.id}
                  onClick={() => setActivePartFilter(tab.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activePartFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.id === 'flagged' && (
                    <Bookmark
                      className={`h-3.5 w-3.5 ${
                        stats.flaggedCount > 0 ? 'fill-current text-amber-600 dark:text-amber-400' : ''
                      }`}
                    />
                  )}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs font-medium text-slate-500 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>Phím tắt (?)</span>
              </button>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={onAbortExit}
                className="cursor-pointer whitespace-nowrap text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
              >
                Thoát phòng thi
              </button>
            </div>
          </div>

          {/* Empty state when filtering by bookmarked questions and none are flagged */}
          {activePartFilter === 'flagged' && flaggedItems.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <Bookmark className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Chưa có câu hỏi nào được đánh dấu
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600 dark:text-slate-400">
                Trong quá trình làm bài, hãy nhấn nút <strong className="font-semibold text-slate-800 dark:text-slate-200">Đánh dấu</strong> ở góc phải mỗi câu hỏi để lưu vào danh sách rà soát trước khi nộp bài.
              </p>
              <button
                type="button"
                onClick={() => setActivePartFilter('all')}
                className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                Hiển thị tất cả câu hỏi
              </button>
            </div>
          )}

          {/* PHẦN I: MULTIPLE CHOICE */}
          {(activePartFilter === 'all' ||
            activePartFilter === 'p1' ||
            activePartFilter === 'flagged') &&
            variant.part1.some((q) => activePartFilter !== 'flagged' || Boolean(answers.flagged?.[q.id])) && (
              <section className="space-y-4">
                <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                    Phần I. Câu trắc nghiệm nhiều phương án lựa chọn
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Thí sinh trả lời từ câu 1 đến câu {variant.part1.length}. Mỗi câu hỏi thí sinh
                    chỉ chọn một phương án ({exam.part1PointPerQ.toString().replace('.', ',')} điểm/câu).
                  </p>
                </div>

                {variant.part1.map((q, idx) => {
                  const selectedIdx = answers.part1[q.id];
                  const isFlagged = Boolean(answers.flagged?.[q.id]);
                  if (activePartFilter === 'flagged' && !isFlagged) return null;
                  const isHighlighted = highlightedQuestionId === q.id;
                  const isFocused = focusedQuestionId === q.id;

                  return (
                    <article
                      key={q.id}
                      id={`question-card-${q.id}`}
                      onClick={() => setFocusedQuestionId(q.id)}
                      className={`rounded-xl border bg-white p-5 transition-colors sm:p-6 dark:bg-slate-900 ${
                        isHighlighted
                          ? 'border-blue-600 ring-2 ring-blue-600/30 dark:border-blue-400 dark:ring-blue-400/30'
                          : isFocused
                            ? 'border-blue-400 dark:border-blue-600'
                            : isFlagged
                              ? 'border-amber-300 dark:border-amber-700/70'
                              : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                            Câu {idx + 1}
                          </span>
                          <span aria-hidden="true" className="mx-2">·</span>
                          <span>{q.topic}</span>
                          <span aria-hidden="true" className="mx-2">·</span>
                          <span>{COGNITIVE_LEVEL_LABELS[q.level]}</span>
                        </div>
                        <button
                          type="button"
                          aria-pressed={isFlagged}
                          title={
                            isFlagged
                              ? 'Bỏ đánh dấu xem lại'
                              : 'Đánh dấu câu hỏi này để xem lại trước khi nộp bài'
                          }
                          onClick={() => toggleFlag(q.id)}
                          className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            isFlagged
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${isFlagged ? 'fill-current' : ''}`} />
                          <span>{isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
                        </button>
                      </div>

                      <p className="mt-3 text-[15px] leading-relaxed font-medium text-slate-900 dark:text-slate-100">
                        {q.prompt}
                      </p>

                      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {q.options.map((optText, oIdx) => {
                          const isSelected = selectedIdx === oIdx;
                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => selectPart1Option(q.id, oIdx)}
                              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors duration-150 ${
                                isSelected
                                  ? 'border-blue-700 bg-blue-50/70 font-semibold text-blue-950 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-100'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ${
                                  isSelected
                                    ? 'bg-blue-700 text-white dark:bg-blue-600'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {OPTION_LETTERS[oIdx]}
                              </span>
                              <span className="leading-snug">{optText}</span>
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

          {/* PHẦN II: TRUE / FALSE (4 STATEMENTS) */}
          {(activePartFilter === 'all' ||
            activePartFilter === 'p2' ||
            activePartFilter === 'flagged') &&
            variant.part2.some((q) => activePartFilter !== 'flagged' || Boolean(answers.flagged?.[q.id])) && (
              <section className="space-y-4">
                <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                    Phần II. Câu trắc nghiệm đúng sai
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai. Điểm tối đa{' '}
                    {exam.part2PointMaxPerQ.toString().replace('.', ',')} điểm/câu (lũy tiến 0,10 ·
                    0,25 · 0,50 · 1,00).
                  </p>
                </div>

                {variant.part2.map((q, idx) => {
                  const userMap = answers.part2[q.id] ?? {};
                  const isFlagged = Boolean(answers.flagged?.[q.id]);
                  if (activePartFilter === 'flagged' && !isFlagged) return null;
                  const isHighlighted = highlightedQuestionId === q.id;
                  const isFocused = focusedQuestionId === q.id;

                  return (
                    <article
                      key={q.id}
                      id={`question-card-${q.id}`}
                      onClick={() => setFocusedQuestionId(q.id)}
                      className={`rounded-xl border bg-white p-5 transition-colors sm:p-6 dark:bg-slate-900 ${
                        isHighlighted
                          ? 'border-blue-600 ring-2 ring-blue-600/30 dark:border-blue-400 dark:ring-blue-400/30'
                          : isFocused
                            ? 'border-blue-400 dark:border-blue-600'
                            : isFlagged
                              ? 'border-amber-300 dark:border-amber-700/70'
                              : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                            Câu {idx + 1} (Phần II)
                          </span>
                          <span aria-hidden="true" className="mx-2">·</span>
                          <span>{q.topic}</span>
                          <span aria-hidden="true" className="mx-2">·</span>
                          <span>{COGNITIVE_LEVEL_LABELS[q.level]}</span>
                        </div>
                        <button
                          type="button"
                          aria-pressed={isFlagged}
                          title={
                            isFlagged
                              ? 'Bỏ đánh dấu xem lại'
                              : 'Đánh dấu câu hỏi này để xem lại trước khi nộp bài'
                          }
                          onClick={() => toggleFlag(q.id)}
                          className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            isFlagged
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${isFlagged ? 'fill-current' : ''}`} />
                          <span>{isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
                        </button>
                      </div>

                      <p className="mt-3 text-[15px] leading-relaxed font-medium text-slate-900 dark:text-slate-100">
                        {q.prompt}
                      </p>

                      <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {(q.statements ?? []).map((stmt) => {
                          const currentVal = userMap[stmt.id];
                          return (
                            <div
                              key={stmt.id}
                              className="flex flex-col justify-between gap-3 bg-white px-4 py-3 sm:flex-row sm:items-center dark:bg-slate-950/50"
                            >
                              <div className="flex items-start gap-2.5 text-sm text-slate-800 dark:text-slate-200">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {stmt.id})
                                </span>
                                <span className="leading-relaxed">{stmt.text}</span>
                              </div>

                              <div
                                role="group"
                                aria-label={`Ý ${stmt.id} câu ${idx + 1}`}
                                className="flex items-center gap-2 shrink-0 self-end sm:self-center"
                              >
                                <button
                                  type="button"
                                  onClick={() => selectPart2Statement(q.id, stmt.id, true)}
                                  className={`min-h-[38px] min-w-[74px] cursor-pointer rounded-md border px-3 text-xs font-semibold transition-colors ${
                                    currentVal === true
                                      ? 'border-emerald-700 bg-emerald-600 text-white'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  Đúng
                                </button>
                                <button
                                  type="button"
                                  onClick={() => selectPart2Statement(q.id, stmt.id, false)}
                                  className={`min-h-[38px] min-w-[74px] cursor-pointer rounded-md border px-3 text-xs font-semibold transition-colors ${
                                    currentVal === false
                                      ? 'border-slate-900 bg-slate-800 text-white dark:border-slate-400 dark:bg-slate-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  Sai
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}

          {/* PHẦN III: SHORT ANSWER (MAX 4 CHARS) */}
          {(activePartFilter === 'all' ||
            activePartFilter === 'p3' ||
            activePartFilter === 'flagged') &&
            variant.part3.some((q) => activePartFilter !== 'flagged' || Boolean(answers.flagged?.[q.id])) && (
              <section className="space-y-4">
                <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                    Phần III. Câu trắc nghiệm trả lời ngắn
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Thí sinh nhập kết quả dạng số tối đa 4 ký tự (gồm chữ số, dấu trừ &quot;-&quot;
                    hoặc dấu phẩy &quot;,&quot;). Mỗi câu đúng đạt{' '}
                    {exam.part3PointPerQ.toString().replace('.', ',')} điểm.
                  </p>
                </div>

                {variant.part3.map((q, idx) => {
                  const val = answers.part3[q.id] ?? '';
                  const isFlagged = Boolean(answers.flagged?.[q.id]);
                  if (activePartFilter === 'flagged' && !isFlagged) return null;
                  const isHighlighted = highlightedQuestionId === q.id;
                  const isFocused = focusedQuestionId === q.id;
                  const chars = [val[0] ?? '', val[1] ?? '', val[2] ?? '', val[3] ?? ''];

                  return (
                    <article
                      key={q.id}
                      id={`question-card-${q.id}`}
                      onClick={() => setFocusedQuestionId(q.id)}
                      className={`rounded-xl border bg-white p-5 transition-colors sm:p-6 dark:bg-slate-900 ${
                        isHighlighted
                          ? 'border-blue-600 ring-2 ring-blue-600/30 dark:border-blue-400 dark:ring-blue-400/30'
                          : isFocused
                            ? 'border-blue-400 dark:border-blue-600'
                            : isFlagged
                              ? 'border-amber-300 dark:border-amber-700/70'
                              : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                            Câu {idx + 1} (Phần III)
                          </span>
                          <span aria-hidden="true" className="mx-2">·</span>
                          <span>{q.topic}</span>
                          <span aria-hidden="true" className="mx-2">·</span>
                          <span>{COGNITIVE_LEVEL_LABELS[q.level]}</span>
                        </div>
                        <button
                          type="button"
                          aria-pressed={isFlagged}
                          title={
                            isFlagged
                              ? 'Bỏ đánh dấu xem lại'
                              : 'Đánh dấu câu hỏi này để xem lại trước khi nộp bài'
                          }
                          onClick={() => toggleFlag(q.id)}
                          className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            isFlagged
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${isFlagged ? 'fill-current' : ''}`} />
                          <span>{isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
                        </button>
                      </div>

                      <p className="mt-3 text-[15px] leading-relaxed font-medium text-slate-900 dark:text-slate-100">
                        {q.prompt}
                      </p>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <label
                            htmlFor={`short-${q.id}`}
                            className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            Đáp án của bạn:
                          </label>
                          <input
                            id={`short-${q.id}`}
                            type="text"
                            inputMode="decimal"
                            maxLength={4}
                            disabled={isTimedOut && autoSubmitEnabled}
                            value={val}
                            onChange={(e) => setPart3Input(q.id, e.target.value)}
                            placeholder="VD: 12,3"
                            className="h-11 w-32 rounded-lg border border-slate-300 bg-white px-3 text-center font-mono text-base font-bold text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500 dark:disabled:bg-slate-800"
                          />
                        </div>

                        {/* 4-column OMR Sheet Preview */}
                        <div className="flex items-center gap-1.5">
                          <span className="mr-1 text-xs text-slate-500 dark:text-slate-400">
                            Ô phiếu tô 4 ký tự:
                          </span>
                          {chars.map((ch, cIdx) => (
                            <span
                              key={cIdx}
                              className={`flex h-9 w-8 items-center justify-center rounded-md border font-mono text-sm font-bold tabular-nums ${
                                ch
                                  ? 'border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200'
                                  : 'border-slate-200 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-600'
                              }`}
                            >
                              {ch || '·'}
                            </span>
                          ))}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
        </main>

        {/* Right Sidebar: OMR Answer Sheet Grid & Proctoring */}
        <aside className="lg:col-span-4">
          <div className="sticky top-22 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  Phiếu trả lời điện tử
                </h3>
                <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                  {stats.totalCompleted}/{stats.totalQuestions} câu
                </span>
              </div>

              {/* Circular Progress & Time Pacing Summary */}
              <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
                <CircularProgressRing
                  completed={stats.totalCompleted}
                  total={stats.totalQuestions}
                  size={64}
                  strokeWidth={6}
                  tone={progressTone}
                  showPercent
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Tiến độ làm bài
                  </p>
                  <p className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums dark:text-slate-50">
                    {stats.totalCompleted} / {stats.totalQuestions}{' '}
                    <span className="font-sans text-xs font-normal text-slate-500 dark:text-slate-400">
                      câu đã hoàn tất
                    </span>
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium tabular-nums ${
                      remainingQuestions === 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : isLowTime
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {pacingText}
                    {stats.p2Partial > 0 ? ` · ${stats.p2Partial} câu P.II dở` : ''}
                  </p>
                </div>
              </div>

              {/* Part I Grid */}
              {variant.part1.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Phần I · Nhiều lựa chọn ({stats.p1Answered}/{variant.part1.length})
                  </p>
                  <div className="mt-2 grid grid-cols-6 gap-1.5">
                    {variant.part1.map((q, idx) => {
                      const done = answers.part1[q.id] !== undefined;
                      const flagged = Boolean(answers.flagged?.[q.id]);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => jumpToQuestion(q.id, 'p1')}
                          className={`relative flex h-9 cursor-pointer items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors ${
                            done
                              ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-600 dark:bg-blue-600'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {idx + 1}
                          {flagged && (
                            <span
                              aria-label="Đã đánh dấu"
                              className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-500 dark:border-slate-900"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Part II Grid */}
              {variant.part2.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Phần II · Đúng/Sai ({stats.p2Answered}/{variant.part2.length})
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {variant.part2.map((q, idx) => {
                      const st = answers.part2[q.id] ?? {};
                      const count = ['a', 'b', 'c', 'd'].filter(
                        (k) => st[k as 'a' | 'b' | 'c' | 'd'] !== undefined,
                      ).length;
                      const flagged = Boolean(answers.flagged?.[q.id]);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => jumpToQuestion(q.id, 'p2')}
                          className={`relative flex h-9 cursor-pointer items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors ${
                            count === 4
                              ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-600 dark:bg-blue-600'
                              : count > 0
                                ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          C{idx + 1} ({count}/4)
                          {flagged && (
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-500 dark:border-slate-900" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Part III Grid */}
              {variant.part3.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Phần III · Trả lời ngắn ({stats.p3Answered}/{variant.part3.length})
                  </p>
                  <div className="mt-2 grid grid-cols-6 gap-1.5">
                    {variant.part3.map((q, idx) => {
                      const done = (answers.part3[q.id] ?? '').trim().length > 0;
                      const flagged = Boolean(answers.flagged?.[q.id]);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => jumpToQuestion(q.id, 'p3')}
                          className={`relative flex h-9 cursor-pointer items-center justify-center rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors ${
                            done
                              ? 'border-blue-700 bg-blue-700 text-white dark:border-blue-600 dark:bg-blue-600'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {idx + 1}
                          {flagged && (
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-500 dark:border-slate-900" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Legend & Auto-save Info */}
              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Đã lưu nháp tự động
                  </span>
                  <span className="font-mono tabular-nums">{lastSavedTime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Câu đánh dấu xem lại</span>
                  <span className="font-mono font-semibold text-amber-700 tabular-nums dark:text-amber-400">
                    {stats.flaggedCount}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(true)}
                className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-700 text-sm font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Send className="h-4 w-4" />
                <span>Nộp bài thi ngay</span>
              </button>
            </div>

            {/* Review Bookmarks Panel */}
            <section
              aria-label="Xem lại câu đã đánh dấu"
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h3 className="inline-flex items-center gap-2 font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  <Bookmark
                    className={`h-4 w-4 ${
                      flaggedItems.length > 0
                        ? 'fill-current text-amber-600 dark:text-amber-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span>Xem lại câu đã đánh dấu</span>
                </h3>
                <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums dark:text-amber-400">
                  {flaggedItems.length} câu
                </span>
              </div>

              {flaggedItems.length === 0 ? (
                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Chưa có câu nào được đánh dấu. Nhấn nút <strong className="font-semibold text-slate-700 dark:text-slate-200">Đánh dấu</strong> trên từng câu hỏi để gom vào đây và rà soát nhanh trước khi nộp bài.
                </p>
              ) : (
                <>
                  {/* Quick Prev / Next Cycle Bar */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => stepBookmark(-1)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Trước</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => stepBookmark(1)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <span>Tiếp</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <span className="ml-1 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                        {activeBookmarkIndex >= 0 ? `${activeBookmarkIndex + 1}/${flaggedItems.length}` : `0/${flaggedItems.length}`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActivePartFilter((prev) => (prev === 'flagged' ? 'all' : 'flagged'))
                      }
                      className="cursor-pointer whitespace-nowrap text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                    >
                      {activePartFilter === 'flagged' ? 'Hiện tất cả' : 'Lọc riêng'}
                    </button>
                  </div>

                  {/* Bookmarked Items List */}
                  <ul className="mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {flaggedItems.map((item) => {
                      const isActiveItem = activeBookmarkId === item.id;
                      return (
                        <li
                          key={item.id}
                          className={`flex items-start justify-between gap-2 transition-colors ${
                            isActiveItem
                              ? 'bg-blue-50/70 dark:bg-blue-950/40'
                              : 'bg-white hover:bg-slate-50 dark:bg-slate-950/40 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => jumpToQuestion(item.id, item.part)}
                            className="min-w-0 flex-1 cursor-pointer px-3 py-2.5 text-left"
                          >
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                                {item.partLabel} · Câu {item.numberInPart}
                              </span>
                              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                ·
                              </span>
                              <span
                                className={`font-medium ${
                                  item.isAnswered
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {item.answerSummary}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                              {item.prompt}
                            </p>
                          </button>

                          <button
                            type="button"
                            aria-label={`Bỏ đánh dấu ${item.partLabel} câu ${item.numberInPart}`}
                            title="Bỏ đánh dấu"
                            onClick={() => toggleFlag(item.id)}
                            className="mt-2 mr-2 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            {/* Proctoring & Focus Mode Summary Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                  {violations.length === 0 ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  )}
                  Giám sát phòng thi
                </span>
                <span className="font-mono font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                  {violations.length} cảnh báo
                </span>
              </div>
              <p className="mt-1.5 leading-relaxed text-slate-500 dark:text-slate-400">
                {exam.strictProctoring
                  ? 'Đang bật theo dõi chuyển tab, mất tiêu điểm cửa sổ và chống sao chép đề theo Thông tư 09/2021.'
                  : 'Chế độ kiểm tra luyện tập tự do (không ghi nhận chuyển tab).'}
              </p>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">
                  Chế độ tập trung:{' '}
                  <strong
                    className={
                      isFullscreen
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }
                  >
                    {isFullscreen ? 'Toàn màn hình' : 'Cửa sổ thường'}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex cursor-pointer items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" />
                      <span>Thu nhỏ</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" />
                      <span>Toàn màn hình</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">
                  Âm báo &lt; 5 phút:{' '}
                  <strong
                    className={
                      lowTimeSoundEnabled
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }
                  >
                    {lowTimeSoundEnabled ? 'Đang bật' : 'Đã tắt'}
                  </strong>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void playLowTimeChime()}
                    className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-slate-100"
                  >
                    <BellRing className="h-3.5 w-3.5" />
                    <span>Nghe thử</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleLowTimeSound}
                    className="inline-flex cursor-pointer items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    {lowTimeSoundEnabled ? (
                      <>
                        <VolumeX className="h-3.5 w-3.5" />
                        <span>Tắt</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>Bật</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">
                  Điều khiển nhanh:{' '}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    Space / 1–4 / ↑↓
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShortcutsOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                  <span>Xem phím tắt</span>
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
      )}

      {/* Submit Confirmation Modal */}
      {confirmSubmitOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-submit-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3
              id="confirm-submit-title"
              className="font-display text-lg font-bold text-slate-900 dark:text-slate-50"
            >
              Xác nhận nộp bài thi?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Sau khi nộp bài, hệ thống sẽ chấm điểm tự động theo quy chuẩn Bộ GD&amp;ĐT 2025 và
              không thể chỉnh sửa đáp án.
            </p>

            <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950/60">
              {variant.part1.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Phần I (Nhiều lựa chọn):
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                    {stats.p1Answered}/{variant.part1.length} câu đã chọn
                  </span>
                </div>
              )}
              {variant.part2.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Phần II (Đúng/Sai):</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                    {stats.p2Answered}/{variant.part2.length} câu đủ 4 ý
                    {stats.p2Partial > 0 ? ` (${stats.p2Partial} câu dở dang)` : ''}
                  </span>
                </div>
              )}
              {variant.part3.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Phần III (Trả lời ngắn):
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                    {stats.p3Answered}/{variant.part3.length} câu đã điền
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Câu đánh dấu xem lại:</span>
                <span className="font-mono font-semibold text-amber-700 tabular-nums dark:text-amber-400">
                  {stats.flaggedCount} câu
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Thời gian còn lại:</span>
                <span className="font-mono font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                  {formatDurationMMSS(secondsLeft)}
                </span>
              </div>
            </div>

            {flaggedItems.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs dark:border-amber-900/70 dark:bg-amber-950/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
                    <Bookmark className="h-3.5 w-3.5 fill-current text-amber-600 dark:text-amber-400" />
                    Bạn còn {flaggedItems.length} câu đang đánh dấu
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmSubmitOpen(false);
                      jumpToQuestion(flaggedItems[0].id, flaggedItems[0].part);
                    }}
                    className="cursor-pointer whitespace-nowrap font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    Xem lại ngay
                  </button>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {flaggedItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setConfirmSubmitOpen(false);
                        jumpToQuestion(item.id, item.part);
                      }}
                      className="cursor-pointer rounded-md border border-amber-300 bg-white px-2 py-1 font-mono text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-900/60"
                    >
                      {item.partLabel} · C{item.numberInPart}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Quay lại làm tiếp
              </button>
              <button
                type="button"
                onClick={() => finalizeAndSubmit('manual')}
                className="cursor-pointer rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                Xác nhận nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Submit on Timeout Modal */}
      {isTimedOut && autoSubmitEnabled && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="timeout-submit-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <Clock className="h-6 w-6" />
            </div>
            <h3
              id="timeout-submit-title"
              className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-slate-50"
            >
              Đã hết thời gian làm bài!
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Hệ thống đã tự động khóa đề và đang thu bài, chấm điểm tự động theo quy chế Bộ
              GD&amp;ĐT 2025...
            </p>
            <button
              type="button"
              onClick={() => finalizeAndSubmit('timeout')}
              className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Xem kết quả ngay
            </button>
          </div>
        </div>
      )}

      {shortcutsOpen && (
        <KeyboardShortcutsModal
          mode="exam"
          onClose={() => setShortcutsOpen(false)}
        />
      )}
    </div>
  );
}
