import {
  Check,
  Eye,
  Lock,
  Pencil,
  Search,
  Share2,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ResourceShareGrant, SharePermission, UserAccount } from '../types/exam';
import { listAccountsSync } from '../utils/authStore';

interface ResourceShareModalProps {
  open: boolean;
  onClose: () => void;
  resourceTypeLabel: string;
  resourceTitle: string;
  ownerTeacherId?: string;
  ownerTeacherName?: string;
  sharedWith?: ResourceShareGrant[];
  currentUser: UserAccount | null;
  onSaveShares: (nextSharedWith: ResourceShareGrant[]) => void;
}

export function ResourceShareModal({
  open,
  onClose,
  resourceTypeLabel,
  resourceTitle,
  ownerTeacherId,
  ownerTeacherName,
  sharedWith,
  currentUser,
  onSaveShares,
}: ResourceShareModalProps) {
  const [grants, setGrants] = useState<ResourceShareGrant[]>([]);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<SharePermission>('view');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const allAccounts = useMemo(() => {
    if (!open) return [];
    return listAccountsSync();
  }, [open]);

  const availableTeachers = useMemo(() => {
    return allAccounts.filter(
      (acc) => acc.role === 'teacher' && acc.id !== ownerTeacherId,
    );
  }, [allAccounts, ownerTeacherId]);

  useEffect(() => {
    if (!open) return;
    setGrants(sharedWith ? [...sharedWith] : []);
    setTeacherQuery('');
    setSelectedPermission('view');
    setLookupError(null);
  }, [open, sharedWith]);

  const unsharedTeachers = useMemo(() => {
    const sharedIds = new Set(grants.map((g) => g.teacherId));
    return availableTeachers.filter((t) => !sharedIds.has(t.id));
  }, [availableTeachers, grants]);

  const normalizedQuery = teacherQuery.trim().toLowerCase();

  const resolvedTeacher = useMemo(() => {
    if (normalizedQuery.length < 6) return null;
    return (
      unsharedTeachers.find((t) => t.id.toLowerCase() === normalizedQuery) ??
      unsharedTeachers.find((t) => t.email.toLowerCase() === normalizedQuery) ??
      null
    );
  }, [normalizedQuery, unsharedTeachers]);

  if (!open) return null;

  const handleAddGrant = () => {
    setLookupError(null);
    const target = resolvedTeacher;
    if (!target) {
      if (!normalizedQuery) {
        setLookupError('Vui lòng nhập ID của giáo viên muốn chia sẻ (VD: GV0002).');
        return;
      }
      const existingGrant = grants.find(
        (g) =>
          g.teacherId.toLowerCase() === normalizedQuery ||
          g.teacherEmail.toLowerCase() === normalizedQuery,
      );
      if (existingGrant) {
        setLookupError(
          `Giáo viên ${existingGrant.teacherName} (${existingGrant.teacherId}) đã có trong danh sách chia sẻ.`,
        );
        return;
      }
      const matchedAccount = allAccounts.find(
        (a) =>
          a.id.toLowerCase() === normalizedQuery ||
          a.email.toLowerCase() === normalizedQuery,
      );
      if (matchedAccount) {
        if (matchedAccount.id === ownerTeacherId) {
          setLookupError('ID này thuộc về chủ sở hữu hiện tại của tài nguyên.');
          return;
        }
        if (matchedAccount.role !== 'teacher') {
          setLookupError(
            `Tài khoản ${matchedAccount.id} (${matchedAccount.fullName}) không phải tài khoản Giáo viên.`,
          );
          return;
        }
      }
      setLookupError(
        `Không tìm thấy giáo viên phù hợp với "${teacherQuery.trim()}". Vui lòng kiểm tra lại ID (VD: GV0002).`,
      );
      return;
    }

    const nextGrant: ResourceShareGrant = {
      teacherId: target.id,
      teacherEmail: target.email,
      teacherName: target.fullName,
      permission: selectedPermission,
      sharedAt: new Date().toISOString(),
    };
    setGrants((prev) => [
      ...prev.filter((g) => g.teacherId !== target.id),
      nextGrant,
    ]);
    setTeacherQuery('');
    setLookupError(null);
  };

  const handleChangePermission = (teacherId: string, permission: SharePermission) => {
    setGrants((prev) =>
      prev.map((g) => (g.teacherId === teacherId ? { ...g, permission } : g)),
    );
  };

  const handleRemoveGrant = (teacherId: string) => {
    setGrants((prev) => prev.filter((g) => g.teacherId !== teacherId));
  };

  const handleSubmit = () => {
    onSaveShares(grants);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Share2 className="h-4 w-4 shrink-0" />
              <span className="text-[11px] font-bold tracking-wide uppercase">
                Chia sẻ {resourceTypeLabel}
              </span>
            </div>
            <h3 className="mt-1 truncate font-display text-base font-bold text-slate-900 dark:text-slate-50">
              {resourceTitle}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Chủ sở hữu:{' '}
              <strong className="text-slate-700 dark:text-slate-200">
                {ownerTeacherName ?? currentUser?.fullName ?? 'Giáo viên tạo'}
              </strong>{' '}
              · Mặc định riêng tư
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ chia sẻ"
            className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
            <label
              htmlFor="share-teacher-id-search"
              className="block font-semibold text-slate-800 dark:text-slate-200"
            >
              Tìm kiếm theo ID giáo viên được chia sẻ
            </label>
            {availableTeachers.length === 0 ? (
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                Chưa có tài khoản giáo viên nào khác trong hệ thống để chia sẻ.
              </p>
            ) : unsharedTeachers.length === 0 ? (
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                Tất cả giáo viên hiện có đều đã được thêm vào danh sách chia sẻ.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      id="share-teacher-id-search"
                      type="text"
                      aria-label="Tìm kiếm theo ID giáo viên"
                      value={teacherQuery}
                      onChange={(e) => {
                        setTeacherQuery(e.target.value);
                        if (lookupError) setLookupError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddGrant();
                        }
                      }}
                      placeholder="Nhập đủ ID 6 ký tự (VD: GV0002)..."
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white pr-7 pl-8 font-mono text-xs text-slate-900 placeholder:font-sans focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    {teacherQuery && (
                      <button
                        type="button"
                        aria-label="Xóa từ khóa tìm kiếm"
                        onClick={() => {
                          setTeacherQuery('');
                          setLookupError(null);
                        }}
                        className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <select
                    aria-label="Chọn quyền truy cập"
                    value={selectedPermission}
                    onChange={(e) =>
                      setSelectedPermission(e.target.value as SharePermission)
                    }
                    className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="view">Chỉ xem</option>
                    <option value="edit">Được sửa</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleAddGrant}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Thêm</span>
                  </button>
                </div>

                {resolvedTeacher && (
                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    Tìm thấy giáo viên:{' '}
                    <strong className="font-mono">{resolvedTeacher.id}</strong> ·{' '}
                    {resolvedTeacher.fullName} ({resolvedTeacher.email})
                  </p>
                )}

                {lookupError && (
                  <p role="alert" className="text-[11px] font-medium text-red-600 dark:text-red-400">
                    {lookupError}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <Users className="h-3.5 w-3.5 text-slate-500" />
                <span>Danh sách giáo viên có quyền truy cập ({grants.length})</span>
              </span>
              {grants.length === 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Lock className="h-3 w-3" />
                  <span>Đang ở chế độ riêng tư</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setGrants([])}
                  className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-red-200 bg-red-50/60 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70"
                >
                  <Lock className="h-3 w-3" />
                  <span>Dừng chia sẻ tất cả</span>
                </button>
              )}
            </div>

            {grants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Chưa chia sẻ cho giáo viên nào. Chỉ chủ sở hữu và Admin có thể xem dữ liệu này.
              </div>
            ) : (
              <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {grants.map((g) => (
                  <div
                    key={g.teacherId}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {g.teacherName}
                        </p>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {g.teacherId}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {g.teacherEmail}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950">
                        <button
                          type="button"
                          onClick={() => handleChangePermission(g.teacherId, 'view')}
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                            g.permission === 'view'
                              ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-800 dark:text-blue-300'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <Eye className="h-3 w-3" />
                          <span>Chỉ xem</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangePermission(g.teacherId, 'edit')}
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                            g.permission === 'edit'
                              ? 'bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Được sửa</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveGrant(g.teacherId)}
                        title="Dừng chia sẻ với giáo viên này"
                        aria-label={`Dừng chia sẻ với ${g.teacherName}`}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Dừng chia sẻ</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Lưu chia sẻ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
