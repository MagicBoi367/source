import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Compass,
  Database,
  ExternalLink,
  FileSpreadsheet,
  GraduationCap,
  Info,
  KeyRound,
  Keyboard,
  LogIn,
  LogOut,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  PlayCircle,
  PlusCircle,
  ShieldCheck,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';
import type { UserAccount, UserRole } from '../types/exam';
import type { AppView } from './Header';
import type { StudentHomeSectionId } from './StudentHomeDashboard';
import type { TeacherClassRoomTab } from './TeacherHomeDashboard';

interface RightSidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  role: UserRole;
  currentUser: UserAccount | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onPrimaryAction: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenProfile: (tab?: 'view_edit' | 'password') => void;
  onOpenAccountManager: (tab: 'create' | 'list') => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
  unreadAlertsCount: number;
  pendingJoinRequestsCount?: number;
  activeStudentSection?: StudentHomeSectionId | null;
  onSelectStudentSection?: (sectionId: StudentHomeSectionId) => void;
  activeTeacherClass?: { id: string; name: string; code: string } | null;
  activeTeacherClassTab?: TeacherClassRoomTab | null;
  activeTeacherClassPendingCount?: number;
  onSelectTeacherClassTab?: (tab: TeacherClassRoomTab) => void;
  onExitTeacherClass?: () => void;
}

interface SidebarNavItem {
  id: AppView;
  label: string;
  shortHint: string;
  icon: ComponentType<{ className?: string }>;
  teacherOnly?: boolean;
  adminOnly?: boolean;
}

const SIDEBAR_ITEMS: SidebarNavItem[] = [
  { id: 'portal', label: 'Phòng thi', shortHint: '1', icon: Compass },
  {
    id: 'exam_manager',
    label: 'Tổ chức đề thi',
    shortHint: '2',
    icon: FileSpreadsheet,
    teacherOnly: true,
  },
  {
    id: 'question_bank',
    label: 'Ngân hàng câu hỏi',
    shortHint: '3',
    icon: Database,
    teacherOnly: true,
  },
  { id: 'results', label: 'Kết quả thi', shortHint: '4', icon: BarChart3 },
  {
    id: 'admin',
    label: 'Quản trị Admin',
    shortHint: '5',
    icon: ShieldCheck,
    adminOnly: true,
  },
  { id: 'intro', label: 'Giới thiệu NTPEXION', shortHint: '0', icon: Info },
];

const STUDENT_SECTION_ITEMS: {
  id: StudentHomeSectionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: 'classes', label: 'Lớp học', icon: GraduationCap },
  { id: 'schedule', label: 'Lịch học', icon: CalendarDays },
  { id: 'materials', label: 'Tài liệu', icon: BookOpen },
  { id: 'assignments', label: 'Bài tập', icon: ClipboardList },
  { id: 'exams', label: 'Bài thi', icon: KeyRound },
  { id: 'scores', label: 'Bảng điểm', icon: Award },
];

export function RightSidebar({
  activeView,
  onNavigate,
  role,
  currentUser,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  isDark,
  onToggleTheme,
  onPrimaryAction,
  onOpenAuth,
  onOpenProfile,
  onOpenAccountManager,
  onOpenShortcuts,
  onLogout,
  unreadAlertsCount,
  pendingJoinRequestsCount = 0,
  activeStudentSection,
  onSelectStudentSection,
  activeTeacherClass = null,
  activeTeacherClassTab = null,
  activeTeacherClassPendingCount = 0,
  onSelectTeacherClassTab,
  onExitTeacherClass,
}: RightSidebarProps) {
  const [sidebarAvatarFailed, setSidebarAvatarFailed] = useState(false);

  useEffect(() => {
    setSidebarAvatarFailed(false);
  }, [currentUser?.avatarUrl]);

  const isStaff = role === 'teacher' || role === 'admin';
  const isInTeacherClass =
    role === 'teacher' && activeView === 'portal' && Boolean(activeTeacherClass);

  const visibleItems = SIDEBAR_ITEMS.filter((item) => {
    if (item.adminOnly && role !== 'admin') return false;
    if (item.teacherOnly && !isStaff) return false;
    if (
      role === 'teacher' &&
      (item.id === 'exam_manager' ||
        item.id === 'question_bank' ||
        item.id === 'results')
    ) {
      return false;
    }
    return true;
  }).map((item) => {
    if (item.id === 'portal' && role !== 'admin') return { ...item, label: 'Trang chủ' };
    if (item.id === 'results' && !isStaff) return { ...item, label: 'Kết quả của tôi' };
    return item;
  });

  const teacherTeachingViews = SIDEBAR_ITEMS.filter(
    (item) =>
      item.id === 'exam_manager' ||
      item.id === 'question_bank' ||
      item.id === 'results',
  );

  const roleLabel =
    role === 'admin'
      ? 'Quản trị viên'
      : role === 'teacher'
        ? 'Giáo viên'
        : 'Học sinh';

  const renderSidebarBody = (isCompact: boolean, isMobileDrawer: boolean) => (
    <div className="flex h-full flex-col justify-between overflow-hidden">
      {/* Top section: Header + Personal Profile + Nav items */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <div
          className={`flex items-center ${
            isCompact ? 'justify-center' : 'justify-between px-1'
          }`}
        >
          {!isCompact && (
            <span className="font-display text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {isInTeacherClass ? 'Menu lớp học' : 'Menu điều hướng'}
            </span>
          )}

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Đóng cột menu bên phải"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Mở rộng cột menu bên phải' : 'Thu gọn cột menu bên phải'}
              title={collapsed ? 'Mở rộng cột menu (M)' : 'Thu gọn cột menu (M)'}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:focus-visible:outline-blue-400"
            >
              {collapsed ? (
                <PanelRightOpen className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Top Personal Info Card */}
        {currentUser ? (
          isCompact ? (
            <div className="flex justify-center">
              <button
                type="button"
                title={`Thông tin cá nhân (${currentUser.fullName})`}
                onClick={() => {
                  onOpenProfile('view_edit');
                  if (isMobileDrawer) onCloseMobile();
                }}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-blue-700 transition-colors hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400"
              >
                {currentUser.avatarUrl && !sidebarAvatarFailed ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    referrerPolicy="no-referrer"
                    onError={() => setSidebarAvatarFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                {currentUser.avatarUrl && !sidebarAvatarFailed ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    referrerPolicy="no-referrer"
                    onError={() => setSidebarAvatarFailed(true)}
                    className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 font-display text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                    {currentUser.fullName.trim().slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                    {currentUser.fullName}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-bold text-slate-700 tabular-nums dark:text-slate-200">
                      ID: {currentUser.id}
                    </span>
                    {' · '}
                    {roleLabel}
                    {currentUser.role === 'student' && currentUser.studentSbd
                      ? ` · SBD ${currentUser.studentSbd}`
                      : ''}
                    {currentUser.role === 'student' && currentUser.studentClass
                      ? ` · ${currentUser.studentClass}`
                      : ''}
                  </p>
                </div>
              </div>
              <p className="mt-1.5 truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
                {currentUser.email}
              </p>
              {currentUser.facebookUrl && (
                <a
                  href={currentUser.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  <span className="truncate">{currentUser.facebookUrl}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onOpenProfile('view_edit');
                    if (isMobileDrawer) onCloseMobile();
                  }}
                  className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-blue-50/70 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Pencil className="h-3 w-3 shrink-0" />
                  <span className="truncate">Thông tin cá nhân</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenProfile('password');
                    if (isMobileDrawer) onCloseMobile();
                  }}
                  className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <KeyRound className="h-3 w-3" />
                  <span>Mật khẩu</span>
                </button>
              </div>
            </div>
          )
        ) : isCompact ? (
          <div className="flex justify-center">
            <button
              type="button"
              title="Đăng nhập / Đăng ký"
              onClick={() => {
                onOpenAuth('login');
                if (isMobileDrawer) onCloseMobile();
              }}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-blue-700 transition-colors hover:bg-blue-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-blue-950/40"
            >
              <LogIn className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Đang xem thử ({roleLabel})
            </p>
            <button
              type="button"
              onClick={() => {
                onOpenAuth('login');
                if (isMobileDrawer) onCloseMobile();
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng nhập / Đăng ký</span>
            </button>
          </div>
        )}

        {/* Navigation Links: Teacher Classroom 8-item Menu vs Default Navigation */}
        {isInTeacherClass && activeTeacherClass ? (
          <nav aria-label="Menu trong lớp học giáo viên" className="space-y-1">
            {!isCompact && (
              <div className="mb-2 rounded-lg border border-blue-200/80 bg-blue-50/50 px-2.5 py-2 dark:border-blue-900/60 dark:bg-blue-950/30">
                <p className="truncate text-xs font-bold text-[#061844] dark:text-slate-100">
                  {activeTeacherClass.name}
                </p>
                <p className="mt-0.5 font-mono text-[11px] font-semibold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                  Mã lớp: {activeTeacherClass.code}
                </p>
              </div>
            )}
            {(
              [
                {
                  key: 'profile',
                  label: 'Thông tin cá nhân',
                  icon: UserCheck,
                  isActive: false,
                  onClick: () => {
                    if (currentUser) {
                      onOpenProfile('view_edit');
                    } else {
                      onOpenAuth('login');
                    }
                  },
                },
                {
                  key: 'home',
                  label: 'Trang chủ',
                  icon: Compass,
                  isActive: false,
                  onClick: () => {
                    onExitTeacherClass?.();
                    onNavigate('portal');
                  },
                },
                {
                  key: 'classes',
                  label: 'Lớp học',
                  icon: GraduationCap,
                  isActive: activeTeacherClassTab === null,
                  onClick: () => {
                    onExitTeacherClass?.();
                    onSelectStudentSection?.('classes');
                  },
                },
                {
                  key: 'students',
                  label: 'Thành viên',
                  icon: Users,
                  isActive: activeTeacherClassTab === 'students',
                  badge:
                    activeTeacherClassPendingCount > 0
                      ? activeTeacherClassPendingCount
                      : undefined,
                  onClick: () => onSelectTeacherClassTab?.('students'),
                },
                {
                  key: 'assignments',
                  label: 'Bài tập',
                  icon: ClipboardList,
                  isActive: activeTeacherClassTab === 'assignments',
                  onClick: () => onSelectTeacherClassTab?.('assignments'),
                },
                {
                  key: 'exams',
                  label: 'Bài thi',
                  icon: KeyRound,
                  isActive: activeTeacherClassTab === 'exams',
                  onClick: () => onSelectTeacherClassTab?.('exams'),
                },
                {
                  key: 'scores',
                  label: 'Kết quả thi',
                  icon: BarChart3,
                  isActive: activeTeacherClassTab === 'scores',
                  onClick: () => onSelectTeacherClassTab?.('scores'),
                },
                {
                  key: 'schedule',
                  label: 'Lịch học',
                  icon: CalendarDays,
                  isActive: activeTeacherClassTab === 'schedule',
                  onClick: () => onSelectTeacherClassTab?.('schedule'),
                },
              ] as {
                key: string;
                label: string;
                icon: ComponentType<{ className?: string }>;
                isActive: boolean;
                badge?: number;
                onClick: () => void;
              }[]
            ).map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.key}
                  type="button"
                  title={entry.label}
                  aria-current={entry.isActive ? 'page' : undefined}
                  onClick={() => {
                    entry.onClick();
                    if (isMobileDrawer) onCloseMobile();
                  }}
                  className={`group flex w-full cursor-pointer items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400 ${
                    isCompact
                      ? 'justify-center px-2 py-2.5'
                      : 'justify-between gap-2.5 px-3 py-2'
                  } ${
                    entry.isActive
                      ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        entry.isActive
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                      }`}
                    />
                    {!isCompact && (
                      <span className="truncate text-sm">{entry.label}</span>
                    )}
                  </span>
                  {!isCompact && entry.badge !== undefined && (
                    <span className="font-mono text-[11px] font-bold text-amber-600 tabular-nums dark:text-amber-400">
                      {entry.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <>
            <nav aria-label="Menu chức năng bên phải" className="space-y-1">
              {!isCompact && (
                <p className="px-1 pb-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                  Điều hướng chính
                </p>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeView === item.id &&
                  !(
                    (role === 'student' || role === 'teacher') &&
                    item.id === 'portal' &&
                    activeStudentSection
                  );
                const showAlertCount = isStaff && item.id === 'results' && unreadAlertsCount > 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={
                      isCompact
                        ? `${item.label} (Phím ${item.shortHint})`
                        : `Phím tắt: ${item.shortHint}`
                    }
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      onNavigate(item.id);
                      if (isMobileDrawer) onCloseMobile();
                    }}
                    className={`group flex w-full cursor-pointer items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400 ${
                      isCompact
                        ? 'justify-center px-2 py-2.5'
                        : 'justify-between gap-2.5 px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                        }`}
                      />
                      {!isCompact && (
                        <span className="truncate text-sm">{item.label}</span>
                      )}
                    </span>

                    {!isCompact && (
                      <span className="flex shrink-0 items-center gap-1.5">
                        {showAlertCount && (
                          <span className="font-mono text-[11px] font-bold text-red-600 tabular-nums dark:text-red-400">
                            {unreadAlertsCount}
                          </span>
                        )}
                        <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                          {item.shortHint}
                        </kbd>
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Portal Sections (Student & Teacher outside class) */}
            {(role === 'student' || role === 'teacher') && onSelectStudentSection && (
              <>
                <div className="h-px bg-slate-200 dark:bg-slate-800" />
                <nav
                  aria-label={
                    role === 'teacher' ? 'Mục giảng dạy giáo viên' : 'Mục học tập học sinh'
                  }
                  className="space-y-1"
                >
                  {!isCompact && (
                    <p className="px-1 pb-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                      {role === 'teacher' ? 'Mục giảng dạy' : 'Mục học tập'}
                    </p>
                  )}
                  {STUDENT_SECTION_ITEMS.filter((sec) =>
                    role === 'teacher'
                      ? sec.id === 'classes' || sec.id === 'schedule'
                      : true,
                  ).map((sec) => {
                    const Icon = sec.icon;
                    const isActive =
                      activeView === 'portal' && activeStudentSection === sec.id;
                    const showPending =
                      role === 'teacher' &&
                      sec.id === 'classes' &&
                      pendingJoinRequestsCount > 0;

                    return (
                      <button
                        key={sec.id}
                        type="button"
                        title={sec.label}
                        onClick={() => {
                          onSelectStudentSection(sec.id);
                          if (isMobileDrawer) onCloseMobile();
                        }}
                        className={`group flex w-full cursor-pointer items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400 ${
                          isCompact
                            ? 'justify-center px-2 py-2'
                            : 'justify-between gap-2.5 px-3 py-2'
                        } ${
                          isActive
                            ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              isActive
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                            }`}
                          />
                          {!isCompact && (
                            <span className="truncate text-sm">{sec.label}</span>
                          )}
                        </span>
                        {!isCompact && showPending && (
                          <span className="font-mono text-[11px] font-bold text-amber-600 tabular-nums dark:text-amber-400">
                            {pendingJoinRequestsCount}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {role === 'teacher' &&
                    teacherTeachingViews.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      const showAlertCount = item.id === 'results' && unreadAlertsCount > 0;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          title={
                            isCompact
                              ? `${item.label} (Phím ${item.shortHint})`
                              : `Phím tắt: ${item.shortHint}`
                          }
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => {
                            onNavigate(item.id);
                            if (isMobileDrawer) onCloseMobile();
                          }}
                          className={`group flex w-full cursor-pointer items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400 ${
                            isCompact
                              ? 'justify-center px-2 py-2'
                              : 'justify-between gap-2.5 px-3 py-2'
                          } ${
                            isActive
                              ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                isActive
                                  ? 'text-blue-700 dark:text-blue-400'
                                  : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                              }`}
                            />
                            {!isCompact && (
                              <span className="truncate text-sm">{item.label}</span>
                            )}
                          </span>
                          {!isCompact && (
                            <span className="flex shrink-0 items-center gap-1.5">
                              {showAlertCount && (
                                <span className="font-mono text-[11px] font-bold text-red-600 tabular-nums dark:text-red-400">
                                  {unreadAlertsCount}
                                </span>
                              )}
                              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                                {item.shortHint}
                              </kbd>
                            </span>
                          )}
                        </button>
                      );
                    })}
                </nav>
              </>
            )}
          </>
        )}

        <div className="h-px bg-slate-200 dark:bg-slate-800" />

        {/* Quick Actions & Utilities */}
        <div className="space-y-1.5">
          {!isCompact && (
            <p className="px-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase dark:text-slate-500">
              Tiện ích
            </p>
          )}

          <button
            type="button"
            title={isStaff ? 'Tạo đề thi mới' : 'Vào thi nhanh'}
            onClick={() => {
              onPrimaryAction();
              if (isMobileDrawer) onCloseMobile();
            }}
            className={`flex w-full cursor-pointer items-center rounded-lg bg-blue-700 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 ${
              isCompact ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5'
            }`}
          >
            {isStaff ? (
              <PlusCircle className="h-4 w-4 shrink-0" />
            ) : (
              <PlayCircle className="h-4 w-4 shrink-0" />
            )}
            {!isCompact && (
              <span className="whitespace-nowrap">
                {isStaff ? 'Tạo đề thi mới' : 'Vào thi nhanh'}
              </span>
            )}
          </button>

          {currentUser && (
            <button
              type="button"
              title="Quản lý & chuyển tài khoản"
              onClick={() => {
                onOpenAccountManager('list');
                if (isMobileDrawer) onCloseMobile();
              }}
              className={`flex w-full cursor-pointer items-center rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${
                isCompact ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
              }`}
            >
              <Users className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              {!isCompact && (
                <span className="truncate">Quản lý tài khoản</span>
              )}
            </button>
          )}

          <button
            type="button"
            title="Phím tắt hệ thống (?)"
            onClick={() => {
              onOpenShortcuts();
              if (isMobileDrawer) onCloseMobile();
            }}
            className={`flex w-full cursor-pointer items-center rounded-lg text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${
              isCompact ? 'justify-center p-2.5' : 'justify-between gap-2 px-3 py-2'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Keyboard className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              {!isCompact && <span>Phím tắt</span>}
            </span>
            {!isCompact && (
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                ?
              </kbd>
            )}
          </button>

          <button
            type="button"
            title={isDark ? 'Chuyển sang giao diện sáng (D)' : 'Chuyển sang giao diện tối (D)'}
            onClick={onToggleTheme}
            className={`flex w-full cursor-pointer items-center rounded-lg text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${
              isCompact ? 'justify-center p-2.5' : 'justify-between gap-2 px-3 py-2'
            }`}
          >
            <span className="flex items-center gap-2.5">
              {isDark ? (
                <Sun className="h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 shrink-0 text-slate-500" />
              )}
              {!isCompact && (
                <span>{isDark ? 'Giao diện sáng' : 'Giao diện tối'}</span>
              )}
            </span>
            {!isCompact && (
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                D
              </kbd>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Session Footer */}
      {currentUser && (
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          {isCompact ? (
            <div className="flex justify-center">
              <button
                type="button"
                title={`Đăng xuất (${currentUser.fullName})`}
                onClick={onLogout}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-red-600 transition-colors hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onLogout();
                if (isMobileDrawer) onCloseMobile();
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop persistent right-hand collapsible sidebar */}
      <aside
        aria-label="Thanh menu bên phải"
        className={`no-print hidden shrink-0 border-l border-slate-200 bg-white transition-[width] duration-150 ease-out md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] dark:border-slate-800 dark:bg-slate-900 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderSidebarBody(collapsed, false)}
      </aside>

      {/* Mobile slide-over right drawer */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs md:hidden dark:bg-slate-950/75"
          onClick={onCloseMobile}
        >
          <aside
            aria-label="Thanh menu bên phải trên di động"
            className="h-full w-72 border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarBody(false, true)}
          </aside>
        </div>
      )}
    </>
  );
}
