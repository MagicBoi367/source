import { useEffect, useState } from 'react';
import type { SubjectMeta, UserRole } from '../types/exam';
import { DEFAULT_SUBJECT_METADATA, SUBJECT_METADATA } from './scoring2025';
import { appendSystemLog } from './systemLogs';

const CUSTOM_SUBJECTS_STORAGE_KEY = 'kythi2025_custom_subjects_v1';

export interface SuggestedSubjectPreset {
  name: string;
  shortName: string;
  defaultDuration: number;
  defaultPart1Count: number;
  defaultPart2Count: number;
  defaultPart3Count: number;
  defaultPart3Point: number;
}

export const SUGGESTED_SUBJECT_PRESETS: SuggestedSubjectPreset[] = [
  {
    name: 'Ngữ văn',
    shortName: 'Văn',
    defaultDuration: 120,
    defaultPart1Count: 12,
    defaultPart2Count: 2,
    defaultPart3Count: 4,
    defaultPart3Point: 0.5,
  },
  {
    name: 'Sinh học',
    shortName: 'Sinh',
    defaultDuration: 50,
    defaultPart1Count: 18,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Lịch sử',
    shortName: 'Sử',
    defaultDuration: 50,
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Địa lí',
    shortName: 'Địa',
    defaultDuration: 50,
    defaultPart1Count: 18,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultPart3Point: 0.25,
  },
  {
    name: 'GDKT & PL',
    shortName: 'GDKT',
    defaultDuration: 50,
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Công nghệ',
    shortName: 'CN',
    defaultDuration: 50,
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Tiếng Nhật',
    shortName: 'Nhật',
    defaultDuration: 50,
    defaultPart1Count: 40,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
];

export const SEARCHABLE_SUBJECT_CATALOG: SuggestedSubjectPreset[] = [
  {
    name: 'Toán học',
    shortName: 'Toán',
    defaultDuration: 90,
    defaultPart1Count: 12,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultPart3Point: 0.5,
  },
  {
    name: 'Ngữ văn',
    shortName: 'Văn',
    defaultDuration: 120,
    defaultPart1Count: 12,
    defaultPart2Count: 2,
    defaultPart3Count: 4,
    defaultPart3Point: 0.5,
  },
  {
    name: 'Vật lí',
    shortName: 'Lí',
    defaultDuration: 50,
    defaultPart1Count: 18,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Hóa học',
    shortName: 'Hóa',
    defaultDuration: 50,
    defaultPart1Count: 18,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Sinh học',
    shortName: 'Sinh',
    defaultDuration: 50,
    defaultPart1Count: 18,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Lịch sử',
    shortName: 'Sử',
    defaultDuration: 50,
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Địa lí',
    shortName: 'Địa',
    defaultDuration: 50,
    defaultPart1Count: 18,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultPart3Point: 0.25,
  },
  {
    name: 'GDKT & PL',
    shortName: 'GDKT',
    defaultDuration: 50,
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Tin học',
    shortName: 'Tin',
    defaultDuration: 50,
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Công nghệ',
    shortName: 'CN',
    defaultDuration: 50,
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Tiếng Anh',
    shortName: 'Anh',
    defaultDuration: 50,
    defaultPart1Count: 40,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Tiếng Nhật',
    shortName: 'Nhật',
    defaultDuration: 50,
    defaultPart1Count: 40,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Tiếng Hàn',
    shortName: 'Hàn',
    defaultDuration: 50,
    defaultPart1Count: 40,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Tiếng Trung',
    shortName: 'Trung',
    defaultDuration: 50,
    defaultPart1Count: 40,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Tiếng Pháp',
    shortName: 'Pháp',
    defaultDuration: 50,
    defaultPart1Count: 40,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Tiếng Đức',
    shortName: 'Đức',
    defaultDuration: 50,
    defaultPart1Count: 40,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Tiếng Nga',
    shortName: 'Nga',
    defaultDuration: 50,
    defaultPart1Count: 40,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Khoa học tự nhiên',
    shortName: 'KHTN',
    defaultDuration: 60,
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 4,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Lịch sử và Địa lí',
    shortName: 'LS&ĐL',
    defaultDuration: 60,
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Giáo dục công dân',
    shortName: 'GDCD',
    defaultDuration: 45,
    defaultPart1Count: 24,
    defaultPart2Count: 2,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Âm nhạc',
    shortName: 'Nhạc',
    defaultDuration: 45,
    defaultPart1Count: 20,
    defaultPart2Count: 2,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Mỹ thuật',
    shortName: 'Mỹ thuật',
    defaultDuration: 45,
    defaultPart1Count: 20,
    defaultPart2Count: 2,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Giáo dục thể chất',
    shortName: 'GDTC',
    defaultDuration: 45,
    defaultPart1Count: 20,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Giáo dục quốc phòng và an ninh',
    shortName: 'GDQPAN',
    defaultDuration: 45,
    defaultPart1Count: 24,
    defaultPart2Count: 2,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
  {
    name: 'Hoạt động trải nghiệm',
    shortName: 'HĐTN',
    defaultDuration: 45,
    defaultPart1Count: 16,
    defaultPart2Count: 2,
    defaultPart3Count: 0,
    defaultPart3Point: 0.25,
  },
];

export interface SubjectCandidate {
  id: string;
  name: string;
  shortName: string;
  defaultDuration: number;
  defaultPart1Count: number;
  defaultPart2Count: number;
  defaultPart3Count: number;
  defaultPart3Point: number;
  isRegistered: boolean;
  isCustom: boolean;
}

const listeners = new Set<() => void>();

function notifySubjectListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Ignore individual subscriber errors
    }
  }
}

export function normalizeSubjectSearch(raw: string): string {
  return raw
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildSubjectSlug(name: string): string {
  const base = normalizeSubjectSearch(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || `mon_${Date.now().toString(36)}`;
}

export function loadCustomSubjects(): SubjectMeta[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SUBJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SubjectMeta =>
          Boolean(
            item &&
              typeof item.id === 'string' &&
              typeof item.name === 'string' &&
              !DEFAULT_SUBJECT_METADATA[item.id],
          ),
      )
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        shortName: item.shortName?.trim() || item.name.trim().slice(0, 8),
        defaultPart1Count: Math.max(0, Math.min(60, Number(item.defaultPart1Count) || 0)),
        defaultPart2Count: Math.max(0, Math.min(20, Number(item.defaultPart2Count) || 0)),
        defaultPart3Count: Math.max(0, Math.min(20, Number(item.defaultPart3Count) || 0)),
        defaultDuration: Math.max(5, Math.min(240, Number(item.defaultDuration) || 50)),
        defaultPart3Point: Number(item.defaultPart3Point) > 0 ? Number(item.defaultPart3Point) : 0.25,
        isCustom: true,
      }));
  } catch {
    return [];
  }
}

function syncSubjectMetadataMap(customSubjects: SubjectMeta[]) {
  for (const key of Object.keys(SUBJECT_METADATA)) {
    if (!DEFAULT_SUBJECT_METADATA[key]) {
      delete SUBJECT_METADATA[key];
    }
  }
  for (const subj of customSubjects) {
    SUBJECT_METADATA[subj.id] = subj;
  }
}

function saveCustomSubjects(customSubjects: SubjectMeta[]) {
  try {
    localStorage.setItem(CUSTOM_SUBJECTS_STORAGE_KEY, JSON.stringify(customSubjects));
  } catch {
    // Ignore storage quota errors
  }
  syncSubjectMetadataMap(customSubjects);
  notifySubjectListeners();
}

export function listAllSubjects(): SubjectMeta[] {
  const custom = loadCustomSubjects();
  syncSubjectMetadataMap(custom);
  return [...Object.values(DEFAULT_SUBJECT_METADATA), ...custom];
}

export interface AddCustomSubjectInput {
  name: string;
  shortName?: string;
  defaultDuration?: number;
  defaultPart1Count?: number;
  defaultPart2Count?: number;
  defaultPart3Count?: number;
  defaultPart3Point?: number;
}

export interface SubjectMutationActor {
  name?: string;
  role?: UserRole | 'guest' | 'system';
  id?: string;
}

export function addCustomSubject(
  input: AddCustomSubjectInput,
  actor?: SubjectMutationActor,
): { ok: true; subject: SubjectMeta } | { ok: false; error: string } {
  const cleanName = input.name.trim();
  if (cleanName.length < 2) {
    return { ok: false, error: 'Tên môn học phải có ít nhất 2 ký tự.' };
  }

  const allExisting = listAllSubjects();
  const normalizedIncoming = normalizeSubjectSearch(cleanName);
  const duplicate = allExisting.find(
    (s) => normalizeSubjectSearch(s.name) === normalizedIncoming,
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Môn học "${duplicate.name}" đã tồn tại trong hệ thống.`,
    };
  }

  const baseSlug = buildSubjectSlug(cleanName);
  let candidateSlug = baseSlug;
  let suffix = 2;
  const existingIds = new Set(allExisting.map((s) => s.id));
  while (existingIds.has(candidateSlug)) {
    candidateSlug = `${baseSlug}_${suffix}`;
    suffix += 1;
  }

  const cleanShort =
    (input.shortName ?? '').trim() ||
    (cleanName.length <= 10 ? cleanName : cleanName.split(/\s+/).slice(-1)[0] || cleanName.slice(0, 6));

  const newSubject: SubjectMeta = {
    id: candidateSlug,
    name: cleanName,
    shortName: cleanShort,
    defaultDuration: Math.max(5, Math.min(240, Math.round(input.defaultDuration ?? 50))),
    defaultPart1Count: Math.max(0, Math.min(60, Math.round(input.defaultPart1Count ?? 24))),
    defaultPart2Count: Math.max(0, Math.min(20, Math.round(input.defaultPart2Count ?? 4))),
    defaultPart3Count: Math.max(0, Math.min(20, Math.round(input.defaultPart3Count ?? 4))),
    defaultPart3Point:
      input.defaultPart3Point && input.defaultPart3Point > 0
        ? Math.round(input.defaultPart3Point * 100) / 100
        : 0.25,
    isCustom: true,
  };

  const currentCustom = loadCustomSubjects();
  saveCustomSubjects([...currentCustom, newSubject]);

  appendSystemLog({
    category: 'system',
    level: 'info',
    action: 'Thêm môn học mới',
    detail: `Đã thêm môn "${newSubject.name}" (${newSubject.shortName}) · ${newSubject.defaultDuration} phút (${newSubject.defaultPart1Count}P1 / ${newSubject.defaultPart2Count}P2 / ${newSubject.defaultPart3Count}P3).`,
    actorName: actor?.name ?? 'Người dùng hệ thống',
    actorRole: actor?.role ?? 'teacher',
    actorId: actor?.id,
    targetLabel: newSubject.name,
  });

  return { ok: true, subject: newSubject };
}

export function deleteCustomSubject(
  subjectId: string,
  actor?: SubjectMutationActor,
): { ok: true } | { ok: false; error: string } {
  if (DEFAULT_SUBJECT_METADATA[subjectId]) {
    return { ok: false, error: 'Không thể xóa 5 môn học mặc định của hệ thống.' };
  }
  const currentCustom = loadCustomSubjects();
  const target = currentCustom.find((s) => s.id === subjectId);
  if (!target) {
    return { ok: false, error: 'Không tìm thấy môn học tùy chỉnh cần xóa.' };
  }

  saveCustomSubjects(currentCustom.filter((s) => s.id !== subjectId));

  appendSystemLog({
    category: 'system',
    level: 'warning',
    action: 'Xóa môn học tùy chỉnh',
    detail: `Đã xóa môn học "${target.name}" (${target.id}) khỏi danh sách môn học.`,
    actorName: actor?.name ?? 'Quản trị viên',
    actorRole: actor?.role ?? 'admin',
    actorId: actor?.id,
    targetLabel: target.name,
  });

  return { ok: true };
}

export function clearCustomSubjects() {
  saveCustomSubjects([]);
}

export function searchSubjectCandidates(query: string): SubjectCandidate[] {
  const normQuery = normalizeSubjectSearch(query);
  if (!normQuery) return [];

  const registered = listAllSubjects();
  const seenNormNames = new Set<string>();
  const matches: SubjectCandidate[] = [];

  for (const subj of registered) {
    const normName = normalizeSubjectSearch(subj.name);
    const normShort = normalizeSubjectSearch(subj.shortName);
    const normId = normalizeSubjectSearch(subj.id);
    if (
      normName.includes(normQuery) ||
      normShort.includes(normQuery) ||
      normId.includes(normQuery)
    ) {
      seenNormNames.add(normName);
      matches.push({
        id: subj.id,
        name: subj.name,
        shortName: subj.shortName,
        defaultDuration: subj.defaultDuration,
        defaultPart1Count: subj.defaultPart1Count,
        defaultPart2Count: subj.defaultPart2Count,
        defaultPart3Count: subj.defaultPart3Count,
        defaultPart3Point: subj.defaultPart3Point,
        isRegistered: true,
        isCustom: Boolean(subj.isCustom),
      });
    }
  }

  for (const preset of SEARCHABLE_SUBJECT_CATALOG) {
    const normName = normalizeSubjectSearch(preset.name);
    if (seenNormNames.has(normName)) continue;
    const normShort = normalizeSubjectSearch(preset.shortName);
    if (normName.includes(normQuery) || normShort.includes(normQuery)) {
      seenNormNames.add(normName);
      matches.push({
        id: buildSubjectSlug(preset.name),
        name: preset.name,
        shortName: preset.shortName,
        defaultDuration: preset.defaultDuration,
        defaultPart1Count: preset.defaultPart1Count,
        defaultPart2Count: preset.defaultPart2Count,
        defaultPart3Count: preset.defaultPart3Count,
        defaultPart3Point: preset.defaultPart3Point,
        isRegistered: false,
        isCustom: true,
      });
    }
  }

  return matches.sort((a, b) => {
    const aNorm = normalizeSubjectSearch(a.name);
    const bNorm = normalizeSubjectSearch(b.name);
    const aStarts = aNorm.startsWith(normQuery) ? 0 : 1;
    const bStarts = bNorm.startsWith(normQuery) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    if (a.isRegistered !== b.isRegistered) return a.isRegistered ? -1 : 1;
    return a.name.localeCompare(b.name, 'vi');
  });
}

export function ensureCatalogSubjectRegistered(
  candidate: SubjectCandidate,
  actor?: SubjectMutationActor,
): SubjectMeta {
  const existing = listAllSubjects().find(
    (s) =>
      s.id === candidate.id ||
      normalizeSubjectSearch(s.name) === normalizeSubjectSearch(candidate.name),
  );
  if (existing) return existing;

  const res = addCustomSubject(
    {
      name: candidate.name,
      shortName: candidate.shortName,
      defaultDuration: candidate.defaultDuration,
      defaultPart1Count: candidate.defaultPart1Count,
      defaultPart2Count: candidate.defaultPart2Count,
      defaultPart3Count: candidate.defaultPart3Count,
      defaultPart3Point: candidate.defaultPart3Point,
    },
    actor,
  );
  if (res.ok) return res.subject;

  return {
    id: candidate.id,
    name: candidate.name,
    shortName: candidate.shortName,
    defaultDuration: candidate.defaultDuration,
    defaultPart1Count: candidate.defaultPart1Count,
    defaultPart2Count: candidate.defaultPart2Count,
    defaultPart3Count: candidate.defaultPart3Count,
    defaultPart3Point: candidate.defaultPart3Point,
    isCustom: true,
  };
}

export function subscribeSubjects(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSubjects(): SubjectMeta[] {
  const [subjects, setSubjects] = useState<SubjectMeta[]>(() => listAllSubjects());

  useEffect(() => {
    setSubjects(listAllSubjects());
    return subscribeSubjects(() => {
      setSubjects(listAllSubjects());
    });
  }, []);

  return subjects;
}
