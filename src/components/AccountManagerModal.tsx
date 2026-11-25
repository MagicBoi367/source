import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SubjectId, UserAccount, UserRole } from '../types/exam';
import {
  deleteStoredAccount,
  listAccountsSync,
  registerAccount,
  resetAccountPasswordDirect,
  setCurrentSessionUserId,
  switchSessionAccount,
} from '../utils/authStore';
import { getSubjectMeta } from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import { SubjectSearchSelect } from './SubjectSearchSelect';

interface AccountManagerModalProps {
  initialTab?: 'create' | 'list';
  currentUser: UserAccount | null;
  onClose: () => void;
  onAccountChanged: (user: UserAccount | null) => void;
}

export function AccountManagerModal({
  initialTab = 'create',
  currentUser,
  onClose,
  onAccountChanged,
}: AccountManagerModalProps) {
  useSubjects();
  const [tab, setTab] = useState<'create' | 'list'>(initialTab);
  const [accounts, setAccounts] = useState<UserAccount[]>(() => listAccountsSync());
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Create account form
  const [role, setRole] = useState<UserRole>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentSbd, setStudentSbd] = useState('');
  const [studentClass, setStudentClass] = useState('12A1');
  const [schoolName, setSchoolName] = useState(
    currentUser?.schoolName ?? 'THPT Chuyên Chu Văn An',
  );
  const [subject, setSubject] = useState<SubjectId>('');
  const [switchAfterCreate, setSwitchAfterCreate] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetInlinePw, setResetInlinePw] = useState('');
  const [listFeedback, setListFeedback] = useState<string | null>(null);

  const isCurrentAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!isCurrentAdmin && role === 'admin') {
      setRole('student');
    }
  }, [isCurrentAdmin, role]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filteredAccounts = useMemo(() => {
    if (roleFilter === 'all') return accounts;
    return accounts.filter((a) => a.role === roleFilter);
  }, [accounts, roleFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (role === 'admin' && !isCurrentAdmin) {
      setError('Chỉ Quản trị viên (Admin) mới có quyền tạo thêm tài khoản Admin.');
      return;
    }
    if (role === 'teacher' && !subject.trim()) {
      setError('Vui lòng tìm kiếm và chọn Môn phụ trách cho giáo viên.');
      return;
    }
    setSaving(true);
    try {
      const res = await registerAccount(
        {
          email,
          password,
          fullName,
          role,
          studentSbd: role === 'student' ? studentSbd : undefined,
          studentClass: role === 'student' ? studentClass : undefined,
          schoolName: role !== 'student' ? schoolName : undefined,
          subject: role === 'teacher' ? subject : undefined,
        },
        { actorRole: currentUser?.role },
      );

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setAccounts(listAccountsSync());
      setFullName('');
      setEmail('');
      setPassword('');
      setStudentSbd('');

      if (switchAfterCreate) {
        setCurrentSessionUserId(res.user.id);
        onAccountChanged(res.user);
        onClose();
      } else {
        const roleName =
          res.user.role === 'admin'
            ? 'Quản trị viên (Admin)'
            : res.user.role === 'teacher'
              ? 'Giáo viên'
              : 'Học sinh';
        setSuccessMsg(
          `Đã tạo tài khoản ${roleName} "${res.user.fullName}" · ID: ${res.user.id} (${res.user.email})${
            res.user.studentSbd ? ` · SBD ${res.user.studentSbd}` : ''
          }.`,
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSwitch = (accountId: string) => {
    const nextUser = switchSessionAccount(accountId);
    if (nextUser) {
      onAccountChanged(nextUser);
      onClose();
    }
  };

  const handleDelete = (accountId: string) => {
    const updated = deleteStoredAccount(accountId);
    setAccounts(updated);
    if (currentUser?.id === accountId) {
      onAccountChanged(null);
    }
  };

  const handleDirectResetPassword = async (accountId: string) => {
    setListFeedback(null);
    const res = await resetAccountPasswordDirect(accountId, resetInlinePw);
    if (!res.ok) {
      setListFeedback(res.error);
      return;
    }
    setResetTargetId(null);
    setResetInlinePw('');
    setListFeedback(`Đã cấp lại mật khẩu mới cho tài khoản ${res.user.fullName}.`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
              {isCurrentAdmin
                ? 'Quản trị tài khoản Học sinh, Giáo viên & Admin'
                : 'Quản trị tài khoản Học sinh & Giáo viên'}
            </p>
            <h2
              id="account-modal-title"
              className="mt-0.5 font-display text-lg font-bold text-slate-900 dark:text-slate-50"
            >
              Tạo &amp; Quản lý tài khoản hệ thống
            </h2>
          </div>
          <button
            type="button"
            aria-label="Đóng hộp thoại tài khoản"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="inline-flex rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setTab('create');
                setError(null);
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'create'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Tạo tài khoản mới</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('list');
                setError(null);
                setSuccessMsg(null);
                setAccounts(listAccountsSync());
              }}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'list'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Danh sách tài khoản ({accounts.length})</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className={`grid gap-3 ${isCurrentAdmin ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                    role === 'student'
                      ? 'border-blue-700 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/50'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40'
                  }`}
                >
                  <GraduationCap
                    className={`h-4 w-4 shrink-0 ${
                      role === 'student' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Tài khoản Học sinh
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Cấp ID <span className="font-mono font-semibold">HVxxxx</span> &amp; SBD
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                    role === 'teacher'
                      ? 'border-emerald-700 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/50'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40'
                  }`}
                >
                  <ShieldCheck
                    className={`h-4 w-4 shrink-0 ${
                      role === 'teacher'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Tài khoản Giáo viên
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Cấp ID <span className="font-mono font-semibold">GVxxxx</span>
                    </p>
                  </div>
                </button>

                {isCurrentAdmin && (
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-left transition-colors ${
                      role === 'admin'
                        ? 'border-amber-600 bg-amber-50/70 dark:border-amber-500 dark:bg-amber-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40'
                    }`}
                  >
                    <ShieldCheck
                      className={`h-4 w-4 shrink-0 ${
                        role === 'admin'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Tài khoản Admin
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Cấp ID <span className="font-mono font-semibold">ADxxxx</span>
                      </p>
                    </div>
                  </button>
                )}
              </div>

              {!isCurrentAdmin && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Lưu ý: Chỉ tài khoản Quản trị viên (Admin · <span className="font-mono">ADxxxx</span>) mới có quyền tạo thêm tài khoản Admin.
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={
                      role === 'student'
                        ? 'VD: Phạm Bảo Ngọc'
                        : role === 'admin'
                          ? 'VD: Quản trị viên Cổng thi'
                          : 'VD: Thầy Vũ Minh Tuấn'
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email tài khoản
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@kythi2025.edu.vn"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                {role === 'student' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Số báo danh (để trống để tự sinh)
                      </label>
                      <input
                        type="text"
                        value={studentSbd}
                        onChange={(e) => setStudentSbd(e.target.value.toUpperCase())}
                        placeholder="VD: 0102755"
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 uppercase focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Lớp
                      </label>
                      <input
                        type="text"
                        required
                        value={studentClass}
                        onChange={(e) => setStudentClass(e.target.value.toUpperCase())}
                        placeholder="12A1"
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 uppercase focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={role === 'admin' ? 'sm:col-span-2' : undefined}>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Trường / Đơn vị
                      </label>
                      <input
                        type="text"
                        required
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder={
                          role === 'admin' ? 'Ban Quản trị NTPEXION' : 'THPT Chuyên Chu Văn An'
                        }
                        className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    {role === 'teacher' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Môn phụ trách
                        </label>
                        <SubjectSearchSelect
                          value={subject}
                          onChange={(val) => {
                            setSubject(val);
                            if (error) setError(null);
                          }}
                          placeholder="Tìm tên môn phụ trách..."
                          ariaLabel="Tìm kiếm và chọn môn phụ trách"
                          currentUser={currentUser}
                          className="mt-1.5"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mật khẩu đăng nhập (tối thiểu 6 ký tự)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu cấp cho tài khoản"
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={switchAfterCreate}
                  onChange={(e) => setSwitchAfterCreate(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                <span>Đăng nhập ngay bằng tài khoản vừa tạo sau khi lưu</span>
              </label>

              <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>
                    {saving
                      ? 'Đang lưu...'
                      : role === 'admin'
                        ? 'Tạo tài khoản Admin'
                        : role === 'student'
                          ? 'Tạo tài khoản Học sinh'
                          : 'Tạo tài khoản Giáo viên'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                  {(
                    [
                      { id: 'all', label: `Tất cả (${accounts.length})` },
                      {
                        id: 'student',
                        label: `Học sinh (${accounts.filter((a) => a.role === 'student').length})`,
                      },
                      {
                        id: 'teacher',
                        label: `Giáo viên (${accounts.filter((a) => a.role === 'teacher').length})`,
                      },
                      {
                        id: 'admin',
                        label: `Admin (${accounts.filter((a) => a.role === 'admin').length})`,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRoleFilter(item.id)}
                      className={`cursor-pointer whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        roleFilter === item.id
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {listFeedback && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-medium text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200">
                  {listFeedback}
                </div>
              )}

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {filteredAccounts.map((acc) => {
                  const isActive = currentUser?.id === acc.id;
                  const isResetting = resetTargetId === acc.id;
                  const canManageThisAccount =
                    (isCurrentAdmin ||
                      (currentUser?.role === 'teacher' && acc.role !== 'admin') ||
                      isActive);
                  return (
                    <div key={acc.id} className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-slate-700 tabular-nums dark:text-slate-200">
                              ID: {acc.id}
                            </span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                              ·
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
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
                                ? 'Quản trị viên'
                                : acc.role === 'teacher'
                                  ? 'Giáo viên'
                                  : 'Học sinh'}
                            </span>
                            {isActive && (
                              <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                (Đang đăng nhập)
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {acc.email}
                            {acc.role === 'student'
                              ? ` · SBD ${acc.studentSbd ?? '—'} · Lớp ${acc.studentClass ?? '—'}`
                              : acc.role === 'admin'
                                ? ` · Quản trị toàn hệ thống${acc.schoolName ? ` · ${acc.schoolName}` : ''}`
                                : ` · ${getSubjectMeta(acc.subject ?? 'toan').name} · ${acc.schoolName ?? ''}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {canManageThisAccount && (
                            <button
                              type="button"
                              onClick={() => {
                                setResetTargetId(isResetting ? null : acc.id);
                                setResetInlinePw('');
                                setListFeedback(null);
                              }}
                              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>Đặt lại MK</span>
                            </button>
                          )}
                          {!isActive && (isCurrentAdmin || acc.role !== 'admin') && (
                            <button
                              type="button"
                              onClick={() => handleSwitch(acc.id)}
                              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                              <span>Chuyển sang</span>
                            </button>
                          )}
                          {accounts.length > 1 &&
                            !isActive &&
                            (isCurrentAdmin || acc.role !== 'admin') && (
                              <button
                                type="button"
                                aria-label={`Xóa tài khoản ${acc.fullName}`}
                                onClick={() => handleDelete(acc.id)}
                                className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                        </div>
                      </div>

                      {isResetting && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-950/60">
                          <input
                            type="password"
                            minLength={6}
                            value={resetInlinePw}
                            onChange={(e) => setResetInlinePw(e.target.value)}
                            placeholder="Nhập mật khẩu mới (≥ 6 ký tự)"
                            className="h-8 min-w-[200px] flex-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => void handleDirectResetPassword(acc.id)}
                            className="cursor-pointer whitespace-nowrap rounded-md bg-blue-700 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                          >
                            Lưu mật khẩu mới
                          </button>
                          <button
                            type="button"
                            onClick={() => setResetTargetId(null)}
                            className="cursor-pointer whitespace-nowrap rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Hủy
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
