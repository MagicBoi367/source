import { useCallback, useEffect, useMemo, useState } from 'react';
import { SEED_EXAMS, SEED_QUESTIONS, SEED_SUBMISSIONS } from '../data/seedData';
import {
  derivePrivateClassCode,
  SEED_CLASS_ASSIGNMENTS,
  SEED_CLASS_JOIN_REQUESTS,
  SEED_CLASS_MATERIALS,
  SEED_CLASS_SCHEDULES,
  SEED_TEACHER_CLASSES,
} from '../data/studentPortalData';
import type {
  ClassAssignment,
  ClassJoinRequest,
  ClassMaterial,
  ClassScheduleSlot,
  Exam,
  ExamSubmission,
  Question,
  SystemConfig,
  TeacherPrivateClass,
  UserRole,
} from '../types/exam';
import {
  listAccountsSync,
  migrateStoredAccountIdsSync,
  updateStoredAccount,
} from '../utils/authStore';
import { formatGradeLabel, MAX_CLASSES_PER_TEACHER } from '../utils/scoring2025';
import { appendSystemLog } from '../utils/systemLogs';

const STORAGE_KEYS = {
  questions: 'kythi2025_questions_v1',
  exams: 'kythi2025_exams_v1',
  submissions: 'kythi2025_submissions_v1',
  privateClasses: 'kythi2025_private_classes_v1',
  classJoinRequests: 'kythi2025_class_join_requests_v1',
  classMaterials: 'kythi2025_class_materials_v1',
  classAssignments: 'kythi2025_class_assignments_v1',
  classSchedules: 'kythi2025_class_schedules_v1',
  role: 'kythi2025_role_v1',
  systemConfig: 'kythi2025_system_config_v1',
  gradeSeedMigrated: 'kythi2025_grade_seeds_v1',
  classHubSeedMigrated: 'kythi2025_class_hub_seed_v1',
  questionsOwnershipMigrated: 'kythi2025_questions_ownership_v2',
  examsOwnershipMigrated: 'kythi2025_exams_ownership_v2',
} as const;

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  allowSelfRegistration: true,
  allowGuestPreview: true,
  announcementEnabled: false,
  announcementText:
    'Kỳ thi thử Tốt nghiệp THPT 2025 đang mở phòng thi trực tuyến. Thí sinh vui lòng kiểm tra SBD trước khi vào phòng.',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeExam(exam: Exam): Exam {
  const effectiveDuration = Math.max(1, exam.duration ?? exam.durationMinutes ?? 45);
  return {
    ...exam,
    duration: effectiveDuration,
    durationMinutes: effectiveDuration,
    autoSubmitOnTimeout: exam.autoSubmitOnTimeout ?? true,
    warningMinutes: exam.warningMinutes ?? 5,
  };
}

function loadInitialQuestions(): Question[] {
  migrateStoredAccountIdsSync();
  let next = readStorage<Question[]>(STORAGE_KEYS.questions, SEED_QUESTIONS);
  try {
    if (!localStorage.getItem(STORAGE_KEYS.gradeSeedMigrated)) {
      const existingIds = new Set(next.map((q) => q.id));
      const missing = SEED_QUESTIONS.filter((q) => !existingIds.has(q.id));
      if (missing.length > 0) next = [...next, ...missing];
    }
    if (!localStorage.getItem(STORAGE_KEYS.questionsOwnershipMigrated)) {
      const seedQMap = new Map(SEED_QUESTIONS.map((q) => [q.id, q]));
      next = next.map((q) => {
        const seedMatch = seedQMap.get(q.id);
        return {
          ...q,
          isPrivate: q.isPrivate ?? seedMatch?.isPrivate ?? true,
          ownerTeacherId:
            q.ownerTeacherId ??
            seedMatch?.ownerTeacherId ??
            (q.subject === 'vat_li' ? 'GV0003' : 'GV0001'),
          ownerTeacherName:
            q.ownerTeacherName ??
            seedMatch?.ownerTeacherName ??
            (q.subject === 'vat_li' ? 'Cô Lê Thu Hà' : 'ThS. Trần Quốc Bảo'),
        };
      });
      localStorage.setItem(STORAGE_KEYS.questionsOwnershipMigrated, 'true');
    }
  } catch {
    // Ignore storage flag read/write errors
  }
  return next;
}

function loadInitialExams(): Exam[] {
  migrateStoredAccountIdsSync();
  const stored = readStorage<Exam[]>(STORAGE_KEYS.exams, SEED_EXAMS).map(normalizeExam);
  let next = stored;
  try {
    if (!localStorage.getItem(STORAGE_KEYS.gradeSeedMigrated)) {
      const existingIds = new Set(next.map((e) => e.id));
      const missing = SEED_EXAMS.filter((e) => !existingIds.has(e.id)).map(normalizeExam);
      localStorage.setItem(STORAGE_KEYS.gradeSeedMigrated, 'true');
      if (missing.length > 0) next = [...next, ...missing];
    }
    if (!localStorage.getItem(STORAGE_KEYS.classHubSeedMigrated)) {
      next = next.map((ex) => {
        if (ex.id === 'exam_toan_2025' && !ex.privateClassId && !ex.isPrivate) {
          return {
            ...ex,
            privateClassId: 'pclass_seed_toan12',
            ownerTeacherId: ex.ownerTeacherId ?? 'GV0001',
            ownerTeacherName: ex.ownerTeacherName ?? 'ThS. Trần Quốc Bảo',
          };
        }
        if (ex.id === 'exam_vatli_2025' && !ex.privateClassId && !ex.isPrivate) {
          return {
            ...ex,
            privateClassId: 'pclass_seed_vatli12',
            ownerTeacherId: ex.ownerTeacherId ?? 'GV0003',
            ownerTeacherName: ex.ownerTeacherName ?? 'Cô Lê Thu Hà',
          };
        }
        return ex;
      });
    }
    if (!localStorage.getItem(STORAGE_KEYS.examsOwnershipMigrated)) {
      const seedExMap = new Map(SEED_EXAMS.map((e) => [e.id, e]));
      next = next.map((ex) => {
        const seedMatch = seedExMap.get(ex.id);
        return {
          ...ex,
          ownerTeacherId:
            ex.ownerTeacherId ??
            seedMatch?.ownerTeacherId ??
            (ex.subject === 'vat_li' ? 'GV0003' : 'GV0001'),
          ownerTeacherName:
            ex.ownerTeacherName ??
            seedMatch?.ownerTeacherName ??
            (ex.subject === 'vat_li' ? 'Cô Lê Thu Hà' : 'ThS. Trần Quốc Bảo'),
        };
      });
      localStorage.setItem(STORAGE_KEYS.examsOwnershipMigrated, 'true');
    }
  } catch {
    // Ignore storage flag write errors
  }
  return next;
}

function loadInitialPrivateClasses(): TeacherPrivateClass[] {
  const stored = readStorage<TeacherPrivateClass[]>(
    STORAGE_KEYS.privateClasses,
    SEED_TEACHER_CLASSES,
  );
  try {
    if (!localStorage.getItem(STORAGE_KEYS.classHubSeedMigrated)) {
      const existingIds = new Set(stored.map((c) => c.id));
      const missing = SEED_TEACHER_CLASSES.filter((c) => !existingIds.has(c.id));
      localStorage.setItem(STORAGE_KEYS.classHubSeedMigrated, 'true');
      return missing.length > 0 ? [...stored, ...missing] : stored;
    }
  } catch {
    // Ignore storage errors
  }
  return stored;
}

export function useExamStore() {
  const [questions, setQuestions] = useState<Question[]>(() => loadInitialQuestions());
  const [exams, setExams] = useState<Exam[]>(() => loadInitialExams());
  const [submissions, setSubmissions] = useState<ExamSubmission[]>(() =>
    readStorage(STORAGE_KEYS.submissions, SEED_SUBMISSIONS),
  );
  const [privateClasses, setPrivateClasses] = useState<TeacherPrivateClass[]>(() =>
    loadInitialPrivateClasses(),
  );
  const [classJoinRequests, setClassJoinRequests] = useState<ClassJoinRequest[]>(() =>
    readStorage<ClassJoinRequest[]>(STORAGE_KEYS.classJoinRequests, SEED_CLASS_JOIN_REQUESTS),
  );
  const [classMaterials, setClassMaterials] = useState<ClassMaterial[]>(() =>
    readStorage<ClassMaterial[]>(STORAGE_KEYS.classMaterials, SEED_CLASS_MATERIALS),
  );
  const [classAssignments, setClassAssignments] = useState<ClassAssignment[]>(() =>
    readStorage<ClassAssignment[]>(STORAGE_KEYS.classAssignments, SEED_CLASS_ASSIGNMENTS),
  );
  const [classSchedules, setClassSchedules] = useState<ClassScheduleSlot[]>(() =>
    readStorage<ClassScheduleSlot[]>(STORAGE_KEYS.classSchedules, SEED_CLASS_SCHEDULES),
  );
  const [role, setRole] = useState<UserRole>(() =>
    readStorage<UserRole>(STORAGE_KEYS.role, 'student'),
  );
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => ({
    ...DEFAULT_SYSTEM_CONFIG,
    ...readStorage<Partial<SystemConfig>>(STORAGE_KEYS.systemConfig, {}),
  }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.questions, JSON.stringify(questions));
    } catch {
      // Ignore storage quota errors
    }
  }, [questions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.exams, JSON.stringify(exams));
    } catch {
      // Ignore storage quota errors
    }
  }, [exams]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(submissions));
    } catch {
      // Ignore storage quota errors
    }
  }, [submissions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.role, JSON.stringify(role));
    } catch {
      // Ignore storage quota errors
    }
  }, [role]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.systemConfig, JSON.stringify(systemConfig));
    } catch {
      // Ignore storage quota errors
    }
  }, [systemConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.privateClasses, JSON.stringify(privateClasses));
    } catch {
      // Ignore storage quota errors
    }
  }, [privateClasses]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.classJoinRequests,
        JSON.stringify(classJoinRequests),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [classJoinRequests]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.classMaterials, JSON.stringify(classMaterials));
    } catch {
      // Ignore storage quota errors
    }
  }, [classMaterials]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.classAssignments, JSON.stringify(classAssignments));
    } catch {
      // Ignore storage quota errors
    }
  }, [classAssignments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.classSchedules, JSON.stringify(classSchedules));
    } catch {
      // Ignore storage quota errors
    }
  }, [classSchedules]);

  const questionMap = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );

  const addQuestion = useCallback((q: Question) => {
    setQuestions((prev) => [q, ...prev]);
    appendSystemLog({
      category: 'question',
      level: 'info',
      action: 'Thêm câu hỏi mới',
      detail: `Thêm câu hỏi ${q.type} (${formatGradeLabel(q.grade)} · Môn ${q.subject}) vào ngân hàng.`,
      targetLabel: q.topic || q.id,
    });
  }, []);

  const updateQuestion = useCallback((updated: Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    appendSystemLog({
      category: 'question',
      level: 'info',
      action: 'Cập nhật câu hỏi',
      detail: `Chỉnh sửa câu hỏi ${updated.id} (${formatGradeLabel(updated.grade)} · Môn ${updated.subject}).`,
      targetLabel: updated.topic || updated.id,
    });
  }, []);

  const deleteQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setExams((prev) =>
      prev.map((ex) => ({
        ...ex,
        part1QuestionIds: ex.part1QuestionIds.filter((qid) => qid !== id),
        part2QuestionIds: ex.part2QuestionIds.filter((qid) => qid !== id),
        part3QuestionIds: ex.part3QuestionIds.filter((qid) => qid !== id),
      })),
    );
    appendSystemLog({
      category: 'question',
      level: 'warning',
      action: 'Xóa câu hỏi',
      detail: `Đã xóa câu hỏi ${id} khỏi ngân hàng câu hỏi.`,
      targetLabel: id,
    });
  }, []);

  const deleteAllQuestions = useCallback((questionIdsToDelete?: string[]) => {
    if (!questionIdsToDelete) {
      setQuestions([]);
      setExams((prev) =>
        prev.map((ex) => ({
          ...ex,
          part1QuestionIds: [],
          part2QuestionIds: [],
          part3QuestionIds: [],
        })),
      );
      appendSystemLog({
        category: 'question',
        level: 'warning',
        action: 'Xóa toàn bộ ngân hàng câu hỏi',
        detail: 'Đã xóa toàn bộ câu hỏi trong ngân hàng và gỡ liên kết khỏi các đề thi.',
        targetLabel: 'Question Bank',
      });
      return;
    }
    const removeSet = new Set(questionIdsToDelete);
    setQuestions((prev) => prev.filter((q) => !removeSet.has(q.id)));
    setExams((prev) =>
      prev.map((ex) => ({
        ...ex,
        part1QuestionIds: ex.part1QuestionIds.filter((qid) => !removeSet.has(qid)),
        part2QuestionIds: ex.part2QuestionIds.filter((qid) => !removeSet.has(qid)),
        part3QuestionIds: ex.part3QuestionIds.filter((qid) => !removeSet.has(qid)),
      })),
    );
    appendSystemLog({
      category: 'question',
      level: 'warning',
      action: 'Xóa hàng loạt câu hỏi',
      detail: `Đã xóa ${questionIdsToDelete.length} câu hỏi khỏi ngân hàng.`,
      targetLabel: `${questionIdsToDelete.length} câu hỏi`,
    });
  }, []);

  const importQuestions = useCallback((incoming: Question[]) => {
    setQuestions((prev) => {
      const existingIds = new Set(prev.map((q) => q.id));
      const fresh = incoming.filter((q) => !existingIds.has(q.id));
      return [...fresh, ...prev];
    });
    appendSystemLog({
      category: 'question',
      level: 'info',
      action: 'Nhập câu hỏi từ file',
      detail: `Đã nhập ${incoming.length} câu hỏi vào Ngân hàng câu hỏi.`,
      targetLabel: `${incoming.length} câu hỏi`,
    });
  }, []);

  const addExam = useCallback((exam: Exam) => {
    setExams((prev) => [exam, ...prev]);
    appendSystemLog({
      category: 'exam',
      level: 'info',
      action: 'Tạo đề thi mới',
      detail: `Tạo đề "${exam.title}" (Mã phòng ${exam.roomCode} · ${formatGradeLabel(exam.grade)}).`,
      targetLabel: exam.roomCode,
    });
  }, []);

  const updateExam = useCallback((updated: Exam) => {
    setExams((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    appendSystemLog({
      category: 'exam',
      level: 'info',
      action: 'Cập nhật đề thi / trạng thái phòng thi',
      detail: `Cập nhật đề "${updated.title}" (Mã phòng ${updated.roomCode} · Trạng thái: ${updated.status}).`,
      targetLabel: updated.roomCode,
    });
  }, []);

  const deleteExam = useCallback((id: string) => {
    setExams((prev) => prev.filter((e) => e.id !== id));
    appendSystemLog({
      category: 'exam',
      level: 'warning',
      action: 'Xóa đề thi',
      detail: `Đã xóa đề thi ${id} khỏi hệ thống.`,
      targetLabel: id,
    });
  }, []);

  const deleteAllExams = useCallback((examIdsToDelete?: string[]) => {
    if (!examIdsToDelete) {
      setExams([]);
      appendSystemLog({
        category: 'exam',
        level: 'warning',
        action: 'Xóa toàn bộ đề thi',
        detail: 'Đã xóa toàn bộ danh sách đề thi trong hệ thống.',
        targetLabel: 'All Exams',
      });
      return;
    }
    const removeSet = new Set(examIdsToDelete);
    setExams((prev) => prev.filter((e) => !removeSet.has(e.id)));
    appendSystemLog({
      category: 'exam',
      level: 'warning',
      action: 'Xóa hàng loạt đề thi',
      detail: `Đã xóa ${examIdsToDelete.length} đề thi khỏi danh sách quản trị.`,
      targetLabel: `${examIdsToDelete.length} đề thi`,
    });
  }, []);

  const addSubmission = useCallback((sub: ExamSubmission) => {
    setSubmissions((prev) => [sub, ...prev]);
    appendSystemLog({
      category: 'exam',
      level: 'info',
      action: 'Nộp bài thi trực tuyến',
      detail: `${sub.studentName} (${sub.studentSbd} · ${sub.studentClass}) nộp đề "${sub.examTitle}" — Điểm: ${sub.totalScore.toFixed(2)}.`,
      actorName: sub.studentName,
      actorRole: 'student',
      actorId: sub.submittedByUserId,
      targetLabel: `${sub.roomCode} · Mã đề ${sub.variantCode}`,
    });
  }, []);

  const deleteSubmission = useCallback((id: string) => {
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    appendSystemLog({
      category: 'exam',
      level: 'warning',
      action: 'Xóa lịch sử bài nộp',
      detail: `Quản trị viên đã xóa bản ghi bài nộp ${id}.`,
      targetLabel: id,
    });
  }, []);

  const addPrivateClass = useCallback(
    (cls: TeacherPrivateClass): { ok: boolean; error?: string } => {
      const ownerId = cls.ownerTeacherId?.trim();
      const existingOwnedCount = ownerId
        ? privateClasses.filter((c) => c.ownerTeacherId === ownerId).length
        : 0;
      if (ownerId && existingOwnedCount >= MAX_CLASSES_PER_TEACHER) {
        appendSystemLog({
          category: 'class',
          level: 'warning',
          action: 'Vượt giới hạn tạo lớp học',
          detail: `Giáo viên ${cls.ownerTeacherName ?? ownerId} đã đạt giới hạn tối đa ${MAX_CLASSES_PER_TEACHER} lớp học.`,
          actorName: cls.ownerTeacherName,
          actorId: ownerId,
          targetLabel: cls.classCode || cls.name,
        });
        return {
          ok: false,
          error: `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học.`,
        };
      }

      setPrivateClasses((prev) => {
        if (
          ownerId &&
          prev.filter((c) => c.ownerTeacherId === ownerId).length >=
            MAX_CLASSES_PER_TEACHER
        ) {
          return prev;
        }
        return [cls, ...prev];
      });
      appendSystemLog({
        category: 'class',
        level: 'info',
        action: 'Tạo lớp học mới',
        detail: `Tạo lớp "${cls.name}" (${formatGradeLabel(cls.grade)}${cls.classCode ? ` · Mã ${cls.classCode}` : ''}).`,
        actorName: cls.ownerTeacherName,
        actorId: ownerId,
        targetLabel: cls.classCode || cls.name,
      });
      return { ok: true };
    },
    [privateClasses],
  );

  const updatePrivateClass = useCallback((updated: TeacherPrivateClass) => {
    setPrivateClasses((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );
    appendSystemLog({
      category: 'class',
      level: 'info',
      action: 'Cập nhật thông tin lớp học',
      detail: `Cập nhật lớp "${updated.name}" (${formatGradeLabel(updated.grade)}).`,
      targetLabel: updated.classCode || updated.name,
    });
  }, []);

  const deletePrivateClass = useCallback((id: string) => {
    setPrivateClasses((prev) => prev.filter((c) => c.id !== id));
    setClassJoinRequests((prev) => prev.filter((r) => r.classId !== id));
    setClassMaterials((prev) => prev.filter((m) => m.classId !== id));
    setClassAssignments((prev) => prev.filter((a) => a.classId !== id));
    setClassSchedules((prev) => prev.filter((s) => s.classId !== id));
    // Preserve isPrivate & ownerTeacherId on linked exams so private exams never become public
    setExams((prev) =>
      prev.map((ex) =>
        ex.privateClassId === id
          ? {
              ...ex,
              privateClassId: undefined,
              isPrivate: true,
            }
          : ex,
      ),
    );
    appendSystemLog({
      category: 'class',
      level: 'warning',
      action: 'Xóa lớp học',
      detail: `Đã xóa lớp học ${id} cùng danh sách duyệt lớp, tài liệu, bài tập và lịch học liên quan.`,
      targetLabel: id,
    });
  }, []);

  const requestJoinClass = useCallback(
    (input: {
      targetClass: TeacherPrivateClass;
      studentUserId: string;
      studentName: string;
      studentSbd?: string;
      studentClass?: string;
      studentEmail?: string;
      actorRole?: UserRole | 'guest';
    }): { ok: true; request: ClassJoinRequest } | { ok: false; error: string } => {
      const code = derivePrivateClassCode(input.targetClass);
      const existing = classJoinRequests.find(
        (r) =>
          r.classId === input.targetClass.id &&
          r.studentUserId === input.studentUserId,
      );
      if (existing?.status === 'approved') {
        return { ok: false, error: `Bạn đã tham gia lớp "${input.targetClass.name}" rồi.` };
      }
      if (existing?.status === 'pending') {
        return {
          ok: false,
          error: `Yêu cầu vào lớp "${input.targetClass.name}" (${code}) đang chờ giáo viên duyệt.`,
        };
      }

      const requiresApproval = input.targetClass.requireApproval !== false;
      const nowIso = new Date().toISOString();
      const nextRequest: ClassJoinRequest = {
        id: existing?.id ?? `cjr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        classId: input.targetClass.id,
        classCode: code,
        studentUserId: input.studentUserId,
        studentName: input.studentName,
        studentSbd: input.studentSbd,
        studentClass: input.studentClass,
        studentEmail: input.studentEmail,
        status: requiresApproval ? 'pending' : 'approved',
        requestedAt: nowIso,
        reviewedAt: requiresApproval ? undefined : nowIso,
        reviewedByTeacherName: requiresApproval
          ? undefined
          : 'Tự động vào lớp (Tắt phê duyệt)',
      };

      setClassJoinRequests((prev) => {
        const filtered = prev.filter((r) => r.id !== nextRequest.id);
        return [nextRequest, ...filtered];
      });

      if (!requiresApproval && input.studentUserId !== 'guest_student') {
        const stuAcc = listAccountsSync().find((a) => a.id === input.studentUserId);
        if (stuAcc) {
          const currentIds = new Set(stuAcc.enrolledClassIds ?? []);
          currentIds.add(input.targetClass.id);
          updateStoredAccount(stuAcc.id, {
            enrolledClassIds: Array.from(currentIds),
          });
        }
      }

      appendSystemLog({
        category: 'class',
        level: 'info',
        action: requiresApproval
          ? 'Xin vào lớp bằng mã lớp'
          : 'Tự động vào lớp bằng mã lớp',
        detail: requiresApproval
          ? `${input.studentName} gửi yêu cầu vào lớp "${input.targetClass.name}" (${code}), chờ giáo viên duyệt.`
          : `${input.studentName} tự động tham gia lớp "${input.targetClass.name}" (${code}) do lớp đang tắt phê duyệt.`,
        actorName: input.studentName,
        actorRole: input.actorRole ?? 'student',
        actorId: input.studentUserId === 'guest_student' ? undefined : input.studentUserId,
        targetLabel: code,
      });

      return { ok: true, request: nextRequest };
    },
    [classJoinRequests],
  );

  const cancelJoinRequest = useCallback(
    (
      requestId: string,
      actor?: { name?: string; role?: UserRole | 'guest'; id?: string },
    ) => {
      const target = classJoinRequests.find((r) => r.id === requestId);
      setClassJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (target) {
        appendSystemLog({
          category: 'class',
          level: 'info',
          action: 'Hủy yêu cầu vào lớp',
          detail: `${actor?.name ?? target.studentName} đã hủy yêu cầu tham gia lớp mã ${target.classCode}.`,
          actorName: actor?.name ?? target.studentName,
          actorRole: actor?.role ?? 'student',
          actorId: actor?.id,
          targetLabel: target.classCode,
        });
      }
    },
    [classJoinRequests],
  );

  const reviewClassJoinRequest = useCallback(
    (
      requestId: string,
      decision: 'approved' | 'rejected',
      reviewer: { name: string; role?: UserRole; id?: string },
    ) => {
      const target = classJoinRequests.find((r) => r.id === requestId);
      if (!target) return;

      const reviewedAt = new Date().toISOString();
      setClassJoinRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: decision,
                reviewedAt,
                reviewedByTeacherName: reviewer.name,
              }
            : r,
        ),
      );

      if (target.studentUserId !== 'guest_student') {
        const stuAcc = listAccountsSync().find((a) => a.id === target.studentUserId);
        if (stuAcc) {
          const currentIds = new Set(stuAcc.enrolledClassIds ?? []);
          if (decision === 'approved') currentIds.add(target.classId);
          else currentIds.delete(target.classId);
          updateStoredAccount(stuAcc.id, {
            enrolledClassIds: Array.from(currentIds),
          });
        }
      }

      appendSystemLog({
        category: 'class',
        level: decision === 'approved' ? 'info' : 'warning',
        action:
          decision === 'approved'
            ? 'Giáo viên duyệt học sinh vào lớp'
            : 'Giáo viên từ chối yêu cầu vào lớp',
        detail: `${reviewer.name} đã ${
          decision === 'approved' ? 'duyệt' : 'từ chối'
        } ${target.studentName} vào lớp mã ${target.classCode}.`,
        actorName: reviewer.name,
        actorRole: reviewer.role ?? 'teacher',
        actorId: reviewer.id,
        targetLabel: target.classCode,
      });
    },
    [classJoinRequests],
  );

  const removeClassMembership = useCallback(
    (
      classId: string,
      studentUserId: string,
      actor?: {
        name?: string;
        role?: UserRole | 'guest';
        id?: string;
        reason?: 'student_left' | 'teacher_removed';
      },
    ) => {
      const targetReq = classJoinRequests.find(
        (r) => r.classId === classId && r.studentUserId === studentUserId,
      );
      setClassJoinRequests((prev) =>
        prev.filter(
          (r) => !(r.classId === classId && r.studentUserId === studentUserId),
        ),
      );

      if (studentUserId !== 'guest_student') {
        const stuAcc = listAccountsSync().find((a) => a.id === studentUserId);
        if (stuAcc) {
          const nextIds = (stuAcc.enrolledClassIds ?? []).filter((id) => id !== classId);
          updateStoredAccount(stuAcc.id, { enrolledClassIds: nextIds });
        }
      }

      appendSystemLog({
        category: 'class',
        level: 'warning',
        action:
          actor?.reason === 'teacher_removed'
            ? 'Giáo viên mời học sinh rời lớp'
            : 'Học sinh rời lớp học',
        detail:
          actor?.reason === 'teacher_removed'
            ? `${actor?.name ?? 'Giáo viên'} đã xóa ${
                targetReq?.studentName ?? studentUserId
              } khỏi lớp ${targetReq?.classCode ?? classId}.`
            : `${actor?.name ?? targetReq?.studentName ?? 'Học sinh'} đã rời lớp ${
                targetReq?.classCode ?? classId
              }.`,
        actorName: actor?.name ?? targetReq?.studentName ?? 'Người dùng',
        actorRole: actor?.role ?? 'student',
        actorId: actor?.id,
        targetLabel: targetReq?.classCode ?? classId,
      });
    },
    [classJoinRequests],
  );

  const addClassMaterial = useCallback((material: ClassMaterial) => {
    setClassMaterials((prev) => [material, ...prev]);
    appendSystemLog({
      category: 'class',
      level: 'info',
      action: 'Gửi tài liệu lớp học',
      detail: `Đăng tài liệu "${material.title}" vào lớp ${material.classId}.`,
      targetLabel: material.title,
    });
  }, []);

  const updateClassMaterial = useCallback((updated: ClassMaterial) => {
    setClassMaterials((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m)),
    );
    appendSystemLog({
      category: 'class',
      level: 'info',
      action: 'Cập nhật tài liệu lớp học',
      detail: `Cập nhật chia sẻ hoặc nội dung tài liệu "${updated.title}".`,
      targetLabel: updated.title,
    });
  }, []);

  const deleteClassMaterial = useCallback((id: string) => {
    setClassMaterials((prev) => prev.filter((m) => m.id !== id));
    appendSystemLog({
      category: 'class',
      level: 'warning',
      action: 'Xóa tài liệu lớp học',
      detail: `Đã gỡ tài liệu ${id}.`,
      targetLabel: id,
    });
  }, []);

  const addClassAssignment = useCallback((assignment: ClassAssignment) => {
    setClassAssignments((prev) => [assignment, ...prev]);
    appendSystemLog({
      category: 'class',
      level: 'info',
      action: 'Giao bài tập mới',
      detail: `Giao bài tập "${assignment.title}" (Hạn ${assignment.dueDateLabel}) vào lớp ${assignment.classId}.`,
      targetLabel: assignment.title,
    });
  }, []);

  const updateClassAssignment = useCallback((updated: ClassAssignment) => {
    setClassAssignments((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a)),
    );
    appendSystemLog({
      category: 'class',
      level: 'info',
      action: 'Cập nhật bài tập lớp học',
      detail: `Cập nhật chia sẻ hoặc nội dung bài tập "${updated.title}".`,
      targetLabel: updated.title,
    });
  }, []);

  const deleteClassAssignment = useCallback((id: string) => {
    setClassAssignments((prev) => prev.filter((a) => a.id !== id));
    appendSystemLog({
      category: 'class',
      level: 'warning',
      action: 'Xóa bài tập lớp học',
      detail: `Đã gỡ bài tập ${id}.`,
      targetLabel: id,
    });
  }, []);

  const addClassScheduleSlot = useCallback((slot: ClassScheduleSlot) => {
    setClassSchedules((prev) => [...prev, slot]);
    appendSystemLog({
      category: 'class',
      level: 'info',
      action: 'Thêm lịch học mới',
      detail: `Thêm lịch "${slot.topic}" (${slot.dayKey.toUpperCase()} · ${slot.timeSlot}) cho lớp ${slot.classId}.`,
      targetLabel: `${slot.dayKey.toUpperCase()} ${slot.timeSlot}`,
    });
  }, []);

  const updateClassScheduleSlot = useCallback((updated: ClassScheduleSlot) => {
    setClassSchedules((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    );
    appendSystemLog({
      category: 'class',
      level: 'info',
      action: 'Cập nhật lịch học',
      detail: `Sửa lịch "${updated.topic}" (${updated.dayKey.toUpperCase()} · ${updated.timeSlot}).`,
      targetLabel: `${updated.dayKey.toUpperCase()} ${updated.timeSlot}`,
    });
  }, []);

  const deleteClassScheduleSlot = useCallback((id: string) => {
    setClassSchedules((prev) => prev.filter((s) => s.id !== id));
    appendSystemLog({
      category: 'class',
      level: 'warning',
      action: 'Xóa lịch học',
      detail: `Đã xóa buổi học ${id} khỏi thời khóa biểu.`,
      targetLabel: id,
    });
  }, []);

  const updateSystemConfig = useCallback((patch: Partial<SystemConfig>) => {
    setSystemConfig((prev) => ({ ...prev, ...patch }));
    const changedKeys = Object.keys(patch).join(', ');
    appendSystemLog({
      category: 'system',
      level: 'info',
      action: 'Cập nhật cấu hình hệ thống',
      detail: `Thay đổi thiết lập hệ thống: ${changedKeys}.`,
      targetLabel: changedKeys,
    });
  }, []);

  const resetAllDemoData = useCallback(() => {
    setQuestions(SEED_QUESTIONS);
    setExams(SEED_EXAMS);
    setSubmissions(SEED_SUBMISSIONS);
    setPrivateClasses(SEED_TEACHER_CLASSES);
    setClassJoinRequests(SEED_CLASS_JOIN_REQUESTS);
    setClassMaterials(SEED_CLASS_MATERIALS);
    setClassAssignments(SEED_CLASS_ASSIGNMENTS);
    setClassSchedules(SEED_CLASS_SCHEDULES);
    setSystemConfig(DEFAULT_SYSTEM_CONFIG);
    appendSystemLog({
      category: 'system',
      level: 'warning',
      action: 'Khôi phục dữ liệu mẫu toàn hệ thống',
      detail: 'Đưa câu hỏi, đề thi, bài nộp, lớp học, yêu cầu vào lớp, tài liệu, lịch học và cấu hình về trạng thái gốc.',
      targetLabel: 'Full System Reset',
    });
  }, []);

  return {
    questions,
    questionMap,
    exams,
    submissions,
    privateClasses,
    classJoinRequests,
    classMaterials,
    classAssignments,
    classSchedules,
    role,
    setRole,
    systemConfig,
    updateSystemConfig,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    deleteAllQuestions,
    importQuestions,
    addExam,
    updateExam,
    deleteExam,
    deleteAllExams,
    addSubmission,
    deleteSubmission,
    addPrivateClass,
    updatePrivateClass,
    deletePrivateClass,
    requestJoinClass,
    cancelJoinRequest,
    reviewClassJoinRequest,
    removeClassMembership,
    addClassMaterial,
    updateClassMaterial,
    deleteClassMaterial,
    addClassAssignment,
    updateClassAssignment,
    deleteClassAssignment,
    addClassScheduleSlot,
    updateClassScheduleSlot,
    deleteClassScheduleSlot,
    resetAllDemoData,
  };
}
