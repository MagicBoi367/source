import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  DoorOpen,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  KeyRound,
  LogOut,
  Printer,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  derivePrivateClassCode,
  downloadClassMaterialTxt,
} from '../data/studentPortalData';
import type {
  ClassAssignment,
  ClassJoinRequest,
  ClassMaterial,
  ClassScheduleSlot,
  Exam,
  ExamSubmission,
  Question,
  SubjectId,
  TeacherPrivateClass,
  UserAccount,
} from '../types/exam';
import { appendSystemLog } from '../utils/systemLogs';
import {
  areGradesEqual,
  calculateExamMaxRawScore,
  classifyAcademicRankTT22,
  EXAM_CATEGORY_LABELS,
  formatGradeLabel,
  formatScoreVi,
  getExamDurationMinutes,
  getSubjectMeta,
  OPTION_LETTERS,
} from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import type { AppView } from './Header';
import { SubjectSearchSelect } from './SubjectSearchSelect';
import { WeeklyCalendarSchedule } from './WeeklyCalendarSchedule';

const STUDENT_PROGRESS_KEY = 'kythi2025_student_hub_progress_v2';

interface StudentHubLocalProgress {
  completedAssignmentIds: string[];
}

function readProgress(userId: string): StudentHubLocalProgress {
  try {
    const raw = localStorage.getItem(`${STUDENT_PROGRESS_KEY}_${userId}`);
    if (!raw) {
      return { completedAssignmentIds: [] };
    }
    const parsed = JSON.parse(raw) as Partial<StudentHubLocalProgress>;
    return {
      completedAssignmentIds: Array.isArray(parsed.completedAssignmentIds)
        ? parsed.completedAssignmentIds
        : [],
    };
  } catch {
    return { completedAssignmentIds: [] };
  }
}

function saveProgress(userId: string, data: StudentHubLocalProgress): void {
  try {
    localStorage.setItem(`${STUDENT_PROGRESS_KEY}_${userId}`, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export type StudentHomeSectionId =
  | 'classes'
  | 'schedule'
  | 'materials'
  | 'assignments'
  | 'exams'
  | 'scores';

interface StudentHomeDashboardProps {
  currentUser: UserAccount | null;
  exams: Exam[];
  questions: Question[];
  submissions: ExamSubmission[];
  allPrivateClasses: TeacherPrivateClass[];
  classJoinRequests: ClassJoinRequest[];
  classMaterials: ClassMaterial[];
  classAssignments: ClassAssignment[];
  classSchedules: ClassScheduleSlot[];
  onRequestJoinClass: (targetClass: TeacherPrivateClass) => {
    ok: boolean;
    error?: string;
    request?: ClassJoinRequest;
  };
  onCancelJoinRequest: (requestId: string) => void;
  onLeaveClassMembership: (classId: string) => void;
  onSelectExamToStart: (exam: Exam) => void;
  onJoinByRoomCode: (code: string) => string | null;
  onOpenPrintableExam: (exam: Exam) => void;
  onNavigate: (view: AppView) => void;
  onViewSubmission: (sub: ExamSubmission) => void;
  requestedSection?: { sectionId: StudentHomeSectionId; nonce: number } | null;
  onSectionActivated?: (sectionId: StudentHomeSectionId) => void;
}

type ClassRoomTab = 'exams' | 'materials' | 'assignments' | 'schedule';

export function StudentHomeDashboard({
  currentUser,
  exams,
  questions,
  submissions,
  allPrivateClasses,
  classJoinRequests,
  classMaterials,
  classAssignments,
  classSchedules,
  onRequestJoinClass,
  onCancelJoinRequest,
  onLeaveClassMembership,
  onSelectExamToStart,
  onJoinByRoomCode,
  onOpenPrintableExam,
  onNavigate,
  onViewSubmission,
  requestedSection,
  onSectionActivated,
}: StudentHomeDashboardProps) {
  useSubjects();
  const userKey = currentUser?.id ?? 'guest_student';
  const [progress, setProgress] = useState<StudentHubLocalProgress>(() =>
    readProgress(userKey),
  );

  useEffect(() => {
    setProgress(readProgress(userKey));
  }, [userKey]);

  const updateProgressState = (
    updater: (prev: StudentHubLocalProgress) => StudentHubLocalProgress,
  ) => {
    setProgress((prev) => {
      const next = updater(prev);
      saveProgress(userKey, next);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // 1. CLASS ENROLLMENT (BY CLASS CODE + TEACHER APPROVAL) & CLASS NAVIGATION
  // ---------------------------------------------------------------------------
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinFeedback, setJoinFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [classSearchInput, setClassSearchInput] = useState('');
  const [appliedClassQuery, setAppliedClassQuery] = useState('');
  const [inlineCardCodeInputs, setInlineCardCodeInputs] = useState<Record<string, string>>(
    {},
  );
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [classRoomTab, setClassRoomTab] = useState<ClassRoomTab>('exams');

  const classMap = useMemo(
    () => new Map(allPrivateClasses.map((pc) => [pc.id, pc])),
    [allPrivateClasses],
  );

  const myClassRequests = useMemo(
    () => classJoinRequests.filter((r) => r.studentUserId === userKey),
    [classJoinRequests, userKey],
  );

  const requestByClassId = useMemo(
    () => new Map(myClassRequests.map((r) => [r.classId, r])),
    [myClassRequests],
  );

  const enrolledClassIds = useMemo(() => {
    const approved = new Set<string>();
    for (const req of myClassRequests) {
      if (req.status === 'approved') {
        approved.add(req.classId);
      }
    }
    return approved;
  }, [myClassRequests]);

  const joinedClasses = useMemo(
    () => allPrivateClasses.filter((pc) => enrolledClassIds.has(pc.id)),
    [allPrivateClasses, enrolledClassIds],
  );

  const pendingOrRejectedRequests = useMemo(
    () =>
      myClassRequests.filter(
        (r) =>
          (r.status === 'pending' || r.status === 'rejected') &&
          classMap.has(r.classId),
      ),
    [classMap, myClassRequests],
  );

  const submitJoinWithExactCode = (rawCode: string, expectedClass?: TeacherPrivateClass) => {
    const cleaned = rawCode.trim().toUpperCase().replace(/\s+/g, '-');
    if (!cleaned) {
      setJoinFeedback({
        type: 'error',
        text: 'Vui lòng nhập mã lớp do giáo viên cung cấp (VD: 12A1-HSG).',
      });
      return;
    }

    const matched = expectedClass
      ? derivePrivateClassCode(expectedClass) === cleaned
        ? expectedClass
        : undefined
      : allPrivateClasses.find((pc) => derivePrivateClassCode(pc) === cleaned);

    if (!matched) {
      setJoinFeedback({
        type: 'error',
        text: expectedClass
          ? `Mã lớp chưa đúng cho lớp "${expectedClass.name}". Vui lòng kiểm tra lại với giáo viên.`
          : `Không tìm thấy lớp học nào mang mã "${cleaned}". Vui lòng hỏi lại giáo viên để lấy đúng mã lớp.`,
      });
      return;
    }

    const res = onRequestJoinClass(matched);
    if (!res.ok) {
      setJoinFeedback({
        type: 'error',
        text: res.error ?? 'Không thể gửi yêu cầu vào lớp.',
      });
      return;
    }

    setJoinCodeInput('');
    setInlineCardCodeInputs((prev) => ({ ...prev, [matched.id]: '' }));
    setJoinFeedback({
      type: 'success',
      text:
        res.request?.status === 'approved' || matched.requireApproval === false
          ? `Đã tham gia lớp "${matched.name}" (${derivePrivateClassCode(matched)}) thành công. Bạn có thể vào lớp học ngay.`
          : `Đã gửi yêu cầu tham gia lớp "${matched.name}" (${derivePrivateClassCode(matched)}). Vui lòng chờ giáo viên duyệt để vào lớp học.`,
    });
  };

  const handleJoinCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitJoinWithExactCode(joinCodeInput);
  };

  const handleLeaveClass = (classId: string) => {
    onLeaveClassMembership(classId);
    if (activeClassId === classId) {
      setActiveClassId(null);
    }
  };

  const handleEnterClassRoom = (classId: string, initialTab: ClassRoomTab = 'exams') => {
    if (!enrolledClassIds.has(classId)) return;
    const targetCls = classMap.get(classId);
    appendSystemLog({
      category: 'class',
      level: 'info',
      action: 'Học sinh vào lớp học',
      detail: `Truy cập trang lớp học "${targetCls?.name ?? classId}".`,
      actorName: currentUser?.fullName ?? 'Học sinh (Khách)',
      actorRole: currentUser?.role ?? 'guest',
      actorId: currentUser?.id,
      targetLabel: targetCls ? derivePrivateClassCode(targetCls) : classId,
    });
    setActiveClassId(classId);
    setClassRoomTab(initialTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchClassesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedClassQuery(classSearchInput);
  };

  const searchKeyword = normalizeSearchText(appliedClassQuery || classSearchInput);
  const rawUpperQuery = (appliedClassQuery || classSearchInput)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-');
  const isSearchingClasses = searchKeyword.length > 0;

  const searchedTeacherClasses = useMemo(() => {
    if (!searchKeyword) return [];
    return allPrivateClasses.filter((pc) => {
      const code = normalizeSearchText(derivePrivateClassCode(pc));
      const teacher = normalizeSearchText(pc.ownerTeacherName);
      const name = normalizeSearchText(pc.name);
      return (
        teacher.includes(searchKeyword) ||
        code === searchKeyword ||
        name.includes(searchKeyword)
      );
    });
  }, [allPrivateClasses, searchKeyword]);

  // ---------------------------------------------------------------------------
  // 3. FILTERED DATA STRICTLY SCOPED TO JOINED TEACHER CLASSES
  // ---------------------------------------------------------------------------
  const [examSubjectFilter, setExamSubjectFilter] = useState<'all' | SubjectId>('all');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);

  const joinedClassExams = useMemo(() => {
    return exams.filter((ex) => {
      if (ex.status !== 'active' || ex.isPrivate) return false;
      if (!ex.privateClassId || !enrolledClassIds.has(ex.privateClassId)) {
        return false;
      }
      if (examSubjectFilter !== 'all' && ex.subject !== examSubjectFilter) {
        return false;
      }
      return true;
    });
  }, [exams, enrolledClassIds, examSubjectFilter]);

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = roomCodeInput.trim().toUpperCase();
    if (!trimmed) {
      setRoomError('Vui lòng nhập mã bài thi (VD: TOAN2025).');
      return;
    }
    const matchedInJoined = joinedClassExams.find(
      (ex) => ex.roomCode.toUpperCase() === trimmed,
    );
    if (!matchedInJoined) {
      const existsInSystem = exams.find(
        (ex) => ex.roomCode.toUpperCase() === trimmed && !ex.isPrivate,
      );
      if (existsInSystem && existsInSystem.privateClassId) {
        const cls = classMap.get(existsInSystem.privateClassId);
        if (cls && !enrolledClassIds.has(cls.id)) {
          setRoomError(
            `Bài thi "${trimmed}" thuộc lớp "${cls.name}" (${derivePrivateClassCode(cls)}). Hãy tìm và tham gia lớp học này trước để làm bài.`,
          );
          return;
        }
      }
      const err = onJoinByRoomCode(trimmed);
      if (err) {
        setRoomError(err);
      } else {
        setRoomError(null);
        setRoomCodeInput('');
      }
      return;
    }
    onSelectExamToStart(matchedInJoined);
    setRoomError(null);
    setRoomCodeInput('');
  };

  const [materialSubjectFilter, setMaterialSubjectFilter] = useState<'all' | SubjectId>(
    'all',
  );
  const [activeMaterial, setActiveMaterial] = useState<ClassMaterial | null>(null);

  const joinedClassMaterials = useMemo(() => {
    return classMaterials.filter((mat) => {
      if (!enrolledClassIds.has(mat.classId)) return false;
      if (materialSubjectFilter !== 'all' && mat.subject !== materialSubjectFilter) {
        return false;
      }
      return true;
    });
  }, [classMaterials, enrolledClassIds, materialSubjectFilter]);

  const joinedClassAssignments = useMemo(() => {
    return classAssignments.filter((asg) => enrolledClassIds.has(asg.classId));
  }, [classAssignments, enrolledClassIds]);

  const joinedClassSchedules = useMemo(() => {
    return classSchedules.filter((slot) => enrolledClassIds.has(slot.classId));
  }, [classSchedules, enrolledClassIds]);

  // Scoreboard (Module 4) — strictly student's own submissions
  const scoreStats = useMemo(() => {
    if (submissions.length === 0) {
      return { count: 0, avg: 0, best: 0 };
    }
    const sum = submissions.reduce((acc, s) => acc + s.totalScore, 0);
    const best = Math.max(...submissions.map((s) => s.totalScore));
    return {
      count: submissions.length,
      avg: sum / submissions.length,
      best,
    };
  }, [submissions]);

  // Interactive Assignment Modal State
  const [activeAssignment, setActiveAssignment] =
    useState<ClassAssignment | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, number>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);

  const assignmentPracticeQuestions = useMemo(() => {
    if (!activeAssignment) return [];
    const matching = questions.filter(
      (q) =>
        q.type === 'multiple_choice' &&
        q.subject === activeAssignment.subject &&
        q.options &&
        q.options.length === 4,
    );
    const gradeMatched = matching.filter((q) => areGradesEqual(q.grade, activeAssignment.grade));
    const pool = gradeMatched.length >= 3 ? gradeMatched : matching;
    return pool.slice(0, 5);
  }, [activeAssignment, questions]);

  const toggleAssignmentCompleted = (assignmentId: string) => {
    updateProgressState((prev) => {
      const exists = prev.completedAssignmentIds.includes(assignmentId);
      return {
        ...prev,
        completedAssignmentIds: exists
          ? prev.completedAssignmentIds.filter((id) => id !== assignmentId)
          : [...prev.completedAssignmentIds, assignmentId],
      };
    });
  };

  const activeClassObj = activeClassId ? classMap.get(activeClassId) ?? null : null;

  const activeClassExams = useMemo(() => {
    if (!activeClassObj) return [];
    return exams.filter(
      (ex) =>
        ex.status === 'active' &&
        !ex.isPrivate &&
        ex.privateClassId === activeClassObj.id,
    );
  }, [activeClassObj, exams]);

  const activeClassMaterials = useMemo(() => {
    if (!activeClassObj) return [];
    return classMaterials.filter((m) => m.classId === activeClassObj.id);
  }, [activeClassObj, classMaterials]);

  const activeClassAssignments = useMemo(() => {
    if (!activeClassObj) return [];
    return classAssignments.filter((a) => a.classId === activeClassObj.id);
  }, [activeClassObj, classAssignments]);

  const activeClassSchedules = useMemo(() => {
    if (!activeClassObj) return [];
    return classSchedules.filter((s) => s.classId === activeClassObj.id);
  }, [activeClassObj, classSchedules]);

  const scrollToSection = (sectionId: StudentHomeSectionId) => {
    onSectionActivated?.(sectionId);
    const el = document.getElementById(`portal-section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (!requestedSection) return;
    setActiveClassId(null);
    const timer = window.setTimeout(() => {
      const el = document.getElementById(
        `portal-section-${requestedSection.sectionId}`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [requestedSection]);

  const quickNavItems: {
    id: StudentHomeSectionId;
    label: string;
    count: number;
  }[] = [
    { id: 'classes', label: 'Lớp học', count: joinedClasses.length },
    { id: 'schedule', label: 'Lịch học', count: joinedClassSchedules.length },
    { id: 'materials', label: 'Tài liệu', count: joinedClassMaterials.length },
    { id: 'assignments', label: 'Bài tập', count: joinedClassAssignments.length },
    { id: 'exams', label: 'Bài thi', count: joinedClassExams.length },
    { id: 'scores', label: 'Bảng điểm', count: submissions.length },
  ];

  // ---------------------------------------------------------------------------
  // RENDER CLASS ROOM PAGE ("Trang lớp học" khi bấm "Vào lớp học")
  // ---------------------------------------------------------------------------
  if (activeClassObj) {
    const classCode = derivePrivateClassCode(activeClassObj);
    const subjectName = getSubjectMeta(activeClassObj.subject ?? 'toan').name;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveClassId(null)}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Trang tổng quan</span>
          </button>

          <button
            type="button"
            onClick={() => handleLeaveClass(activeClassObj.id)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Rời lớp học</span>
          </button>
        </div>

        {/* Class Workspace Banner */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-blue-700 dark:text-blue-400">
              {subjectName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatGradeLabel(activeClassObj.grade)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              Mã lớp: {classCode}
            </span>
          </div>

          <h1 className="mt-2 font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
            {activeClassObj.name}
          </h1>

          <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
            Giáo viên phụ trách:{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {activeClassObj.ownerTeacherName}
            </strong>
          </p>

          {activeClassObj.description && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {activeClassObj.description}
            </p>
          )}

          {/* Class Sub-navigation Tabs */}
          <div
            role="tablist"
            aria-label="Nội dung trong lớp học"
            className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-4 dark:border-slate-800"
          >
            {(
              [
                { id: 'exams', label: `Bài thi của lớp (${activeClassExams.length})` },
                {
                  id: 'materials',
                  label: `Tài liệu (${activeClassMaterials.length})`,
                },
                {
                  id: 'assignments',
                  label: `Bài tập (${activeClassAssignments.length})`,
                },
                {
                  id: 'schedule',
                  label: `Lịch học (${activeClassSchedules.length})`,
                },
              ] as { id: ClassRoomTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={classRoomTab === tab.id}
                onClick={() => setClassRoomTab(tab.id)}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold tabular-nums transition-colors ${
                  classRoomTab === tab.id
                    ? 'bg-blue-700 text-white dark:bg-blue-600'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Tab Body */}
        {classRoomTab === 'exams' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Bài thi trong lớp {activeClassObj.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Chọn bài thi bên dưới để bắt đầu làm bài ngay trong lớp học.
            </p>

            {activeClassExams.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Giáo viên chưa gửi bài thi nào vào lớp học này.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {activeClassExams.map((exam) => {
                  const totalQ =
                    exam.part1QuestionIds.length +
                    exam.part2QuestionIds.length +
                    exam.part3QuestionIds.length;
                  const maxRaw = calculateExamMaxRawScore(exam);
                  const myAttempts = submissions.filter((s) => s.examId === exam.id).length;

                  return (
                    <article
                      key={exam.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{EXAM_CATEGORY_LABELS[exam.category]}</span>
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            Mã bài thi: {exam.roomCode}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                          {exam.title}
                        </h3>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="h-3.5 w-3.5" />
                            {getExamDurationMinutes(exam)} phút
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {totalQ} câu ({formatScoreVi(maxRaw)} điểm)
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {myAttempts > 0 ? `Đã nộp ${myAttempts} lần` : 'Chưa làm bài'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => onOpenPrintableExam(exam)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Xem đề chuẩn A4</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectExamToStart(exam)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <span>Làm bài thi</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {classRoomTab === 'materials' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Tài liệu giáo viên gửi trong lớp
            </h2>
            {activeClassMaterials.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Giáo viên chưa gửi tài liệu nào trong lớp học này.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassMaterials.map((mat) => (
                  <div key={mat.id} className="py-4 first:pt-1 last:pb-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {mat.category} · GV {mat.ownerTeacherName}
                    </p>
                    <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {mat.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {mat.summary}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveMaterial(mat)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Đọc nhanh</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadClassMaterialTxt(mat)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Tải về (.txt)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {classRoomTab === 'assignments' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Bài tập giáo viên giao trong lớp
            </h2>
            {activeClassAssignments.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Giáo viên chưa giao bài tập nào trong lớp học này.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassAssignments.map((asg) => {
                  const isDone = progress.completedAssignmentIds.includes(asg.id);
                  return (
                    <div key={asg.id} className="py-4 first:pt-1 last:pb-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Hạn: {asg.dueDateLabel} · GV {asg.ownerTeacherName}
                        </span>
                        <span
                          className={`font-semibold ${
                            isDone
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {isDone ? 'Đã hoàn thành' : 'Chưa làm'}
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                        {asg.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {asg.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAssignment(asg);
                            setPracticeAnswers({});
                            setPracticeSubmitted(false);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <span>Làm bài tập</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAssignmentCompleted(asg.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{isDone ? 'Bỏ đánh dấu' : 'Đánh dấu đã xong'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {classRoomTab === 'schedule' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Lịch học của lớp {activeClassObj.name}
            </h2>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Lịch học tuần từ Thứ 2 đến Chủ nhật do giáo viên cập nhật.
            </p>
            <WeeklyCalendarSchedule
              slots={activeClassSchedules}
              classes={[activeClassObj]}
              canEdit={false}
              currentUser={currentUser}
              emptyNotice="Lớp học này chưa có lịch học tuần được xếp."
            />
          </section>
        )}

        {/* Modals remain accessible while inside Class Page */}
        {activeMaterial && (
          <MaterialReaderModal
            material={activeMaterial}
            onClose={() => setActiveMaterial(null)}
          />
        )}
        {activeAssignment && (
          <AssignmentPracticeModal
            assignment={activeAssignment}
            questions={assignmentPracticeQuestions}
            practiceAnswers={practiceAnswers}
            practiceSubmitted={practiceSubmitted}
            onSelectAnswer={(qid, optIdx) =>
              setPracticeAnswers((prev) => ({ ...prev, [qid]: optIdx }))
            }
            onSubmitPractice={() => {
              setPracticeSubmitted(true);
              if (!progress.completedAssignmentIds.includes(activeAssignment.id)) {
                toggleAssignmentCompleted(activeAssignment.id);
              }
            }}
            onClose={() => setActiveAssignment(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===================================================================== */}
      {/* THANH CHUYỂN NHANH 6 MỤC: LỚP HỌC, BÀI THI, TÀI LIỆU, BẢNG ĐIỂM, BÀI TẬP, LỊCH HỌC */}
      {/* ===================================================================== */}
      <nav
        aria-label="6 mục trang tổng quan học sinh"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6"
      >
        {quickNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToSection(item.id)}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-slate-800/80"
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {item.label}
            </span>
            <span className="font-mono text-xs font-bold text-blue-700 tabular-nums dark:text-blue-400">
              {item.count}
            </span>
          </button>
        ))}
      </nav>

      {/* ===================================================================== */}
      {/* MỤC 1: LỚP HỌC (Chỉ vào được khi có mã lớp & được giáo viên duyệt)    */}
      {/* ===================================================================== */}
      <section
        id="portal-section-classes"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Lớp học
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Chỉ hiển thị các lớp đã được giáo viên duyệt. Để tham gia lớp mới, bạn phải nhập đúng mã lớp do giáo viên cung cấp và chờ giáo viên duyệt.
            </p>
          </div>
          <p className="font-mono text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
            Đã duyệt {joinedClasses.length} lớp
            {pendingOrRejectedRequests.some((r) => r.status === 'pending')
              ? ` · ${pendingOrRejectedRequests.filter((r) => r.status === 'pending').length} chờ duyệt`
              : ''}
          </p>
        </div>

        {/* Form xin vào lớp bằng Mã lớp (bắt buộc mã lớp + giáo viên duyệt) */}
        <form
          onSubmit={handleJoinCodeSubmit}
          className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
        >
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Xin tham gia lớp học bằng Mã lớp
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Nhập chính xác mã lớp từ giáo viên (VD: 12A1-HSG, 12A1-VATLI) để gửi yêu cầu chờ duyệt.
          </p>
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                aria-label="Nhập mã lớp để xin tham gia"
                value={joinCodeInput}
                onChange={(e) => {
                  setJoinCodeInput(e.target.value);
                  if (joinFeedback) setJoinFeedback(null);
                }}
                placeholder="Nhập mã lớp do giáo viên cấp (VD: 12A1-HSG)..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-4 pl-10 font-mono text-sm text-slate-900 uppercase placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <UserPlus className="h-4 w-4" />
              <span>Gửi yêu cầu vào lớp</span>
            </button>
          </div>
          {joinFeedback && (
            <p
              role={joinFeedback.type === 'error' ? 'alert' : 'status'}
              className={`mt-2.5 text-xs font-medium ${
                joinFeedback.type === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {joinFeedback.text}
            </p>
          )}
        </form>

        {/* Thanh tìm kiếm theo tên giáo viên hoặc mã lớp */}
        <form
          onSubmit={handleSearchClassesSubmit}
          className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              aria-label="Tìm lớp học theo tên giáo viên hoặc mã lớp"
              value={classSearchInput}
              onChange={(e) => {
                setClassSearchInput(e.target.value);
                setAppliedClassQuery(e.target.value);
              }}
              placeholder="Tìm lớp học theo tên giáo viên hoặc nhập đúng mã lớp (VD: Trần Quốc Bảo, 12A1-TOAN)..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-9 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {classSearchInput && (
              <button
                type="button"
                aria-label="Xóa từ khóa tìm lớp"
                onClick={() => {
                  setClassSearchInput('');
                  setAppliedClassQuery('');
                }}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Search className="h-4 w-4" />
            <span>Tìm lớp học</span>
          </button>
        </form>

        {/* Search Results Panel (never exposes hidden classCode for unjoined classes) */}
        {isSearchingClasses && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Kết quả tìm lớp học ({searchedTeacherClasses.length})
              </p>
              <button
                type="button"
                onClick={() => {
                  setClassSearchInput('');
                  setAppliedClassQuery('');
                }}
                className="cursor-pointer text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
              >
                Đóng kết quả tìm kiếm
              </button>
            </div>

            {searchedTeacherClasses.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Không tìm thấy lớp học nào khớp với từ khóa &ldquo;{appliedClassQuery || classSearchInput}&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {searchedTeacherClasses.map((pc) => {
                  const req = requestByClassId.get(pc.id);
                  const isJoined = req?.status === 'approved';
                  const isPending = req?.status === 'pending';
                  const code = derivePrivateClassCode(pc);
                  const matchedExactCode = rawUpperQuery === code;
                  const subjectName = getSubjectMeta(pc.subject ?? 'toan').name;

                  return (
                    <div
                      key={pc.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {subjectName} · {formatGradeLabel(pc.grade)}
                          </span>
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            {isJoined || isPending || matchedExactCode
                              ? `Mã lớp: ${code}`
                              : 'Cần mã lớp'}
                          </span>
                        </div>
                        <h3 className="mt-1.5 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                          {pc.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          Giáo viên: <strong className="text-slate-900 dark:text-slate-100">{pc.ownerTeacherName}</strong>
                        </p>
                      </div>

                      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                        {isJoined ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEnterClassRoom(pc.id)}
                              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                              <DoorOpen className="h-3.5 w-3.5" />
                              <span>Vào lớp học</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLeaveClass(pc.id)}
                              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <LogOut className="h-3.5 w-3.5" />
                              <span>Rời lớp học</span>
                            </button>
                          </div>
                        ) : isPending && req ? (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                              Đang chờ giáo viên duyệt
                            </span>
                            <button
                              type="button"
                              onClick={() => onCancelJoinRequest(req.id)}
                              className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                            >
                              Hủy yêu cầu
                            </button>
                          </div>
                        ) : matchedExactCode ? (
                          <button
                            type="button"
                            onClick={() => submitJoinWithExactCode(code, pc)}
                            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            <span>Xin vào lớp (chờ duyệt)</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              aria-label={`Nhập mã lớp của ${pc.name}`}
                              value={inlineCardCodeInputs[pc.id] ?? ''}
                              onChange={(e) =>
                                setInlineCardCodeInputs((prev) => ({
                                  ...prev,
                                  [pc.id]: e.target.value,
                                }))
                              }
                              placeholder="Nhập mã lớp để xin vào..."
                              className="h-8 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 uppercase placeholder:font-sans placeholder:normal-case dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                submitJoinWithExactCode(
                                  inlineCardCodeInputs[pc.id] ?? '',
                                  pc,
                                )
                              }
                              className="inline-flex h-8 cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              <span>Xin vào lớp</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Yêu cầu đang chờ giáo viên duyệt / bị từ chối */}
        {pendingOrRejectedRequests.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Yêu cầu xin vào lớp ({pendingOrRejectedRequests.length})
            </p>
            <div className="mt-2.5 divide-y divide-amber-200/70 dark:divide-amber-900/40">
              {pendingOrRejectedRequests.map((req) => {
                const cls = classMap.get(req.classId);
                if (!cls) return null;
                return (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {cls.name}{' '}
                        <span className="font-mono text-blue-700 dark:text-blue-400">
                          ({req.classCode})
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        GV {cls.ownerTeacherName} ·{' '}
                        {req.status === 'pending' ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            Đang chờ giáo viên duyệt
                          </span>
                        ) : (
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            Giáo viên đã từ chối
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === 'rejected' && (
                        <button
                          type="button"
                          onClick={() => submitJoinWithExactCode(req.classCode, cls)}
                          className="cursor-pointer rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-400"
                        >
                          Xin lại
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onCancelJoinRequest(req.id)}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      >
                        {req.status === 'pending' ? 'Hủy yêu cầu' : 'Xóa'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Joined Teacher-Created Classes List (Approved Only) */}
        {joinedClasses.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <Users className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Bạn chưa được duyệt vào lớp học nào.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Hãy nhập mã lớp do giáo viên cung cấp ở ô bên trên để gửi yêu cầu tham gia và chờ giáo viên duyệt.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {joinedClasses.map((pc) => {
              const code = derivePrivateClassCode(pc);
              const subjectName = getSubjectMeta(pc.subject ?? 'toan').name;
              const clsExamCount = exams.filter(
                (ex) =>
                  ex.status === 'active' &&
                  !ex.isPrivate &&
                  ex.privateClassId === pc.id,
              ).length;
              const clsMatCount = classMaterials.filter(
                (m) => m.classId === pc.id,
              ).length;
              const clsAsgCount = classAssignments.filter(
                (a) => a.classId === pc.id,
              ).length;

              return (
                <article
                  key={pc.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {subjectName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatGradeLabel(pc.grade)}</span>
                      </div>
                      <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                        Mã lớp: {code}
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      {pc.name}
                    </h3>

                    <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                      Giáo viên tạo lớp:{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {pc.ownerTeacherName}
                      </strong>
                    </p>

                    {pc.description && (
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {pc.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      <span>{clsExamCount} bài thi</span>
                      <span aria-hidden="true">·</span>
                      <span>{clsMatCount} tài liệu</span>
                      <span aria-hidden="true">·</span>
                      <span>{clsAsgCount} bài tập</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleEnterClassRoom(pc.id, 'exams')}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      <DoorOpen className="h-3.5 w-3.5" />
                      <span>Vào lớp học</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleLeaveClass(pc.id)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Rời lớp học</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MỤC 2: LỊCH HỌC (Dạng lịch 7 cột Thứ 2 – Chủ nhật, chỉ giáo viên sửa) */}
      {/* ===================================================================== */}
      <section
        id="portal-section-schedule"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-5 flex flex-col justify-between gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Lịch học
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Lịch học tuần chia theo từng ngày từ Thứ 2 đến Chủ nhật của các lớp bạn đã tham gia (chỉ giáo viên mới có quyền chỉnh sửa).
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Chế độ chỉ xem · Đồng bộ từ giáo viên
          </span>
        </div>

        <WeeklyCalendarSchedule
          slots={joinedClassSchedules}
          classes={joinedClasses}
          canEdit={false}
          currentUser={currentUser}
          emptyNotice="Chưa có lịch học cho các lớp bạn đã tham gia. Hãy tham gia lớp học hoặc chờ giáo viên cập nhật lịch."
        />
      </section>

      {/* ===================================================================== */}
      {/* MỤC 3: TÀI LIỆU & MỤC 4: BÀI TẬP (Chỉ từ lớp học đã tham gia)          */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* MỤC 3: TÀI LIỆU */}
        <section
          id="portal-section-materials"
          className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                  Tài liệu
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Chỉ hiển thị tài liệu giáo viên gửi lên từ các lớp học bạn đã tham gia.
              </p>
            </div>

            <SubjectSearchSelect
              allowAll
              compact
              allLabel="Tất cả môn"
              value={materialSubjectFilter}
              onChange={(val) =>
                setMaterialSubjectFilter((val || 'all') as 'all' | SubjectId)
              }
              ariaLabel="Lọc tài liệu theo môn học"
              currentUser={currentUser}
              className="w-48"
            />
          </div>

          {joinedClassMaterials.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <FileText className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-500" />
              <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chưa có tài liệu nào từ các lớp học bạn đã tham gia.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {joinedClassMaterials.map((mat) => {
                const cls = classMap.get(mat.classId);
                return (
                  <div key={mat.id} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        {getSubjectMeta(mat.subject).name}
                      </span>
                      {cls && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            Lớp {derivePrivateClassCode(cls)}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>GV {mat.ownerTeacherName}</span>
                    </div>

                    <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {mat.title}
                    </h3>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {mat.summary}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveMaterial(mat)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Đọc nhanh</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadClassMaterialTxt(mat)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Tải về (.txt)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* MỤC 4: BÀI TẬP */}
        <section
          id="portal-section-assignments"
          className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                  Bài tập
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Chỉ hiển thị bài tập do giáo viên gửi trong các lớp học bạn đã tham gia.
              </p>
            </div>

            <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
              Hoàn thành{' '}
              {
                joinedClassAssignments.filter((a) =>
                  progress.completedAssignmentIds.includes(a.id),
                ).length
              }
              /{joinedClassAssignments.length}
            </span>
          </div>

          {joinedClassAssignments.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <ClipboardList className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-500" />
              <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chưa có bài tập nào được giao trong các lớp bạn đã tham gia.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {joinedClassAssignments.map((asg) => {
                const isDone = progress.completedAssignmentIds.includes(asg.id);
                const cls = classMap.get(asg.classId);
                return (
                  <div key={asg.id} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {getSubjectMeta(asg.subject).name}
                        </span>
                        {cls && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">
                              Lớp {derivePrivateClassCode(cls)}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>Hạn: {asg.dueDateLabel}</span>
                      </div>
                      <span
                        className={`font-semibold ${
                          isDone
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {isDone ? 'Đã hoàn thành' : 'Chưa làm'}
                      </span>
                    </div>

                    <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                      {asg.title}
                    </h3>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {asg.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAssignment(asg);
                          setPracticeAnswers({});
                          setPracticeSubmitted(false);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        <span>Làm bài tập</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleAssignmentCompleted(asg.id)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isDone
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{isDone ? 'Bỏ đánh dấu' : 'Đánh dấu đã xong'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ===================================================================== */}
      {/* MỤC 5: BÀI THI (Chỉ hiển thị bài thi trong lớp đã tham gia + vào trang lớp để làm) */}
      {/* ===================================================================== */}
      <section
        id="portal-section-exams"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Bài thi
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Chỉ hiển thị các bài thi thuộc những lớp học bạn đã tham gia. Bạn có thể bấm Vào lớp học để làm bài thi hoặc làm ngay tại đây.
            </p>
          </div>

          <SubjectSearchSelect
            allowAll
            compact
            allLabel="Tất cả môn học"
            value={examSubjectFilter}
            onChange={(val) =>
              setExamSubjectFilter((val || 'all') as 'all' | SubjectId)
            }
            ariaLabel="Lọc bài thi theo môn học"
            currentUser={currentUser}
            className="w-48"
          />
        </div>

        {/* Enter Exam Code Form */}
        <form onSubmit={handleRoomSubmit} className="mt-5 space-y-2">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                aria-label="Nhập mã bài thi"
                value={roomCodeInput}
                onChange={(e) => {
                  setRoomCodeInput(e.target.value);
                  if (roomError) setRoomError(null);
                }}
                placeholder="Nhập mã bài thi trong lớp (VD: TOAN2025)"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pr-4 pl-10 font-mono text-sm text-slate-900 uppercase placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <span>Vào làm bài thi</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {roomError && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {roomError}
            </p>
          )}
        </form>

        {/* Exams strictly scoped to Joined Classes */}
        {joinedClassExams.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <BookOpen className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Chưa có bài thi nào trong các lớp học bạn đã tham gia.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Hãy tham gia lớp học của giáo viên ở mục Lớp học để nhận bài thi từ giáo viên.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {joinedClassExams.map((exam) => {
              const subjectMeta = getSubjectMeta(exam.subject);
              const cls = exam.privateClassId ? classMap.get(exam.privateClassId) : null;
              const totalQ =
                exam.part1QuestionIds.length +
                exam.part2QuestionIds.length +
                exam.part3QuestionIds.length;
              const maxRaw = calculateExamMaxRawScore(exam);
              const myAttempts = submissions.filter((s) => s.examId === exam.id).length;

              return (
                <article
                  key={exam.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {subjectMeta.name}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {cls
                            ? `Lớp ${derivePrivateClassCode(cls)}`
                            : EXAM_CATEGORY_LABELS[exam.category]}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                        {exam.roomCode}
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      {exam.title}
                    </h3>

                    {cls && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        Thuộc lớp: <strong className="text-slate-800 dark:text-slate-200">{cls.name}</strong>
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {getExamDurationMinutes(exam)} phút
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {totalQ} câu ({formatScoreVi(maxRaw)} điểm)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {myAttempts > 0 ? `Bạn đã nộp ${myAttempts} lần` : 'Chưa làm bài'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      {cls && (
                        <button
                          type="button"
                          onClick={() => handleEnterClassRoom(cls.id, 'exams')}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <DoorOpen className="h-3.5 w-3.5" />
                          <span>Vào lớp học</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenPrintableExam(exam)}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Đề A4</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectExamToStart(exam)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      <span>Làm bài thi</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MỤC 6: BẢNG ĐIỂM (Chỉ hiển thị bài chính user học sinh đã nộp)       */}
      {/* ===================================================================== */}
      <section
        id="portal-section-scores"
        className="scroll-mt-20 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
                Bảng điểm
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Chỉ hiển thị bảng điểm và lịch sử bài thi do chính tài khoản của bạn đã nộp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Đã nộp:{' '}
                <strong className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                  {scoreStats.count}
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Điểm TB:{' '}
                <strong className="font-mono text-blue-700 tabular-nums dark:text-blue-400">
                  {scoreStats.count > 0 ? formatScoreVi(scoreStats.avg) : '—'}
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Cao nhất:{' '}
                <strong className="font-mono text-emerald-700 tabular-nums dark:text-emerald-400">
                  {scoreStats.count > 0 ? formatScoreVi(scoreStats.best) : '—'}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('results')}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Xem chi tiết kết quả</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <th className="px-6 py-3">Kỳ thi</th>
                <th className="px-6 py-3">Môn học</th>
                <th className="px-6 py-3">Mã phòng · Đề</th>
                <th className="px-6 py-3 text-right">Phần I / II / III</th>
                <th className="px-6 py-3 text-right">Tổng điểm</th>
                <th className="px-6 py-3">Xếp loại</th>
                <th className="px-6 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {submissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                  >
                    Bạn chưa nộp bài thi nào. Hãy chọn một bài thi trong mục Bài thi để bắt đầu làm bài.
                  </td>
                </tr>
              ) : (
                submissions.slice(0, 8).map((sub) => {
                  const rank = classifyAcademicRankTT22(sub.totalScore);
                  return (
                    <tr
                      key={sub.id}
                      onClick={() => onViewSubmission(sub)}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="max-w-xs truncate px-6 py-3.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {sub.examTitle}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {getSubjectMeta(sub.subject).name}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                        {sub.roomCode} · {sub.variantCode}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                        {formatScoreVi(sub.part1Score)} / {formatScoreVi(sub.part2Score)} /{' '}
                        {formatScoreVi(sub.part3Score)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-sm font-bold text-blue-700 tabular-nums dark:text-blue-400">
                        {formatScoreVi(sub.totalScore)}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {rank.label}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400">
                          Xem phiếu
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeMaterial && (
        <MaterialReaderModal
          material={activeMaterial}
          onClose={() => setActiveMaterial(null)}
        />
      )}

      {activeAssignment && (
        <AssignmentPracticeModal
          assignment={activeAssignment}
          questions={assignmentPracticeQuestions}
          practiceAnswers={practiceAnswers}
          practiceSubmitted={practiceSubmitted}
          onSelectAnswer={(qid, optIdx) =>
            setPracticeAnswers((prev) => ({ ...prev, [qid]: optIdx }))
          }
          onSubmitPractice={() => {
            setPracticeSubmitted(true);
            if (!progress.completedAssignmentIds.includes(activeAssignment.id)) {
              toggleAssignmentCompleted(activeAssignment.id);
            }
          }}
          onClose={() => setActiveAssignment(null)}
        />
      )}
    </div>
  );
}

function MaterialReaderModal({
  material,
  onClose,
}: {
  material: ClassMaterial;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={material.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs dark:bg-slate-950/75"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              {getSubjectMeta(material.subject).name} · {material.category} · GV{' '}
              {material.ownerTeacherName}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {material.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Đóng tài liệu"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          {material.keyPoints.length > 0 && (
            <div>
              <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Điểm trọng tâm cần nắm
              </h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
                {material.keyPoints.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              Nội dung tài liệu
            </h4>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              {material.contentText}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => downloadClassMaterialTxt(material)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải về (.txt)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignmentPracticeModal({
  assignment,
  questions,
  practiceAnswers,
  practiceSubmitted,
  onSelectAnswer,
  onSubmitPractice,
  onClose,
}: {
  assignment: ClassAssignment;
  questions: Question[];
  practiceAnswers: Record<string, number>;
  practiceSubmitted: boolean;
  onSelectAnswer: (qid: string, optIdx: number) => void;
  onSubmitPractice: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={assignment.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs dark:bg-slate-950/75"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              {getSubjectMeta(assignment.subject).name} · GV {assignment.ownerTeacherName} ·
              Hạn {assignment.dueDateLabel}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              {assignment.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Đóng bài tập"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            {assignment.description}
          </p>

          {questions.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Hiện chưa có câu hỏi luyện tập tự động cho môn này trong ngân hàng câu hỏi.
            </p>
          ) : (
            questions.map((q, qIdx) => {
              const chosen = practiceAnswers[q.id];
              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Câu {qIdx + 1}. {q.prompt}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(q.options ?? []).map((opt, optIdx) => {
                      const isSelected = chosen === optIdx;
                      const isCorrect = q.correctOptionIndex === optIdx;
                      let style =
                        'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800';
                      if (practiceSubmitted) {
                        if (isCorrect) {
                          style =
                            'border-emerald-500 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200';
                        } else if (isSelected && !isCorrect) {
                          style =
                            'border-red-400 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300';
                        }
                      } else if (isSelected) {
                        style =
                          'border-blue-700 bg-blue-50 font-semibold text-blue-900 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200';
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={practiceSubmitted}
                          onClick={() => onSelectAnswer(q.id, optIdx)}
                          className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-xs transition-colors ${style}`}
                        >
                          <span className="mr-1.5 font-mono font-bold">
                            {OPTION_LETTERS[optIdx]}.
                          </span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {practiceSubmitted && q.explanation && (
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-slate-100">
                        Lời giải:
                      </strong>{' '}
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          {practiceSubmitted ? (
            <p className="text-xs font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
              Kết quả:{' '}
              {
                questions.filter(
                  (q) => practiceAnswers[q.id] === q.correctOptionIndex,
                ).length
              }
              /{questions.length} câu đúng
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chọn đáp án rồi bấm Kiểm tra bài tập.
            </p>
          )}

          <div className="flex items-center gap-2">
            {!practiceSubmitted && questions.length > 0 && (
              <button
                type="button"
                onClick={onSubmitPractice}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Kiểm tra &amp; Hoàn thành</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
