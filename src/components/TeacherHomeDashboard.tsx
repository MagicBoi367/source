import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  Copy,
  DoorOpen,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  KeyRound,
  Lock,
  LogIn,
  Plus,
  Printer,
  Search,
  Settings,
  Share2,
  Trash2,
  UserCheck,
  UserX,
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
  GradeLevel,
  ResourceShareGrant,
  SubjectId,
  TeacherPrivateClass,
  UserAccount,
} from '../types/exam';
import {
  calculateExamMaxRawScore,
  canManageResourceSharing,
  canTeacherEditResource,
  classifyAcademicRankTT22,
  EXAM_CATEGORY_LABELS,
  formatGradeLabel,
  formatScoreVi,
  generateClassCode5,
  getExamDurationMinutes,
  getSubjectMeta,
  getTeacherSharePermission,
  isAdminUser,
  isResourceOwner,
  isValidAllowedGrade,
  isValidClassCode5,
  MAX_CLASSES_PER_TEACHER,
  sanitizeClassCodeInput,
} from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import { AddSubjectModal } from './AddSubjectModal';
import { GradeInputControl } from './GradeInputControl';
import type { AppView } from './Header';
import { ResourceShareModal } from './ResourceShareModal';
import type { StudentHomeSectionId } from './StudentHomeDashboard';
import { SubjectSearchSelect } from './SubjectSearchSelect';
import { WeeklyCalendarSchedule } from './WeeklyCalendarSchedule';

interface TeacherHomeDashboardProps {
  currentUser: UserAccount | null;
  exams: Exam[];
  submissions: ExamSubmission[];
  privateClasses: TeacherPrivateClass[];
  allPrivateClasses: TeacherPrivateClass[];
  classJoinRequests: ClassJoinRequest[];
  classMaterials: ClassMaterial[];
  classAssignments: ClassAssignment[];
  classSchedules: ClassScheduleSlot[];
  onAddPrivateClass: (cls: TeacherPrivateClass) => { ok: boolean; error?: string } | void;
  onUpdatePrivateClass?: (cls: TeacherPrivateClass) => void;
  onDeletePrivateClass: (id: string) => void;
  onReviewJoinRequest: (requestId: string, decision: 'approved' | 'rejected') => void;
  onRemoveClassMember: (classId: string, studentUserId: string) => void;
  onAddClassMaterial: (material: ClassMaterial) => void;
  onUpdateClassMaterial?: (material: ClassMaterial) => void;
  onDeleteClassMaterial: (id: string) => void;
  onAddClassAssignment: (assignment: ClassAssignment) => void;
  onUpdateClassAssignment?: (assignment: ClassAssignment) => void;
  onDeleteClassAssignment: (id: string) => void;
  onAddScheduleSlot: (slot: ClassScheduleSlot) => void;
  onUpdateScheduleSlot: (slot: ClassScheduleSlot) => void;
  onDeleteScheduleSlot: (id: string) => void;
  onSelectExamToStart: (exam: Exam) => void;
  onOpenPrintableExam: (exam: Exam) => void;
  onNavigate: (view: AppView) => void;
  onViewSubmission: (sub: ExamSubmission) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  requestedSection?: { sectionId: StudentHomeSectionId; nonce: number } | null;
  onSectionActivated?: (sectionId: StudentHomeSectionId) => void;
  activeClassId?: string | null;
  onActiveClassChange?: (classId: string | null) => void;
  activeClassTab?: TeacherClassRoomTab | null;
  onActiveClassTabChange?: (tab: TeacherClassRoomTab | null) => void;
}

export type TeacherClassRoomTab =
  | 'students'
  | 'assignments'
  | 'exams'
  | 'scores'
  | 'schedule'
  | 'materials';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function suggestClassCode(
  grade: GradeLevel,
  subject: SubjectId,
  name = '',
  excludeCodes?: ReadonlySet<string>,
  previousCode?: string,
): string {
  return generateClassCode5({
    grade,
    subject,
    name,
    excludeCodes,
    previousCode,
  });
}

export function TeacherHomeDashboard({
  currentUser,
  exams,
  submissions,
  privateClasses,
  allPrivateClasses,
  classJoinRequests,
  classMaterials,
  classAssignments,
  classSchedules,
  onAddPrivateClass,
  onUpdatePrivateClass,
  onDeletePrivateClass,
  onReviewJoinRequest,
  onRemoveClassMember,
  onAddClassMaterial,
  onUpdateClassMaterial,
  onDeleteClassMaterial,
  onAddClassAssignment,
  onUpdateClassAssignment,
  onDeleteClassAssignment,
  onAddScheduleSlot,
  onUpdateScheduleSlot,
  onDeleteScheduleSlot,
  onSelectExamToStart,
  onOpenPrintableExam,
  onNavigate,
  onViewSubmission,
  onOpenAuth,
  requestedSection,
  activeClassId: controlledClassId,
  onActiveClassChange,
  activeClassTab: controlledClassTab,
  onActiveClassTabChange,
}: TeacherHomeDashboardProps) {
  useSubjects();
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [internalClassId, setInternalClassId] = useState<string | null>(null);
  const [internalClassTab, setInternalClassTab] =
    useState<TeacherClassRoomTab | null>(null);

  const activeClassId =
    controlledClassId !== undefined ? controlledClassId : internalClassId;
  const classRoomTab =
    controlledClassTab !== undefined ? controlledClassTab : internalClassTab;

  const setActiveClassId = (nextId: string | null) => {
    if (controlledClassId === undefined) {
      setInternalClassId(nextId);
    }
    onActiveClassChange?.(nextId);
  };

  const setClassRoomTab = (nextTab: TeacherClassRoomTab | null) => {
    if (controlledClassTab === undefined) {
      setInternalClassTab(nextTab);
    }
    onActiveClassTabChange?.(nextTab);
  };
  const [shareModalTarget, setShareModalTarget] = useState<
    | { kind: 'class'; item: TeacherPrivateClass }
    | { kind: 'material'; item: ClassMaterial }
    | { kind: 'assignment'; item: ClassAssignment }
    | null
  >(null);

  // Search teacher's classes
  const [classSearchInput, setClassSearchInput] = useState('');
  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);
  const [confirmStopShareClassId, setConfirmStopShareClassId] = useState<string | null>(null);

  // Create new class inline form state
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState(() => suggestClassCode(12, ''));
  const [newClassSubject, setNewClassSubject] = useState<SubjectId>('');
  const [newClassGrade, setNewClassGrade] = useState<GradeLevel>(12);
  const [newClassDesc, setNewClassDesc] = useState('');
  const [createClassError, setCreateClassError] = useState<string | null>(null);

  // Create Material form state (used inside class room)
  const [matTitle, setMatTitle] = useState('');
  const [matCategory, setMatCategory] = useState('Tài liệu ôn tập');
  const [matSummary, setMatSummary] = useState('');
  const [matKeyPoints, setMatKeyPoints] = useState('');
  const [matContent, setMatContent] = useState('');
  const [matError, setMatError] = useState<string | null>(null);
  const [activeMaterial, setActiveMaterial] = useState<ClassMaterial | null>(null);

  // Create Assignment form state (used inside class room)
  const [asgTitle, setAsgTitle] = useState('');
  const [asgDue, setAsgDue] = useState('Thứ 6 · 21:00');
  const [asgMinutes, setAsgMinutes] = useState(20);
  const [asgRoomCode, setAsgRoomCode] = useState('');
  const [asgDesc, setAsgDesc] = useState('');
  const [asgError, setAsgError] = useState<string | null>(null);

  const myClassIds = useMemo(
    () => new Set(privateClasses.map((pc) => pc.id)),
    [privateClasses],
  );

  const editableClasses = useMemo(
    () => privateClasses.filter((pc) => canTeacherEditResource(pc, currentUser)),
    [privateClasses, currentUser],
  );

  const editableClassIds = useMemo(
    () => new Set(editableClasses.map((pc) => pc.id)),
    [editableClasses],
  );

  const ownedClassesCount = useMemo(
    () => privateClasses.filter((pc) => isResourceOwner(pc, currentUser)).length,
    [privateClasses, currentUser],
  );

  const classMap = useMemo(
    () => new Map(privateClasses.map((pc) => [pc.id, pc])),
    [privateClasses],
  );

  const allClassCodesSet = useMemo(
    () => new Set(allPrivateClasses.map((pc) => derivePrivateClassCode(pc))),
    [allPrivateClasses],
  );

  const hasReachedClassLimit =
    !isAdminUser(currentUser) && ownedClassesCount >= MAX_CLASSES_PER_TEACHER;

  useEffect(() => {
    if (!createClassOpen) return;
    const hasName = newClassName.trim().length >= 2;
    const hasSubject = newClassSubject.trim().length > 0;
    const hasValidGrade = isValidAllowedGrade(newClassGrade);
    if (hasName && hasSubject && hasValidGrade) {
      setNewClassCode((prev) =>
        suggestClassCode(
          newClassGrade,
          newClassSubject,
          newClassName,
          allClassCodesSet,
          prev,
        ),
      );
    }
  }, [createClassOpen, newClassName, newClassSubject, newClassGrade, allClassCodesSet]);

  const myPendingJoinRequests = useMemo(
    () =>
      classJoinRequests.filter(
        (r) => editableClassIds.has(r.classId) && r.status === 'pending',
      ),
    [classJoinRequests, editableClassIds],
  );

  const myApprovedRequests = useMemo(
    () =>
      classJoinRequests.filter(
        (r) => myClassIds.has(r.classId) && r.status === 'approved',
      ),
    [classJoinRequests, myClassIds],
  );

  const filteredTeacherClasses = useMemo(() => {
    const q = normalizeSearchText(classSearchInput);
    if (!q) return privateClasses;
    return privateClasses.filter((pc) => {
      const code = normalizeSearchText(derivePrivateClassCode(pc));
      const name = normalizeSearchText(pc.name);
      return code.includes(q) || name.includes(q);
    });
  }, [classSearchInput, privateClasses]);

  const myClassSchedules = useMemo(
    () => classSchedules.filter((s) => myClassIds.has(s.classId)),
    [classSchedules, myClassIds],
  );

  useEffect(() => {
    if (!requestedSection) return;
    if (controlledClassId === undefined) {
      setInternalClassId(null);
    }
    onActiveClassChange?.(null);
    if (controlledClassTab === undefined) {
      setInternalClassTab(null);
    }
    onActiveClassTabChange?.(null);
    const timer = window.setTimeout(() => {
      const el = document.getElementById(
        `portal-section-${requestedSection.sectionId}`,
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedSection]);

  const handleCopyCode = (classId: string, code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedClassId(classId);
    window.setTimeout(() => {
      setCopiedClassId((prev) => (prev === classId ? null : prev));
    }, 2000);
  };

  const handleCreateClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setCreateClassError('Vui lòng đăng nhập tài khoản Giáo viên để tạo lớp học mới.');
      return;
    }
    if (!isAdminUser(currentUser) && ownedClassesCount >= MAX_CLASSES_PER_TEACHER) {
      setCreateClassError(
        `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học. Vui lòng xóa bớt lớp cũ nếu muốn tạo thêm.`,
      );
      return;
    }
    const cleanName = newClassName.trim();
    if (cleanName.length < 2) {
      setCreateClassError('Vui lòng nhập tên lớp học (tối thiểu 2 ký tự).');
      return;
    }
    const cleanCode = sanitizeClassCodeInput(newClassCode);
    if (!isValidClassCode5(cleanCode)) {
      setCreateClassError('Mã lớp phải gồm đúng 5 ký tự (3 chữ hoa A–Z và 2 số 0–9), VD: 4T9KA.');
      return;
    }
    if (allClassCodesSet.has(cleanCode)) {
      setCreateClassError(`Mã lớp "${cleanCode}" đã tồn tại. Vui lòng chọn mã khác.`);
      return;
    }
    if (!newClassSubject.trim()) {
      setCreateClassError('Vui lòng tìm kiếm và chọn môn học cho lớp.');
      return;
    }

    const created: TeacherPrivateClass = {
      id: `pclass_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      classCode: cleanCode,
      name: cleanName,
      subject: newClassSubject,
      grade: newClassGrade,
      description: newClassDesc.trim() || undefined,
      ownerTeacherId: currentUser.id,
      ownerTeacherName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    };
    const result = onAddPrivateClass(created);
    if (result && !result.ok) {
      setCreateClassError(
        result.error ??
          `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học.`,
      );
      return;
    }
    setNewClassName('');
    setNewClassDesc('');
    setNewClassSubject('');
    setNewClassCode(suggestClassCode(newClassGrade, '', '', allClassCodesSet));
    setCreateClassError(null);
    setCreateClassOpen(false);
  };

  const handleCreateMaterialSubmit = (e: React.FormEvent, targetClassId: string) => {
    e.preventDefault();
    if (!currentUser) {
      setMatError('Vui lòng đăng nhập tài khoản Giáo viên để gửi tài liệu.');
      return;
    }
    const targetCls = classMap.get(targetClassId);
    if (!targetCls) {
      setMatError('Không tìm thấy lớp học nhận tài liệu.');
      return;
    }
    if (!canTeacherEditResource(targetCls, currentUser)) {
      setMatError('Bạn chỉ có quyền xem lớp học này nên không thể đăng tài liệu.');
      return;
    }
    if (!matTitle.trim()) {
      setMatError('Vui lòng nhập tiêu đề tài liệu.');
      return;
    }
    const lines = matKeyPoints
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    onAddClassMaterial({
      id: `cmat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      classId: targetCls.id,
      title: matTitle.trim(),
      subject: targetCls.subject ?? currentUser.subject ?? 'toan',
      grade: targetCls.grade,
      category: matCategory.trim() || 'Tài liệu ôn tập',
      summary:
        matSummary.trim() ||
        `Tài liệu do ${currentUser.fullName} gửi cho lớp ${targetCls.name}.`,
      keyPoints: lines,
      contentText:
        matContent.trim() ||
        `${matTitle.trim().toUpperCase()}\nGiáo viên: ${currentUser.fullName}\nLớp: ${targetCls.name}\n\n${matSummary.trim()}`,
      ownerTeacherId: currentUser.id,
      ownerTeacherName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    });
    setMatTitle('');
    setMatSummary('');
    setMatKeyPoints('');
    setMatContent('');
    setMatError(null);
  };

  const handleCreateAssignmentSubmit = (e: React.FormEvent, targetClassId: string) => {
    e.preventDefault();
    if (!currentUser) {
      setAsgError('Vui lòng đăng nhập tài khoản Giáo viên để giao bài tập.');
      return;
    }
    const targetCls = classMap.get(targetClassId);
    if (!targetCls) {
      setAsgError('Không tìm thấy lớp học nhận bài tập.');
      return;
    }
    if (!canTeacherEditResource(targetCls, currentUser)) {
      setAsgError('Bạn chỉ có quyền xem lớp học này nên không thể giao bài tập.');
      return;
    }
    if (!asgTitle.trim()) {
      setAsgError('Vui lòng nhập tiêu đề bài tập.');
      return;
    }
    onAddClassAssignment({
      id: `casg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      classId: targetCls.id,
      title: asgTitle.trim(),
      subject: targetCls.subject ?? currentUser.subject ?? 'toan',
      grade: targetCls.grade,
      description:
        asgDesc.trim() ||
        `Hoàn thành bài tập ôn luyện cho lớp ${targetCls.name} trước thời hạn.`,
      dueDateLabel: asgDue.trim() || 'Cuối tuần · 21:00',
      estimatedMinutes: Math.max(5, Number(asgMinutes) || 20),
      relatedRoomCode: asgRoomCode.trim().toUpperCase() || undefined,
      ownerTeacherId: currentUser.id,
      ownerTeacherName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    });
    setAsgTitle('');
    setAsgDesc('');
    setAsgRoomCode('');
    setAsgError(null);
  };

  // ---------------------------------------------------------------------------
  // TEACHER CLASS ROOM WORKSPACE ("Trang lớp học" khi giáo viên bấm "Vào lớp học")
  // ---------------------------------------------------------------------------
  const activeClassObj = activeClassId ? classMap.get(activeClassId) ?? null : null;

  const activeClassPendingRequests = useMemo(() => {
    if (!activeClassObj) return [];
    return classJoinRequests.filter(
      (r) => r.classId === activeClassObj.id && r.status === 'pending',
    );
  }, [activeClassObj, classJoinRequests]);

  const activeClassApprovedStudents = useMemo(() => {
    if (!activeClassObj) return [];
    return classJoinRequests.filter(
      (r) => r.classId === activeClassObj.id && r.status === 'approved',
    );
  }, [activeClassObj, classJoinRequests]);

  const activeClassExams = useMemo(() => {
    if (!activeClassObj) return [];
    return exams.filter((ex) => ex.privateClassId === activeClassObj.id);
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

  const activeClassSubmissions = useMemo(() => {
    if (!activeClassObj) return [];
    const examIds = new Set(activeClassExams.map((ex) => ex.id));
    const roomCodes = new Set([
      ...activeClassExams.map((ex) => ex.roomCode.trim().toUpperCase()),
      ...activeClassAssignments
        .map((a) => (a.relatedRoomCode ?? '').trim().toUpperCase())
        .filter(Boolean),
    ]);
    const approvedStudentIds = new Set(
      activeClassApprovedStudents.map((s) => s.studentUserId),
    );
    return submissions.filter((sub) => {
      if (examIds.has(sub.examId)) return true;
      if (roomCodes.has(sub.roomCode.trim().toUpperCase())) return true;
      if (
        sub.submittedByUserId &&
        approvedStudentIds.has(sub.submittedByUserId) &&
        (!activeClassObj.subject || sub.subject === activeClassObj.subject)
      ) {
        return true;
      }
      return false;
    });
  }, [
    activeClassApprovedStudents,
    activeClassAssignments,
    activeClassExams,
    activeClassObj,
    submissions,
  ]);

  const activeClassScoreStats = useMemo(() => {
    if (activeClassSubmissions.length === 0) return { count: 0, avg: 0, best: 0 };
    const sum = activeClassSubmissions.reduce((acc, s) => acc + s.totalScore, 0);
    const best = Math.max(...activeClassSubmissions.map((s) => s.totalScore));
    return {
      count: activeClassSubmissions.length,
      avg: sum / activeClassSubmissions.length,
      best,
    };
  }, [activeClassSubmissions]);

  const handleSaveShareGrants = (nextSharedWith: ResourceShareGrant[]) => {
    if (!shareModalTarget) return;
    if (shareModalTarget.kind === 'class') {
      onUpdatePrivateClass?.({
        ...shareModalTarget.item,
        sharedWith: nextSharedWith,
      });
    } else if (shareModalTarget.kind === 'material') {
      onUpdateClassMaterial?.({
        ...shareModalTarget.item,
        sharedWith: nextSharedWith,
      });
    } else if (shareModalTarget.kind === 'assignment') {
      onUpdateClassAssignment?.({
        ...shareModalTarget.item,
        sharedWith: nextSharedWith,
      });
    }
  };

  const handleStopShareClass = (pc: TeacherPrivateClass, mode: 'self' | 'all') => {
    if (!onUpdatePrivateClass) return;
    if (mode === 'all') {
      onUpdatePrivateClass({
        ...pc,
        sharedWith: [],
      });
    } else if (currentUser) {
      onUpdatePrivateClass({
        ...pc,
        sharedWith: (pc.sharedWith ?? []).filter((g) => g.teacherId !== currentUser.id),
      });
      if (activeClassId === pc.id) {
        setActiveClassId(null);
        setClassRoomTab(null);
      }
    }
    setConfirmStopShareClassId(null);
  };

  const shareModalNode = (
    <ResourceShareModal
      open={Boolean(shareModalTarget)}
      onClose={() => setShareModalTarget(null)}
      resourceTypeLabel={
        shareModalTarget?.kind === 'class'
          ? 'lớp học'
          : shareModalTarget?.kind === 'material'
            ? 'tài liệu'
            : 'bài tập'
      }
      resourceTitle={
        shareModalTarget
          ? shareModalTarget.kind === 'class'
            ? shareModalTarget.item.name
            : shareModalTarget.item.title
          : ''
      }
      ownerTeacherId={shareModalTarget?.item.ownerTeacherId}
      ownerTeacherName={shareModalTarget?.item.ownerTeacherName}
      sharedWith={shareModalTarget?.item.sharedWith}
      currentUser={currentUser}
      onSaveShares={handleSaveShareGrants}
    />
  );

  if (activeClassObj) {
    const classCode = derivePrivateClassCode(activeClassObj);
    const subjectName = getSubjectMeta(activeClassObj.subject ?? 'toan').name;
    const canEditActiveClass = canTeacherEditResource(activeClassObj, currentUser);
    const canShareActiveClass = canManageResourceSharing(activeClassObj, currentUser);
    const activeClassSharePerm = getTeacherSharePermission(activeClassObj, currentUser);
    const activeClassShareCount = activeClassObj.sharedWith?.length ?? 0;
    const approvalEnabled = activeClassObj.requireApproval !== false;

    return (
      <div className="space-y-6">
        {/* Top Classroom Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveClassId(null);
                setClassRoomTab(null);
              }}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại Lớp học</span>
            </button>
            <nav
              aria-label="Vị trí lớp học"
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
            >
              <span>Trang chủ</span>
              <span aria-hidden="true">/</span>
              <span>Lớp học</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {activeClassObj.name}
              </span>
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canShareActiveClass && onUpdatePrivateClass && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setShareModalTarget({ kind: 'class', item: activeClassObj })
                  }
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>
                    Chia sẻ lớp{activeClassShareCount > 0 ? ` (${activeClassShareCount})` : ''}
                  </span>
                </button>
                {activeClassShareCount > 0 &&
                  (confirmStopShareClassId === activeClassObj.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStopShareClass(activeClassObj, 'all')}
                        className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Xác nhận dừng chia sẻ
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmStopShareClassId(null)}
                        className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmStopShareClassId(activeClassObj.id)}
                      className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Dừng chia sẻ</span>
                    </button>
                  ))}
              </>
            )}

            {!isResourceOwner(activeClassObj, currentUser) &&
              !isAdminUser(currentUser) &&
              activeClassSharePerm &&
              onUpdatePrivateClass &&
              (confirmStopShareClassId === activeClassObj.id ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStopShareClass(activeClassObj, 'self')}
                    className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Xác nhận dừng chia sẻ
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStopShareClassId(null)}
                    className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmStopShareClassId(activeClassObj.id)}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <UserX className="h-3.5 w-3.5" />
                  <span>Dừng chia sẻ</span>
                </button>
              ))}

            <button
              type="button"
              onClick={() => handleCopyCode(activeClassObj.id, classCode)}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2 font-mono text-xs font-bold text-blue-700 hover:bg-blue-100 tabular-nums dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>
                {copiedClassId === activeClassObj.id
                  ? `Đã sao chép: ${classCode}`
                  : `Sao chép mã lớp: ${classCode}`}
              </span>
            </button>
          </div>
        </div>

        {/* Class Information Panel */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold tracking-wide text-[#0057FF] uppercase dark:text-[#22D3EE]">
                  Thông tin lớp học
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {subjectName}
                </span>
                <span aria-hidden="true">·</span>
                <span>{formatGradeLabel(activeClassObj.grade)}</span>
                <span aria-hidden="true">·</span>
                {isResourceOwner(activeClassObj, currentUser) || isAdminUser(currentUser) ? (
                  <span className="inline-flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
                    {activeClassShareCount > 0 ? (
                      <>
                        <Share2 className="h-3 w-3 text-[#0057FF] dark:text-[#22D3EE]" />
                        <span className="text-[#0057FF] dark:text-[#22D3EE]">
                          Đã chia sẻ ({activeClassShareCount} GV)
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" />
                        <span>Riêng tư</span>
                      </>
                    )}
                  </span>
                ) : activeClassSharePerm ? (
                  <span className="inline-flex items-center gap-1 font-medium text-cyan-700 dark:text-cyan-300">
                    <Share2 className="h-3 w-3" />
                    <span>
                      Chia sẻ bởi {activeClassObj.ownerTeacherName} (
                      {activeClassSharePerm === 'edit' ? 'Được sửa' : 'Chỉ xem'})
                    </span>
                  </span>
                ) : null}
              </div>

              <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                Tạo ngày{' '}
                {new Date(activeClassObj.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </div>

            <h1 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-[#061844] dark:text-slate-50">
              {activeClassObj.name}
            </h1>

            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {activeClassObj.description?.trim() ||
                'Không gian lớp học trực tuyến để quản lý thành viên, giao bài tập, tổ chức bài thi, theo dõi kết quả thi và cập nhật lịch học.'}
            </p>

            {/* Structured Class Metadata Grid (single-elevation hairline grid) */}
            <dl className="mt-5 grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/50 sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="px-4 py-3">
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  Mã tham gia lớp
                </dt>
                <dd className="mt-1 font-mono text-base font-bold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                  {classCode}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  Giáo viên phụ trách
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {activeClassObj.ownerTeacherName || currentUser?.fullName || 'Giáo viên'}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  Môn · Khối / Bậc học
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {subjectName} · {formatGradeLabel(activeClassObj.grade)}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  Sĩ số lớp
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  {activeClassApprovedStudents.length} thành viên
                  {activeClassPendingRequests.length > 0 && (
                    <span className="ml-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      ({activeClassPendingRequests.length} chờ)
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            {!canEditActiveClass && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50/70 px-3.5 py-2 text-xs text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-200">
                <Eye className="h-4 w-4 shrink-0" />
                <span>
                  Lớp học được chia sẻ ở chế độ <strong>Chỉ xem</strong>. Bạn có thể xem học sinh, đề thi, tài liệu và bảng điểm nhưng không thể thêm, sửa hoặc xóa nội dung.
                </span>
              </div>
            )}
          </div>
        </section>

        {classRoomTab === null && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Chọn một mục trên thanh menu để hiển thị nội dung lớp học
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Hãy nhấn vào <strong className="font-semibold text-slate-700 dark:text-slate-300">Thành viên</strong>,{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Bài tập</strong>,{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Bài thi</strong>,{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Kết quả thi</strong> hoặc{' '}
              <strong className="font-semibold text-slate-700 dark:text-slate-300">Lịch học</strong> trên thanh menu bên phải để xem chi tiết bên dưới.
            </p>
          </div>
        )}

        {/* Tab 1: Students & Approval */}
        {classRoomTab === 'students' && (
          <div className="space-y-6">
            <section
              className={`rounded-xl border p-6 transition-colors ${
                approvalEnabled
                  ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20'
                  : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/70'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                    Yêu cầu xin vào lớp chờ duyệt ({activeClassPendingRequests.length})
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {approvalEnabled ? (
                      <>
                        Học sinh đã nhập đúng mã lớp <strong className="font-mono">{classCode}</strong>. Chỉ khi bạn bấm Duyệt, học sinh mới vào được lớp và xem bài thi/tài liệu.
                      </>
                    ) : (
                      <>
                        Đang tắt phê duyệt: Học sinh nhập đúng mã lớp <strong className="font-mono">{classCode}</strong> sẽ tự động vào lớp ngay mà không cần chờ duyệt.
                      </>
                    )}
                  </p>
                </div>

                {canEditActiveClass && onUpdatePrivateClass ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={approvalEnabled}
                    onClick={() =>
                      onUpdatePrivateClass({
                        ...activeClassObj,
                        requireApproval: !approvalEnabled,
                      })
                    }
                    className="inline-flex cursor-pointer items-center gap-2.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <span
                      aria-hidden="true"
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        approvalEnabled
                          ? 'bg-[#0057FF]'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                          approvalEnabled ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </span>
                    <span>
                      {approvalEnabled ? 'Phê duyệt: Đang bật' : 'Phê duyệt: Đang tắt'}
                    </span>
                  </button>
                ) : (
                  <span className="whitespace-nowrap shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {approvalEnabled ? 'Phê duyệt: Đang bật' : 'Phê duyệt: Đang tắt'}
                  </span>
                )}
              </div>

              {activeClassPendingRequests.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  {approvalEnabled
                    ? 'Hiện không có yêu cầu xin vào lớp nào đang chờ duyệt.'
                    : 'Chế độ phê duyệt đang tắt — học sinh nhập đúng mã lớp sẽ tự động tham gia danh sách thành viên bên dưới.'}
                </p>
              ) : (
                <div className="mt-4 divide-y divide-amber-200/70 rounded-xl border border-amber-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                  {activeClassPendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {req.studentName}
                          {req.studentClass ? (
                            <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                              Lớp {req.studentClass}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {/^(HV|GV|AD)\d{4}$/.test(req.studentUserId) ? `ID ${req.studentUserId} · ` : ''}
                          {req.studentSbd ? `SBD ${req.studentSbd} · ` : ''}
                          {req.studentEmail ?? 'Tài khoản học sinh'}
                        </p>
                      </div>
                      {canEditActiveClass && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onReviewJoinRequest(req.id, 'approved')}
                            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Duyệt vào lớp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onReviewJoinRequest(req.id, 'rejected')}
                            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            <span>Từ chối</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                Danh sách học sinh đã duyệt ({activeClassApprovedStudents.length})
              </h2>

              {activeClassApprovedStudents.length === 0 ? (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Chưa có học sinh nào được duyệt vào lớp này. Hãy chia sẻ mã lớp{' '}
                  <strong className="font-mono text-blue-700 dark:text-blue-400">
                    {classCode}
                  </strong>{' '}
                  cho học sinh của bạn.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                        <th className="px-4 py-2.5">Học sinh</th>
                        <th className="px-4 py-2.5">SBD / Lớp</th>
                        <th className="px-4 py-2.5">Email</th>
                        {canEditActiveClass && (
                          <th className="px-4 py-2.5 text-right">Thao tác</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeClassApprovedStudents.map((stu) => (
                        <tr key={stu.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                            {stu.studentName}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">
                            {/^(HV|GV|AD)\d{4}$/.test(stu.studentUserId) ? `ID ${stu.studentUserId} · ` : ''}
                            {stu.studentSbd ?? '—'} {stu.studentClass ? `· ${stu.studentClass}` : ''}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {stu.studentEmail ?? '—'}
                          </td>
                          {canEditActiveClass && (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  onRemoveClassMember(activeClassObj.id, stu.studentUserId)
                                }
                                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="h-3 w-3" />
                                <span>Mời rời lớp</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Tab 2: Exams */}
        {classRoomTab === 'exams' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                    Bài thi trong lớp {activeClassObj.name}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tạo hoặc gán đề thi vào lớp trong Tổ chức đề thi để học sinh được duyệt làm bài.
                </p>
              </div>
              {canEditActiveClass && (
                <button
                  type="button"
                  onClick={() => onNavigate('exam_manager')}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tổ chức đề thi</span>
                </button>
              )}
            </div>

            {activeClassExams.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Chưa có bài thi nào được gắn vào lớp học này.
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
                  const subCount = submissions.filter((s) => s.examId === exam.id).length;
                  return (
                    <article
                      key={exam.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{EXAM_CATEGORY_LABELS[exam.category]}</span>
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            Mã phòng: {exam.roomCode}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                          {exam.title}
                        </h3>
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {getExamDurationMinutes(exam)} phút
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {totalQ} câu ({formatScoreVi(maxRaw)} điểm)
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{subCount} bài nộp</span>
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenPrintableExam(exam)}
                            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Đề A4</span>
                          </button>
                          {canTeacherEditResource(
                            exam,
                            currentUser,
                            editableClassIds,
                            exam.privateClassId,
                          ) && (
                            <button
                              type="button"
                              onClick={() => onNavigate('exam_manager')}
                              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <Settings className="h-3.5 w-3.5" />
                              <span>Cấu hình</span>
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectExamToStart(exam)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          <span>Thi thử</span>
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

        {/* Tab 3: Materials */}
        {classRoomTab === 'materials' && (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                Tài liệu lớp {activeClassObj.name}
              </h2>
            </div>
            {canEditActiveClass && (
              <form
                onSubmit={(e) => handleCreateMaterialSubmit(e, activeClassObj.id)}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  + Gửi tài liệu mới vào lớp
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={matTitle}
                    onChange={(e) => setMatTitle(e.target.value)}
                    placeholder="Tiêu đề tài liệu..."
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                    placeholder="Phân loại (VD: Tài liệu ôn tập)"
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <textarea
                  rows={2}
                  value={matSummary}
                  onChange={(e) => setMatSummary(e.target.value)}
                  placeholder="Tóm tắt nội dung chính..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <textarea
                  rows={3}
                  value={matContent}
                  onChange={(e) => setMatContent(e.target.value)}
                  placeholder="Nội dung chi tiết / công thức (học sinh có thể đọc nhanh hoặc tải .txt)..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {matError && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    {matError}
                  </p>
                )}
                <button
                  type="submit"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Đăng tài liệu vào lớp</span>
                </button>
              </form>
            )}

            {activeClassMaterials.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chưa có tài liệu nào trong lớp học này.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassMaterials.map((mat) => {
                  const canShareMat = canManageResourceSharing(mat, currentUser);
                  const canDeleteMat = canTeacherEditResource(
                    mat,
                    currentUser,
                    editableClassIds,
                    mat.classId,
                  );
                  const matShareCount = mat.sharedWith?.length ?? 0;
                  return (
                    <div key={mat.id} className="py-4 first:pt-1 last:pb-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{mat.category}</span>
                        {(isResourceOwner(mat, currentUser) || isAdminUser(currentUser)) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              {matShareCount > 0 ? (
                                <>
                                  <Share2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                  <span className="text-blue-700 dark:text-blue-300">
                                    Đã chia sẻ ({matShareCount} GV)
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3 w-3" />
                                  <span>Riêng tư</span>
                                </>
                              )}
                            </span>
                          </>
                        )}
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
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Xem nội dung</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadClassMaterialTxt(mat)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Tải .txt</span>
                        </button>
                        {canShareMat && onUpdateClassMaterial && (
                          <button
                            type="button"
                            onClick={() =>
                              setShareModalTarget({ kind: 'material', item: mat })
                            }
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>Chia sẻ</span>
                          </button>
                        )}
                        {canDeleteMat && (
                          <button
                            type="button"
                            onClick={() => onDeleteClassMaterial(mat.id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Tab 4: Assignments */}
        {classRoomTab === 'assignments' && (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                Bài tập lớp {activeClassObj.name}
              </h2>
            </div>
            {canEditActiveClass && (
              <form
                onSubmit={(e) => handleCreateAssignmentSubmit(e, activeClassObj.id)}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50"
              >
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  + Giao bài tập mới cho lớp
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input
                    type="text"
                    value={asgTitle}
                    onChange={(e) => setAsgTitle(e.target.value)}
                    placeholder="Tên bài tập..."
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 sm:col-span-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={asgDue}
                    onChange={(e) => setAsgDue(e.target.value)}
                    placeholder="Hạn nộp (VD: Thứ 6 · 21:00)"
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={asgMinutes}
                    onChange={(e) => setAsgMinutes(Number(e.target.value))}
                    placeholder="Số phút dự kiến"
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <textarea
                  rows={2}
                  value={asgDesc}
                  onChange={(e) => setAsgDesc(e.target.value)}
                  placeholder="Mô tả yêu cầu bài tập..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {asgError && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    {asgError}
                  </p>
                )}
                <button
                  type="submit"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Giao bài tập</span>
                </button>
              </form>
            )}

            {activeClassAssignments.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chưa có bài tập nào trong lớp học này.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeClassAssignments.map((asg) => {
                  const canShareAsg = canManageResourceSharing(asg, currentUser);
                  const canDeleteAsg = canTeacherEditResource(
                    asg,
                    currentUser,
                    editableClassIds,
                    asg.classId,
                  );
                  return (
                    <div
                      key={asg.id}
                      className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-1 last:pb-1"
                    >
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Hạn: {asg.dueDateLabel} · ~{asg.estimatedMinutes} phút
                        </p>
                        <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                          {asg.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {asg.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canShareAsg && onUpdateClassAssignment && (
                          <button
                            type="button"
                            onClick={() =>
                              setShareModalTarget({ kind: 'assignment', item: asg })
                            }
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>Chia sẻ</span>
                          </button>
                        )}
                        {canDeleteAsg && (
                          <button
                            type="button"
                            onClick={() => onDeleteClassAssignment(asg.id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Tab 5: Schedule */}
        {classRoomTab === 'schedule' && (
          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-1 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Lịch học của lớp {activeClassObj.name}
            </h2>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Nhấn &ldquo;+ Thêm lịch&rdquo; ở từng ngày để cập nhật thời khóa biểu; học sinh đã duyệt vào lớp sẽ xem ở chế độ chỉ đọc.
            </p>
            <WeeklyCalendarSchedule
              slots={activeClassSchedules}
              classes={[activeClassObj]}
              canEdit={canEditActiveClass}
              currentUser={currentUser}
              onAddSlot={onAddScheduleSlot}
              onUpdateSlot={onUpdateScheduleSlot}
              onDeleteSlot={onDeleteScheduleSlot}
              emptyNotice="Lớp học này chưa có lịch học tuần. Nhấn '+ Thêm lịch' để tạo."
            />
          </section>
        )}

        {/* Tab 6: Scores */}
        {classRoomTab === 'scores' && (
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                    Bảng điểm lớp {activeClassObj.name}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tổng hợp bài làm thí sinh đã nộp trong lớp học theo cấu trúc 3 phần 2025.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Bài nộp:{' '}
                    <strong className="font-mono text-slate-900 tabular-nums dark:text-slate-100">
                      {activeClassScoreStats.count}
                    </strong>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Điểm TB:{' '}
                    <strong className="font-mono text-blue-700 tabular-nums dark:text-blue-400">
                      {activeClassScoreStats.count > 0
                        ? formatScoreVi(activeClassScoreStats.avg)
                        : '—'}
                    </strong>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Cao nhất:{' '}
                    <strong className="font-mono text-emerald-700 tabular-nums dark:text-emerald-400">
                      {activeClassScoreStats.count > 0
                        ? formatScoreVi(activeClassScoreStats.best)
                        : '—'}
                    </strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('results')}
                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Xem toàn bộ bảng điểm</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                    <th className="px-6 py-3">SBD</th>
                    <th className="px-6 py-3">Thí sinh</th>
                    <th className="px-6 py-3">Kỳ thi</th>
                    <th className="px-6 py-3">Mã đề</th>
                    <th className="px-6 py-3 text-right">Phần I / II / III</th>
                    <th className="px-6 py-3 text-right">Tổng điểm</th>
                    <th className="px-6 py-3">Xếp loại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeClassSubmissions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                      >
                        Chưa có bài thi nào được nộp trong lớp học này.
                      </td>
                    </tr>
                  ) : (
                    activeClassSubmissions.map((sub) => {
                      const rank = classifyAcademicRankTT22(sub.totalScore);
                      return (
                        <tr
                          key={sub.id}
                          onClick={() => onViewSubmission(sub)}
                          className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-6 py-3.5 font-mono text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                            {sub.studentSbd}
                          </td>
                          <td className="px-6 py-3.5 text-xs">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {sub.studentName}
                            </span>
                            <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                              ({sub.studentClass})
                            </span>
                          </td>
                          <td className="max-w-xs truncate px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                            {sub.examTitle}
                          </td>
                          <td className="px-6 py-3.5 font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                            {sub.variantCode}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                            {formatScoreVi(sub.part1Score)} /{' '}
                            {formatScoreVi(sub.part2Score)} /{' '}
                            {formatScoreVi(sub.part3Score)}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono text-sm font-bold text-blue-700 tabular-nums dark:text-blue-400">
                            {formatScoreVi(sub.totalScore)}
                          </td>
                          <td className="px-6 py-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {rank.label}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeMaterial && (
          <TeacherMaterialReaderModal
            material={activeMaterial}
            onClose={() => setActiveMaterial(null)}
          />
        )}
        {shareModalNode}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===================================================================== */}
      {/* MỤC 1: LỚP HỌC (Tạo lớp học mới + Duyệt yêu cầu vào lớp bằng mã lớp) */}
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
              Tạo lớp học mới kèm mã lớp riêng. Học sinh chỉ vào được khi nhập đúng mã lớp và được bạn duyệt trực tiếp tại đây.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
              {ownedClassesCount}/{MAX_CLASSES_PER_TEACHER} lớp · {myApprovedRequests.length} học sinh
            </p>
            {currentUser ? (
              <button
                type="button"
                disabled={hasReachedClassLimit && !createClassOpen}
                title={
                  hasReachedClassLimit && !createClassOpen
                    ? `Mỗi tài khoản giáo viên chỉ được tạo tối đa ${MAX_CLASSES_PER_TEACHER} lớp học`
                    : undefined
                }
                onClick={() => {
                  setCreateClassOpen((v) => !v);
                  setCreateClassError(null);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
              >
                <Plus className="h-4 w-4" />
                <span>
                  {createClassOpen
                    ? 'Đóng biểu mẫu'
                    : hasReachedClassLimit
                      ? `Đã đạt giới hạn ${MAX_CLASSES_PER_TEACHER}/${MAX_CLASSES_PER_TEACHER} lớp`
                      : 'Tạo lớp học mới'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <LogIn className="h-4 w-4" />
                <span>Đăng nhập Giáo viên để tạo lớp</span>
              </button>
            )}
          </div>
        </div>

        {currentUser && hasReachedClassLimit && (
          <div
            role="status"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
          >
            Tài khoản giáo viên của bạn đã đạt giới hạn tối đa{' '}
            <strong className="font-semibold">
              {MAX_CLASSES_PER_TEACHER}/{MAX_CLASSES_PER_TEACHER} lớp học
            </strong>
            . Hãy xóa bớt lớp không còn sử dụng nếu bạn muốn tạo lớp mới.
          </div>
        )}

        {/* Form Tạo lớp học mới */}
        {createClassOpen && currentUser && !hasReachedClassLimit && (
          <form
            onSubmit={handleCreateClassSubmit}
            className="mt-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-5 dark:border-blue-900/60 dark:bg-blue-950/20"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Tạo lớp học mới của giáo viên ({currentUser.fullName})
              </h3>
              <button
                type="button"
                onClick={() => setCreateClassOpen(false)}
                className="cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tên lớp học *
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => {
                    setNewClassName(e.target.value);
                    if (createClassError) setCreateClassError(null);
                  }}
                  placeholder="VD: Toán 12A2 — Luyện đề THPT 2025"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mã lớp * (3 chữ hoa + 2 số)
                </label>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="text"
                    maxLength={5}
                    value={newClassCode}
                    onChange={(e) => {
                      setNewClassCode(sanitizeClassCodeInput(e.target.value));
                      if (createClassError) setCreateClassError(null);
                    }}
                    placeholder="VD: 4T9KA"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs font-bold tracking-wider text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    title="Tạo mã lớp mới (trộn 3 chữ hoa + 2 số)"
                    onClick={() =>
                      setNewClassCode((prev) =>
                        suggestClassCode(
                          newClassGrade,
                          newClassSubject,
                          newClassName,
                          allClassCodesSet,
                          prev,
                        ),
                      )
                    }
                    className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Đổi mã
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Môn học
                  </label>
                  <SubjectSearchSelect
                    value={newClassSubject}
                    onChange={(nextSubj) => {
                      setNewClassSubject(nextSubj);
                      if (createClassError) setCreateClassError(null);
                    }}
                    placeholder="Tìm tên môn..."
                    ariaLabel="Tìm kiếm và chọn môn học cho lớp"
                    currentUser={currentUser}
                    onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Khối / Bậc học
                  </label>
                  <GradeInputControl
                    value={newClassGrade}
                    onChange={(nextGrade) => setNewClassGrade(nextGrade)}
                    ariaLabel="Chọn hoặc nhập khối từ 1 đến 12, Đại học hoặc Cao đẳng"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mô tả lớp học (tùy chọn)
              </label>
              <input
                type="text"
                value={newClassDesc}
                onChange={(e) => setNewClassDesc(e.target.value)}
                placeholder="VD: Lớp ôn thi TN THPT theo cấu trúc 3 dạng thức 2025..."
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {createClassError && (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {createClassError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateClassOpen(false)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Lưu &amp; Mở lớp học</span>
              </button>
            </div>
          </form>
        )}

        {/* Hàng đợi duyệt học sinh vào lớp */}
        {myPendingJoinRequests.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Yêu cầu học sinh xin vào lớp chờ bạn duyệt ({myPendingJoinRequests.length})
              </p>
              <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                Học sinh đã nhập đúng mã lớp
              </span>
            </div>

            <div className="mt-3 divide-y divide-amber-200/70 rounded-xl border border-amber-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {myPendingJoinRequests.map((req) => {
                const cls = classMap.get(req.classId);
                return (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {req.studentName}{' '}
                        {req.studentClass ? (
                          <span className="font-normal text-slate-500 dark:text-slate-400">
                            · Lớp {req.studentClass}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                        Xin vào:{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                          {cls?.name ?? req.classCode}
                        </strong>{' '}
                        <span className="font-mono text-blue-700 dark:text-blue-400">
                          ({req.classCode})
                        </span>
                        {req.studentSbd ? ` · SBD ${req.studentSbd}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onReviewJoinRequest(req.id, 'approved')}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Duyệt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onReviewJoinRequest(req.id, 'rejected')}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        <span>Từ chối</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Thanh tìm kiếm lớp học của giáo viên */}
        {privateClasses.length > 0 && (
          <div className="mt-5 relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              aria-label="Tìm lớp học của bạn theo tên hoặc mã lớp"
              value={classSearchInput}
              onChange={(e) => setClassSearchInput(e.target.value)}
              placeholder="Lọc lớp học của bạn theo tên lớp hoặc mã lớp..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-9 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {classSearchInput && (
              <button
                type="button"
                aria-label="Xóa từ khóa lọc lớp"
                onClick={() => setClassSearchInput('')}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Danh sách lớp học giáo viên đang quản lý */}
        {filteredTeacherClasses.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <Users className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {currentUser
                ? 'Bạn chưa có lớp học nào khớp bộ lọc.'
                : 'Đăng nhập tài khoản Giáo viên để tạo và quản lý lớp học.'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {currentUser
                ? 'Nhấn "Tạo lớp học mới" ở góc trên để tạo lớp và nhận mã lớp cấp cho học sinh.'
                : 'Tài khoản giáo viên mẫu: giaovien@kythi2025.edu.vn / 123456.'}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredTeacherClasses.map((pc) => {
              const code = derivePrivateClassCode(pc);
              const subjectName = getSubjectMeta(pc.subject ?? 'toan').name;
              const approvedCount = classJoinRequests.filter(
                (r) => r.classId === pc.id && r.status === 'approved',
              ).length;
              const pendingCount = classJoinRequests.filter(
                (r) => r.classId === pc.id && r.status === 'pending',
              ).length;
              const clsExamCount = exams.filter(
                (ex) => ex.privateClassId === pc.id,
              ).length;
              const clsMatCount = classMaterials.filter((m) => m.classId === pc.id).length;
              const clsAsgCount = classAssignments.filter(
                (a) => a.classId === pc.id,
              ).length;
              const canShareCls = canManageResourceSharing(pc, currentUser);
              const isOwnerOrAdminCls =
                isResourceOwner(pc, currentUser) || isAdminUser(currentUser);
              const sharePermCls = getTeacherSharePermission(pc, currentUser);
              const shareCountCls = pc.sharedWith?.length ?? 0;

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
                        <span aria-hidden="true">·</span>
                        {isOwnerOrAdminCls ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {shareCountCls > 0 ? (
                              <>
                                <Share2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                <span className="text-blue-700 dark:text-blue-300">
                                  Đã chia sẻ ({shareCountCls} GV)
                                </span>
                              </>
                            ) : (
                              <>
                                <Lock className="h-3 w-3" />
                                <span>Riêng tư</span>
                              </>
                            )}
                          </span>
                        ) : sharePermCls ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                            <Share2 className="h-3 w-3" />
                            <span>
                              Chia sẻ bởi {pc.ownerTeacherName} (
                              {sharePermCls === 'edit' ? 'Được sửa' : 'Chỉ xem'})
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(pc.id, code)}
                        title="Sao chép mã lớp"
                        className="inline-flex cursor-pointer items-center gap-1 font-mono font-bold text-blue-700 hover:underline tabular-nums dark:text-blue-400"
                      >
                        <Copy className="h-3 w-3" />
                        <span>
                          {copiedClassId === pc.id ? 'Đã chép' : `Mã: ${code}`}
                        </span>
                      </button>
                    </div>

                    <h3 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-slate-50">
                      {pc.name}
                    </h3>

                    {pc.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {pc.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {approvedCount} học sinh
                      </span>
                      {pendingCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            {pendingCount} chờ duyệt
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{clsExamCount} bài thi</span>
                      <span aria-hidden="true">·</span>
                      <span>{clsMatCount} tài liệu</span>
                      <span aria-hidden="true">·</span>
                      <span>{clsAsgCount} bài tập</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveClassId(pc.id);
                          setClassRoomTab(null);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        <DoorOpen className="h-3.5 w-3.5" />
                        <span>Vào lớp học</span>
                      </button>

                      {canShareCls && onUpdatePrivateClass && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShareModalTarget({ kind: 'class', item: pc })}
                            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>Chia sẻ{shareCountCls > 0 ? ` (${shareCountCls})` : ''}</span>
                          </button>

                          {shareCountCls > 0 &&
                            (confirmStopShareClassId === pc.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStopShareClass(pc, 'all')}
                                  className="cursor-pointer whitespace-nowrap rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                                >
                                  Xác nhận dừng
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmStopShareClassId(null)}
                                  className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmStopShareClassId(pc.id)}
                                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                              >
                                <Lock className="h-3.5 w-3.5" />
                                <span>Dừng chia sẻ</span>
                              </button>
                            ))}
                        </>
                      )}
                    </div>

                    {!isOwnerOrAdminCls &&
                      sharePermCls &&
                      onUpdatePrivateClass &&
                      (confirmStopShareClassId === pc.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStopShareClass(pc, 'self')}
                            className="cursor-pointer whitespace-nowrap rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Xác nhận dừng chia sẻ
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmStopShareClassId(null)}
                            className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmStopShareClassId(pc.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          <span>Dừng chia sẻ</span>
                        </button>
                      ))}

                    {canShareCls &&
                      (confirmDeleteClassId === pc.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeletePrivateClass(pc.id);
                              setConfirmDeleteClassId(null);
                            }}
                            className="cursor-pointer rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Xác nhận xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteClassId(null)}
                            className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteClassId(pc.id)}
                          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa lớp</span>
                        </button>
                      ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MỤC 2: LỊCH HỌC (7 cột Thứ 2 – Chủ nhật, giáo viên chỉnh sửa trực tiếp) */}
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
              Lịch giảng dạy tuần từ Thứ 2 đến Chủ nhật. Bạn có quyền thêm, sửa, xóa lịch học cho các lớp của mình.
            </p>
          </div>
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
            Quyền giáo viên · Chỉnh sửa trực tiếp
          </span>
        </div>

        <WeeklyCalendarSchedule
          slots={myClassSchedules}
          classes={privateClasses}
          canEdit={Boolean(
            currentUser && (editableClasses.length > 0 || privateClasses.length === 0),
          )}
          currentUser={currentUser}
          onAddSlot={onAddScheduleSlot}
          onUpdateSlot={onUpdateScheduleSlot}
          onDeleteSlot={onDeleteScheduleSlot}
          emptyNotice="Chưa có lịch học nào cho các lớp của bạn. Nhấn '+ Thêm lịch' ở từng ngày để xếp lịch."
        />
      </section>

      {activeMaterial && (
        <TeacherMaterialReaderModal
          material={activeMaterial}
          onClose={() => setActiveMaterial(null)}
        />
      )}

      <AddSubjectModal
        open={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setNewClassSubject(created.id);
          setNewClassCode((prev) =>
            suggestClassCode(
              newClassGrade,
              created.id,
              newClassName,
              allClassCodesSet,
              prev,
            ),
          );
          setAddSubjectModalOpen(false);
        }}
      />
      {shareModalNode}
    </div>
  );
}

function TeacherMaterialReaderModal({
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
              {getSubjectMeta(material.subject).name} · {material.category}
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
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {material.contentText}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={() => downloadClassMaterialTxt(material)}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải về (.txt)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
