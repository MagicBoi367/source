import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { resizeAvatarImageFile } from '../data/studentPortalData';
import type { UserAccount } from '../types/exam';
import {
  changeAccountPassword,
  updateStoredAccount,
} from '../utils/authStore';
import { getSubjectMeta } from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';

interface UserProfileModalProps {
  currentUser: UserAccount;
  initialTab?: 'view_edit' | 'password';
  onClose: () => void;
  onUserUpdated: (user: UserAccount) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function UserProfileModal({
  currentUser,
  initialTab = 'view_edit',
  onClose,
  onUserUpdated,
}: UserProfileModalProps) {
  useSubjects();
  const [activeTab, setActiveTab] = useState<'view_edit' | 'password'>(initialTab);

  // Profile form state
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [studentClass, setStudentClass] = useState(currentUser.studentClass ?? '');
  const [schoolName, setSchoolName] = useState(currentUser.schoolName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl ?? '');
  const [facebookUrl, setFacebookUrl] = useState(currentUser.facebookUrl ?? '');
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setFullName(currentUser.fullName);
    setStudentClass(currentUser.studentClass ?? '');
    setSchoolName(currentUser.schoolName ?? '');
    setAvatarUrl(currentUser.avatarUrl ?? '');
    setFacebookUrl(currentUser.facebookUrl ?? '');
    setAvatarImgFailed(false);
    setProfileFeedback(null);
  }, [
    currentUser.id,
    currentUser.fullName,
    currentUser.studentClass,
    currentUser.schoolName,
    currentUser.avatarUrl,
    currentUser.facebookUrl,
  ]);

  const displayedAvatar =
    activeTab === 'view_edit' ? avatarUrl : currentUser.avatarUrl ?? '';

  const roleLabel =
    currentUser.role === 'admin'
      ? 'Quản trị viên'
      : currentUser.role === 'teacher'
        ? 'Giáo viên'
        : 'Học sinh';

  const handleAvatarFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const resized = await resizeAvatarImageFile(file);
      setAvatarUrl(resized);
      setAvatarImgFailed(false);
      setProfileFeedback(null);
      setActiveTab('view_edit');
    } catch (err) {
      setProfileFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể tải ảnh đại diện.',
      });
    }
  };

  const handleCopyUserId = () => {
    navigator.clipboard?.writeText(currentUser.id).catch(() => {});
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 1800);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const res = updateStoredAccount(currentUser.id, {
      fullName,
      studentClass: currentUser.role === 'student' ? studentClass : undefined,
      schoolName: currentUser.role !== 'student' ? schoolName : undefined,
      avatarUrl,
      facebookUrl,
    });
    if (!res.ok) {
      setProfileFeedback({ type: 'error', text: res.error });
      return;
    }
    onUserUpdated(res.user);
    setAvatarImgFailed(false);
    setProfileFeedback({
      type: 'success',
      text: `Đã lưu thông tin cá nhân cho tài khoản ID ${res.user.id}.`,
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        text: 'Mật khẩu mới nhập lại không khớp.',
      });
      return;
    }
    setPasswordBusy(true);
    const res = await changeAccountPassword(
      currentUser.id,
      currentPassword,
      newPassword,
    );
    setPasswordBusy(false);
    if (!res.ok) {
      setPasswordFeedback({ type: 'error', text: res.error });
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordFeedback({
      type: 'success',
      text: 'Đổi mật khẩu thành công. Tài khoản đã được cập nhật bảo mật.',
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Title Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <UserCheck className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            <h2
              id="user-profile-modal-title"
              className="font-display text-base font-bold text-slate-900 sm:text-lg dark:text-slate-50"
            >
              Thông tin cá nhân &amp; Tài khoản
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ thông tin cá nhân"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          {/* Compact Summary Card */}
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-950/60">
            <div className="relative shrink-0 self-start sm:self-auto">
              {displayedAvatar && !avatarImgFailed ? (
                <img
                  src={displayedAvatar}
                  alt={currentUser.fullName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarImgFailed(true)}
                  className="h-18 w-18 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                />
              ) : (
                <div className="flex h-18 w-18 items-center justify-center rounded-full border border-blue-200 bg-blue-50 font-display text-lg font-bold text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/60 dark:text-blue-300">
                  {getInitials(currentUser.fullName)}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveTab('view_edit');
                  window.setTimeout(() => avatarInputRef.current?.click(), 50);
                }}
                title="Tải ảnh đại diện"
                aria-label="Đổi ảnh đại diện"
                className="absolute -right-1 -bottom-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition-colors hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                  {currentUser.fullName}
                </p>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {roleLabel}
                </span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  ·
                </span>
                <button
                  type="button"
                  onClick={handleCopyUserId}
                  title="Sao chép ID tài khoản"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-800 tabular-nums transition-colors hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-500 dark:hover:text-blue-300"
                >
                  <span>ID: {currentUser.id}</span>
                  {copiedId ? (
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1 font-mono">
                  <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <span>{currentUser.email}</span>
                </span>
                {currentUser.role === 'student' ? (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                      ·
                    </span>
                    <span className="font-mono tabular-nums">
                      SBD:{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {currentUser.studentSbd ?? '—'}
                      </strong>
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                      ·
                    </span>
                    <span>
                      Lớp:{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {currentUser.studentClass ?? '12A1'}
                      </strong>
                    </span>
                  </>
                ) : (
                  <>
                    {currentUser.subject && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                          ·
                        </span>
                        <span>
                          Môn:{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {getSubjectMeta(currentUser.subject).name}
                          </strong>
                        </span>
                      </>
                    )}
                    {currentUser.schoolName && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                          ·
                        </span>
                        <span>{currentUser.schoolName}</span>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  Facebook:
                </span>
                {currentUser.facebookUrl ? (
                  <a
                    href={currentUser.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    <span className="max-w-xs truncate">{currentUser.facebookUrl}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    Chưa thêm liên kết Facebook
                  </span>
                )}
              </div>
            </div>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleAvatarFileSelected}
            className="hidden"
          />

          {/* Sub-tabs */}
          <div
            role="tablist"
            aria-label="Chức năng tài khoản cá nhân"
            className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'view_edit'}
              onClick={() => setActiveTab('view_edit')}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                activeTab === 'view_edit'
                  ? 'bg-blue-700 text-white dark:bg-blue-600'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Chỉnh sửa trang cá nhân</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'password'}
              onClick={() => setActiveTab('password')}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                activeTab === 'password'
                  ? 'bg-blue-700 text-white dark:bg-blue-600'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Đổi mật khẩu</span>
            </button>
          </div>

          {activeTab === 'view_edit' ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="nav-profile-id"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    ID tài khoản (6 ký tự cố định theo vai trò)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="nav-profile-id"
                      type="text"
                      readOnly
                      value={currentUser.id}
                      className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-100 px-3 font-mono text-sm font-bold tracking-wider text-slate-800 tabular-nums focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleCopyUserId}
                      className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {copiedId ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Sao chép ID</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="nav-profile-email"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Email đăng nhập
                  </label>
                  <input
                    id="nav-profile-email"
                    type="email"
                    readOnly
                    value={currentUser.email}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 font-mono text-sm text-slate-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
                  />
                </div>

                <div>
                  <label
                    htmlFor="nav-profile-name"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Họ và tên
                  </label>
                  <input
                    id="nav-profile-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nhập họ và tên..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                {currentUser.role === 'student' ? (
                  <div>
                    <label
                      htmlFor="nav-profile-class"
                      className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Lớp hành chính
                    </label>
                    <input
                      id="nav-profile-class"
                      type="text"
                      value={studentClass}
                      onChange={(e) => setStudentClass(e.target.value.toUpperCase())}
                      placeholder="VD: 12A1"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 uppercase focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="nav-profile-school"
                      className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Trường / Đơn vị công tác
                    </label>
                    <input
                      id="nav-profile-school"
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="VD: THPT Chu Văn An"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="nav-profile-facebook"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Liên kết tài khoản Facebook
                  </label>
                  <input
                    id="nav-profile-facebook"
                    type="text"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    placeholder="https://www.facebook.com/ten.tai.khoan"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="nav-profile-avatar-url"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Ảnh đại diện (Tải từ máy hoặc dán URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="nav-profile-avatar-url"
                      type="text"
                      value={
                        avatarUrl.startsWith('data:image/')
                          ? '(Đã tải ảnh từ thiết bị)'
                          : avatarUrl
                      }
                      readOnly={avatarUrl.startsWith('data:image/')}
                      onChange={(e) => {
                        setAvatarUrl(e.target.value);
                        setAvatarImgFailed(false);
                      }}
                      placeholder="https://... hoặc bấm Tải ảnh"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Tải ảnh</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarUrl('');
                          setAvatarImgFailed(false);
                        }}
                        title="Xóa ảnh đại diện"
                        className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 px-2.5 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {profileFeedback && (
                <p
                  role="status"
                  className={`text-xs font-semibold ${
                    profileFeedback.type === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {profileFeedback.text}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 cursor-pointer items-center whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu thông tin cá nhân</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="nav-cur-pw"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Mật khẩu hiện tại
                  </label>
                  <div className="relative">
                    <input
                      id="nav-cur-pw"
                      type={showCurrentPw ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang dùng"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      aria-label={showCurrentPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      {showCurrentPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="nav-new-pw"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Mật khẩu mới (&ge; 6 ký tự)
                  </label>
                  <div className="relative">
                    <input
                      id="nav-new-pw"
                      type={showNewPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-10 pl-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      aria-label={showNewPw ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      {showNewPw ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="nav-confirm-pw"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    id="nav-confirm-pw"
                    type={showNewPw ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              {passwordFeedback && (
                <p
                  role="status"
                  className={`text-xs font-semibold ${
                    passwordFeedback.type === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {passwordFeedback.text}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 cursor-pointer items-center whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={passwordBusy}
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>
                    {passwordBusy ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
