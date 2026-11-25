import {
  ArrowRight,
  BellRing,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Lock,
  LogIn,
  Printer,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  ClassAssignment,
  ClassJoinRequest,
  ClassMaterial,
  ClassScheduleSlot,
  Exam,
  ExamSubmission,
  GradeLevel,
  Question,
  SubjectId,
  SystemConfig,
  TeacherPrivateClass,
  UserAccount,
  UserRole,
} from '../types/exam';
import {
  areGradesEqual,
  calculateExamMaxRawScore,
  collectAvailableGrades,
  doesExamMatchStudentClass,
  EXAM_CATEGORY_LABELS,
  formatExamClassScope,
  formatGradeLabel,
  formatScoreVi,
  getExamDurationMinutes,
  getGradeDescription,
  getSubjectMeta,
} from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import type { AppView } from './Header';
import {
  StudentHomeDashboard,
  type StudentHomeSectionId,
} from './StudentHomeDashboard';
import { SubjectSearchSelect } from './SubjectSearchSelect';
import {
  TeacherHomeDashboard,
  type TeacherClassRoomTab,
} from './TeacherHomeDashboard';
import { WeeklyCalendarSchedule } from './WeeklyCalendarSchedule';

interface PortalOverviewProps {
  role: UserRole;
  currentUser: UserAccount | null;
  systemConfig?: SystemConfig;
  privateClasses?: TeacherPrivateClass[];
  allPrivateClasses?: TeacherPrivateClass[];
  classJoinRequests?: ClassJoinRequest[];
  classMaterials?: ClassMaterial[];
  classAssignments?: ClassAssignment[];
  classSchedules?: ClassScheduleSlot[];
  onAddPrivateClass?: (cls: TeacherPrivateClass) => { ok: boolean; error?: string } | void;
  onUpdatePrivateClass?: (cls: TeacherPrivateClass) => void;
  onDeletePrivateClass?: (id: string) => void;
  onRequestJoinClass?: (targetClass: TeacherPrivateClass) => {
    ok: boolean;
    error?: string;
    request?: ClassJoinRequest;
  };
  onCancelJoinRequest?: (requestId: string) => void;
  onReviewJoinRequest?: (requestId: string, decision: 'approved' | 'rejected') => void;
  onRemoveClassMember?: (classId: string, studentUserId: string) => void;
  onAddClassMaterial?: (material: ClassMaterial) => void;
  onUpdateClassMaterial?: (material: ClassMaterial) => void;
  onDeleteClassMaterial?: (id: string) => void;
  onAddClassAssignment?: (assignment: ClassAssignment) => void;
  onUpdateClassAssignment?: (assignment: ClassAssignment) => void;
  onDeleteClassAssignment?: (id: string) => void;
  onAddScheduleSlot?: (slot: ClassScheduleSlot) => void;
  onUpdateScheduleSlot?: (slot: ClassScheduleSlot) => void;
  onDeleteScheduleSlot?: (id: string) => void;
  onChangeRole: (role: UserRole) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  exams: Exam[];
  questions: Question[];
  submissions: ExamSubmission[];
  onSelectExamToStart: (exam: Exam) => void;
  onJoinByRoomCode: (code: string) => string | null;
  onOpenPrintableExam: (exam: Exam) => void;
  onNavigate: (view: AppView) => void;
  onCreateExam: () => void;
  onViewSubmission: (sub: ExamSubmission) => void;
  requestedStudentSection?: { sectionId: StudentHomeSectionId; nonce: number } | null;
  onStudentSectionActivated?: (sectionId: StudentHomeSectionId) => void;
  activeTeacherClassId?: string | null;
  onActiveTeacherClassChange?: (classId: string | null) => void;
  activeTeacherClassTab?: TeacherClassRoomTab | null;
  onActiveTeacherClassTabChange?: (tab: TeacherClassRoomTab | null) => void;
}

export function PortalOverview({
  role,
  currentUser,
  systemConfig,
  privateClasses = [],
  allPrivateClasses = [],
  classJoinRequests = [],
  classMaterials = [],
  classAssignments = [],
  classSchedules = [],
  onAddPrivateClass,
  onUpdatePrivateClass,
  onDeletePrivateClass,
  onRequestJoinClass,
  onCancelJoinRequest,
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
  onChangeRole,
  onOpenAuth,
  exams,
  questions,
  submissions,
  onSelectExamToStart,
  onJoinByRoomCode,
  onOpenPrintableExam,
  onNavigate,
  onCreateExam,
  onViewSubmission,
  requestedStudentSection,
  onStudentSectionActivated,
  activeTeacherClassId,
  onActiveTeacherClassChange,
  activeTeacherClassTab,
  onActiveTeacherClassTabChange,
}: PortalOverviewProps) {
  useSubjects();
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');
  const [gradeFilter, setGradeFilter] = useState<
    'all' | GradeLevel | 'my_class' | 'private'
  >('all');
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({});
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const isStaff = role === 'teacher' || role === 'admin';
  const studentClass = currentUser?.role === 'student' ? currentUser.studentClass : undefined;

  const baseVisibleExams = useMemo(() => {
    return exams.filter((ex) => {
      if (role === 'student' && ex.status !== 'active') return false;
      if (subjectFilter !== 'all' && ex.subject !== subjectFilter) return false;
      return true;
    });
  }, [exams, role, subjectFilter]);

  const privateClassMap = useMemo(
    () => new Map(privateClasses.map((pc) => [pc.id, pc])),
    [privateClasses],
  );

  const privateExamsCount = useMemo(
    () => baseVisibleExams.filter((ex) => ex.isPrivate).length,
    [baseVisibleExams],
  );

  const availableGrades = useMemo(
    () => collectAvailableGrades(baseVisibleExams, true),
    [baseVisibleExams],
  );

  const visibleExams = useMemo(() => {
    return baseVisibleExams.filter((ex) => {
      if (gradeFilter === 'my_class') {
        return doesExamMatchStudentClass(ex, studentClass);
      }
      if (gradeFilter === 'private') {
        return Boolean(ex.isPrivate);
      }
      if (gradeFilter !== 'all' && !areGradesEqual(ex.grade, gradeFilter)) return false;
      return true;
    });
  }, [baseVisibleExams, gradeFilter, studentClass]);

  const groupedByGrade = useMemo(() => {
    return availableGrades
      .map((grade) => ({
        grade,
        label: formatGradeLabel(grade),
        description: getGradeDescription(grade),
        items: visibleExams.filter((ex) => areGradesEqual(ex.grade, grade)),
      }))
      .filter((g) => g.items.length > 0);
  }, [availableGrades, visibleExams]);

  const avgScore = useMemo(() => {
    if (submissions.length === 0) return 0;
    const sum = submissions.reduce((acc, s) => acc + s.totalScore, 0);
    return sum / submissions.length;
  }, [submissions]);

  const activeExamCount = useMemo(
    () => exams.filter((e) => e.status === 'active').length,
    [exams],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {systemConfig?.announcementEnabled && systemConfig.announcementText.trim() && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/85 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
        >
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <span className="font-bold">Thông báo hệ thống: </span>
            <span>{systemConfig.announcementText}</span>
          </div>
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="cursor-pointer whitespace-nowrap shrink-0 font-semibold text-amber-800 underline hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
            >
              Chỉnh sửa
            </button>
          )}
        </div>
      )}

      {/* Workspace Mode Toolbar (kept outside <header> per Top Bar Contract) */}
      {(currentUser?.role === 'admin' || !currentUser) && (
        <div className="mb-6 flex flex-col justify-end gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
          {currentUser ? (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="inline-flex cursor-pointer items-center gap-1.5 self-start whitespace-nowrap rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 sm:self-auto dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Trang Admin</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                role="group"
                aria-label="Chế độ làm việc"
                className="inline-flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1 sm:self-auto dark:bg-slate-800"
              >
                <button
                  type="button"
                  onClick={() => onChangeRole('student')}
                  className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                    role === 'student'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  Thí sinh dự thi
                </button>
                <button
                  type="button"
                  onClick={() => onChangeRole('teacher')}
                  className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                    role === 'teacher'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  Giáo viên &amp; Hội đồng thi
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Đăng nhập / Đăng ký</span>
              </button>
            </div>
          )}
        </div>
      )}

      {role === 'student' ? (
        <StudentHomeDashboard
          currentUser={currentUser}
          exams={exams}
          questions={questions}
          submissions={submissions}
          allPrivateClasses={allPrivateClasses}
          classJoinRequests={classJoinRequests}
          classMaterials={classMaterials}
          classAssignments={classAssignments}
          classSchedules={classSchedules}
          onRequestJoinClass={(cls) =>
            onRequestJoinClass
              ? onRequestJoinClass(cls)
              : { ok: false, error: 'Chức năng gửi yêu cầu chưa sẵn sàng.' }
          }
          onCancelJoinRequest={(reqId) => onCancelJoinRequest?.(reqId)}
          onLeaveClassMembership={(classId) =>
            onRemoveClassMember?.(classId, currentUser?.id ?? 'guest_student')
          }
          onSelectExamToStart={onSelectExamToStart}
          onJoinByRoomCode={onJoinByRoomCode}
          onOpenPrintableExam={onOpenPrintableExam}
          onNavigate={onNavigate}
          onViewSubmission={onViewSubmission}
          requestedSection={requestedStudentSection}
          onSectionActivated={onStudentSectionActivated}
        />
      ) : role === 'teacher' ? (
        <TeacherHomeDashboard
          currentUser={currentUser}
          exams={exams}
          submissions={submissions}
          privateClasses={privateClasses}
          allPrivateClasses={allPrivateClasses}
          classJoinRequests={classJoinRequests}
          classMaterials={classMaterials}
          classAssignments={classAssignments}
          classSchedules={classSchedules}
          onAddPrivateClass={(cls) =>
            onAddPrivateClass
              ? onAddPrivateClass(cls)
              : { ok: false, error: 'Chức năng tạo lớp chưa sẵn sàng.' }
          }
          onUpdatePrivateClass={(cls) => onUpdatePrivateClass?.(cls)}
          onDeletePrivateClass={(id) => onDeletePrivateClass?.(id)}
          onReviewJoinRequest={(reqId, decision) =>
            onReviewJoinRequest?.(reqId, decision)
          }
          onRemoveClassMember={(classId, studentUserId) =>
            onRemoveClassMember?.(classId, studentUserId)
          }
          onAddClassMaterial={(mat) => onAddClassMaterial?.(mat)}
          onUpdateClassMaterial={(mat) => onUpdateClassMaterial?.(mat)}
          onDeleteClassMaterial={(id) => onDeleteClassMaterial?.(id)}
          onAddClassAssignment={(asg) => onAddClassAssignment?.(asg)}
          onUpdateClassAssignment={(asg) => onUpdateClassAssignment?.(asg)}
          onDeleteClassAssignment={(id) => onDeleteClassAssignment?.(id)}
          onAddScheduleSlot={(slot) => onAddScheduleSlot?.(slot)}
          onUpdateScheduleSlot={(slot) => onUpdateScheduleSlot?.(slot)}
          onDeleteScheduleSlot={(id) => onDeleteScheduleSlot?.(id)}
          onSelectExamToStart={onSelectExamToStart}
          onOpenPrintableExam={onOpenPrintableExam}
          onNavigate={onNavigate}
          onViewSubmission={onViewSubmission}
          onOpenAuth={onOpenAuth}
          requestedSection={requestedStudentSection}
          onSectionActivated={onStudentSectionActivated}
          activeClassId={activeTeacherClassId}
          onActiveClassChange={onActiveTeacherClassChange}
          activeClassTab={activeTeacherClassTab}
          onActiveClassTabChange={onActiveTeacherClassTabChange}
        />
      ) : (
        <>
      {/* Editorial Split Hero */}
      <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs font-medium tracking-wide text-blue-700 dark:text-blue-400">
              Chuẩn cấu trúc Bộ Giáo dục và Đào tạo 2025
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance] sm:text-4xl dark:text-slate-50">
              Tổ chức thi và kiểm tra trắc nghiệm trực tuyến chuẩn Thông tư 2025
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Hỗ trợ đầy đủ 3 dạng thức câu hỏi mới (Nhiều lựa chọn, Đúng/Sai tính điểm lũy tiến
              0,1–0,25–0,5–1,0 và Trả lời ngắn), trộn mã đề tự động, giám sát chuyển tab theo
              Thông tư 09/2021 và xuất bảng điểm CSV chuẩn hành chính.
            </p>
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onCreateExam}
                className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <span>Tạo đề thi từ Ma trận 2025</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('question_bank')}
                className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span>Quản lý Ngân hàng câu hỏi</span>
              </button>
              {role === 'admin' && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition-colors duration-150 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Mở Trang Quản trị Admin</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/hero_exam_hall_1795435512059.jpg"
              alt="Phòng thi tiêu chuẩn tổ chức kiểm tra đánh giá trực tuyến"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="h-64 w-full object-cover lg:h-full dark:brightness-90"
            />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 p-6 text-center lg:h-full dark:from-slate-900 dark:to-slate-800">
              <ShieldCheck className="h-10 w-10 text-blue-700 dark:text-blue-400" />
              <p className="mt-3 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Phòng thi trực tuyến chuẩn Bộ GD&amp;ĐT 2025
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 4-Column KPI Strip in Full-Width Row Below Hero */}
      <section className="mt-6 grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Kỳ thi đang mở</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {activeExamCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Sẵn sàng tiếp nhận thí sinh
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Ngân hàng câu hỏi
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {questions.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Đủ 3 dạng thức 2025</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Bài thi đã chấm
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-slate-50">
            {submissions.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tự động hóa thang 10,00
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Điểm trung bình
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-blue-700 tabular-nums dark:text-blue-400">
            {formatScoreVi(avgScore)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Thống kê toàn hệ thống
          </p>
        </div>
      </section>

      {/* Active Exams Directory Grouped by Grade & Class */}
      <section className="mt-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Điều hành phòng thi theo Khối lớp
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Các đề thi được phân tách gọn gàng theo từng khối / lớp và phạm vi lớp áp dụng
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SubjectSearchSelect
              allowAll
              compact
              allLabel="Tất cả môn học"
              value={subjectFilter}
              onChange={(val) => setSubjectFilter((val || 'all') as 'all' | SubjectId)}
              ariaLabel="Lọc theo môn học"
              currentUser={currentUser}
              className="w-48"
            />
          </div>
        </div>

        {/* Grade / Class Filter Tabs */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Phân loại theo khối lớp"
            className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={gradeFilter === 'all'}
              onClick={() => setGradeFilter('all')}
              className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                gradeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Tất cả khối ({baseVisibleExams.length})
            </button>

            {studentClass && (
              <button
                type="button"
                role="tab"
                aria-selected={gradeFilter === 'my_class'}
                onClick={() => setGradeFilter('my_class')}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                  gradeFilter === 'my_class'
                    ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Lớp của tôi: {studentClass} (
                {baseVisibleExams.filter((ex) => doesExamMatchStudentClass(ex, studentClass)).length})
              </button>
            )}

            {availableGrades.map((grade) => {
              const count = baseVisibleExams.filter((ex) =>
                areGradesEqual(ex.grade, grade),
              ).length;
              const isSelected =
                gradeFilter !== 'all' &&
                gradeFilter !== 'my_class' &&
                gradeFilter !== 'private' &&
                areGradesEqual(gradeFilter, grade);
              return (
                <button
                  key={String(grade)}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setGradeFilter(grade)}
                  className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {formatGradeLabel(grade)} ({count})
                </button>
              );
            })}

            {privateExamsCount > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={gradeFilter === 'private'}
                onClick={() => setGradeFilter('private')}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                  gradeFilter === 'private'
                    ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Đề riêng của tôi ({privateExamsCount})</span>
              </button>
            )}
          </div>
        </div>

        {groupedByGrade.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-500" />
            <h3 className="mt-3 font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Không có đề thi phù hợp khối lớp hoặc môn học đã chọn
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Hãy chọn khối lớp / môn học khác hoặc chuyển sang chế độ Giáo viên để tạo đề mới.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {groupedByGrade.map((group) => {
              const gradeKey = String(group.grade);
              const isSectionCollapsed =
                gradeFilter === 'all' && Boolean(collapsedGrades[gradeKey]);

              return (
                <div
                  key={gradeKey}
                  className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/50">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                          {group.label}
                        </h3>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                          ·
                        </span>
                        <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                          {group.items.length} phòng thi
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {group.description}
                      </p>
                    </div>

                    {gradeFilter === 'all' && (
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedGrades((prev) => ({
                            ...prev,
                            [gradeKey]: !prev[gradeKey],
                          }))
                        }
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {isSectionCollapsed ? (
                          <>
                            <ChevronRight className="h-3.5 w-3.5" />
                            <span>Mở rộng ({group.items.length})</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            <span>Thu gọn</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {!isSectionCollapsed && (
                    <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0 md:gap-px md:bg-slate-200 dark:divide-slate-800 dark:md:bg-slate-800">
                      {group.items.map((exam) => {
                        const subjectMeta = getSubjectMeta(exam.subject);
                        const totalQ =
                          exam.part1QuestionIds.length +
                          exam.part2QuestionIds.length +
                          exam.part3QuestionIds.length;
                        const maxRaw = calculateExamMaxRawScore(exam);
                        const attempts = submissions.filter((s) => s.examId === exam.id).length;

                        return (
                          <article
                            key={exam.id}
                            className="flex flex-col justify-between bg-white p-6 transition-colors duration-150 hover:bg-slate-50/70 dark:bg-slate-900 dark:hover:bg-slate-800/40"
                          >
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                                    {subjectMeta.name}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatExamClassScope(exam)}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{EXAM_CATEGORY_LABELS[exam.category]}</span>
                                </div>
                                <span className="font-mono font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                                  Mã phòng: {exam.roomCode}
                                </span>
                              </div>

                              <h4 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-slate-50">
                                {exam.title}
                              </h4>

                              <div className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-100 py-3 text-xs dark:border-slate-800">
                                <div>
                                  <span className="block text-slate-500 dark:text-slate-400">
                                    Phần I (A/B/C/D)
                                  </span>
                                  <span className="mt-0.5 block font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                                    {exam.part1QuestionIds.length} câu
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 dark:text-slate-400">
                                    Phần II (Đúng/Sai)
                                  </span>
                                  <span className="mt-0.5 block font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                                    {exam.part2QuestionIds.length} câu
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-slate-500 dark:text-slate-400">
                                    Phần III (Trả lời ngắn)
                                  </span>
                                  <span className="mt-0.5 block font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                                    {exam.part3QuestionIds.length} câu
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                  <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                  {getExamDurationMinutes(exam)} phút
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  Tổng {totalQ} câu ({formatScoreVi(maxRaw)} điểm)
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  {attempts} lượt nộp
                                </span>
                                {exam.isPrivate && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400">
                                      <Lock className="h-3.5 w-3.5" />
                                      <span>
                                        {exam.privateClassId && privateClassMap.get(exam.privateClassId)
                                          ? `Riêng tư · Lớp ${privateClassMap.get(exam.privateClassId)?.name}`
                                          : 'Riêng tư · Chỉ mình tôi'}
                                      </span>
                                    </span>
                                  </>
                                )}
                                {exam.strictProctoring && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                      Giám sát TT 09
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-2">
                              <button
                                type="button"
                                onClick={() => onOpenPrintableExam(exam)}
                                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Xem đề chuẩn A4</span>
                              </button>

                              <div className="flex items-center gap-2">
                                {isStaff && (
                                  <button
                                    type="button"
                                    onClick={() => onNavigate('exam_manager')}
                                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                  >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    <span>Cấu hình</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={exam.status !== 'active'}
                                  onClick={() => onSelectExamToStart(exam)}
                                  className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                                >
                                  <span>{isStaff ? 'Thi thử đề này' : 'Bắt đầu làm bài'}</span>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Submissions Quick Table */}
      <section className="mt-12 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Lịch sử nộp bài gần đây
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bấm vào từng bài thi để xem phiếu điểm phân tích theo 3 phần và lời giải chi tiết
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('results')}
            className="inline-flex cursor-pointer items-center gap-1.5 self-start whitespace-nowrap text-xs font-semibold text-blue-700 hover:underline sm:self-auto dark:text-blue-400"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Xem toàn bộ bảng điểm</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
                <th className="px-6 py-3">Số báo danh</th>
                <th className="px-6 py-3">Thí sinh</th>
                <th className="px-6 py-3">Kỳ thi</th>
                <th className="px-6 py-3">Mã đề</th>
                <th className="px-6 py-3 text-right">Điểm Phần I / II / III</th>
                <th className="px-6 py-3 text-right">Tổng điểm</th>
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
                    Chưa có bài thi nào được nộp.
                  </td>
                </tr>
              ) : (
                submissions.slice(0, 5).map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => onViewSubmission(sub)}
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                      {sub.studentSbd}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {sub.studentName}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        Lớp {sub.studentClass}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {sub.examTitle}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-700 tabular-nums dark:text-slate-300">
                      {sub.variantCode}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums dark:text-slate-300">
                      {formatScoreVi(sub.part1Score)} / {formatScoreVi(sub.part2Score)} /{' '}
                      {formatScoreVi(sub.part3Score)}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-sm font-bold text-blue-700 tabular-nums dark:text-blue-400">
                      {formatScoreVi(sub.totalScore)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400">
                        Xem phiếu
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Teacher-Editable Weekly Schedule Calendar (Thứ 2 - Chủ nhật) */}
      <section className="mt-10">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
              Lịch học các lớp (Thứ 2 – Chủ nhật)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Chỉ tài khoản giáo viên / hội đồng thi có quyền thêm, sửa hoặc xóa lịch học; học sinh
              tham gia lớp sẽ xem lịch ở chế độ chỉ đọc.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('exam_manager')}
            className="inline-flex cursor-pointer items-center gap-1.5 self-start whitespace-nowrap text-xs font-semibold text-blue-700 hover:underline sm:self-auto dark:text-blue-400"
          >
            <span>Quản lý lớp &amp; Tài liệu lớp học</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <WeeklyCalendarSchedule
          slots={
            role === 'admin'
              ? classSchedules
              : classSchedules.filter((slot) =>
                  privateClasses.some((pc) => pc.id === slot.classId),
                )
          }
          classes={role === 'admin' ? allPrivateClasses : privateClasses}
          canEdit={isStaff}
          currentUser={currentUser}
          onAddSlot={onAddScheduleSlot}
          onUpdateSlot={onUpdateScheduleSlot}
          onDeleteSlot={onDeleteScheduleSlot}
          emptyNotice="Chưa có lịch học nào cho các lớp của bạn. Nhấn '+ Thêm lịch' ở từng ngày hoặc mở Tổ chức đề thi để tạo lớp và gửi tài liệu/bài tập."
        />
      </section>
        </>
      )}
    </div>
  );
}
