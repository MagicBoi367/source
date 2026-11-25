import type { SubjectId, UserAccount, UserRole } from '../types/exam';
import { appendSystemLog } from './systemLogs';

const ACCOUNTS_STORAGE_KEY = 'kythi2025_accounts_v1';
const SESSION_STORAGE_KEY = 'kythi2025_active_session_v1';

interface StoredUserRecord extends UserAccount {
  salt: string;
  passwordHash: string;
}

export interface RegisterAccountInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  studentSbd?: string;
  studentClass?: string;
  schoolName?: string;
  subject?: SubjectId;
}

export interface RegisterAccountOptions {
  actorRole?: UserRole;
}

export type AuthActionResult =
  | { ok: true; user: UserAccount }
  | { ok: false; error: string };

const ACCOUNT_IDS_MIGRATED_KEY = 'kythi2025_account_ids_v2_migrated';

export const LEGACY_ACCOUNT_ID_MAP: Record<string, string> = {
  acc_seed_admin_1: 'AD0001',
  acc_seed_student_1: 'HV0001',
  acc_seed_teacher_1: 'GV0001',
  acc_seed_teacher_2: 'GV0002',
  acc_seed_teacher_vatli: 'GV0003',
};

const RESERVED_SYSTEM_USER_IDS = new Set<string>([
  'AD0001',
  'HV0001',
  'GV0001',
  'GV0002',
  'GV0003',
]);

export function getUserIdPrefix(role: UserRole): 'HV' | 'GV' | 'AD' {
  if (role === 'admin') return 'AD';
  if (role === 'teacher') return 'GV';
  return 'HV';
}

export function isValidRoleUserId(id: string | undefined, role: UserRole): boolean {
  if (!id) return false;
  const prefix = getUserIdPrefix(role);
  return new RegExp(`^${prefix}\\d{4}$`).test(id.trim());
}

function randomFourDigits(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % 10000;
  }
  return Math.floor(Math.random() * 10000);
}

export function generateRoleUserId(
  role: UserRole,
  existingIds: ReadonlySet<string>,
): string {
  const prefix = getUserIdPrefix(role);
  for (let attempt = 0; attempt < 250; attempt++) {
    const num = randomFourDigits();
    const candidate = `${prefix}${String(num).padStart(4, '0')}`;
    if (!existingIds.has(candidate) && !RESERVED_SYSTEM_USER_IDS.has(candidate)) {
      return candidate;
    }
  }
  const offset = randomFourDigits();
  for (let i = 0; i < 10000; i++) {
    const num = (offset + i) % 10000;
    const candidate = `${prefix}${String(num).padStart(4, '0')}`;
    if (!existingIds.has(candidate) && !RESERVED_SYSTEM_USER_IDS.has(candidate)) {
      return candidate;
    }
  }
  return `${prefix}${String(Date.now() % 10000).padStart(4, '0')}`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return toHex(buf);
  }
  return `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const input = `${salt}:${password}`;
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return toHex(new Uint8Array(digest));
  }
  // Fallback deterministic hash only if WebCrypto subtle is unavailable
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

function sanitizeAccount(record: StoredUserRecord): UserAccount {
  return {
    id: record.id,
    email: record.email,
    fullName: record.fullName,
    role: record.role,
    studentSbd: record.studentSbd,
    studentClass: record.studentClass,
    schoolName: record.schoolName,
    subject: record.subject,
    avatarUrl: record.avatarUrl,
    facebookUrl: record.facebookUrl,
    enrolledClassIds: Array.isArray(record.enrolledClassIds)
      ? record.enrolledClassIds
      : undefined,
    createdAt: record.createdAt,
  };
}

// Precomputed deterministic seed salt + hash helper built lazily on first read
async function buildSeedRecords(): Promise<StoredUserRecord[]> {
  const studentSalt = 'kythi2025_seed_stu_01';
  const teacherSalt = 'kythi2025_seed_tch_01';
  const teacher2Salt = 'kythi2025_seed_tch_02';
  const adminSalt = 'kythi2025_seed_adm_01';
  const [studentHash, teacherHash, teacher2Hash, adminHash] = await Promise.all([
    hashPassword('123456', studentSalt),
    hashPassword('123456', teacherSalt),
    hashPassword('123456', teacher2Salt),
    hashPassword('123456', adminSalt),
  ]);

  return [
    {
      id: 'AD0001',
      email: 'admin@kythi2025.edu.vn',
      fullName: 'Quản trị viên Hệ thống',
      role: 'admin',
      schoolName: 'Ban Quản trị NTPEXION',
      createdAt: '2025-05-01T08:00:00.000Z',
      salt: adminSalt,
      passwordHash: adminHash,
    },
    {
      id: 'HV0001',
      email: 'hocsinh@kythi2025.edu.vn',
      fullName: 'Nguyễn Minh Anh',
      role: 'student',
      studentSbd: '0102588',
      studentClass: '12A1',
      createdAt: '2025-05-01T08:00:00.000Z',
      salt: studentSalt,
      passwordHash: studentHash,
    },
    {
      id: 'GV0001',
      email: 'giaovien@kythi2025.edu.vn',
      fullName: 'ThS. Trần Quốc Bảo',
      role: 'teacher',
      schoolName: 'THPT Chuyên Chu Văn An',
      subject: 'toan',
      createdAt: '2025-05-01T08:00:00.000Z',
      salt: teacherSalt,
      passwordHash: teacherHash,
    },
    {
      id: 'GV0002',
      email: 'gv.hai@kythi2025.edu.vn',
      fullName: 'Cô Nguyễn Thị Hải (gv.hai)',
      role: 'teacher',
      schoolName: 'THPT Nguyễn Huệ',
      subject: 'ngu_van',
      createdAt: '2025-05-02T08:00:00.000Z',
      salt: teacher2Salt,
      passwordHash: teacher2Hash,
    },
  ];
}

function readRawRecordsInternalSync(): StoredUserRecord[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUserRecord[]) : [];
  } catch {
    return [];
  }
}

function saveRawRecordsSync(records: StoredUserRecord[]): void {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota errors
  }
}

function remapAccountReferencesInStorage(idRemap: Record<string, string>): void {
  if (Object.keys(idRemap).length === 0) return;

  const mapId = (id?: string): string | undefined =>
    id && idRemap[id] ? idRemap[id] : id;

  const mapSharedWith = <T extends { teacherId: string }>(
    list?: T[],
  ): T[] | undefined => {
    if (!Array.isArray(list)) return list;
    let changed = false;
    const next = list.map((g) => {
      const mapped = idRemap[g.teacherId];
      if (mapped && mapped !== g.teacherId) {
        changed = true;
        return { ...g, teacherId: mapped };
      }
      return g;
    });
    return changed ? next : list;
  };

  try {
    const activeSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (activeSession && idRemap[activeSession]) {
      localStorage.setItem(SESSION_STORAGE_KEY, idRemap[activeSession]);
    }
  } catch {
    // Ignore storage errors
  }

  const teacherOwnedKeys = [
    'kythi2025_questions_v1',
    'kythi2025_exams_v1',
    'kythi2025_private_classes_v1',
    'kythi2025_class_materials_v1',
    'kythi2025_class_assignments_v1',
    'kythi2025_class_schedules_v1',
  ];

  for (const storageKey of teacherOwnedKeys) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      let changed = false;
      const updated = parsed.map((item: Record<string, unknown>) => {
        const nextOwner =
          typeof item.ownerTeacherId === 'string'
            ? mapId(item.ownerTeacherId)
            : item.ownerTeacherId;
        const prevShared = Array.isArray(item.sharedWith)
          ? (item.sharedWith as { teacherId: string }[])
          : undefined;
        const nextShared = mapSharedWith(prevShared);
        if (nextOwner !== item.ownerTeacherId || nextShared !== prevShared) {
          changed = true;
          return {
            ...item,
            ...(nextOwner !== undefined ? { ownerTeacherId: nextOwner } : {}),
            ...(nextShared !== undefined ? { sharedWith: nextShared } : {}),
          };
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
    } catch {
      // Ignore parse/quota errors
    }
  }

  try {
    const rawReqs = localStorage.getItem('kythi2025_class_join_requests_v1');
    if (rawReqs) {
      const parsed = JSON.parse(rawReqs);
      if (Array.isArray(parsed)) {
        let changed = false;
        const updated = parsed.map((r: Record<string, unknown>) => {
          if (typeof r.studentUserId === 'string' && idRemap[r.studentUserId]) {
            changed = true;
            return { ...r, studentUserId: idRemap[r.studentUserId] };
          }
          return r;
        });
        if (changed) {
          localStorage.setItem('kythi2025_class_join_requests_v1', JSON.stringify(updated));
        }
      }
    }
  } catch {
    // Ignore storage errors
  }

  try {
    const rawSubs = localStorage.getItem('kythi2025_submissions_v1');
    if (rawSubs) {
      const parsed = JSON.parse(rawSubs);
      if (Array.isArray(parsed)) {
        let changed = false;
        const updated = parsed.map((s: Record<string, unknown>) => {
          if (typeof s.submittedByUserId === 'string' && idRemap[s.submittedByUserId]) {
            changed = true;
            return { ...s, submittedByUserId: idRemap[s.submittedByUserId] };
          }
          return s;
        });
        if (changed) {
          localStorage.setItem('kythi2025_submissions_v1', JSON.stringify(updated));
        }
      }
    }
  } catch {
    // Ignore storage errors
  }

  try {
    const rawLogs = localStorage.getItem('kythi2025_system_logs_v1');
    if (rawLogs) {
      const parsed = JSON.parse(rawLogs);
      if (Array.isArray(parsed)) {
        let changed = false;
        const updated = parsed.map((l: Record<string, unknown>) => {
          if (typeof l.actorId === 'string' && idRemap[l.actorId]) {
            changed = true;
            return { ...l, actorId: idRemap[l.actorId] };
          }
          return l;
        });
        if (changed) {
          localStorage.setItem('kythi2025_system_logs_v1', JSON.stringify(updated));
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export function migrateStoredAccountIdsSync(): StoredUserRecord[] {
  const records = readRawRecordsInternalSync();
  let alreadyFlagged = false;
  try {
    alreadyFlagged = localStorage.getItem(ACCOUNT_IDS_MIGRATED_KEY) === 'true';
  } catch {
    alreadyFlagged = false;
  }

  const needsRecordMigration = records.some((r) => !isValidRoleUserId(r.id, r.role));
  if (!needsRecordMigration && alreadyFlagged) {
    return records;
  }

  const usedIds = new Set<string>();
  for (const r of records) {
    if (isValidRoleUserId(r.id, r.role)) {
      usedIds.add(r.id);
    }
  }

  const idRemap: Record<string, string> = { ...LEGACY_ACCOUNT_ID_MAP };
  let recordsChanged = false;

  const migratedRecords = records.map((r) => {
    if (isValidRoleUserId(r.id, r.role)) {
      return r;
    }
    recordsChanged = true;
    const mappedLegacy = LEGACY_ACCOUNT_ID_MAP[r.id];
    let nextId: string;
    if (
      mappedLegacy &&
      isValidRoleUserId(mappedLegacy, r.role) &&
      !usedIds.has(mappedLegacy)
    ) {
      nextId = mappedLegacy;
    } else {
      nextId = generateRoleUserId(r.role, usedIds);
    }
    usedIds.add(nextId);
    idRemap[r.id] = nextId;
    return { ...r, id: nextId };
  });

  if (recordsChanged) {
    saveRawRecordsSync(migratedRecords);
  }
  remapAccountReferencesInStorage(idRemap);

  try {
    localStorage.setItem(ACCOUNT_IDS_MIGRATED_KEY, 'true');
  } catch {
    // Ignore storage errors
  }

  return migratedRecords;
}

function readRawRecordsSync(): StoredUserRecord[] {
  return migrateStoredAccountIdsSync();
}

export async function ensureSeedAccounts(): Promise<UserAccount[]> {
  const existing = readRawRecordsSync();
  if (existing.length > 0) {
    // Upgrade existing storage seamlessly if admin or second teacher seed account does not yet exist
    const hasAdmin = existing.some(
      (r) => r.role === 'admin' || r.email.toLowerCase() === 'admin@kythi2025.edu.vn',
    );
    const hasTeacher2 = existing.some(
      (r) =>
        r.id === 'GV0002' ||
        r.email.toLowerCase() === 'gv.hai@kythi2025.edu.vn',
    );
    if (!hasAdmin || !hasTeacher2) {
      const seeds = await buildSeedRecords();
      let merged = [...existing];
      if (!hasAdmin) {
        const adminSeed = seeds.find((s) => s.role === 'admin');
        if (adminSeed) merged = [adminSeed, ...merged];
      }
      if (!hasTeacher2) {
        const teacher2Seed = seeds.find((s) => s.id === 'GV0002');
        if (teacher2Seed) merged = [...merged, teacher2Seed];
      }
      saveRawRecordsSync(merged);
      return merged.map(sanitizeAccount);
    }
    return existing.map(sanitizeAccount);
  }
  const seeds = await buildSeedRecords();
  saveRawRecordsSync(seeds);
  remapAccountReferencesInStorage(LEGACY_ACCOUNT_ID_MAP);
  try {
    localStorage.setItem(ACCOUNT_IDS_MIGRATED_KEY, 'true');
  } catch {
    // Ignore
  }
  return seeds.map(sanitizeAccount);
}

export async function resetSeedAccounts(): Promise<UserAccount[]> {
  const seeds = await buildSeedRecords();
  saveRawRecordsSync(seeds);
  try {
    localStorage.setItem(ACCOUNT_IDS_MIGRATED_KEY, 'true');
  } catch {
    // Ignore
  }
  return seeds.map(sanitizeAccount);
}

export function listAccountsSync(): UserAccount[] {
  return readRawRecordsSync().map(sanitizeAccount);
}

export function getCurrentSessionUser(): UserAccount | null {
  try {
    const records = readRawRecordsSync();
    const activeId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!activeId) return null;
    const matched = records.find((r) => r.id === activeId);
    return matched ? sanitizeAccount(matched) : null;
  } catch {
    return null;
  }
}

export function setCurrentSessionUserId(accountId: string | null): void {
  try {
    if (!accountId) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, accountId);
    }
  } catch {
    // Ignore storage errors
  }
}

function generateAutoSbd(existing: StoredUserRecord[]): string {
  const used = new Set(
    existing.map((r) => (r.studentSbd ?? '').trim().toUpperCase()).filter(Boolean),
  );
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = `010${Math.floor(1000 + Math.random() * 8999)}`;
    if (!used.has(candidate)) return candidate;
  }
  return `010${Date.now().toString().slice(-4)}`;
}

export async function registerAccount(
  input: RegisterAccountInput,
  options?: RegisterAccountOptions,
): Promise<AuthActionResult> {
  if (input.role === 'admin' && options?.actorRole !== 'admin') {
    return {
      ok: false,
      error: 'Chỉ tài khoản Quản trị viên (Admin) mới có quyền tạo thêm tài khoản Admin.',
    };
  }

  await ensureSeedAccounts();
  const records = readRawRecordsSync();

  const cleanName = input.fullName.trim();
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanPassword = input.password;

  if (cleanName.length < 2) {
    return { ok: false, error: 'Họ và tên cần có ít nhất 2 ký tự.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Địa chỉ email không hợp lệ (VD: ten@truong.edu.vn).' };
  }
  if (cleanPassword.length < 6) {
    return { ok: false, error: 'Mật khẩu phải có tối thiểu 6 ký tự.' };
  }

  if (records.some((r) => r.email.toLowerCase() === cleanEmail)) {
    return {
      ok: false,
      error: 'Email này đã được đăng ký. Vui lòng chọn email khác hoặc đăng nhập.',
    };
  }

  let studentSbd: string | undefined;
  let studentClass: string | undefined;
  let schoolName: string | undefined;
  let subject: SubjectId | undefined;

  if (input.role === 'student') {
    const requestedSbd = (input.studentSbd ?? '').trim().toUpperCase();
    if (requestedSbd) {
      if (records.some((r) => r.studentSbd?.toUpperCase() === requestedSbd)) {
        return {
          ok: false,
          error: `Số báo danh "${requestedSbd}" đã thuộc về một tài khoản học sinh khác.`,
        };
      }
      studentSbd = requestedSbd;
    } else {
      studentSbd = generateAutoSbd(records);
    }
    studentClass = (input.studentClass ?? '').trim().toUpperCase() || '12A1';
  } else if (input.role === 'teacher') {
    schoolName = (input.schoolName ?? '').trim() || 'THPT Công lập';
    subject = input.subject ?? 'toan';
  } else {
    schoolName = (input.schoolName ?? '').trim() || 'Ban Quản trị NTPEXION';
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(cleanPassword, salt);
  const existingIds = new Set(records.map((r) => r.id));
  const generatedId = generateRoleUserId(input.role, existingIds);

  const newRecord: StoredUserRecord = {
    id: generatedId,
    email: cleanEmail,
    fullName: cleanName,
    role: input.role,
    studentSbd,
    studentClass,
    schoolName,
    subject,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash,
  };

  saveRawRecordsSync([newRecord, ...records]);
  const createdUser = sanitizeAccount(newRecord);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Đăng ký tài khoản mới',
    detail: `Tạo tài khoản ${createdUser.role} "${createdUser.fullName}" (ID: ${createdUser.id} · ${createdUser.email}).`,
    actorName: createdUser.fullName,
    actorRole: createdUser.role,
    actorId: createdUser.id,
    targetLabel: `${createdUser.id} · ${createdUser.email}`,
  });
  return { ok: true, user: createdUser };
}

export async function loginWithCredentials(
  identifier: string,
  password: string,
): Promise<AuthActionResult> {
  await ensureSeedAccounts();
  const records = readRawRecordsSync();

  const cleanId = identifier.trim().toLowerCase();
  if (!cleanId || !password) {
    return {
      ok: false,
      error: 'Vui lòng nhập đầy đủ Email (hoặc ID / SBD) và Mật khẩu.',
    };
  }

  const found = records.find(
    (r) =>
      r.email.toLowerCase() === cleanId ||
      r.id.toLowerCase() === cleanId ||
      (r.studentSbd && r.studentSbd.toLowerCase() === cleanId),
  );

  if (!found) {
    appendSystemLog({
      category: 'auth',
      level: 'warning',
      action: 'Đăng nhập thất bại (Không tìm thấy tài khoản)',
      detail: `Thử đăng nhập với định danh "${identifier.trim()}".`,
      actorName: identifier.trim() || 'Khách',
      actorRole: 'guest',
      targetLabel: cleanId,
    });
    return {
      ok: false,
      error: 'Không tìm thấy tài khoản với Email hoặc Số báo danh này.',
    };
  }

  const candidateHash = await hashPassword(password, found.salt);
  if (candidateHash !== found.passwordHash) {
    appendSystemLog({
      category: 'auth',
      level: 'warning',
      action: 'Đăng nhập thất bại (Sai mật khẩu)',
      detail: `Nhập sai mật khẩu cho tài khoản ${found.fullName} (${found.email}).`,
      actorName: found.fullName,
      actorRole: found.role,
      actorId: found.id,
      targetLabel: found.email,
    });
    return { ok: false, error: 'Mật khẩu không chính xác. Vui lòng thử lại.' };
  }

  const sanitized = sanitizeAccount(found);
  setCurrentSessionUserId(sanitized.id);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Đăng nhập hệ thống',
    detail: `${sanitized.fullName} (${sanitized.email}) đã đăng nhập thành công.`,
    actorName: sanitized.fullName,
    actorRole: sanitized.role,
    actorId: sanitized.id,
    targetLabel: sanitized.email,
  });
  return { ok: true, user: sanitized };
}

export async function quickLoginDemoAccount(
  role: UserRole,
  email?: string,
): Promise<UserAccount> {
  await ensureSeedAccounts();
  let records = readRawRecordsSync();
  const findTarget = (list: StoredUserRecord[]) => {
    if (email) {
      const byEmail = list.find((r) => r.email.toLowerCase() === email.toLowerCase());
      if (byEmail) return byEmail;
    }
    return list.find((r) => r.role === role);
  };
  let target = findTarget(records);
  if (!target) {
    await resetSeedAccounts();
    records = readRawRecordsSync();
    target = findTarget(records) ?? records[0];
  }
  const sanitized = sanitizeAccount(target);
  setCurrentSessionUserId(sanitized.id);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Đăng nhập nhanh tài khoản mẫu',
    detail: `Đăng nhập nhanh vai trò ${role}: ${sanitized.fullName} (${sanitized.email}).`,
    actorName: sanitized.fullName,
    actorRole: sanitized.role,
    actorId: sanitized.id,
    targetLabel: sanitized.email,
  });
  return sanitized;
}

export function switchSessionAccount(accountId: string): UserAccount | null {
  const records = readRawRecordsSync();
  const found = records.find((r) => r.id === accountId);
  if (!found) return null;
  setCurrentSessionUserId(found.id);
  const sanitized = sanitizeAccount(found);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Chuyển đổi phiên tài khoản',
    detail: `Chuyển phiên hoạt động sang ${sanitized.fullName} (${sanitized.email}).`,
    targetLabel: sanitized.email,
  });
  return sanitized;
}

export function deleteStoredAccount(accountId: string): UserAccount[] {
  const records = readRawRecordsSync();
  const removed = records.find((r) => r.id === accountId);
  const next = records.filter((r) => r.id !== accountId);
  saveRawRecordsSync(next);
  if (localStorage.getItem(SESSION_STORAGE_KEY) === accountId) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  if (removed) {
    appendSystemLog({
      category: 'user',
      level: 'warning',
      action: 'Xóa tài khoản người dùng',
      detail: `Đã xóa tài khoản ${removed.fullName} (${removed.email} · ${removed.role}).`,
      targetLabel: removed.email,
    });
  }
  return next.map(sanitizeAccount);
}

const RESET_OTP_STORAGE_KEY = 'kythi2025_reset_otp_v1';

interface StoredResetOtp {
  userId: string;
  otpCode: string;
  expiresAt: number;
}

export interface PasswordResetChallenge {
  userId: string;
  fullName: string;
  maskedEmail: string;
  role: UserRole;
  otpCode: string;
  expiresAt: number;
}

export type PasswordResetRequestResult =
  | { ok: true; challenge: PasswordResetChallenge }
  | { ok: false; error: string };

function maskEmailAddress(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.min(5, local.length - 2))}@${domain}`;
}

function generateSixDigitOtp(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(100000 + (arr[0] % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function requestPasswordResetCode(
  identifier: string,
): Promise<PasswordResetRequestResult> {
  await ensureSeedAccounts();
  const records = readRawRecordsSync();
  const cleanId = identifier.trim().toLowerCase();

  if (!cleanId) {
    return {
      ok: false,
      error: 'Vui lòng nhập Email, ID tài khoản hoặc Số báo danh cần khôi phục mật khẩu.',
    };
  }

  const found = records.find(
    (r) =>
      r.email.toLowerCase() === cleanId ||
      r.id.toLowerCase() === cleanId ||
      (r.studentSbd && r.studentSbd.toLowerCase() === cleanId),
  );

  if (!found) {
    return {
      ok: false,
      error: 'Không tìm thấy tài khoản khớp với Email, ID hoặc Số báo danh này.',
    };
  }

  const otpCode = generateSixDigitOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  try {
    const payload: StoredResetOtp = {
      userId: found.id,
      otpCode,
      expiresAt,
    };
    sessionStorage.setItem(RESET_OTP_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore sessionStorage errors
  }

  return {
    ok: true,
    challenge: {
      userId: found.id,
      fullName: found.fullName,
      maskedEmail: maskEmailAddress(found.email),
      role: found.role,
      otpCode,
      expiresAt,
    },
  };
}

export async function confirmPasswordReset(
  identifier: string,
  otpCode: string,
  newPassword: string,
): Promise<AuthActionResult> {
  await ensureSeedAccounts();
  const records = readRawRecordsSync();
  const cleanId = identifier.trim().toLowerCase();
  const cleanOtp = otpCode.trim();

  const foundIdx = records.findIndex(
    (r) =>
      r.email.toLowerCase() === cleanId ||
      r.id.toLowerCase() === cleanId ||
      (r.studentSbd && r.studentSbd.toLowerCase() === cleanId),
  );

  if (foundIdx === -1) {
    return {
      ok: false,
      error: 'Không tìm thấy tài khoản cần đặt lại mật khẩu.',
    };
  }

  let storedOtp: StoredResetOtp | null = null;
  try {
    const raw = sessionStorage.getItem(RESET_OTP_STORAGE_KEY);
    if (raw) storedOtp = JSON.parse(raw) as StoredResetOtp;
  } catch {
    storedOtp = null;
  }

  const target = records[foundIdx];
  if (!storedOtp || storedOtp.userId !== target.id) {
    return {
      ok: false,
      error: 'Chưa có yêu cầu đặt lại mật khẩu hợp lệ. Vui lòng gửi lại mã xác nhận.',
    };
  }

  if (Date.now() > storedOtp.expiresAt) {
    return {
      ok: false,
      error: 'Mã xác nhận đã hết hạn (quá 5 phút). Vui lòng lấy mã mới.',
    };
  }

  if (cleanOtp !== storedOtp.otpCode) {
    return {
      ok: false,
      error: 'Mã xác nhận 6 số không chính xác. Vui lòng kiểm tra lại.',
    };
  }

  if (newPassword.length < 6) {
    return {
      ok: false,
      error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.',
    };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  const updatedRecord: StoredUserRecord = {
    ...target,
    salt: newSalt,
    passwordHash: newHash,
  };

  const nextRecords = [...records];
  nextRecords[foundIdx] = updatedRecord;
  saveRawRecordsSync(nextRecords);

  try {
    sessionStorage.removeItem(RESET_OTP_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup error
  }

  const sanitized = sanitizeAccount(updatedRecord);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Khôi phục mật khẩu qua mã xác nhận',
    detail: `Đặt lại mật khẩu thành công cho ${sanitized.fullName} (${sanitized.email}).`,
    actorName: sanitized.fullName,
    actorRole: sanitized.role,
    actorId: sanitized.id,
    targetLabel: sanitized.email,
  });

  return { ok: true, user: sanitized };
}

export async function resetAccountPasswordDirect(
  accountId: string,
  newPassword: string,
): Promise<AuthActionResult> {
  if (newPassword.length < 6) {
    return { ok: false, error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' };
  }
  const records = readRawRecordsSync();
  const idx = records.findIndex((r) => r.id === accountId);
  if (idx === -1) {
    return { ok: false, error: 'Không tìm thấy tài khoản.' };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  const updatedRecord: StoredUserRecord = {
    ...records[idx],
    salt: newSalt,
    passwordHash: newHash,
  };

  const nextRecords = [...records];
  nextRecords[idx] = updatedRecord;
  saveRawRecordsSync(nextRecords);
  const sanitized = sanitizeAccount(updatedRecord);
  appendSystemLog({
    category: 'auth',
    level: 'warning',
    action: 'Quản trị viên cấp lại mật khẩu',
    detail: `Cấp lại mật khẩu trực tiếp cho tài khoản ${sanitized.fullName} (${sanitized.email}).`,
    targetLabel: sanitized.email,
  });
  return { ok: true, user: sanitized };
}

export function normalizeFacebookProfileUrl(
  raw: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'Liên kết Facebook phải sử dụng giao thức http:// hoặc https://.',
      };
    }
    const host = parsed.hostname.toLowerCase();
    const isFbHost =
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'fb.com' ||
      host.endsWith('.fb.com') ||
      host === 'fb.me';
    if (!isFbHost) {
      return {
        ok: false,
        error:
          'Vui lòng nhập liên kết tài khoản Facebook hợp lệ (VD: https://www.facebook.com/ten.tai.khoan).',
      };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return {
      ok: false,
      error:
        'Liên kết Facebook không đúng định dạng URL (VD: https://www.facebook.com/ten.tai.khoan).',
    };
  }
}

export function normalizeSafeAvatarUrl(
  raw: string,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: undefined };
  }
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return { ok: true, value: trimmed };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'Ảnh đại diện URL phải sử dụng http://, https:// hoặc tải ảnh từ máy.',
      };
    }
    return { ok: true, value: parsed.toString() };
  } catch {
    return {
      ok: false,
      error: 'Đường dẫn ảnh đại diện không hợp lệ.',
    };
  }
}

export async function changeAccountPassword(
  accountId: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthActionResult> {
  if (!currentPassword) {
    return { ok: false, error: 'Vui lòng nhập mật khẩu hiện tại để xác thực.' };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' };
  }
  const records = readRawRecordsSync();
  const idx = records.findIndex((r) => r.id === accountId);
  if (idx === -1) {
    return { ok: false, error: 'Không tìm thấy tài khoản.' };
  }

  const target = records[idx];
  const currentHash = await hashPassword(currentPassword, target.salt);
  if (currentHash !== target.passwordHash) {
    return { ok: false, error: 'Mật khẩu hiện tại không chính xác.' };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  const updatedRecord: StoredUserRecord = {
    ...target,
    salt: newSalt,
    passwordHash: newHash,
  };

  const nextRecords = [...records];
  nextRecords[idx] = updatedRecord;
  saveRawRecordsSync(nextRecords);
  const sanitized = sanitizeAccount(updatedRecord);
  appendSystemLog({
    category: 'auth',
    level: 'info',
    action: 'Đổi mật khẩu tài khoản',
    detail: `${sanitized.fullName} (${sanitized.email}) đã thay đổi mật khẩu đăng nhập.`,
    actorName: sanitized.fullName,
    actorRole: sanitized.role,
    actorId: sanitized.id,
    targetLabel: sanitized.email,
  });
  return { ok: true, user: sanitized };
}

export function updateStoredAccount(
  accountId: string,
  patch: {
    fullName?: string;
    role?: UserRole;
    studentSbd?: string;
    studentClass?: string;
    schoolName?: string;
    subject?: SubjectId;
    avatarUrl?: string;
    facebookUrl?: string;
    enrolledClassIds?: string[];
  },
  options?: { actorRole?: UserRole },
): AuthActionResult {
  const records = readRawRecordsSync();
  const idx = records.findIndex((r) => r.id === accountId);
  if (idx === -1) {
    return { ok: false, error: 'Không tìm thấy tài khoản cần cập nhật.' };
  }

  const current = records[idx];
  const nextName = (patch.fullName ?? current.fullName).trim();
  if (nextName.length < 2) {
    return { ok: false, error: 'Họ và tên phải có tối thiểu 2 ký tự.' };
  }

  const nextRole = patch.role ?? current.role;
  if (
    nextRole === 'admin' &&
    current.role !== 'admin' &&
    options?.actorRole !== 'admin'
  ) {
    return {
      ok: false,
      error: 'Chỉ Quản trị viên (Admin) mới có quyền nâng cấp tài khoản lên Admin.',
    };
  }

  let nextAvatarUrl = current.avatarUrl;
  if (patch.avatarUrl !== undefined) {
    const avatarCheck = normalizeSafeAvatarUrl(patch.avatarUrl);
    if (!avatarCheck.ok) {
      return { ok: false, error: avatarCheck.error };
    }
    nextAvatarUrl = avatarCheck.value;
  }

  let nextFacebookUrl = current.facebookUrl;
  if (patch.facebookUrl !== undefined) {
    const fbCheck = normalizeFacebookProfileUrl(patch.facebookUrl);
    if (!fbCheck.ok) {
      return { ok: false, error: fbCheck.error };
    }
    nextFacebookUrl = fbCheck.value;
  }

  const nextEnrolledClassIds =
    patch.enrolledClassIds !== undefined
      ? Array.from(new Set(patch.enrolledClassIds.filter(Boolean)))
      : current.enrolledClassIds;

  let nextId = current.id;
  if (!isValidRoleUserId(current.id, nextRole)) {
    const existingIds = new Set(records.map((r) => r.id));
    nextId = generateRoleUserId(nextRole, existingIds);
  }

  let nextSbd = current.studentSbd;
  let nextClass = current.studentClass;
  let nextSchool = current.schoolName;
  let nextSubject = current.subject;

  if (nextRole === 'student') {
    const candidateSbd = (patch.studentSbd ?? current.studentSbd ?? '').trim().toUpperCase();
    if (
      candidateSbd &&
      records.some(
        (r) => r.id !== accountId && r.studentSbd?.toUpperCase() === candidateSbd,
      )
    ) {
      return {
        ok: false,
        error: `Số báo danh "${candidateSbd}" đã được gán cho tài khoản khác.`,
      };
    }
    nextSbd = candidateSbd || generateAutoSbd(records);
    nextClass = (patch.studentClass ?? current.studentClass ?? '12A1').trim().toUpperCase();
    nextSchool = undefined;
    nextSubject = undefined;
  } else if (nextRole === 'teacher') {
    nextSchool = (patch.schoolName ?? current.schoolName ?? 'THPT Công lập').trim();
    nextSubject = patch.subject ?? current.subject ?? 'toan';
    nextSbd = undefined;
    nextClass = undefined;
  } else {
    nextSchool = (patch.schoolName ?? current.schoolName ?? 'Ban Quản trị NTPEXION').trim();
    nextSbd = undefined;
    nextClass = undefined;
    nextSubject = undefined;
  }

  const updated: StoredUserRecord = {
    ...current,
    id: nextId,
    fullName: nextName,
    role: nextRole,
    studentSbd: nextSbd,
    studentClass: nextClass,
    schoolName: nextSchool,
    subject: nextSubject,
    avatarUrl: nextAvatarUrl,
    facebookUrl: nextFacebookUrl,
    enrolledClassIds: nextEnrolledClassIds,
  };

  const nextRecords = [...records];
  nextRecords[idx] = updated;
  saveRawRecordsSync(nextRecords);
  if (nextId !== current.id) {
    remapAccountReferencesInStorage({ [current.id]: nextId });
  }
  const sanitized = sanitizeAccount(updated);

  const onlyEnrollmentChanged =
    patch.enrolledClassIds !== undefined &&
    patch.fullName === undefined &&
    patch.role === undefined &&
    patch.studentSbd === undefined &&
    patch.studentClass === undefined &&
    patch.schoolName === undefined &&
    patch.subject === undefined &&
    patch.avatarUrl === undefined &&
    patch.facebookUrl === undefined;

  if (!onlyEnrollmentChanged) {
    appendSystemLog({
      category: 'user',
      level: 'info',
      action: 'Cập nhật hồ sơ & phân quyền tài khoản',
      detail: `Cập nhật thông tin tài khoản ${sanitized.fullName} (${sanitized.email} · ${sanitized.role}).`,
      targetLabel: sanitized.email,
    });
  }

  return { ok: true, user: sanitized };
}

export function exportAccountsToCsv(accounts: UserAccount[]): void {
  const esc = (v: string | number | undefined) => {
    const str = String(v ?? '');
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = ['ID', 'Họ và tên', 'Email', 'Vai trò', 'SBD', 'Lớp', 'Đơn vị / Trường', 'Môn', 'Ngày tạo'];
  const rows = accounts.map((a) => [
    esc(a.id),
    esc(a.fullName),
    esc(a.email),
    esc(a.role === 'admin' ? 'Admin' : a.role === 'teacher' ? 'Giáo viên' : 'Học sinh'),
    esc(a.studentSbd ?? ''),
    esc(a.studentClass ?? ''),
    esc(a.schoolName ?? ''),
    esc(a.subject ?? ''),
    esc(a.createdAt),
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tai_khoan_kythi2025_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


