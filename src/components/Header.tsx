import {
  ChevronDown,
  ExternalLink,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  ShieldCheck,
  Sun,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { TeacherAlert, UserAccount, UserRole } from '../types/exam';
import { getSubjectMeta } from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import { NTPEXION_LOGO_PATH } from './IntroLandingPage';
import type { StudentHomeSectionId } from './StudentHomeDashboard';
import { TeacherNotificationBell } from './TeacherNotificationCenter';

export type AppView =
  | 'intro'
  | 'portal'
  | 'question_bank'
  | 'exam_manager'
  | 'results'
  | 'admin';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  role: UserRole;
  currentUser: UserAccount | null;
  onPrimaryAction: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenProfile: (tab?: 'view_edit' | 'password') => void;
  onOpenAccountManager: (tab: 'create' | 'list') => void;
  onLogout: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  alerts: TeacherAlert[];
  alertSoundEnabled: boolean;
  onToggleAlertSound: () => void;
  onMarkAlertRead: (id: string) => void;
  onMarkAllAlertsRead: () => void;
  onClearAlerts: () => void;
  onInspectAlert: (alert: TeacherAlert) => void;
  onTriggerTestAlert: () => void;
  rightSidebarCollapsed: boolean;
  onToggleRightSidebar: () => void;
  onOpenMobileRightSidebar: () => void;
  activePortalSection?: StudentHomeSectionId | null;
  onSelectPortalSection?: (sectionId: StudentHomeSectionId) => void;
}

const ALL_NAV_ITEMS: {
  id: AppView;
  label: string;
  teacherOnly?: boolean;
  adminOnly?: boolean;
}[] = [
  { id: 'portal', label: 'Phòng thi' },
  { id: 'exam_manager', label: 'Tổ chức đề thi', teacherOnly: true },
  { id: 'question_bank', label: 'Ngân hàng câu hỏi', teacherOnly: true },
  { id: 'results', label: 'Kết quả thi' },
  { id: 'intro', label: 'Giới thiệu' },
  { id: 'admin', label: 'Quản trị Admin', adminOnly: true },
];

export function Header({
  activeView,
  onNavigate,
  role,
  currentUser,
  onPrimaryAction,
  onOpenAuth,
  onOpenProfile,
  onOpenAccountManager,
  onLogout,
  isDark,
  onToggleTheme,
  alerts,
  alertSoundEnabled,
  onToggleAlertSound,
  onMarkAlertRead,
  onMarkAllAlertsRead,
  onClearAlerts,
  onInspectAlert,
  onTriggerTestAlert,
  rightSidebarCollapsed,
  onToggleRightSidebar,
  onOpenMobileRightSidebar,
  activePortalSection = null,
  onSelectPortalSection,
}: HeaderProps) {
  useSubjects();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [headerAvatarFailed, setHeaderAvatarFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const unreadAlertsCount = alerts.filter((a) => !a.read).length;
  const isStaff = role === 'teacher' || role === 'admin';

  useEffect(() => {
    setHeaderAvatarFailed(false);
  }, [currentUser?.avatarUrl]);

  type HeaderNavEntry =
    | {
        key: string;
        label: string;
        kind: 'view';
        viewId: AppView;
        isActive: boolean;
      }
    | {
        key: string;
        label: string;
        kind: 'portal_section';
        sectionId: StudentHomeSectionId;
        isActive: boolean;
      };

  const navEntries: HeaderNavEntry[] =
    role === 'teacher'
      ? [
          {
            key: 'portal',
            label: 'Trang chủ',
            kind: 'view',
            viewId: 'portal',
            isActive:
              activeView === 'portal' &&
              activePortalSection !== 'classes' &&
              activePortalSection !== 'schedule',
          },
          {
            key: 'classes',
            label: 'Lớp học',
            kind: 'portal_section',
            sectionId: 'classes',
            isActive: activeView === 'portal' && activePortalSection === 'classes',
          },
          {
            key: 'schedule',
            label: 'Lịch học',
            kind: 'portal_section',
            sectionId: 'schedule',
            isActive: activeView === 'portal' && activePortalSection === 'schedule',
          },
          {
            key: 'intro',
            label: 'Giới thiệu',
            kind: 'view',
            viewId: 'intro',
            isActive: activeView === 'intro',
          },
        ]
      : ALL_NAV_ITEMS.filter((item) => {
          if (item.adminOnly && role !== 'admin') return false;
          if (item.teacherOnly && !isStaff) return false;
          return true;
        }).map((item) => {
          const label =
            item.id === 'portal' && role !== 'admin'
              ? 'Trang chủ'
              : item.id === 'results' && !isStaff
                ? 'Kết quả của tôi'
                : item.label;
          return {
            key: item.id,
            label,
            kind: 'view',
            viewId: item.id,
            isActive: activeView === item.id,
          };
        });

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [accountMenuOpen]);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-[#132B66] dark:bg-[#061844]/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand mark + single-line wordmark */}
        <button
          type="button"
          onClick={() => {
            onNavigate('portal');
            setMobileOpen(false);
          }}
          className="flex cursor-pointer items-center gap-2.5 whitespace-nowrap shrink-0 font-display text-lg font-extrabold tracking-tight text-[#061844] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF] dark:text-white dark:focus-visible:outline-[#22D3EE]"
        >
          {!logoFailed && (
            <img
              src={NTPEXION_LOGO_PATH}
              alt="NTPEXION"
              referrerPolicy="no-referrer"
              onError={() => setLogoFailed(true)}
              className="h-9 w-auto rounded-md border border-slate-200/80 bg-white px-1 py-0.5 object-contain"
            />
          )}
          <span>
            NTPE<span className="text-[#0057FF] dark:text-[#00D4FF]">X</span>ION
          </span>
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden md:flex items-center gap-3.5 lg:gap-5 text-[13px] lg:text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          {navEntries.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              title={
                item.kind === 'portal_section'
                  ? item.label
                  : `${item.label} (Phím tắt: ${idx + 1})`
              }
              onClick={() => {
                if (item.kind === 'portal_section') {
                  onSelectPortalSection?.(item.sectionId);
                } else {
                  onNavigate(item.viewId);
                }
              }}
              className={`relative cursor-pointer whitespace-nowrap shrink-0 py-1 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF] dark:focus-visible:outline-[#22D3EE] ${
                item.isActive
                  ? 'font-semibold text-[#0057FF] dark:text-[#22D3EE]'
                  : 'text-slate-600 hover:text-[#061844] dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {item.label}
              {item.isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[19px] h-0.5 bg-gradient-to-r from-[#0057FF] to-[#06B6D4] dark:from-[#0057FF] dark:to-[#22D3EE]"
                />
              )}
            </button>
          ))}
        </nav>

        {/* Zone 3: Alerts Bell + Theme Toggle + Account + Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          {isStaff && (
            <TeacherNotificationBell
              alerts={alerts}
              soundEnabled={alertSoundEnabled}
              onToggleSound={onToggleAlertSound}
              onMarkRead={onMarkAlertRead}
              onMarkAllRead={onMarkAllAlertsRead}
              onClearAll={onClearAlerts}
              onInspectAlert={onInspectAlert}
              onTriggerTestAlert={onTriggerTestAlert}
            />
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={isDark ? 'Chuyển sang giao diện sáng (Light Mode)' : 'Chuyển sang giao diện tối (Dark Mode)'}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {currentUser ? (
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((v) => !v)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {currentUser.avatarUrl && !headerAvatarFailed ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    referrerPolicy="no-referrer"
                    onError={() => setHeaderAvatarFailed(true)}
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <UserCheck
                    className={`h-4 w-4 shrink-0 ${
                      currentUser.role === 'admin'
                        ? 'text-amber-600 dark:text-amber-400'
                        : currentUser.role === 'teacher'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-blue-700 dark:text-blue-400'
                    }`}
                  />
                )}
                <span className="hidden max-w-[110px] truncate sm:inline">
                  {currentUser.fullName}
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-500 tabular-nums dark:text-slate-400">
                  {currentUser.id}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex items-center gap-3">
                      {currentUser.avatarUrl && !headerAvatarFailed ? (
                        <img
                          src={currentUser.avatarUrl}
                          alt={currentUser.fullName}
                          referrerPolicy="no-referrer"
                          onError={() => setHeaderAvatarFailed(true)}
                          className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 font-display text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                          {currentUser.fullName.trim().slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                            {currentUser.fullName}
                          </p>
                          <span className="shrink-0 font-mono text-[11px] font-bold text-slate-600 tabular-nums dark:text-slate-300">
                            ID: {currentUser.id}
                          </span>
                        </div>
                        <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                      {currentUser.role === 'admin'
                        ? `Quản trị viên hệ thống${currentUser.schoolName ? ` · ${currentUser.schoolName}` : ''}`
                        : currentUser.role === 'teacher'
                          ? `Giáo viên · ${getSubjectMeta(currentUser.subject ?? 'toan').name}${currentUser.schoolName ? ` · ${currentUser.schoolName}` : ''}`
                          : `Học sinh · SBD ${currentUser.studentSbd ?? '—'} · Lớp ${currentUser.studentClass ?? '—'}`}
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
                  </div>

                  <div className="p-1.5 text-xs">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenProfile('view_edit');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-slate-800 hover:bg-blue-50/70 hover:text-blue-700 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                    >
                      <Pencil className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                      <span>Thông tin cá nhân &amp; Ảnh đại diện</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenProfile('password');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <KeyRound className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span>Đổi mật khẩu tài khoản</span>
                    </button>
                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                    {currentUser.role === 'admin' && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onNavigate('admin');
                        }}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                      >
                        <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span>Trang Quản trị Admin</span>
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenAccountManager('create');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <UserPlus className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                      <span>
                        {currentUser.role === 'admin'
                          ? 'Tạo tài khoản (HS / GV / Admin)'
                          : 'Tạo tài khoản (Học sinh / Giáo viên)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenAccountManager('list');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span>Danh sách &amp; Chuyển tài khoản</span>
                    </button>
                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onLogout();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng nhập / Đăng ký</span>
            </button>
          )}

          <button
            type="button"
            onClick={onPrimaryAction}
            className="hidden lg:inline-flex cursor-pointer items-center justify-center whitespace-nowrap shrink-0 rounded-lg bg-[#0057FF] px-3.5 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-[#061844] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF] dark:bg-[#0057FF] dark:hover:bg-[#06B6D4] dark:hover:text-[#040D22]"
          >
            {isStaff ? 'Tạo đề thi mới' : 'Vào thi nhanh'}
          </button>

          <button
            type="button"
            onClick={onToggleRightSidebar}
            aria-label={
              rightSidebarCollapsed
                ? 'Mở rộng cột menu bên phải'
                : 'Thu gọn cột menu bên phải'
            }
            title={
              rightSidebarCollapsed
                ? 'Mở rộng cột menu bên phải (M)'
                : 'Thu gọn cột menu bên phải (M)'
            }
            className="hidden md:inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            {rightSidebarCollapsed ? (
              <PanelRightOpen className="h-4 w-4" />
            ) : (
              <PanelRightClose className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            aria-label="Mở cột menu bên phải"
            onClick={onOpenMobileRightSidebar}
            className="inline-flex h-9 w-9 md:hidden cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex md:hidden cursor-pointer items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-[#132B66] dark:bg-[#061844]">
          <div className="flex flex-col gap-1">
            {currentUser && (
              <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  {currentUser.avatarUrl && !headerAvatarFailed ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      referrerPolicy="no-referrer"
                      onError={() => setHeaderAvatarFailed(true)}
                      className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 font-display text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                      {currentUser.fullName.trim().slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                        {currentUser.fullName}
                      </p>
                      <span className="shrink-0 font-mono text-[11px] font-bold text-slate-600 tabular-nums dark:text-slate-300">
                        ID: {currentUser.id}
                      </span>
                    </div>
                    <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {currentUser.email}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenProfile('view_edit');
                      setMobileOpen(false);
                    }}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
                    <span>Thông tin cá nhân</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenProfile('password');
                      setMobileOpen(false);
                    }}
                    className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Đổi mật khẩu</span>
                  </button>
                </div>
              </div>
            )}
            {navEntries.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.kind === 'portal_section') {
                    onSelectPortalSection?.(item.sectionId);
                  } else {
                    onNavigate(item.viewId);
                  }
                  setMobileOpen(false);
                }}
                className={`w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  item.isActive
                    ? 'bg-[#0057FF]/10 font-semibold text-[#0057FF] dark:bg-[#0B225B] dark:text-[#22D3EE]'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0B225B]/60'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onPrimaryAction();
                setMobileOpen(false);
              }}
              className="mt-2 w-full cursor-pointer rounded-lg bg-[#0057FF] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#061844] dark:hover:bg-[#06B6D4] dark:hover:text-[#040D22]"
            >
              {isStaff ? 'Tạo đề thi mới' : 'Vào thi nhanh'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
