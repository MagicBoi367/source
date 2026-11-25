import {
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  BellRing,
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Info,
  KeyRound,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
  X,
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
  Question,
  SubjectId,
  SystemConfig,
  SystemLogCategory,
  SystemLogEntry,
  SystemLogLevel,
  TeacherAlert,
  UserAccount,
  UserRole,
} from '../types/exam';
import {
  deleteStoredAccount,
  exportAccountsToCsv,
  listAccountsSync,
  registerAccount,
  resetAccountPasswordDirect,
  switchSessionAccount,
  updateStoredAccount,
} from '../utils/authStore';
import {
  areGradesEqual,
  collectAvailableGrades,
  exportSubmissionsToCsv,
  formatExamClassScope,
  formatGradeLabel,
  formatScoreVi,
  getExamDurationMinutes,
  getSubjectMeta,
  normalizeGradeValue,
} from '../utils/scoring2025';
import {
  deleteCustomSubject,
  ensureCatalogSubjectRegistered,
  searchSubjectCandidates,
  useSubjects,
} from '../utils/subjectStore';
import { AddSubjectModal } from './AddSubjectModal';
import { SubjectSearchSelect } from './SubjectSearchSelect';
import {
  appendSystemLog,
  exportSystemLogsCsv,
  exportSystemLogsJson,
  LOG_CATEGORY_LABELS,
  LOG_LEVEL_LABELS,
} from '../utils/systemLogs';
import type { AppView } from './Header';

interface AdminDashboardProps {
  currentUser: UserAccount | null;
  isDark: boolean;
  questions: Question[];
  exams: Exam[];
  submissions: ExamSubmission[];
  alerts: TeacherAlert[];
  systemLogs?: SystemLogEntry[];
  systemConfig: SystemConfig;
  onUpdateSystemConfig: (patch: Partial<SystemConfig>) => void;
  onNavigate: (view: AppView) => void;
  onUpdateExam: (exam: Exam) => void;
  onDeleteExam: (id: string) => void;
  onDeleteAllExams?: () => void;
  onDeleteAllQuestions?: () => void;
  onPrintExam: (exam: Exam) => void;
  onViewSubmission: (sub: ExamSubmission) => void;
  onDeleteSubmission: (id: string) => void;
  onMarkAlertRead: (id: string) => void;
  onMarkAllAlertsRead: () => void;
  onClearAlerts: () => void;
  onTriggerTestAlert: () => void;
  onClearSystemLogs?: () => void;
  onSwitchAccount: (user: UserAccount) => void;
  onResetAllData: () => void;
}

type AdminTab = 'overview' | 'users' | 'content' | 'system' | 'logs';

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  payload?: {
    name?: string;
    label?: string;
    questions?: number;
    exams?: number;
    submissions?: number;
    count?: number;
    value?: number;
    percent?: number;
  };
}

function SubjectChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
      <p className="font-display font-bold text-slate-900 dark:text-slate-50">
        {item.name}
      </p>
      <div className="mt-1 space-y-0.5 font-mono text-slate-700 tabular-nums dark:text-slate-300">
        <p>Câu hỏi: <strong>{item.questions ?? 0}</strong></p>
        <p>Đề thi: <strong>{item.exams ?? 0}</strong></p>
        <p>Lượt nộp bài: <strong>{item.submissions ?? 0}</strong></p>
      </div>
    </div>
  );
}

function SimpleCountTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
      <p className="font-display font-bold text-slate-900 dark:text-slate-50">
        {item.label ?? item.name}
      </p>
      <p className="mt-1 font-mono text-slate-700 tabular-nums dark:text-slate-300">
        Số lượng: <strong>{item.count ?? item.value ?? 0}</strong>
        {item.percent !== undefined ? ` (${item.percent}%)` : ''}
      </p>
    </div>
  );
}

function getStorageUsageKb(): number {
  try {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('kythi2025_')) continue;
      const v = localStorage.getItem(k) ?? '';
      bytes += (k.length + v.length) * 2;
    }
    return Math.max(1, Math.round(bytes / 1024));
  } catch {
    return 0;
  }
}

export function AdminDashboard({
  currentUser,
  isDark,
  questions,
  exams,
  submissions,
  alerts,
  systemLogs = [],
  systemConfig,
  onUpdateSystemConfig,
  onNavigate,
  onUpdateExam,
  onDeleteExam,
  onDeleteAllExams,
  onDeleteAllQuestions,
  onPrintExam,
  onViewSubmission,
  onDeleteSubmission,
  onMarkAlertRead,
  onMarkAllAlertsRead,
  onClearAlerts,
  onTriggerTestAlert,
  onClearSystemLogs,
  onSwitchAccount,
  onResetAllData,
}: AdminDashboardProps) {
  const subjects = useSubjects();
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [subjectCatalogSearch, setSubjectCatalogSearch] = useState('');
  const [confirmDeleteSubjectId, setConfirmDeleteSubjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [accounts, setAccounts] = useState<UserAccount[]>(() => listAccountsSync());

  // User management state
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('student');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSbd, setNewSbd] = useState('');
  const [newClass, setNewClass] = useState('12A1');
  const [newSchool, setNewSchool] = useState('THPT Chuyên Chu Văn An');
  const [newSubject, setNewSubject] = useState<SubjectId>('');
  const [userFeedback, setUserFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('student');
  const [editSbd, setEditSbd] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editSubject, setEditSubject] = useState<SubjectId>('toan');

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  // Content management state
  const [examSearch, setExamSearch] = useState('');
  const [examGradeFilter, setExamGradeFilter] = useState<'all' | GradeLevel>('all');
  const [confirmDeleteExamId, setConfirmDeleteExamId] = useState<string | null>(null);
  const [confirmDeleteAllExamsOpen, setConfirmDeleteAllExamsOpen] = useState(false);
  const [confirmDeleteAllQuestionsOpen, setConfirmDeleteAllQuestionsOpen] = useState(false);
  const [contentFeedback, setContentFeedback] = useState<string | null>(null);
  const [subSearch, setSubSearch] = useState('');
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // System logs state
  const [logSearch, setLogSearch] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState<'all' | SystemLogCategory>('all');
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | SystemLogLevel>('all');
  const [logRoleFilter, setLogRoleFilter] = useState<
    'all' | UserRole | 'guest' | 'system'
  >('all');
  const [logLimit, setLogLimit] = useState<50 | 100 | 250 | 'all'>(100);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SystemLogEntry | null>(null);

  useEffect(() => {
    if (!confirmDeleteAllExamsOpen && !confirmDeleteAllQuestionsOpen && !selectedLog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setConfirmDeleteAllExamsOpen(false);
        setConfirmDeleteAllQuestionsOpen(false);
        setSelectedLog(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [confirmDeleteAllExamsOpen, confirmDeleteAllQuestionsOpen, selectedLog]);

  const gridStroke = isDark ? '#334155' : '#E2E8F0';
  const tickFill = isDark ? '#94A3B8' : '#64748B';

  const stats = useMemo(() => {
    const studentCount = accounts.filter((a) => a.role === 'student').length;
    const teacherCount = accounts.filter((a) => a.role === 'teacher').length;
    const adminCount = accounts.filter((a) => a.role === 'admin').length;

    const activeExams = exams.filter((e) => e.status === 'active').length;
    const draftExams = exams.filter((e) => e.status === 'draft').length;
    const closedExams = exams.filter((e) => e.status === 'closed').length;

    const p1Q = questions.filter((q) => q.type === 'multiple_choice').length;
    const p2Q = questions.filter((q) => q.type === 'true_false').length;
    const p3Q = questions.filter((q) => q.type === 'short_answer').length;

    const avgScore =
      submissions.length > 0
        ? submissions.reduce((sum, s) => sum + s.totalScore, 0) / submissions.length
        : 0;
    const passCount = submissions.filter((s) => s.totalScore >= 5).length;
    const passRate =
      submissions.length > 0 ? Math.round((passCount / submissions.length) * 100) : 0;

    const unreadAlerts = alerts.filter((a) => !a.read).length;
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical').length;
    const flaggedSubmissions = submissions.filter((s) => s.violations.length > 0).length;

    return {
      studentCount,
      teacherCount,
      adminCount,
      activeExams,
      draftExams,
      closedExams,
      p1Q,
      p2Q,
      p3Q,
      avgScore,
      passRate,
      unreadAlerts,
      criticalAlerts,
      flaggedSubmissions,
      storageKb: getStorageUsageKb(),
    };
  }, [accounts, alerts, exams, questions, submissions]);

  const subjectStatsData = useMemo(() => {
    return subjects.map((meta) => ({
      name: meta.shortName,
      questions: questions.filter((q) => q.subject === meta.id).length,
      exams: exams.filter((e) => e.subject === meta.id).length,
      submissions: submissions.filter((s) => s.subject === meta.id).length,
    }));
  }, [exams, questions, subjects, submissions]);

  const scoreDistributionData = useMemo(() => {
    const bands = [
      { label: '< 3,5', min: 0, max: 3.499, color: '#DC2626' },
      { label: '3,5 – 4,9', min: 3.5, max: 4.999, color: '#D97706' },
      { label: '5,0 – 6,4', min: 5.0, max: 6.499, color: '#0284C7' },
      { label: '6,5 – 7,9', min: 6.5, max: 7.999, color: '#1D4ED8' },
      { label: '8,0 – 8,9', min: 8.0, max: 8.999, color: '#059669' },
      { label: '9,0 – 10', min: 9.0, max: 10.01, color: '#047857' },
    ];
    return bands.map((b) => {
      const count = submissions.filter(
        (s) => s.totalScore >= b.min && s.totalScore <= b.max,
      ).length;
      const percent =
        submissions.length > 0 ? Math.round((count / submissions.length) * 100) : 0;
      return { ...b, count, percent };
    });
  }, [submissions]);

  const rolePieData = useMemo(() => {
    const total = Math.max(1, accounts.length);
    return [
      {
        label: 'Học sinh',
        value: stats.studentCount,
        percent: Math.round((stats.studentCount / total) * 100),
        color: '#1D4ED8',
      },
      {
        label: 'Giáo viên',
        value: stats.teacherCount,
        percent: Math.round((stats.teacherCount / total) * 100),
        color: '#059669',
      },
      {
        label: 'Quản trị viên',
        value: stats.adminCount,
        percent: Math.round((stats.adminCount / total) * 100),
        color: '#D97706',
      },
    ].filter((d) => d.value > 0);
  }, [accounts.length, stats.adminCount, stats.studentCount, stats.teacherCount]);

  const filteredAccounts = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (userRoleFilter !== 'all' && acc.role !== userRoleFilter) return false;
      if (!q) return true;
      return (
        acc.id.toLowerCase().includes(q) ||
        acc.fullName.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        (acc.studentSbd ?? '').toLowerCase().includes(q) ||
        (acc.studentClass ?? '').toLowerCase().includes(q) ||
        (acc.schoolName ?? '').toLowerCase().includes(q)
      );
    });
  }, [accounts, userRoleFilter, userSearch]);

  const availableExamGrades = useMemo(
    () => collectAvailableGrades(exams, true),
    [exams],
  );

  const filteredExams = useMemo(() => {
    const q = examSearch.trim().toLowerCase();
    return exams.filter((e) => {
      if (examGradeFilter !== 'all' && !areGradesEqual(e.grade, examGradeFilter)) return false;
      if (!q) return true;
      const classMatch = (e.targetClasses ?? []).some((c) => c.toLowerCase().includes(q));
      return (
        e.title.toLowerCase().includes(q) ||
        e.roomCode.toLowerCase().includes(q) ||
        getSubjectMeta(e.subject).name.toLowerCase().includes(q) ||
        classMatch
      );
    });
  }, [examGradeFilter, examSearch, exams]);

  const filteredSubmissions = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.studentSbd.toLowerCase().includes(q) ||
        s.examTitle.toLowerCase().includes(q) ||
        s.roomCode.toLowerCase().includes(q),
    );
  }, [subSearch, submissions]);

  const logStats = useMemo(() => {
    const infoCount = systemLogs.filter((l) => l.level === 'info').length;
    const warningCount = systemLogs.filter((l) => l.level === 'warning').length;
    const errorCount = systemLogs.filter((l) => l.level === 'error').length;
    return { total: systemLogs.length, infoCount, warningCount, errorCount };
  }, [systemLogs]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return systemLogs.filter((log) => {
      if (logCategoryFilter !== 'all' && log.category !== logCategoryFilter) return false;
      if (logLevelFilter !== 'all' && log.level !== logLevelFilter) return false;
      if (logRoleFilter !== 'all' && log.actorRole !== logRoleFilter) return false;
      if (!q) return true;
      return (
        log.action.toLowerCase().includes(q) ||
        log.detail.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        (log.targetLabel ?? '').toLowerCase().includes(q) ||
        log.id.toLowerCase().includes(q)
      );
    });
  }, [logCategoryFilter, logLevelFilter, logRoleFilter, logSearch, systemLogs]);

  const displayedLogs = useMemo(() => {
    if (logLimit === 'all') return filteredLogs;
    return filteredLogs.slice(0, logLimit);
  }, [filteredLogs, logLimit]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFeedback(null);
    if (newRole === 'admin' && currentUser?.role !== 'admin') {
      setUserFeedback({
        type: 'err',
        msg: 'Chỉ tài khoản Quản trị viên (Admin) mới có quyền tạo thêm tài khoản Admin.',
      });
      return;
    }
    if (newRole === 'teacher' && !newSubject.trim()) {
      setUserFeedback({ type: 'err', msg: 'Vui lòng tìm kiếm và chọn Môn phụ trách cho giáo viên.' });
      return;
    }
    const res = await registerAccount(
      {
        email: newEmail,
        password: newPassword,
        fullName: newName,
        role: newRole,
        studentSbd: newRole === 'student' ? newSbd : undefined,
        studentClass: newRole === 'student' ? newClass : undefined,
        schoolName: newRole !== 'student' ? newSchool : undefined,
        subject: newRole === 'teacher' ? newSubject : undefined,
      },
      { actorRole: currentUser?.role },
    );
    if (!res.ok) {
      setUserFeedback({ type: 'err', msg: res.error });
      return;
    }
    setAccounts(listAccountsSync());
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewSbd('');
    setShowCreateUser(false);
    setUserFeedback({
      type: 'ok',
      msg: `Đã tạo tài khoản ${
        res.user.role === 'admin'
          ? 'Quản trị viên'
          : res.user.role === 'teacher'
            ? 'Giáo viên'
            : 'Học sinh'
      } "${res.user.fullName}" · ID: ${res.user.id} (${res.user.email}).`,
    });
  };

  const startEditingUser = (acc: UserAccount) => {
    setEditingUserId(acc.id);
    setEditName(acc.fullName);
    setEditRole(acc.role);
    setEditSbd(acc.studentSbd ?? '');
    setEditClass(acc.studentClass ?? '12A1');
    setEditSchool(acc.schoolName ?? 'THPT Chuyên Chu Văn An');
    setEditSubject(acc.subject ?? 'toan');
    setResetUserId(null);
    setConfirmDeleteUserId(null);
    setUserFeedback(null);
  };

  const handleSaveEditUser = (accountId: string) => {
    const res = updateStoredAccount(
      accountId,
      {
        fullName: editName,
        role: editRole,
        studentSbd: editSbd,
        studentClass: editClass,
        schoolName: editSchool,
        subject: editSubject,
      },
      { actorRole: currentUser?.role },
    );
    if (!res.ok) {
      setUserFeedback({ type: 'err', msg: res.error });
      return;
    }
    if (accountId === currentUser?.id) {
      onSwitchAccount(res.user);
    }
    setAccounts(listAccountsSync());
    setEditingUserId(null);
    setUserFeedback({
      type: 'ok',
      msg: `Đã cập nhật thông tin & phân quyền cho ${res.user.fullName} (ID: ${res.user.id}).`,
    });
  };

  const handleResetPw = async (accountId: string) => {
    const res = await resetAccountPasswordDirect(accountId, resetPw);
    if (!res.ok) {
      setUserFeedback({ type: 'err', msg: res.error });
      return;
    }
    setResetUserId(null);
    setResetPw('');
    setUserFeedback({
      type: 'ok',
      msg: `Đã cấp lại mật khẩu mới cho tài khoản ${res.user.fullName}.`,
    });
  };

  const handleDeleteUser = (accountId: string) => {
    const next = deleteStoredAccount(accountId);
    setAccounts(next);
    setConfirmDeleteUserId(null);
    setUserFeedback({ type: 'ok', msg: 'Đã xóa tài khoản khỏi hệ thống.' });
  };

  const handleExportFullBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      systemConfig,
      accounts: accounts,
      questionsCount: questions.length,
      examsCount: exams.length,
      submissionsCount: submissions.length,
      systemLogsCount: systemLogs.length,
      questions,
      exams,
      submissions,
      alerts,
      systemLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kythi2025_admin_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    appendSystemLog({
      category: 'system',
      level: 'info',
      action: 'Xuất bản sao lưu toàn hệ thống (JSON)',
      detail: `Xuất gói sao lưu gồm ${accounts.length} tài khoản, ${exams.length} đề thi, ${questions.length} câu hỏi và ${submissions.length} bài nộp.`,
      actorName: currentUser?.fullName ?? 'Quản trị viên',
      actorRole: currentUser?.role ?? 'admin',
      actorId: currentUser?.id,
      targetLabel: 'JSON Backup',
    });
  };

  const cycleExamStatus = (exam: Exam) => {
    const nextStatus: Exam['status'] =
      exam.status === 'active'
        ? 'closed'
        : exam.status === 'closed'
          ? 'draft'
          : 'active';
    onUpdateExam({ ...exam, status: nextStatus });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold tracking-wide text-blue-700 dark:text-blue-400">
            Trung tâm Quản trị Hệ thống · Admin Control Panel
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
            Quản trị toàn diện NTPEXION
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Điều hành tài khoản người dùng (Học sinh, Giáo viên, Admin), đề thi, ngân hàng câu hỏi,
            cấu hình hệ thống và thống kê hoạt động toàn trang web.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportFullBackupJson}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Sao lưu toàn bộ (JSON)</span>
          </button>
          <button
            type="button"
            onClick={() => exportSubmissionsToCsv(submissions)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Xuất bảng điểm CSV</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div
        role="tablist"
        aria-label="Phân khu quản trị Admin"
        className="mt-6 flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-900"
      >
        {(
          [
            { id: 'overview', label: 'Thống kê Web & Tổng quan', icon: BarChart3 },
            { id: 'users', label: `Quản lý User (${accounts.length})`, icon: Users },
            {
              id: 'content',
              label: `Đề thi & Bài nộp (${exams.length} / ${submissions.length})`,
              icon: Layers,
            },
            {
              id: 'system',
              label: `Cấu hình & Giám sát (${stats.unreadAlerts} mới)`,
              icon: Settings2,
            },
            {
              id: 'logs',
              label: `Nhật ký hệ thống (${systemLogs.length})`,
              icon: ScrollText,
            },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: WEB OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="mt-6 space-y-6">
          {/* 6 KPI Cards */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Tổng tài khoản
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
                {accounts.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {stats.studentCount} HS · {stats.teacherCount} GV · {stats.adminCount} Admin
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Đề thi &amp; Phòng thi
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-blue-700 tabular-nums dark:text-blue-400">
                {exams.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {stats.activeExams} mở · {stats.draftExams} nháp · {stats.closedExams} đóng
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Ngân hàng câu hỏi
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
                {questions.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                P1: {stats.p1Q} · P2: {stats.p2Q} · P3: {stats.p3Q}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Lượt nộp bài &amp; TB
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                {submissions.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                TB {formatScoreVi(stats.avgScore)}đ · Đạt {stats.passRate}%
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Cảnh báo giám sát
              </p>
              <p
                className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
                  stats.criticalAlerts > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-50'
                }`}
              >
                {alerts.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {stats.unreadAlerts} chưa đọc · {stats.flaggedSubmissions} bài có cảnh báo
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Lưu trữ cục bộ
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
                {stats.storageKb} KB
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Đồng bộ trình duyệt
              </p>
            </div>
          </section>

          {/* Charts Grid */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Subject Activity Bar Chart */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                Thống kê nội dung &amp; lượt thi theo Môn học
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                So sánh số câu hỏi, đề thi và bài nộp trên 5 môn
              </p>
              <div className="mt-4 h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={subjectStatsData}
                    margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickFill }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
                    <Tooltip content={<SubjectChartTooltip />} />
                    <Bar dataKey="questions" name="Câu hỏi" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="exams" name="Đề thi" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="submissions" name="Bài nộp" fill="#D97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-blue-700" />
                  Câu hỏi
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                  Đề thi
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-amber-600" />
                  Bài nộp
                </span>
              </div>
            </div>

            {/* Score Distribution Chart */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                Phổ điểm toàn hệ thống
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Phân tầng điểm số trên {submissions.length} bài thi đã chấm
              </p>
              <div className="mt-4 h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={scoreDistributionData}
                    margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: tickFill }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
                    <Tooltip content={<SimpleCountTooltip />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {scoreDistributionData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* User Role Breakdown Pie */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-3 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                Cơ cấu tài khoản
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Tỷ lệ Học sinh, Giáo viên &amp; Admin
              </p>
              <div className="mt-3 h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={rolePieData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={38}
                      outerRadius={66}
                      paddingAngle={3}
                    >
                      {rolePieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<SimpleCountTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5 text-xs">
                {rolePieData.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between text-slate-700 dark:text-slate-300"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.label}</span>
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {item.value} ({item.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* All Feature Shortcuts Grid */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              Điều khiển nhanh toàn bộ chức năng Web
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Truy cập trực tiếp từng phân hệ nghiệp vụ hoặc chuyển tới tab quản trị chuyên sâu
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: 'Quản lý User & Phân quyền',
                  desc: `Tạo mới, sửa vai trò, cấp lại mật khẩu cho ${accounts.length} tài khoản`,
                  icon: Users,
                  action: () => setActiveTab('users'),
                },
                {
                  title: 'Tổ chức đề thi & Nhập file',
                  desc: `Sinh mã đề hoán vị, nhập Đề/Đáp án Word & Excel (${exams.length} đề)`,
                  icon: FileCheck2,
                  action: () => onNavigate('exam_manager'),
                },
                {
                  title: 'Ngân hàng câu hỏi 2025',
                  desc: `Biên soạn & phân loại ${questions.length} câu hỏi đủ 3 dạng thức`,
                  icon: BookOpen,
                  action: () => onNavigate('question_bank'),
                },
                {
                  title: 'Kết quả thi & Nhật ký hành vi',
                  desc: `Phân tích phổ điểm, xuất CSV & xem log vi phạm (${submissions.length} bài)`,
                  icon: BarChart3,
                  action: () => onNavigate('results'),
                },
                {
                  title: 'Giám sát & Cấu hình Web',
                  desc: 'Bật/tắt tự đăng ký, chế độ khách, thông báo toàn trang & cảnh báo',
                  icon: Settings2,
                  action: () => setActiveTab('system'),
                },
                {
                  title: 'Cổng phòng thi thí sinh',
                  desc: 'Kiểm tra danh sách phòng thi đang mở và thi thử theo mã phòng',
                  icon: ShieldCheck,
                  action: () => onNavigate('portal'),
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.title}
                    type="button"
                    onClick={card.action}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {card.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                        {card.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: FULL USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="mt-6 space-y-5">
          {/* Toolbar */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Tìm tên, ID, email, SBD, lớp, trường..."
                  className="h-9 w-64 rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {(
                  [
                    { id: 'all', label: `Tất cả (${accounts.length})` },
                    { id: 'student', label: `Học sinh (${stats.studentCount})` },
                    { id: 'teacher', label: `Giáo viên (${stats.teacherCount})` },
                    { id: 'admin', label: `Admin (${stats.adminCount})` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setUserRoleFilter(f.id)}
                    className={`cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      userRoleFilter === f.id
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportAccountsToCsv(accounts)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Xuất CSV User</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateUser((v) => !v);
                  setUserFeedback(null);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{showCreateUser ? 'Ẩn form tạo User' : 'Tạo User mới'}</span>
              </button>
            </div>
          </div>

          {userFeedback && (
            <div
              role={userFeedback.type === 'err' ? 'alert' : 'status'}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
                userFeedback.type === 'err'
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              {userFeedback.type === 'err' ? (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              <span>{userFeedback.msg}</span>
            </div>
          )}

          {/* Create New User Panel */}
          {showCreateUser && (
            <form
              onSubmit={handleCreateUser}
              className="rounded-xl border border-blue-200 bg-white p-5 shadow-xs dark:border-blue-900/60 dark:bg-slate-900"
            >
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                Tạo tài khoản mới (Học sinh / Giáo viên / Quản trị viên)
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Vai trò
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="student">Học sinh (cấp ID HVxxxx)</option>
                    <option value="teacher">Giáo viên (cấp ID GVxxxx)</option>
                    {currentUser?.role === 'admin' && (
                      <option value="admin">Quản trị viên Admin (cấp ID ADxxxx)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email đăng nhập
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@kythi2025.edu.vn"
                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                {newRole === 'student' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Số báo danh (trống = tự cấp)
                      </label>
                      <input
                        type="text"
                        value={newSbd}
                        onChange={(e) => setNewSbd(e.target.value.toUpperCase())}
                        placeholder="0102888"
                        className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Lớp
                      </label>
                      <input
                        type="text"
                        required
                        value={newClass}
                        onChange={(e) => setNewClass(e.target.value.toUpperCase())}
                        className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Đơn vị / Trường
                      </label>
                      <input
                        type="text"
                        required
                        value={newSchool}
                        onChange={(e) => setNewSchool(e.target.value)}
                        className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    {newRole === 'teacher' && (
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Môn phụ trách
                          </label>
                          <button
                            type="button"
                            onClick={() => setAddSubjectModalOpen(true)}
                            className="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                          >
                            + Thêm môn
                          </button>
                        </div>
                        <SubjectSearchSelect
                          compact
                          value={newSubject}
                          onChange={(val) => setNewSubject(val)}
                          placeholder="Tìm môn phụ trách..."
                          ariaLabel="Tìm kiếm và chọn môn phụ trách"
                          currentUser={currentUser}
                          onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
                          className="mt-1.5"
                        />
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mật khẩu (≥ 6 ký tự)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••"
                    className="mt-1.5 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="cursor-pointer rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Lưu tài khoản</span>
                </button>
              </div>
            </form>
          )}

          {/* User Directory Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredAccounts.length === 0 ? (
                <div className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  Không tìm thấy người dùng phù hợp bộ lọc.
                </div>
              ) : (
                filteredAccounts.map((acc) => {
                  const isSelf = currentUser?.id === acc.id;
                  const isEditing = editingUserId === acc.id;
                  const isResetting = resetUserId === acc.id;
                  const isConfirmDelete = confirmDeleteUserId === acc.id;

                  return (
                    <div key={acc.id} className="px-5 py-3.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-slate-700 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800 dark:text-slate-200">
                              ID: {acc.id}
                            </span>
                            <span className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                              {acc.fullName}
                            </span>
                            <span
                              className={`font-semibold ${
                                acc.role === 'admin'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : acc.role === 'teacher'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-blue-700 dark:text-blue-400'
                              }`}
                            >
                              {acc.role === 'admin'
                                ? 'Quản trị viên (Admin)'
                                : acc.role === 'teacher'
                                  ? 'Giáo viên'
                                  : 'Học sinh'}
                            </span>
                            {isSelf && (
                              <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                (Phiên hiện tại)
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {acc.email}
                            {acc.role === 'student'
                              ? ` · SBD ${acc.studentSbd ?? '—'} · Lớp ${acc.studentClass ?? '—'}`
                              : acc.role === 'teacher'
                                ? ` · ${getSubjectMeta(acc.subject ?? 'toan').name} · ${acc.schoolName ?? ''}`
                                : ` · ${acc.schoolName ?? 'Ban Quản trị'}`}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              isEditing ? setEditingUserId(null) : startEditingUser(acc)
                            }
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Sửa / Phân quyền</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetUserId(isResetting ? null : acc.id);
                              setResetPw('');
                              setEditingUserId(null);
                              setConfirmDeleteUserId(null);
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <KeyRound className="h-3 w-3" />
                            <span>Đặt lại MK</span>
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                const switched = switchSessionAccount(acc.id);
                                if (switched) onSwitchAccount(switched);
                              }}
                              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-blue-950/40"
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                              <span>Đăng nhập thử</span>
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              type="button"
                              aria-label={`Xóa ${acc.fullName}`}
                              onClick={() =>
                                setConfirmDeleteUserId(isConfirmDelete ? null : acc.id)
                              }
                              className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-950/60">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-[11px] sm:col-span-4 dark:border-slate-800">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                              ID hiện tại: {acc.id}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              Đổi vai trò sẽ tự động cấp ID mới theo đầu mã vai trò (HV / GV / AD)
                            </span>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                              Họ và tên
                            </label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                              Vai trò
                            </label>
                            <select
                              value={editRole}
                              disabled={isSelf}
                              onChange={(e) => setEditRole(e.target.value as UserRole)}
                              className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              <option value="student">Học sinh (HVxxxx)</option>
                              <option value="teacher">Giáo viên (GVxxxx)</option>
                              {(currentUser?.role === 'admin' || acc.role === 'admin') && (
                                <option value="admin">Admin (ADxxxx)</option>
                              )}
                            </select>
                          </div>
                          {editRole === 'student' ? (
                            <>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  Số báo danh
                                </label>
                                <input
                                  type="text"
                                  value={editSbd}
                                  onChange={(e) => setEditSbd(e.target.value.toUpperCase())}
                                  className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  Lớp
                                </label>
                                <input
                                  type="text"
                                  value={editClass}
                                  onChange={(e) => setEditClass(e.target.value.toUpperCase())}
                                  className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  Đơn vị / Trường
                                </label>
                                <input
                                  type="text"
                                  value={editSchool}
                                  onChange={(e) => setEditSchool(e.target.value)}
                                  className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                />
                              </div>
                              {editRole === 'teacher' && (
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                    Môn phụ trách
                                  </label>
                                  <SubjectSearchSelect
                                    compact
                                    value={editSubject}
                                    onChange={(val) => setEditSubject(val)}
                                    placeholder="Tìm môn phụ trách..."
                                    ariaLabel="Tìm kiếm và chọn môn phụ trách"
                                    currentUser={currentUser}
                                    onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
                                    className="mt-1"
                                  />
                                </div>
                              )}
                            </>
                          )}
                          <div className="flex items-center justify-end gap-2 sm:col-span-4">
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="cursor-pointer rounded-md border border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditUser(acc.id)}
                              className="cursor-pointer rounded-md bg-blue-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                              Lưu thay đổi
                            </button>
                          </div>
                        </div>
                      )}

                      {isResetting && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-950/60">
                          <input
                            type="password"
                            minLength={6}
                            value={resetPw}
                            onChange={(e) => setResetPw(e.target.value)}
                            placeholder="Mật khẩu mới (≥ 6 ký tự)"
                            className="h-8 min-w-[200px] flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => void handleResetPw(acc.id)}
                            className="cursor-pointer rounded-md bg-blue-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                          >
                            Cập nhật mật khẩu
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetUserId(null)}
                            className="cursor-pointer rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            Hủy
                          </button>
                        </div>
                      )}

                      {isConfirmDelete && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                          <span>
                            Xác nhận xóa vĩnh viễn tài khoản <strong>{acc.fullName}</strong>?
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(acc.id)}
                              className="cursor-pointer rounded-md bg-red-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                            >
                              Xóa ngay
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(null)}
                              className="cursor-pointer rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-red-800 dark:bg-slate-900 dark:text-slate-200"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONTENT (EXAMS & SUBMISSIONS OVERSIGHT) */}
      {activeTab === 'content' && (
        <div className="mt-6 space-y-6">
          {/* Exams Management Table */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center dark:border-slate-800">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Điều hành tất cả Đề thi &amp; Phòng thi ({exams.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Đóng/mở phòng thi, bật tắt giám sát Thông tư 09 hoặc mở trình soạn thảo đề
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Lọc theo khối lớp"
                  value={examGradeFilter === 'all' ? 'all' : String(examGradeFilter)}
                  onChange={(e) =>
                    setExamGradeFilter(
                      e.target.value === 'all'
                        ? 'all'
                        : normalizeGradeValue(e.target.value),
                    )
                  }
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="all">Tất cả khối</option>
                  {availableExamGrades.map((g) => (
                    <option key={String(g)} value={String(g)}>
                      {formatGradeLabel(g)}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    placeholder="Tìm tên đề, mã phòng, lớp..."
                    className="h-9 w-52 rounded-lg border border-slate-300 bg-white pr-3 pl-8 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('exam_manager')}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Mở trình Quản lý Đề</span>
                </button>
                {onDeleteAllExams && (
                  <button
                    type="button"
                    disabled={exams.length === 0}
                    onClick={() => {
                      setContentFeedback(null);
                      setConfirmDeleteAllExamsOpen(true);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="tabular-nums">Xóa tất cả đề thi ({exams.length})</span>
                  </button>
                )}
              </div>
            </div>

            {contentFeedback && (
              <div
                role="status"
                className="flex items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{contentFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setContentFeedback(null)}
                  className="cursor-pointer whitespace-nowrap shrink-0 text-[11px] font-semibold underline hover:no-underline"
                >
                  Đóng
                </button>
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredExams.length === 0 ? (
                <div className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  {exams.length === 0
                    ? 'Hiện chưa có đề thi nào trong hệ thống. Bạn có thể tạo đề mới ở Trình Quản lý Đề hoặc khôi phục dữ liệu mẫu ở tab Cấu hình & Giám sát.'
                    : 'Không tìm thấy đề thi phù hợp với bộ lọc hiện tại.'}
                </div>
              ) : (
                filteredExams.map((exam) => {
                const attempts = submissions.filter((s) => s.examId === exam.id).length;
                const totalQ =
                  exam.part1QuestionIds.length +
                  exam.part2QuestionIds.length +
                  exam.part3QuestionIds.length;
                const isDel = confirmDeleteExamId === exam.id;

                return (
                  <div key={exam.id} className="px-5 py-3.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            {exam.roomCode}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                            ·
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {exam.title}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                          {getSubjectMeta(exam.subject).name} · {formatExamClassScope(exam)} ·{' '}
                          {totalQ} câu · {getExamDurationMinutes(exam)} phút · {attempts} lượt nộp ·
                          Tạo bởi {exam.createdBy}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => cycleExamStatus(exam)}
                          className={`cursor-pointer whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                            exam.status === 'active'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : exam.status === 'draft'
                                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {exam.status === 'active'
                            ? 'Đang mở'
                            : exam.status === 'draft'
                              ? 'Bản nháp'
                              : 'Đã đóng'}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onUpdateExam({
                              ...exam,
                              strictProctoring: !exam.strictProctoring,
                            })
                          }
                          className={`cursor-pointer whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                            exam.strictProctoring
                              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                          }`}
                        >
                          {exam.strictProctoring ? 'Giám sát: Bật' : 'Giám sát: Tắt'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onPrintExam(exam)}
                          className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Printer className="h-3 w-3" />
                          <span>In A4</span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Xóa đề ${exam.title}`}
                          onClick={() => setConfirmDeleteExamId(isDel ? null : exam.id)}
                          className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isDel && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                        <span>
                          Xóa đề thi <strong>{exam.title}</strong>?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteExam(exam.id);
                              setConfirmDeleteExamId(null);
                            }}
                            className="cursor-pointer rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                          >
                            Xác nhận xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteExamId(null)}
                            className="cursor-pointer rounded-md border border-red-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-red-800 dark:bg-slate-900 dark:text-slate-200"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
                })
              )}
            </div>
          </section>

          {/* Submissions Oversight */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center dark:border-slate-800">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Quản lý Bài nộp &amp; Vi phạm toàn hệ thống ({submissions.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Xem chi tiết bài làm hoặc loại bỏ bài thi thử nghiệm không hợp lệ
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="Tìm thí sinh, SBD, mã phòng..."
                  className="h-9 w-56 rounded-lg border border-slate-300 bg-white pr-3 pl-8 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                    <th className="px-5 py-3">SBD</th>
                    <th className="px-5 py-3">Thí sinh</th>
                    <th className="px-5 py-3">Đề thi</th>
                    <th className="px-5 py-3 text-right">Điểm tổng</th>
                    <th className="px-5 py-3 text-right">Vi phạm / Log</th>
                    <th className="px-5 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSubmissions.map((sub) => {
                    const isDel = confirmDeleteSubId === sub.id;
                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-mono font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                          {sub.studentSbd}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {sub.studentName}
                          </span>
                          <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                            ({sub.studentClass})
                          </span>
                        </td>
                        <td className="max-w-xs truncate px-5 py-3 text-slate-600 dark:text-slate-300">
                          {sub.examTitle}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                          {formatScoreVi(sub.totalScore)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums">
                          <span
                            className={
                              sub.violations.length > 0
                                ? 'font-bold text-red-600 dark:text-red-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }
                          >
                            {sub.violations.length} VP
                          </span>
                          <span className="mx-1 text-slate-300 dark:text-slate-700">/</span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {sub.actionLogs?.length ?? 0} log
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {isDel ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteSubmission(sub.id);
                                  setConfirmDeleteSubId(null);
                                }}
                                className="cursor-pointer rounded bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                              >
                                Xác nhận xóa
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSubId(null)}
                                className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onViewSubmission(sub)}
                                className="cursor-pointer font-semibold text-blue-700 hover:underline dark:text-blue-400"
                              >
                                Xem phiếu
                              </button>
                              <button
                                type="button"
                                aria-label={`Xóa bài nộp ${sub.studentName}`}
                                onClick={() => setConfirmDeleteSubId(sub.id)}
                                className="cursor-pointer rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: SYSTEM CONFIG, ALERTS & BACKUP */}
      {activeTab === 'system' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Web Feature Flags & Announcements */}
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Cấu hình tính năng &amp; Chính sách truy cập Web
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Các thiết lập này áp dụng trực tiếp cho màn hình Đăng nhập và Cổng phòng thi
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Cho phép tự đăng ký tài khoản mới
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Khi tắt, chỉ Admin hoặc Giáo viên mới có thể tạo tài khoản Học sinh / Giáo viên.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={systemConfig.allowSelfRegistration}
                  onChange={(e) =>
                    onUpdateSystemConfig({ allowSelfRegistration: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Cho phép xem trước cổng thi ở Chế độ Khách
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Hiển thị nút &ldquo;Xem thử không cần đăng nhập&rdquo; tại màn hình Đăng nhập.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={systemConfig.allowGuestPreview}
                  onChange={(e) =>
                    onUpdateSystemConfig({ allowGuestPreview: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700"
                />
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <label className="flex cursor-pointer items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Hiển thị thông báo toàn cổng thi
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Ghim biểu ngữ thông báo khẩn hoặc lịch thi trên đầu trang Phòng thi.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={systemConfig.announcementEnabled}
                    onChange={(e) =>
                      onUpdateSystemConfig({ announcementEnabled: e.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700"
                  />
                </label>

                <textarea
                  rows={2}
                  value={systemConfig.announcementText}
                  onChange={(e) =>
                    onUpdateSystemConfig({ announcementText: e.target.value })
                  }
                  placeholder="Nhập nội dung thông báo gửi thí sinh & giáo viên..."
                  className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Backup & Reset */}
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <h3 className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                <Database className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <span>Sao lưu &amp; Khôi phục dữ liệu Web ({stats.storageKb} KB)</span>
              </h3>
              {contentFeedback && (
                <div
                  role="status"
                  className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{contentFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setContentFeedback(null)}
                    className="cursor-pointer whitespace-nowrap shrink-0 text-[11px] font-semibold underline hover:no-underline"
                  >
                    Đóng
                  </button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportFullBackupJson}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải bản sao lưu JSON</span>
                </button>

                {onDeleteAllExams && (
                  <button
                    type="button"
                    disabled={exams.length === 0}
                    onClick={() => {
                      setContentFeedback(null);
                      setConfirmDeleteAllExamsOpen(true);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="tabular-nums">Xóa tất cả đề thi ({exams.length})</span>
                  </button>
                )}

                {onDeleteAllQuestions && (
                  <button
                    type="button"
                    disabled={questions.length === 0}
                    onClick={() => {
                      setContentFeedback(null);
                      setConfirmDeleteAllQuestionsOpen(true);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="tabular-nums">Xóa hết câu hỏi ({questions.length})</span>
                  </button>
                )}

                {!confirmResetAll ? (
                  <button
                    type="button"
                    onClick={() => setConfirmResetAll(true)}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Khôi phục dữ liệu gốc</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetAllData();
                        setAccounts(listAccountsSync());
                        setConfirmResetAll(false);
                      }}
                      className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Xác nhận khôi phục toàn bộ
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetAll(false)}
                      className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* System Proctoring Alerts Monitor */}
          <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  <BellRing className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Nhật ký cảnh báo giám sát ({alerts.length})</span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Theo dõi chuyển tab, mất kết nối mạng hoặc tạm dừng thi trên toàn hệ thống
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className="cursor-pointer whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950"
                >
                  Mở log toàn hệ thống
                </button>
                <button
                  type="button"
                  onClick={onTriggerTestAlert}
                  className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  + Thử cảnh báo
                </button>
                <button
                  type="button"
                  onClick={onMarkAllAlertsRead}
                  className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-blue-950/40"
                >
                  Đọc tất cả
                </button>
                <button
                  type="button"
                  onClick={onClearAlerts}
                  className="cursor-pointer rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Xóa hết
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-96 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  Hiện chưa có cảnh báo giám sát nào được ghi nhận.
                </div>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    className={`rounded-lg border p-3 text-xs ${
                      !al.read
                        ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800/70 dark:bg-amber-950/30'
                        : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100">
                          {al.title} ·{' '}
                          <span className="font-medium text-blue-700 dark:text-blue-400">
                            {al.studentName} ({al.studentSbd})
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                          {al.detail}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400 tabular-nums">
                          Phòng {al.roomCode} ·{' '}
                          {new Date(al.timestamp).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      {!al.read && (
                        <button
                          type="button"
                          onClick={() => onMarkAlertRead(al.id)}
                          className="shrink-0 cursor-pointer rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Đã xem
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* System Subject Catalog Management (search-to-reveal) */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-12 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  <BookOpen className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  <span>Tra cứu &amp; Quản lý môn học ({subjects.length} môn đang hoạt động)</span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Tìm kiếm tên môn học để xem thông tin, kích hoạt từ danh mục hoặc thêm môn học tùy chỉnh mới.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddSubjectModalOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm môn học mới</span>
              </button>
            </div>

            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={subjectCatalogSearch}
                onChange={(e) => setSubjectCatalogSearch(e.target.value)}
                placeholder="Nhập tên môn học để tìm kiếm (VD: Ngữ văn, Sinh học, Toán...)"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-8 pl-9 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              {subjectCatalogSearch && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa tìm môn"
                  onClick={() => setSubjectCatalogSearch('')}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {!subjectCatalogSearch.trim() ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center dark:border-slate-700 dark:bg-slate-950/40">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Nhập tên môn học vào ô tìm kiếm phía trên để hiển thị danh sách kết quả khớp.
                </p>
              </div>
            ) : (() => {
              const matched = searchSubjectCandidates(subjectCatalogSearch);
              if (matched.length === 0) {
                return (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center dark:border-slate-700 dark:bg-slate-950/40">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Không tìm thấy môn "{subjectCatalogSearch.trim()}". Bạn có thể nhấn{' '}
                      <button
                        type="button"
                        onClick={() => setAddSubjectModalOpen(true)}
                        className="cursor-pointer font-semibold text-blue-700 hover:underline dark:text-blue-400"
                      >
                        Thêm môn học mới
                      </button>{' '}
                      để tạo môn này.
                    </p>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {matched.map((cand) => {
                    const qCount = cand.isRegistered
                      ? questions.filter((q) => q.subject === cand.id).length
                      : 0;
                    const exCount = cand.isRegistered
                      ? exams.filter((e) => e.subject === cand.id).length
                      : 0;
                    return (
                      <div
                        key={`${cand.id}_${cand.name}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                              {cand.name}
                            </p>
                            <span className="font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              ({cand.shortName})
                            </span>
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            {cand.isRegistered
                              ? `${cand.defaultDuration} phút · ${qCount} câu · ${exCount} đề · ${cand.isCustom ? 'Tùy chỉnh' : 'Hệ thống'}`
                              : `${cand.defaultDuration} phút · Chưa kích hoạt`}
                          </p>
                        </div>

                        {!cand.isRegistered ? (
                          <button
                            type="button"
                            onClick={() => {
                              ensureCatalogSubjectRegistered(
                                cand,
                                currentUser
                                  ? {
                                      id: currentUser.id,
                                      name: currentUser.fullName,
                                      role: currentUser.role,
                                    }
                                  : { name: 'Quản trị viên', role: 'admin' },
                              );
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Kích hoạt</span>
                          </button>
                        ) : (
                          cand.isCustom &&
                          (confirmDeleteSubjectId === cand.id ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteCustomSubject(
                                    cand.id,
                                    currentUser
                                      ? {
                                          id: currentUser.id,
                                          name: currentUser.fullName,
                                          role: currentUser.role,
                                        }
                                      : { name: 'Quản trị viên', role: 'admin' },
                                  );
                                  setConfirmDeleteSubjectId(null);
                                }}
                                className="cursor-pointer whitespace-nowrap rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                              >
                                Xóa
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSubjectId(null)}
                                className="cursor-pointer whitespace-nowrap rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Xóa môn ${cand.name}`}
                              onClick={() => setConfirmDeleteSubjectId(cand.id)}
                              className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        </div>
      )}

      {/* TAB 5: FULL SYSTEM AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="mt-6 space-y-5">
          {/* Summary KPIs */}
          <section
            aria-label="Tổng quan nhật ký hệ thống"
            className="grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Tổng sự kiện ghi nhận
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
                {logStats.total}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                Lưu trữ tối đa 500 bản ghi gần nhất
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Thông tin hoạt động
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-blue-700 tabular-nums dark:text-blue-400">
                {logStats.infoCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Đăng nhập, tạo đề, nộp bài, lớp học
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Cảnh báo thao tác
              </p>
              <p className="mt-1.5 font-mono text-2xl font-bold text-amber-600 tabular-nums dark:text-amber-400">
                {logStats.warningCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Xóa dữ liệu, thoát thi, sai mật khẩu
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Lỗi / Vi phạm giám sát
              </p>
              <p
                className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
                  logStats.errorCount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-50'
                }`}
              >
                {logStats.errorCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Chuyển tab, mất mạng, vi phạm quy chế
              </p>
            </div>
          </section>

          {/* Filter & Action Toolbar */}
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                    <ScrollText className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    <span>Nhật ký hoạt động toàn hệ thống</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Theo dõi thời gian thực mọi thao tác xác thực, đề thi, ngân hàng câu hỏi, lớp
                    học, giám sát và cấu hình của toàn bộ người dùng.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportSystemLogsCsv(filteredLogs)}
                    disabled={filteredLogs.length === 0}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Xuất CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportSystemLogsJson(filteredLogs)}
                    disabled={filteredLogs.length === 0}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Xuất JSON</span>
                  </button>

                  {onClearSystemLogs &&
                    (!confirmClearLogs ? (
                      <button
                        type="button"
                        onClick={() => setConfirmClearLogs(true)}
                        disabled={systemLogs.length === 0}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Dọn log cũ</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onClearSystemLogs();
                            setConfirmClearLogs(false);
                            setSelectedLog(null);
                          }}
                          className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Xác nhận xóa log
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearLogs(false)}
                          className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Hủy
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-wrap items-center gap-2.5">
                  <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Tìm hành động, chi tiết, tên user, mã phòng..."
                      aria-label="Tìm kiếm nhật ký hệ thống"
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <select
                    aria-label="Lọc theo phân khu hệ thống"
                    value={logCategoryFilter}
                    onChange={(e) =>
                      setLogCategoryFilter(e.target.value as 'all' | SystemLogCategory)
                    }
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <option value="all">Tất cả phân khu</option>
                    {(Object.entries(LOG_CATEGORY_LABELS) as [SystemLogCategory, string][]).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>

                  <select
                    aria-label="Lọc theo vai trò thực hiện"
                    value={logRoleFilter}
                    onChange={(e) =>
                      setLogRoleFilter(
                        e.target.value as 'all' | UserRole | 'guest' | 'system',
                      )
                    }
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <option value="all">Mọi vai trò</option>
                    <option value="admin">Quản trị viên</option>
                    <option value="teacher">Giáo viên</option>
                    <option value="student">Học sinh</option>
                    <option value="guest">Khách</option>
                    <option value="system">Hệ thống</option>
                  </select>
                </div>

                {/* Segmented Level Filter + Row Limit */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
                    {(
                      [
                        { id: 'all', label: 'Tất cả' },
                        { id: 'info', label: 'Thông tin' },
                        { id: 'warning', label: 'Cảnh báo' },
                        { id: 'error', label: 'Lỗi / Vi phạm' },
                      ] as const
                    ).map((lv) => (
                      <button
                        key={lv.id}
                        type="button"
                        onClick={() => setLogLevelFilter(lv.id)}
                        className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          logLevelFilter === lv.id
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-50'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                        }`}
                      >
                        {lv.label}
                      </button>
                    ))}
                  </div>

                  <select
                    aria-label="Số dòng hiển thị"
                    value={logLimit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLogLimit(val === 'all' ? 'all' : (Number(val) as 50 | 100 | 250));
                    }}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-700 tabular-nums focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    <option value={50}>50 dòng</option>
                    <option value={100}>100 dòng</option>
                    <option value={250}>250 dòng</option>
                    <option value="all">Tất cả</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Log Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                    <th className="px-4 py-3 whitespace-nowrap">Thời gian</th>
                    <th className="px-4 py-3 whitespace-nowrap">Mức độ</th>
                    <th className="px-4 py-3 whitespace-nowrap">Phân khu</th>
                    <th className="px-4 py-3 whitespace-nowrap">Người thực hiện</th>
                    <th className="px-4 py-3">Hành động &amp; Chi tiết</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Kiểm tra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-xs text-slate-500 dark:text-slate-400"
                      >
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          Không có bản ghi nhật ký phù hợp bộ lọc hiện tại.
                        </p>
                        {(logSearch ||
                          logCategoryFilter !== 'all' ||
                          logLevelFilter !== 'all' ||
                          logRoleFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogSearch('');
                              setLogCategoryFilter('all');
                              setLogLevelFilter('all');
                              setLogRoleFilter('all');
                            }}
                            className="mt-2.5 cursor-pointer text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                          >
                            Xóa toàn bộ bộ lọc
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    displayedLogs.map((log) => {
                      const roleText =
                        log.actorRole === 'admin'
                          ? 'Quản trị viên'
                          : log.actorRole === 'teacher'
                            ? 'Giáo viên'
                            : log.actorRole === 'student'
                              ? 'Học sinh'
                              : log.actorRole === 'system'
                                ? 'Hệ thống'
                                : 'Khách';

                      const levelColor =
                        log.level === 'error'
                          ? 'text-red-700 dark:text-red-400'
                          : log.level === 'warning'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-blue-700 dark:text-blue-400';

                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLog(log)}
                          className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/45"
                        >
                          <td className="px-4 py-2.5 font-mono text-[11px] whitespace-nowrap text-slate-600 tabular-nums dark:text-slate-300">
                            {new Date(log.timestamp).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${levelColor}`}
                            >
                              {log.level === 'error' ? (
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              ) : log.level === 'warning' ? (
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <Info className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span>{LOG_LEVEL_LABELS[log.level]}</span>
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-[11px] font-medium text-slate-700 dark:text-slate-300">
                            {LOG_CATEGORY_LABELS[log.category]}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {log.actorName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {roleText}
                            </p>
                          </td>
                          <td className="max-w-md px-4 py-2.5">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {log.action}
                              {log.targetLabel && (
                                <span className="ml-1.5 font-mono text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                  · {log.targetLabel}
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-300">
                              {log.detail}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              aria-label={`Xem chi tiết log ${log.action}`}
                              className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Chi tiết</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredLogs.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 text-[11px] text-slate-500 tabular-nums dark:border-slate-800 dark:text-slate-400">
                <span>
                  Đang hiển thị {displayedLogs.length} / {filteredLogs.length} bản ghi khớp bộ lọc
                  (tổng {systemLogs.length} log trong hệ thống).
                </span>
                <span>Bấm vào bất kỳ dòng nào để xem đầy đủ siêu dữ liệu bản ghi.</span>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal: System Log Detail Inspector */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setSelectedLog(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="syslog-detail-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                  {LOG_CATEGORY_LABELS[selectedLog.category]} · {LOG_LEVEL_LABELS[selectedLog.level]}
                </p>
                <h3
                  id="syslog-detail-title"
                  className="mt-0.5 font-display text-base font-bold text-slate-900 dark:text-slate-50"
                >
                  {selectedLog.action}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Đóng chi tiết nhật ký"
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Mã bản ghi (ID)</p>
                  <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                    {selectedLog.id}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Thời điểm ghi</p>
                  <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                    {new Date(selectedLog.timestamp).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Người thực hiện</p>
                  <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                    {selectedLog.actorName} ({selectedLog.actorRole})
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Đối tượng liên quan</p>
                  <p className="mt-0.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {selectedLog.targetLabel ?? '—'}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Mô tả chi tiết sự kiện
                </p>
                <p className="mt-1.5 leading-relaxed text-slate-800 dark:text-slate-200">
                  {selectedLog.detail}
                </p>
              </div>

              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Dữ liệu kỹ thuật (JSON)
                </p>
                <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete All Exams */}
      {confirmDeleteAllExamsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setConfirmDeleteAllExamsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-all-exams-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="delete-all-exams-title"
                  className="font-display text-base font-bold text-slate-900 dark:text-slate-50"
                >
                  Xác nhận xóa tất cả đề thi?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Thao tác này sẽ xóa vĩnh viễn toàn bộ{' '}
                  <strong className="font-mono text-red-700 tabular-nums dark:text-red-400">
                    {exams.length} đề thi
                  </strong>{' '}
                  đang có trong danh sách điều hành của Quản trị viên.
                </p>
                <ul className="mt-3 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <li className="tabular-nums">
                    • Ngân hàng câu hỏi ({questions.length} câu) và lịch sử bài nộp (
                    {submissions.length} lượt) vẫn được giữ nguyên.
                  </li>
                  <li>
                    • Đề thi riêng tư của giáo viên khác (nếu có) vẫn được bảo toàn biệt lập.
                  </li>
                  <li>
                    • Sau khi xóa, bạn có thể tạo đề mới hoặc dùng nút Khôi phục dữ liệu gốc.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteAllExamsOpen(false)}
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const deletedCount = exams.length;
                  onDeleteAllExams?.();
                  setConfirmDeleteExamId(null);
                  setConfirmDeleteAllExamsOpen(false);
                  setContentFeedback(
                    `Đã xóa toàn bộ ${deletedCount} đề thi khỏi danh sách quản trị.`,
                  );
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="tabular-nums">Xác nhận xóa tất cả ({exams.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete All Questions */}
      {confirmDeleteAllQuestionsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setConfirmDeleteAllQuestionsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-delete-all-questions-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="admin-delete-all-questions-title"
                  className="font-display text-base font-bold text-slate-900 dark:text-slate-50"
                >
                  Xác nhận xóa hết câu hỏi?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Thao tác này sẽ xóa vĩnh viễn toàn bộ{' '}
                  <strong className="font-mono text-red-700 tabular-nums dark:text-red-400">
                    {questions.length} câu hỏi
                  </strong>{' '}
                  trong Ngân hàng câu hỏi và gỡ liên kết câu hỏi khỏi các đề thi hiện tại.
                </p>
                <ul className="mt-3 space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <li className="tabular-nums">
                    • Lịch sử bài nộp ({submissions.length} lượt) và tài khoản người dùng vẫn được
                    giữ nguyên.
                  </li>
                  <li>
                    • Bạn có thể nhập file mới ở Ngân hàng câu hỏi hoặc dùng Khôi phục dữ liệu gốc.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteAllQuestionsOpen(false)}
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const deletedCount = questions.length;
                  onDeleteAllQuestions?.();
                  setConfirmDeleteAllQuestionsOpen(false);
                  setContentFeedback(
                    `Đã xóa toàn bộ ${deletedCount} câu hỏi khỏi Ngân hàng câu hỏi.`,
                  );
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="tabular-nums">Xác nhận xóa hết ({questions.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <AddSubjectModal
        open={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setNewSubject(created.id);
          setAddSubjectModalOpen(false);
        }}
      />
    </div>
  );
}
