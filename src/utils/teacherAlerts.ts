import type { ExamActionType, TeacherAlert } from '../types/exam';
import { appendSystemLog } from './systemLogs';

const ALERTS_STORAGE_KEY = 'kythi2025_teacher_alerts_v1';
const ALERTS_BROADCAST_CHANNEL = 'kythi2025_proctoring_alerts_channel';
const ALERTS_IN_WINDOW_EVENT = 'kythi2025:teacher-alert-pushed';
const ALERTS_SYNC_EVENT = 'kythi2025:teacher-alerts-updated';
const MAX_STORED_ALERTS = 60;

export const SEED_TEACHER_ALERTS: TeacherAlert[] = [
  {
    id: 'seed_alert_1',
    timestamp: '2025-02-20T08:42:11Z',
    studentName: 'Lê Hoàng Nam',
    studentSbd: '0102483',
    studentClass: '12A2',
    examId: 'exam_toan_tn2025',
    examTitle: 'Đề tham khảo Tốt nghiệp THPT 2025 — Môn Toán',
    roomCode: 'TOAN2025',
    variantCode: '0103',
    actionType: 'violation',
    title: 'Chuyển tab trình duyệt',
    detail: 'Chuyển sang cửa sổ khác trong 4 giây khi đang làm bài thi',
    severity: 'critical',
    read: false,
  },
  {
    id: 'seed_alert_2',
    timestamp: '2025-02-21T14:18:05Z',
    studentName: 'Đỗ Đức Anh',
    studentSbd: '0102519',
    studentClass: '12A4',
    examId: 'exam_hoahoc_gk2',
    examTitle: 'Kiểm tra Giữa kỳ II — Hóa học 12',
    roomCode: 'HOAHOC25',
    variantCode: '0301',
    actionType: 'paused_exam',
    title: 'Rời tiêu điểm & tạm dừng phòng thi',
    detail: 'Cửa sổ phòng thi mất tiêu điểm thao tác và tạm dừng làm bài',
    severity: 'warning',
    read: true,
  },
];

export function readTeacherAlerts(): TeacherAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(SEED_TEACHER_ALERTS));
      return SEED_TEACHER_ALERTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TeacherAlert[]) : SEED_TEACHER_ALERTS;
  } catch {
    return SEED_TEACHER_ALERTS;
  }
}

export function writeTeacherAlerts(alerts: TeacherAlert[]): void {
  const capped = alerts.slice(0, MAX_STORED_ALERTS);
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // Ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent<TeacherAlert[]>(ALERTS_SYNC_EVENT, { detail: capped }));
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(ALERTS_BROADCAST_CHANNEL);
      bc.postMessage({ kind: 'sync', alerts: capped });
      bc.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export type PushTeacherAlertInput = {
  studentName: string;
  studentSbd: string;
  studentClass: string;
  examId: string;
  examTitle: string;
  roomCode: string;
  variantCode: string;
  actionType: ExamActionType;
  title: string;
  detail: string;
  severity: TeacherAlert['severity'];
  timestamp?: string;
};

export function pushTeacherAlert(input: PushTeacherAlertInput): TeacherAlert {
  const alert: TeacherAlert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: input.timestamp ?? new Date().toISOString(),
    studentName: input.studentName,
    studentSbd: input.studentSbd,
    studentClass: input.studentClass,
    examId: input.examId,
    examTitle: input.examTitle,
    roomCode: input.roomCode,
    variantCode: input.variantCode,
    actionType: input.actionType,
    title: input.title,
    detail: input.detail,
    severity: input.severity,
    read: false,
  };

  const current = readTeacherAlerts();
  const next = [alert, ...current].slice(0, MAX_STORED_ALERTS);
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota
  }

  window.dispatchEvent(new CustomEvent<TeacherAlert>(ALERTS_IN_WINDOW_EVENT, { detail: alert }));
  window.dispatchEvent(new CustomEvent<TeacherAlert[]>(ALERTS_SYNC_EVENT, { detail: next }));

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(ALERTS_BROADCAST_CHANNEL);
      bc.postMessage({ kind: 'new_alert', alert, alerts: next });
      bc.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }

  appendSystemLog({
    category: 'security',
    level:
      input.severity === 'critical'
        ? 'error'
        : input.severity === 'warning'
          ? 'warning'
          : 'info',
    action: input.title,
    detail: `${input.studentName} (${input.studentSbd} · ${input.studentClass}) — ${input.detail}`,
    actorName: input.studentName,
    actorRole: 'student',
    targetLabel: `Phòng ${input.roomCode} · Mã đề ${input.variantCode}`,
    timestamp: alert.timestamp,
  });

  return alert;
}

export function markTeacherAlertRead(id: string): TeacherAlert[] {
  const next = readTeacherAlerts().map((a) => (a.id === id ? { ...a, read: true } : a));
  writeTeacherAlerts(next);
  return next;
}

export function markAllTeacherAlertsRead(): TeacherAlert[] {
  const next = readTeacherAlerts().map((a) => ({ ...a, read: true }));
  writeTeacherAlerts(next);
  return next;
}

export function clearAllTeacherAlerts(): TeacherAlert[] {
  writeTeacherAlerts([]);
  return [];
}

export function resetSeedTeacherAlerts(): TeacherAlert[] {
  writeTeacherAlerts(SEED_TEACHER_ALERTS);
  return SEED_TEACHER_ALERTS;
}

export function subscribeTeacherAlerts(
  onNewAlert: (alert: TeacherAlert) => void,
  onListSync: (alerts: TeacherAlert[]) => void,
): () => void {
  const handleWindowNew = (e: Event) => {
    const custom = e as CustomEvent<TeacherAlert>;
    if (custom.detail) onNewAlert(custom.detail);
  };

  const handleWindowSync = (e: Event) => {
    const custom = e as CustomEvent<TeacherAlert[]>;
    if (Array.isArray(custom.detail)) onListSync(custom.detail);
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key !== ALERTS_STORAGE_KEY) return;
    const latest = readTeacherAlerts();
    onListSync(latest);
    if (latest[0] && !latest[0].read) {
      onNewAlert(latest[0]);
    }
  };

  window.addEventListener(ALERTS_IN_WINDOW_EVENT, handleWindowNew);
  window.addEventListener(ALERTS_SYNC_EVENT, handleWindowSync);
  window.addEventListener('storage', handleStorage);

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(ALERTS_BROADCAST_CHANNEL);
      bc.onmessage = (event: MessageEvent<{ kind?: string; alert?: TeacherAlert; alerts?: TeacherAlert[] }>) => {
        const payload = event.data;
        if (!payload) return;
        if (Array.isArray(payload.alerts)) {
          onListSync(payload.alerts);
        }
        if (payload.kind === 'new_alert' && payload.alert) {
          onNewAlert(payload.alert);
        }
      };
    }
  } catch {
    // Ignore BroadcastChannel unavailability
  }

  return () => {
    window.removeEventListener(ALERTS_IN_WINDOW_EVENT, handleWindowNew);
    window.removeEventListener(ALERTS_SYNC_EVENT, handleWindowSync);
    window.removeEventListener('storage', handleStorage);
    if (bc) {
      bc.close();
    }
  };
}
