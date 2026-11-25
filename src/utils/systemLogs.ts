import type {
  SystemLogCategory,
  SystemLogEntry,
  SystemLogLevel,
  UserRole,
} from '../types/exam';

const SYSTEM_LOGS_STORAGE_KEY = 'kythi2025_system_logs_v1';
const SYSTEM_LOGS_SYNC_EVENT = 'kythi2025:system-logs-updated';
const SYSTEM_LOGS_BROADCAST_CHANNEL = 'kythi2025_system_logs_channel';
const MAX_SYSTEM_LOGS = 500;

export const LOG_CATEGORY_LABELS: Record<SystemLogCategory, string> = {
  auth: 'Xác thực & Phiên',
  exam: 'Đề thi & Nộp bài',
  question: 'Ngân hàng câu hỏi',
  class: 'Lớp học & Tài liệu',
  user: 'Tài khoản người dùng',
  security: 'Giám sát phòng thi',
  system: 'Hệ thống & Cấu hình',
};

export const LOG_LEVEL_LABELS: Record<SystemLogLevel, string> = {
  info: 'Thông tin',
  warning: 'Cảnh báo',
  error: 'Lỗi / Vi phạm',
};

export const SEED_SYSTEM_LOGS: SystemLogEntry[] = [
  {
    id: 'syslog_seed_6',
    timestamp: '2025-05-12T08:15:00.000Z',
    category: 'security',
    level: 'error',
    action: 'Phát hiện chuyển tab phòng thi',
    detail: 'Thí sinh Lê Hoàng Nam (0102483) rời thẻ trình duyệt 4 giây khi làm đề TOAN2025.',
    actorName: 'Lê Hoàng Nam',
    actorRole: 'student',
    targetLabel: 'Phòng TOAN2025 · Mã đề 0103',
  },
  {
    id: 'syslog_seed_5',
    timestamp: '2025-05-11T14:20:00.000Z',
    category: 'exam',
    level: 'info',
    action: 'Nộp bài thi trực tuyến',
    detail: 'Thí sinh Nguyễn Minh Anh (0102588) hoàn thành đề Toán 2025 và lưu phiếu điểm.',
    actorName: 'Nguyễn Minh Anh',
    actorRole: 'student',
    actorId: 'HV0001',
    targetLabel: 'TOAN2025',
  },
  {
    id: 'syslog_seed_4',
    timestamp: '2025-05-10T09:30:00.000Z',
    category: 'class',
    level: 'info',
    action: 'Khởi tạo lớp học & lịch học tuần',
    detail: 'Khởi tạo các lớp học mẫu (12A1-TOAN, 12A1-HSG, 12A1-VATLI) cùng tài liệu và bài tập.',
    actorName: 'ThS. Trần Quốc Bảo',
    actorRole: 'teacher',
    actorId: 'GV0001',
    targetLabel: '12A1-TOAN',
  },
  {
    id: 'syslog_seed_3',
    timestamp: '2025-05-05T08:10:00.000Z',
    category: 'question',
    level: 'info',
    action: 'Nạp ngân hàng câu hỏi chuẩn 2025',
    detail: 'Đồng bộ bộ câu hỏi 3 dạng thức (Trắc nghiệm, Đúng/Sai, Trả lời ngắn) cho 5 môn thi.',
    actorName: 'Quản trị viên Hệ thống',
    actorRole: 'admin',
    actorId: 'AD0001',
    targetLabel: 'Ngân hàng câu hỏi',
  },
  {
    id: 'syslog_seed_2',
    timestamp: '2025-05-01T08:05:00.000Z',
    category: 'auth',
    level: 'info',
    action: 'Khởi tạo danh sách tài khoản gốc',
    detail: 'Khởi tạo tài khoản Quản trị viên, Giáo viên và Học sinh mẫu trong kho cục bộ.',
    actorName: 'Hệ thống NTPEXION',
    actorRole: 'system',
    targetLabel: 'authStore',
  },
  {
    id: 'syslog_seed_1',
    timestamp: '2025-05-01T08:00:00.000Z',
    category: 'system',
    level: 'info',
    action: 'Khởi chạy hệ thống NTPEXION',
    detail: 'Cổng thi trực tuyến theo Thông tư 2025 sẵn sàng hoạt động.',
    actorName: 'Hệ thống NTPEXION',
    actorRole: 'system',
    targetLabel: 'System Core',
  },
];

interface MinimalSessionAccount {
  id: string;
  fullName: string;
  role: UserRole;
}

function resolveCurrentActorFromStorage(): {
  actorName: string;
  actorRole: UserRole | 'guest' | 'system';
  actorId?: string;
} {
  try {
    const activeId = localStorage.getItem('kythi2025_active_session_v1');
    if (activeId) {
      const rawAccounts = localStorage.getItem('kythi2025_accounts_v1');
      if (rawAccounts) {
        const parsed = JSON.parse(rawAccounts) as MinimalSessionAccount[];
        if (Array.isArray(parsed)) {
          const found = parsed.find((a) => a.id === activeId);
          if (found) {
            return {
              actorName: found.fullName,
              actorRole: found.role,
              actorId: found.id,
            };
          }
        }
      }
    }
    const rawRole = localStorage.getItem('kythi2025_role_v1');
    if (rawRole) {
      const parsedRole = JSON.parse(rawRole) as UserRole;
      if (parsedRole === 'admin') {
        return { actorName: 'Quản trị viên (Chế độ xem)', actorRole: 'admin' };
      }
      if (parsedRole === 'teacher') {
        return { actorName: 'Giáo viên (Chế độ xem)', actorRole: 'teacher' };
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return { actorName: 'Khách / Người dùng', actorRole: 'guest' };
}

export function readSystemLogs(): SystemLogEntry[] {
  try {
    const raw = localStorage.getItem(SYSTEM_LOGS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(SYSTEM_LOGS_STORAGE_KEY, JSON.stringify(SEED_SYSTEM_LOGS));
      return SEED_SYSTEM_LOGS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SystemLogEntry[]) : SEED_SYSTEM_LOGS;
  } catch {
    return SEED_SYSTEM_LOGS;
  }
}

function writeSystemLogs(logs: SystemLogEntry[]): void {
  const capped = logs.slice(0, MAX_SYSTEM_LOGS);
  try {
    localStorage.setItem(SYSTEM_LOGS_STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Ignore storage quota errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<SystemLogEntry[]>(SYSTEM_LOGS_SYNC_EVENT, { detail: capped }),
    );
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(SYSTEM_LOGS_BROADCAST_CHANNEL);
        bc.postMessage({ logs: capped });
        bc.close();
      }
    } catch {
      // Ignore BroadcastChannel unavailability
    }
  }
}

export interface AppendSystemLogInput {
  category: SystemLogCategory;
  level?: SystemLogLevel;
  action: string;
  detail: string;
  actorName?: string;
  actorRole?: UserRole | 'guest' | 'system';
  actorId?: string;
  targetLabel?: string;
  timestamp?: string;
}

export function appendSystemLog(input: AppendSystemLogInput): SystemLogEntry {
  const fallbackActor =
    input.actorName && input.actorRole ? null : resolveCurrentActorFromStorage();

  const entry: SystemLogEntry = {
    id: `syslog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: input.timestamp ?? new Date().toISOString(),
    category: input.category,
    level: input.level ?? 'info',
    action: input.action,
    detail: input.detail,
    actorName: input.actorName ?? fallbackActor?.actorName ?? 'Hệ thống',
    actorRole: input.actorRole ?? fallbackActor?.actorRole ?? 'system',
    actorId: input.actorId ?? fallbackActor?.actorId,
    targetLabel: input.targetLabel,
  };

  const current = readSystemLogs();
  const next = [entry, ...current].slice(0, MAX_SYSTEM_LOGS);
  writeSystemLogs(next);
  return entry;
}

export function clearSystemLogs(): SystemLogEntry[] {
  const clearedBy = resolveCurrentActorFromStorage();
  const auditEntry: SystemLogEntry = {
    id: `syslog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    category: 'system',
    level: 'warning',
    action: 'Xóa nhật ký hệ thống cũ',
    detail: 'Quản trị viên đã dọn dẹp danh sách nhật ký sự kiện hệ thống.',
    actorName: clearedBy.actorName,
    actorRole: clearedBy.actorRole,
    actorId: clearedBy.actorId,
    targetLabel: 'System Logs',
  };
  const next = [auditEntry];
  writeSystemLogs(next);
  return next;
}

export function resetSeedSystemLogs(): SystemLogEntry[] {
  writeSystemLogs(SEED_SYSTEM_LOGS);
  return SEED_SYSTEM_LOGS;
}

export function subscribeSystemLogs(onSync: (logs: SystemLogEntry[]) => void): () => void {
  const handleWindowSync = (e: Event) => {
    const custom = e as CustomEvent<SystemLogEntry[]>;
    if (Array.isArray(custom.detail)) onSync(custom.detail);
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key !== SYSTEM_LOGS_STORAGE_KEY) return;
    onSync(readSystemLogs());
  };

  window.addEventListener(SYSTEM_LOGS_SYNC_EVENT, handleWindowSync);
  window.addEventListener('storage', handleStorage);

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(SYSTEM_LOGS_BROADCAST_CHANNEL);
      bc.onmessage = (event: MessageEvent<{ logs?: SystemLogEntry[] }>) => {
        if (Array.isArray(event.data?.logs)) {
          onSync(event.data.logs);
        }
      };
    }
  } catch {
    // Ignore BroadcastChannel unavailability
  }

  return () => {
    window.removeEventListener(SYSTEM_LOGS_SYNC_EVENT, handleWindowSync);
    window.removeEventListener('storage', handleStorage);
    if (bc) {
      bc.close();
    }
  };
}

export function exportSystemLogsCsv(logs: SystemLogEntry[]): void {
  const esc = (v: string | number | undefined) => {
    const str = String(v ?? '');
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = [
    'ID',
    'Thời gian',
    'Mức độ',
    'Phân khu',
    'Người thực hiện',
    'Vai trò',
    'Hành động',
    'Đối tượng',
    'Chi tiết',
  ];
  const rows = logs.map((l) => [
    esc(l.id),
    esc(new Date(l.timestamp).toLocaleString('vi-VN')),
    esc(LOG_LEVEL_LABELS[l.level]),
    esc(LOG_CATEGORY_LABELS[l.category]),
    esc(l.actorName),
    esc(l.actorRole),
    esc(l.action),
    esc(l.targetLabel ?? ''),
    esc(l.detail),
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `system_logs_kythi2025_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSystemLogsJson(logs: SystemLogEntry[]): void {
  const blob = new Blob([JSON.stringify(logs, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `system_logs_kythi2025_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
