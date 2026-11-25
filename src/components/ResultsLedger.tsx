import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Download,
  FileText,
  Pause,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  Exam,
  ExamSubmission,
  GradeLevel,
  TeacherAlert,
  UserAccount,
  UserRole,
} from '../types/exam';
import {
  areGradesEqual,
  classifyAcademicRankTT22,
  collectAvailableClasses,
  collectAvailableGrades,
  doesExamMatchStudentClass,
  exportSubmissionsToCsv,
  extractGradeFromClassName,
  formatDurationMMSS,
  formatGradeLabel,
  formatScoreVi,
  getSubjectMeta,
  normalizeClassName,
  normalizeGradeValue,
  roundScore,
} from '../utils/scoring2025';
import { ActionLogModal } from './ActionLogModal';
import { PrintableResultsModal } from './PrintableResultsModal';

interface ResultsLedgerProps {
  submissions: ExamSubmission[];
  exams: Exam[];
  role?: UserRole;
  currentUser?: UserAccount | null;
  isDark: boolean;
  alerts?: TeacherAlert[];
  focusAlert?: { sbd: string; nonce: number } | null;
  initialFilter?: { examId?: string; className?: string; nonce: number } | null;
  onMarkAlertRead?: (id: string) => void;
  onViewSubmission: (sub: ExamSubmission) => void;
}

type ChartMode = 'histogram' | 'rank_tt22' | 'part_mastery';

const SCORE_BANDS = [
  { label: '< 3,5', min: 0, max: 3.499, color: '#DC2626', statusText: 'Chưa đạt' },
  { label: '3,5 – 4,9', min: 3.5, max: 4.999, color: '#D97706', statusText: 'Chưa đạt' },
  { label: '5,0 – 6,4', min: 5.0, max: 6.499, color: '#0284C7', statusText: 'Đạt' },
  { label: '6,5 – 7,9', min: 6.5, max: 7.999, color: '#1D4ED8', statusText: 'Khá' },
  { label: '8,0 – 8,9', min: 8.0, max: 8.999, color: '#059669', statusText: 'Tốt' },
  { label: '9,0 – 10', min: 9.0, max: 10.01, color: '#047857', statusText: 'Tốt' },
];

interface ChartTooltipPayloadItem {
  value?: number;
  name?: string;
  payload?: {
    label?: string;
    statusText?: string;
    count?: number;
    percent?: number;
    color?: string;
    avgPct?: number;
    avgEarned?: number;
    avgMax?: number;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<ChartTooltipPayloadItem>;
}

function HistogramTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
      <p className="font-display font-bold text-slate-900 dark:text-slate-50">
        Khoảng điểm {item.label} ({item.statusText})
      </p>
      <p className="mt-1 font-mono text-slate-700 tabular-nums dark:text-slate-300">
        Số lượng: <strong>{item.count}</strong> thí sinh ({item.percent}%)
      </p>
    </div>
  );
}

function RankTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
      <p className="font-display font-bold text-slate-900 dark:text-slate-50">
        Xếp loại: {item.label}
      </p>
      <p className="mt-1 font-mono text-slate-700 tabular-nums dark:text-slate-300">
        {item.count} bài ({item.percent}%)
      </p>
    </div>
  );
}

function PartMasteryTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
      <p className="font-display font-bold text-slate-900 dark:text-slate-50">{item.label}</p>
      <p className="mt-1 font-mono text-slate-700 tabular-nums dark:text-slate-300">
        Tỷ lệ đạt trung bình: <strong>{item.avgPct}%</strong>
      </p>
      <p className="mt-0.5 font-mono text-slate-500 tabular-nums dark:text-slate-400">
        Điểm TB: {formatScoreVi(item.avgEarned ?? 0)} / {formatScoreVi(item.avgMax ?? 0)}đ
      </p>
    </div>
  );
}

export function ResultsLedger({
  submissions,
  exams,
  role = 'teacher',
  currentUser = null,
  isDark,
  alerts = [],
  focusAlert = null,
  initialFilter = null,
  onMarkAlertRead,
  onViewSubmission,
}: ResultsLedgerProps) {
  const isStudent = (currentUser?.role ?? role) === 'student';
  const chartColors = {
    grid: isDark ? '#334155' : '#E2E8F0',
    axisLine: isDark ? '#475569' : '#CBD5E1',
    tick: isDark ? '#94A3B8' : '#475569',
    tickStrong: isDark ? '#E2E8F0' : '#0F172A',
    cursorFill: isDark ? 'rgba(30, 41, 59, 0.55)' : '#F1F5F9',
  };
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');
  const [examFilter, setExamFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [integrityFilter, setIntegrityFilter] = useState<
    'all' | 'alerts' | 'pauses' | 'clean'
  >('all');
  const [chartMode, setChartMode] = useState<ChartMode>('histogram');
  const [printReportOpen, setPrintReportOpen] = useState(false);
  const [selectedLogSubmission, setSelectedLogSubmission] = useState<ExamSubmission | null>(null);

  useEffect(() => {
    if (!focusAlert) return;
    setSearch(focusAlert.sbd);
    setGradeFilter('all');
    setExamFilter('all');
    setClassFilter('all');
    setIntegrityFilter('all');
    const matched = submissions.find(
      (s) => s.studentSbd.toLowerCase() === focusAlert.sbd.toLowerCase(),
    );
    if (matched) {
      setSelectedLogSubmission(matched);
    }
  }, [focusAlert, submissions]);

  useEffect(() => {
    if (!initialFilter) return;
    setSearch('');
    setGradeFilter('all');
    setIntegrityFilter('all');
    setClassFilter(initialFilter.className ? normalizeClassName(initialFilter.className) : 'all');
    setExamFilter(initialFilter.examId ?? 'all');
  }, [initialFilter]);

  const examMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  const availableClasses = useMemo(
    () => collectAvailableClasses(exams, submissions),
    [exams, submissions],
  );

  const availableGrades = useMemo(
    () => collectAvailableGrades(exams, true),
    [exams],
  );

  const matchesClassGrade = (cls: string, targetGrade: GradeLevel) => {
    const normalizedCls = normalizeClassName(cls);
    const extracted = extractGradeFromClassName(cls);
    if (typeof targetGrade === 'number') {
      return extracted === targetGrade || normalizedCls.startsWith(String(targetGrade));
    }
    return (
      normalizedCls === normalizeClassName(String(targetGrade)) ||
      (extracted !== null && areGradesEqual(extracted, targetGrade))
    );
  };

  const visibleClassOptions = useMemo(() => {
    if (gradeFilter === 'all') return availableClasses;
    return availableClasses.filter((cls) => matchesClassGrade(cls, gradeFilter));
  }, [availableClasses, gradeFilter]);

  const classMetrics = useMemo(() => {
    return visibleClassOptions.map((cls) => {
      const normalized = normalizeClassName(cls);
      const classSubs = submissions.filter((s) => {
        if (normalizeClassName(s.studentClass) !== normalized) return false;
        if (examFilter !== 'all' && s.examId !== examFilter) return false;
        return true;
      });
      const count = classSubs.length;
      const avg =
        count > 0 ? classSubs.reduce((acc, s) => acc + s.totalScore, 0) / count : null;
      const alertsCount = classSubs.filter(
        (s) =>
          s.violations.length > 0 ||
          (s.actionLogs ?? []).some(
            (l) => l.type === 'fullscreen_exited' || l.type === 'network_offline',
          ),
      ).length;
      return {
        className: cls,
        count,
        avg,
        alertsCount,
      };
    });
  }, [examFilter, submissions, visibleClassOptions]);

  const filteredExamsForSelect = useMemo(() => {
    return exams.filter((ex) => {
      if (gradeFilter !== 'all' && !areGradesEqual(ex.grade, gradeFilter)) return false;
      if (classFilter !== 'all') {
        const matchesExamScope = doesExamMatchStudentClass(ex, classFilter);
        const hasClassSubmission = submissions.some(
          (s) =>
            s.examId === ex.id &&
            normalizeClassName(s.studentClass) === normalizeClassName(classFilter),
        );
        if (!matchesExamScope && !hasClassSubmission) return false;
      }
      return true;
    });
  }, [classFilter, exams, gradeFilter, submissions]);

  const handleGradeChange = (nextGrade: 'all' | GradeLevel) => {
    setGradeFilter(nextGrade);
    if (
      nextGrade !== 'all' &&
      classFilter !== 'all' &&
      !matchesClassGrade(classFilter, nextGrade)
    ) {
      setClassFilter('all');
    }
    if (nextGrade !== 'all' && examFilter !== 'all') {
      const ex = examMap.get(examFilter);
      if (ex && !areGradesEqual(ex.grade, nextGrade)) {
        setExamFilter('all');
      }
    }
  };

  const handleClassChange = (nextClass: string) => {
    setClassFilter(nextClass);
    if (nextClass !== 'all' && examFilter !== 'all') {
      const ex = examMap.get(examFilter);
      const hasClassSubmission = submissions.some(
        (s) =>
          s.examId === examFilter &&
          normalizeClassName(s.studentClass) === normalizeClassName(nextClass),
      );
      if (ex && !doesExamMatchStudentClass(ex, nextClass) && !hasClassSubmission) {
        setExamFilter('all');
      }
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (gradeFilter !== 'all') {
        const examGrade = examMap.get(s.examId)?.grade ?? null;
        const subGrade = extractGradeFromClassName(s.studentClass) ?? examGrade;
        const matches =
          areGradesEqual(examGrade, gradeFilter) ||
          areGradesEqual(subGrade, gradeFilter) ||
          matchesClassGrade(s.studentClass, gradeFilter);
        if (!matches) return false;
      }
      if (examFilter !== 'all' && s.examId !== examFilter) return false;
      if (
        classFilter !== 'all' &&
        normalizeClassName(s.studentClass) !== normalizeClassName(classFilter)
      ) {
        return false;
      }
      const logs = s.actionLogs ?? [];
      const hasPauses = logs.some((l) => l.type === 'paused_exam');
      const hasAlerts =
        s.violations.length > 0 ||
        logs.some((l) => l.type === 'fullscreen_exited' || l.type === 'network_offline');
      if (integrityFilter === 'alerts' && !hasAlerts) return false;
      if (integrityFilter === 'pauses' && !hasPauses) return false;
      if (integrityFilter === 'clean' && (hasAlerts || hasPauses)) return false;
      if (
        q &&
        !s.studentName.toLowerCase().includes(q) &&
        !s.studentSbd.toLowerCase().includes(q) &&
        !s.studentClass.toLowerCase().includes(q) &&
        !s.examTitle.toLowerCase().includes(q) &&
        !s.roomCode.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [submissions, gradeFilter, examFilter, classFilter, integrityFilter, search, examMap]);

  const unreadAlerts = useMemo(
    () => alerts.filter((a) => !a.read),
    [alerts],
  );

  const hasActiveFilters =
    gradeFilter !== 'all' ||
    examFilter !== 'all' ||
    classFilter !== 'all' ||
    integrityFilter !== 'all' ||
    search.trim() !== '';

  const analytics = useMemo(() => {
    const n = filtered.length;
    if (n === 0) {
      return {
        avg: 0,
        highest: 0,
        passRate: 0,
        bands: SCORE_BANDS.map((b) => ({ ...b, count: 0, percent: 0 })),
        rankData: [
          { label: 'Tốt (≥ 8,0)', count: 0, percent: 0, color: '#059669' },
          { label: 'Khá (6,5–7,9)', count: 0, percent: 0, color: '#1D4ED8' },
          { label: 'Đạt (5,0–6,4)', count: 0, percent: 0, color: '#0284C7' },
          { label: 'Chưa đạt (< 5,0)', count: 0, percent: 0, color: '#DC2626' },
        ],
        partData: [
          { label: 'Phần I · Nhiều lựa chọn', avgPct: 0, avgEarned: 0, avgMax: 0, color: '#1D4ED8' },
          { label: 'Phần II · Đúng/Sai lũy tiến', avgPct: 0, avgEarned: 0, avgMax: 0, color: '#0284C7' },
          { label: 'Phần III · Trả lời ngắn', avgPct: 0, avgEarned: 0, avgMax: 0, color: '#059669' },
        ],
      };
    }

    const total = filtered.reduce((acc, s) => acc + s.totalScore, 0);
    const highest = Math.max(...filtered.map((s) => s.totalScore));
    const passed = filtered.filter((s) => s.totalScore >= 5.0).length;

    const bands = SCORE_BANDS.map((b) => {
      const count = filtered.filter((s) => s.totalScore >= b.min && s.totalScore <= b.max).length;
      return {
        ...b,
        count,
        percent: Math.round((count / n) * 100),
      };
    });

    const totCount = filtered.filter((s) => s.totalScore >= 8.0).length;
    const khaCount = filtered.filter((s) => s.totalScore >= 6.5 && s.totalScore < 8.0).length;
    const datCount = filtered.filter((s) => s.totalScore >= 5.0 && s.totalScore < 6.5).length;
    const chuaDatCount = filtered.filter((s) => s.totalScore < 5.0).length;

    const rankData = [
      { label: 'Tốt (≥ 8,0)', count: totCount, percent: Math.round((totCount / n) * 100), color: '#059669' },
      { label: 'Khá (6,5–7,9)', count: khaCount, percent: Math.round((khaCount / n) * 100), color: '#1D4ED8' },
      { label: 'Đạt (5,0–6,4)', count: datCount, percent: Math.round((datCount / n) * 100), color: '#0284C7' },
      { label: 'Chưa đạt (< 5,0)', count: chuaDatCount, percent: Math.round((chuaDatCount / n) * 100), color: '#DC2626' },
    ];

    let p1EarnedSum = 0;
    let p1MaxSum = 0;
    let p2EarnedSum = 0;
    let p2MaxSum = 0;
    let p3EarnedSum = 0;
    let p3MaxSum = 0;

    for (const sub of filtered) {
      const ex = examMap.get(sub.examId);
      const p1Unit = ex?.part1PointPerQ ?? 0.25;
      const p2Unit = ex?.part2PointMaxPerQ ?? 1.0;
      const p3Unit = ex?.part3PointPerQ ?? 0.5;

      p1EarnedSum += sub.part1Score;
      p1MaxSum += sub.part1Total * p1Unit;
      p2EarnedSum += sub.part2Score;
      p2MaxSum += (sub.part2TotalStatements / 4) * p2Unit;
      p3EarnedSum += sub.part3Score;
      p3MaxSum += sub.part3Total * p3Unit;
    }

    const partData = [
      {
        label: 'Phần I · Nhiều lựa chọn',
        avgPct: p1MaxSum > 0 ? Math.round((p1EarnedSum / p1MaxSum) * 100) : 0,
        avgEarned: roundScore(p1EarnedSum / n),
        avgMax: roundScore(p1MaxSum / n),
        color: '#1D4ED8',
      },
      {
        label: 'Phần II · Đúng/Sai lũy tiến',
        avgPct: p2MaxSum > 0 ? Math.round((p2EarnedSum / p2MaxSum) * 100) : 0,
        avgEarned: roundScore(p2EarnedSum / n),
        avgMax: roundScore(p2MaxSum / n),
        color: '#0284C7',
      },
      {
        label: 'Phần III · Trả lời ngắn',
        avgPct: p3MaxSum > 0 ? Math.round((p3EarnedSum / p3MaxSum) * 100) : 0,
        avgEarned: roundScore(p3EarnedSum / n),
        avgMax: roundScore(p3MaxSum / n),
        color: '#059669',
      },
    ];

    return {
      avg: total / n,
      highest,
      passRate: Math.round((passed / n) * 100),
      bands,
      rankData,
      partData,
    };
  }, [filtered, examMap]);

  const activeExamLabel = useMemo(() => {
    if (examFilter === 'all') return 'Tất cả các kỳ thi';
    return examMap.get(examFilter)?.title ?? examFilter;
  }, [examFilter, examMap]);

  const activeClassLabel = classFilter === 'all' ? 'Tất cả các lớp' : `Lớp ${classFilter}`;

  const csvFilename = useMemo(() => {
    const classPart = classFilter === 'all' ? 'tat_ca_lop' : `lop_${classFilter}`;
    const examPart =
      examFilter === 'all'
        ? 'tat_ca_ky_thi'
        : (examMap.get(examFilter)?.roomCode ?? 'ky_thi').toLowerCase();
    const datePart = new Date().toISOString().slice(0, 10);
    return `bang_diem_${classPart}_${examPart}_${datePart}.csv`;
  }, [classFilter, examFilter, examMap]);

  return (
    <>
      <div
        className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${
          printReportOpen ? 'no-print' : ''
        }`}
      >
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
              {isStudent
                ? 'Hồ sơ điểm số & Lịch sử làm bài cá nhân'
                : 'Thống kê phổ điểm & Nhật ký giám sát phòng thi'}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {isStudent
                ? 'Lịch sử bài thi & Kết quả của tôi'
                : 'Bảng điểm & Kết quả thi trực tuyến'}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {isStudent
                ? currentUser
                  ? `Chỉ hiển thị các bài thi do tài khoản ${currentUser.fullName} (SBD ${currentUser.studentSbd ?? '—'}) đã nộp. Bấm vào từng bài để xem chi tiết.`
                  : 'Chỉ hiển thị các bài thi do chính bạn đã nộp trong phiên làm bài hiện tại.'
                : 'Tổng hợp điểm thành phần Phần I, Phần II (lũy tiến), Phần III, phân bố phổ điểm trực quan và xuất tệp PDF / Excel CSV lưu trữ.'}
            </p>
          </div>

          {!isStudent && (
            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={() => setPrintReportOpen(true)}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <FileText className="h-4 w-4" />
                <span>Xuất PDF lưu trữ</span>
              </button>
              <button
                type="button"
                disabled={filtered.length === 0}
                onClick={() => exportSubmissionsToCsv(filtered, csvFilename)}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
              >
                <Download className="h-4 w-4" />
                <span>Xuất bảng điểm CSV</span>
              </button>
            </div>
          )}
        </div>

      {/* Live Unread Proctoring Alerts Banner (Staff only) */}
      {!isStudent && unreadAlerts.length > 0 && (
        <div
          role="region"
          aria-label="Cảnh báo hành vi bất thường mới nhận"
          className="mt-6 rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800/80 dark:bg-amber-950/35"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
              <BellRing className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              <span className="tabular-nums">
                Cảnh báo giám sát phòng thi trực tiếp ({unreadAlerts.length} thông báo mới)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIntegrityFilter('alerts')}
              className="cursor-pointer text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              Lọc danh sách có cảnh báo
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {unreadAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs dark:border-amber-900/60 dark:bg-slate-900"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {alert.studentName} · <span className="font-mono tabular-nums">{alert.studentSbd}</span>
                  </p>
                  <p className="mt-0.5 truncate font-medium text-red-700 dark:text-red-400">
                    {alert.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {alert.roomCode} · {new Date(alert.timestamp).toLocaleTimeString('vi-VN')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onMarkAlertRead?.(alert.id);
                    setSearch(alert.studentSbd);
                    const matched = submissions.find((s) => s.studentSbd === alert.studentSbd);
                    if (matched) setSelectedLogSubmission(matched);
                  }}
                  className="shrink-0 cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Kiểm tra
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters & Class Tracking Strip */}
      <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div
          className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
            isStudent ? 'lg:grid-cols-5' : 'lg:grid-cols-6'
          }`}
        >
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isStudent
                  ? 'Tìm tên kỳ thi hoặc mã phòng...'
                  : 'Tìm Họ tên, SBD hoặc Lớp (VD: 12A1)...'
              }
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
            />
          </div>

          <select
            aria-label="Lọc theo khối lớp"
            value={gradeFilter === 'all' ? 'all' : String(gradeFilter)}
            onChange={(e) => {
              const val = e.target.value;
              handleGradeChange(val === 'all' ? 'all' : normalizeGradeValue(val));
            }}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
          >
            <option value="all">Tất cả khối</option>
            {availableGrades.map((g) => (
              <option key={String(g)} value={String(g)}>
                {formatGradeLabel(g)}
              </option>
            ))}
          </select>

          {!isStudent && (
            <select
              aria-label="Lọc theo lớp"
              value={classFilter}
              onChange={(e) => handleClassChange(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
            >
              <option value="all">Tất cả các lớp ({submissions.length} bài)</option>
              {visibleClassOptions.map((cls) => {
                const count = submissions.filter(
                  (s) => normalizeClassName(s.studentClass) === normalizeClassName(cls),
                ).length;
                return (
                  <option key={cls} value={cls}>
                    Lớp {cls} ({count} bài)
                  </option>
                );
              })}
            </select>
          )}

          <select
            aria-label="Lọc theo kỳ thi"
            value={examFilter}
            onChange={(e) => setExamFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
          >
            <option value="all">
              {classFilter === 'all' || isStudent
                ? `Tất cả kỳ thi (${submissions.length} bài)`
                : `Tất cả bài thi của lớp ${classFilter}`}
            </option>
            {filteredExamsForSelect.map((ex) => {
              const countInScope = submissions.filter(
                (s) =>
                  s.examId === ex.id &&
                  (classFilter === 'all' ||
                    normalizeClassName(s.studentClass) === normalizeClassName(classFilter)),
              ).length;
              return (
                <option key={ex.id} value={ex.id}>
                  {ex.isPrivate ? '[Riêng] ' : ''}
                  {ex.roomCode} · {ex.title} ({countInScope})
                </option>
              );
            })}
          </select>

          <select
            aria-label="Lọc theo giám sát & tính liêm chính"
            value={integrityFilter}
            onChange={(e) =>
              setIntegrityFilter(e.target.value as 'all' | 'alerts' | 'pauses' | 'clean')
            }
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
          >
            <option value="all">Tất cả giám sát</option>
            <option value="alerts">Có cảnh báo giám sát</option>
            <option value="pauses">Có tạm dừng bài thi</option>
            <option value="clean">Hợp lệ hoàn toàn</option>
          </select>
        </div>

        {/* Interactive Class Quick-Tracking Bar (Staff only) */}
        {!isStudent && classMetrics.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div
              role="tablist"
              aria-label="Theo dõi nhanh theo lớp học"
              className="flex flex-wrap items-center gap-1.5"
            >
              <span className="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                Theo dõi theo lớp:
              </span>
              <button
                type="button"
                role="tab"
                aria-selected={classFilter === 'all'}
                onClick={() => handleClassChange('all')}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                  classFilter === 'all'
                    ? 'bg-blue-700 text-white dark:bg-blue-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                Tất cả lớp ({submissions.length})
              </button>
              {classMetrics.map((cm) => {
                const isSelected =
                  normalizeClassName(classFilter) === normalizeClassName(cm.className);
                return (
                  <button
                    key={cm.className}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleClassChange(isSelected ? 'all' : cm.className)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                      isSelected
                        ? 'bg-blue-700 text-white dark:bg-blue-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="font-mono">{cm.className}</span>
                    <span
                      className={
                        isSelected
                          ? 'text-blue-100'
                          : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      · {cm.count} bài{cm.avg !== null ? ` · TB ${formatScoreVi(cm.avg)}` : ''}
                    </span>
                    {cm.alertsCount > 0 && (
                      <span
                        className={
                          isSelected
                            ? 'text-amber-200'
                            : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        · {cm.alertsCount} CB
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setGradeFilter('all');
                  setExamFilter('all');
                  setClassFilter('all');
                  setIntegrityFilter('all');
                }}
                className="cursor-pointer whitespace-nowrap shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPIs + Interactive Recharts Distribution Panel */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white lg:col-span-4 lg:grid-cols-1 lg:divide-x-0 lg:divide-y dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          <div className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Điểm trung bình</p>
            <p className="mt-1 font-mono text-2xl font-bold text-blue-700 tabular-nums dark:text-blue-400">
              {formatScoreVi(analytics.avg)}
            </p>
            <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
              Tính trên {filtered.length} bài thi
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Điểm cao nhất</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
              {formatScoreVi(analytics.highest)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Thang chuẩn 10,00</p>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400">Tỷ lệ đạt (≥ 5,00)</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
              {analytics.passRate}%
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Theo Thông tư 22/2021</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Biểu đồ phân tích kết quả thi (Recharts)
              </h2>
              <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                Dữ liệu cập nhật theo bộ lọc lớp &amp; kỳ thi (n = {filtered.length} bài)
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Chế độ biểu đồ phân tích"
              className="flex flex-wrap items-center gap-1 self-start rounded-lg bg-slate-100 p-1 sm:self-auto dark:bg-slate-800"
            >
              {(
                [
                  { id: 'histogram', label: 'Phổ điểm 0–10' },
                  { id: 'rank_tt22', label: 'Xếp loại TT 22' },
                  { id: 'part_mastery', label: 'Theo 3 Phần' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={chartMode === tab.id}
                  onClick={() => setChartMode(tab.id)}
                  className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    chartMode === tab.id
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              Không có dữ liệu bài thi để hiển thị biểu đồ cho bộ lọc hiện tại.
            </div>
          ) : chartMode === 'histogram' ? (
            <div className="mt-5">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.bands}
                    margin={{ top: 10, right: 12, left: -16, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: chartColors.tick }}
                      axisLine={{ stroke: chartColors.axisLine }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: chartColors.tick }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<HistogramTooltip />}
                      cursor={{ fill: chartColors.cursorFill }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={52}>
                      {analytics.bands.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-red-600" />
                  <span>&lt; 3,5 (Kém)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-amber-600" />
                  <span>3,5 – 4,9 (Chưa đạt)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-sky-600" />
                  <span>5,0 – 6,4 (Đạt)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-blue-700" />
                  <span>6,5 – 7,9 (Khá)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                  <span>8,0 – 10,0 (Tốt)</span>
                </span>
              </div>
            </div>
          ) : chartMode === 'rank_tt22' ? (
            <div className="mt-5 grid grid-cols-1 items-center gap-4 sm:grid-cols-12">
              <div className="h-60 w-full sm:col-span-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.rankData}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={3}
                      stroke={isDark ? '#0F172A' : '#FFFFFF'}
                    >
                      {analytics.rankData.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<RankTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5 sm:col-span-6">
                {analytics.rankData.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/60"
                  >
                    <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                      <span
                        className="h-3 w-3 rounded-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.label}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                      {item.count} bài ({item.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.partData}
                    layout="vertical"
                    margin={{ top: 8, right: 24, left: 12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartColors.grid} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fontSize: 12, fill: chartColors.tick }}
                      axisLine={{ stroke: chartColors.axisLine }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={165}
                      tick={{ fontSize: 12, fill: chartColors.tickStrong, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<PartMasteryTooltip />}
                      cursor={{ fill: chartColors.cursorFill }}
                    />
                    <Bar dataKey="avgPct" radius={[0, 6, 6, 0]} barSize={28}>
                      {analytics.partData.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {isStudent && submissions.length === 0
                ? 'Bạn chưa có bài thi nào đã nộp'
                : 'Chưa có dữ liệu bài thi phù hợp'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isStudent && submissions.length === 0
                ? 'Hệ thống chỉ hiển thị lịch sử những bài thi do chính tài khoản của bạn đã nộp. Hãy vào Phòng thi để bắt đầu làm bài.'
                : 'Thử thay đổi bộ lọc tìm kiếm hoặc vào làm một bài thi mẫu ở mục Phòng thi.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                  <th className="px-5 py-3.5">SBD</th>
                  <th className="px-5 py-3.5">Họ và tên</th>
                  <th className="px-5 py-3.5">Lớp</th>
                  <th className="px-5 py-3.5">Kỳ thi / Môn</th>
                  <th className="px-5 py-3.5">Mã đề</th>
                  <th className="px-5 py-3.5 text-right">Phần I / II / III</th>
                  <th className="px-5 py-3.5 text-right">Tổng điểm</th>
                  <th className="px-5 py-3.5">Xếp loại</th>
                  <th className="px-5 py-3.5">Giám sát</th>
                  <th className="px-5 py-3.5">Nhật ký thao tác</th>
                  <th className="px-5 py-3.5 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((sub) => {
                  const rank = classifyAcademicRankTT22(sub.totalScore);
                  const logs = sub.actionLogs ?? [];
                  const pauseCount = logs.filter((l) => l.type === 'paused_exam').length;
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => onViewSubmission(sub)}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                        {sub.studentSbd}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {sub.studentName}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                        {sub.studentClass}
                      </td>
                      <td className="max-w-[230px] px-5 py-3.5">
                        <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                          {sub.examTitle}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {getSubjectMeta(sub.subject).name}
                          {examMap.get(sub.examId)?.isPrivate ? ' · Đề riêng tư' : ''}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-700 tabular-nums dark:text-slate-300">
                        {sub.variantCode}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                        {formatScoreVi(sub.part1Score)} / {formatScoreVi(sub.part2Score)} /{' '}
                        {formatScoreVi(sub.part3Score)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-sm font-bold text-blue-700 tabular-nums dark:text-blue-400">
                        {formatScoreVi(sub.totalScore)}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {rank.label}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        <div className="space-y-0.5">
                          {sub.violations.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Hợp lệ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span className="tabular-nums">{sub.violations.length} cảnh báo</span>
                            </span>
                          )}
                          {pauseCount > 0 && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 tabular-nums dark:text-slate-400">
                              <Pause className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                              <span>Tạm dừng {pauseCount} lần</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogSubmission(sub);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-[11px] font-semibold text-slate-700 tabular-nums transition-colors hover:border-blue-600 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
                        >
                          <Activity className="h-3.5 w-3.5" />
                          <span>Nhật ký ({logs.length})</span>
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                        {formatDurationMMSS(sub.elapsedSeconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>

      {printReportOpen && (
        <PrintableResultsModal
          submissions={filtered}
          examLabel={activeExamLabel}
          classLabel={activeClassLabel}
          stats={analytics}
          onClose={() => setPrintReportOpen(false)}
        />
      )}

      {selectedLogSubmission && (
        <ActionLogModal
          submission={selectedLogSubmission}
          onClose={() => setSelectedLogSubmission(null)}
          onViewFullSubmission={onViewSubmission}
        />
      )}
    </>
  );
}
