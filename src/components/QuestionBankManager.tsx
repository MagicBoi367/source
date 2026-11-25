import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  Folder,
  FolderOpen,
  Layers,
  Lock,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  CognitiveLevel,
  Exam,
  GradeLevel,
  Question,
  QuestionType,
  SubjectId,
  TeacherPrivateClass,
  TrueFalseStatement,
  UserAccount,
} from '../types/exam';
import {
  areGradesEqual,
  canManageResourceSharing,
  canTeacherEditResource,
  COGNITIVE_LEVEL_LABELS,
  collectAvailableGrades,
  formatGradeLabel,
  getSubjectMeta,
  getTeacherSharePermission,
  isResourceOwner,
  normalizeGradeValue,
  OPTION_LETTERS,
} from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import { AddSubjectModal } from './AddSubjectModal';
import { GradeInputControl } from './GradeInputControl';
import { ImportExamFilesModal } from './ImportExamFilesModal';
import { ResourceShareModal } from './ResourceShareModal';
import { SubjectSearchSelect } from './SubjectSearchSelect';

interface QuestionBankManagerProps {
  questions: Question[];
  exams?: Exam[];
  currentUser?: UserAccount | null;
  privateClasses?: TeacherPrivateClass[];
  onAddQuestion: (q: Question) => void;
  onUpdateQuestion: (q: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onDeleteAllQuestions?: (questionIds?: string[]) => void;
  onImportQuestions: (incoming: Question[]) => void;
  onCreateExam?: (exam: Exam) => void;
}

interface ExamGroupOption {
  key: string;
  id: string;
  title: string;
  subject: SubjectId;
  grade: GradeLevel;
  roomCode?: string;
  sortTime: string;
}

interface ExamQuestionGroup {
  key: string;
  kind: 'exam' | 'imported' | 'standalone';
  examId?: string;
  title: string;
  roomCode?: string;
  subject?: SubjectId;
  grade?: GradeLevel;
  questions: Question[];
  p1Count: number;
  p2Count: number;
  p3Count: number;
  sortTime: string;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Phần I · Nhiều lựa chọn',
  true_false: 'Phần II · Đúng / Sai (4 ý)',
  short_answer: 'Phần III · Trả lời ngắn',
};

const STANDALONE_GROUP_KEY = '__standalone__';

export function QuestionBankManager({
  questions,
  exams = [],
  currentUser = null,
  privateClasses = [],
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onDeleteAllQuestions,
  onImportQuestions,
  onCreateExam,
}: QuestionBankManagerProps) {
  useSubjects();
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | SubjectId>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | QuestionType>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | CognitiveLevel>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(() => new Set());

  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [presetGroupKey, setPresetGroupKey] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{
    title: string;
    ids: string[];
  } | null>(null);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [shareTargetQuestion, setShareTargetQuestion] = useState<Question | null>(null);

  useEffect(() => {
    if (!confirmDeleteAllOpen && !deleteGroupTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setConfirmDeleteAllOpen(false);
        setDeleteGroupTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [confirmDeleteAllOpen, deleteGroupTarget]);

  const examLookup = useMemo(() => {
    const byId = new Map<string, Exam>();
    const byQuestionId = new Map<string, Exam>();
    const sortedExams = [...exams].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    for (const ex of sortedExams) {
      byId.set(ex.id, ex);
      const qIds = [
        ...ex.part1QuestionIds,
        ...ex.part2QuestionIds,
        ...ex.part3QuestionIds,
      ];
      for (const qId of qIds) {
        if (!byQuestionId.has(qId)) {
          byQuestionId.set(qId, ex);
        }
      }
    }
    return { byId, byQuestionId };
  }, [exams]);

  const resolveQuestionGroupMeta = (q: Question): {
    key: string;
    kind: 'exam' | 'imported' | 'standalone';
    examId?: string;
    title: string;
    roomCode?: string;
    subject?: SubjectId;
    grade?: GradeLevel;
    sortTime: string;
  } => {
    const linkedExam =
      (q.sourceExamId ? examLookup.byId.get(q.sourceExamId) : undefined) ??
      examLookup.byQuestionId.get(q.id);

    if (linkedExam) {
      return {
        key: `exam:${linkedExam.id}`,
        kind: 'exam',
        examId: linkedExam.id,
        title: linkedExam.title,
        roomCode: linkedExam.roomCode,
        subject: linkedExam.subject,
        grade: linkedExam.grade,
        sortTime: linkedExam.createdAt,
      };
    }

    if (q.sourceExamTitle || q.sourceExamId) {
      const idOrTitle = q.sourceExamId || q.sourceExamTitle || 'imported';
      return {
        key: `import:${idOrTitle}`,
        kind: 'imported',
        examId: q.sourceExamId,
        title: q.sourceExamTitle || 'Bộ đề nhập từ file',
        subject: q.subject,
        grade: q.grade,
        sortTime: q.createdAt,
      };
    }

    return {
      key: STANDALONE_GROUP_KEY,
      kind: 'standalone',
      title: 'Câu hỏi lẻ (Chưa gắn đề thi)',
      sortTime: '',
    };
  };

  const examGroupOptions = useMemo<ExamGroupOption[]>(() => {
    const map = new Map<string, ExamGroupOption>();

    for (const ex of exams) {
      const key = `exam:${ex.id}`;
      map.set(key, {
        key,
        id: ex.id,
        title: ex.title,
        subject: ex.subject,
        grade: ex.grade,
        roomCode: ex.roomCode,
        sortTime: ex.createdAt,
      });
    }

    for (const q of questions) {
      const meta = resolveQuestionGroupMeta(q);
      if (meta.kind === 'standalone') continue;
      const existing = map.get(meta.key);
      if (!existing) {
        map.set(meta.key, {
          key: meta.key,
          id: meta.examId ?? meta.key,
          title: meta.title,
          subject: meta.subject ?? q.subject,
          grade: meta.grade ?? q.grade,
          roomCode: meta.roomCode,
          sortTime: meta.sortTime || q.createdAt,
        });
      } else if (q.createdAt > existing.sortTime) {
        existing.sortTime = q.createdAt;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime(),
    );
  }, [exams, questions, examLookup]);

  const hasStandaloneQuestions = useMemo(
    () => questions.some((q) => resolveQuestionGroupMeta(q).kind === 'standalone'),
    [questions, examLookup],
  );

  const filtered = useMemo(() => {
    const qLower = search.trim().toLowerCase();
    return questions.filter((q) => {
      if (groupFilter !== 'all') {
        const meta = resolveQuestionGroupMeta(q);
        if (meta.key !== groupFilter) return false;
      }
      if (subjectFilter !== 'all' && q.subject !== subjectFilter) return false;
      if (gradeFilter !== 'all' && !areGradesEqual(q.grade, gradeFilter)) return false;
      if (typeFilter !== 'all' && q.type !== typeFilter) return false;
      if (levelFilter !== 'all' && q.level !== levelFilter) return false;
      if (
        qLower &&
        !q.prompt.toLowerCase().includes(qLower) &&
        !q.topic.toLowerCase().includes(qLower)
      ) {
        return false;
      }
      return true;
    });
  }, [
    questions,
    groupFilter,
    subjectFilter,
    gradeFilter,
    typeFilter,
    levelFilter,
    search,
    examLookup,
  ]);

  const groupedExams = useMemo<ExamQuestionGroup[]>(() => {
    const groupMap = new Map<string, ExamQuestionGroup>();

    for (const q of filtered) {
      const meta = resolveQuestionGroupMeta(q);
      let group = groupMap.get(meta.key);
      if (!group) {
        group = {
          key: meta.key,
          kind: meta.kind,
          examId: meta.examId,
          title: meta.title,
          roomCode: meta.roomCode,
          subject: meta.subject,
          grade: meta.grade,
          questions: [],
          p1Count: 0,
          p2Count: 0,
          p3Count: 0,
          sortTime: meta.sortTime || q.createdAt,
        };
        groupMap.set(meta.key, group);
      }
      group.questions.push(q);
      if (q.type === 'multiple_choice') group.p1Count += 1;
      else if (q.type === 'true_false') group.p2Count += 1;
      else group.p3Count += 1;
      if (meta.kind !== 'standalone' && q.createdAt > group.sortTime) {
        group.sortTime = q.createdAt;
      }
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.kind === 'standalone' && b.kind !== 'standalone') return 1;
      if (b.kind === 'standalone' && a.kind !== 'standalone') return -1;
      return new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime();
    });
  }, [filtered, examLookup]);

  const hasActiveFilter =
    search.trim() !== '' ||
    groupFilter !== 'all' ||
    subjectFilter !== 'all' ||
    gradeFilter !== 'all' ||
    typeFilter !== 'all' ||
    levelFilter !== 'all';

  const isGroupExpanded = (key: string) => {
    if (hasActiveFilter) return true;
    if (groupedExams.length === 1) return true;
    return expandedGroupKeys.has(key);
  };

  const toggleGroupExpand = (key: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllGroups = () => {
    setExpandedGroupKeys(new Set(groupedExams.map((g) => g.key)));
  };

  const collapseAllGroups = () => {
    setExpandedGroupKeys(new Set());
  };

  const deletableQuestionIds = useMemo(
    () =>
      questions
        .filter((q) => canManageResourceSharing(q, currentUser))
        .map((q) => q.id),
    [questions, currentUser],
  );

  const deletableFilteredIds = useMemo(
    () =>
      filtered
        .filter((q) => canManageResourceSharing(q, currentUser))
        .map((q) => q.id),
    [filtered, currentUser],
  );

  const handleExportJson = (listToExport: Question[] = filtered, customPrefix?: string) => {
    const blob = new Blob([JSON.stringify(listToExport, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePrefix = customPrefix
      ? customPrefix
          .toLowerCase()
          .replace(/[^a-z0-9]+/gi, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 40)
      : 'ngan_hang_cau_hoi_2025';
    a.download = `${safePrefix || 'bo_de'}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderQuestionRow = (q: Question, indexInList: number, borderless = false) => {
    const canEditQ = canTeacherEditResource(q, currentUser);
    const canShareQ = canManageResourceSharing(q, currentUser);
    const isOwnerQ = isResourceOwner(q, currentUser);
    const sharePermQ = getTeacherSharePermission(q, currentUser);
    const shareCountQ = q.sharedWith?.length ?? 0;

    return (
      <article
        key={q.id}
        className={
          borderless
            ? 'px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
            : 'rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
        }
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                Câu {indexInList + 1}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {getSubjectMeta(q.subject).name} · {formatGradeLabel(q.grade)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {QUESTION_TYPE_LABELS[q.type]}
              </span>
              <span aria-hidden="true">·</span>
              <span>{COGNITIVE_LEVEL_LABELS[q.level]}</span>
              <span aria-hidden="true">·</span>
              <span>{q.topic}</span>
              {(isOwnerQ || currentUser?.role === 'admin' || sharePermQ) && (
                <>
                  <span aria-hidden="true">·</span>
                  {isOwnerQ || currentUser?.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {shareCountQ > 0 ? (
                        <>
                          <Share2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          <span className="text-blue-700 tabular-nums dark:text-blue-300">
                            Đã chia sẻ ({shareCountQ} GV)
                          </span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" />
                          <span>Riêng tư</span>
                        </>
                      )}
                    </span>
                  ) : sharePermQ ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                      <Share2 className="h-3 w-3" />
                      <span>
                        Chia sẻ bởi {q.ownerTeacherName ?? 'Giáo viên'} (
                        {sharePermQ === 'edit' ? 'Được sửa' : 'Chỉ xem'})
                      </span>
                    </span>
                  ) : null}
                </>
              )}
            </div>
            <p className="text-sm leading-relaxed font-semibold text-slate-900 dark:text-slate-100">
              {q.prompt}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canShareQ && (
              <button
                type="button"
                onClick={() => setShareTargetQuestion(q)}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Chia sẻ</span>
              </button>
            )}
            {canEditQ && (
              <button
                type="button"
                onClick={() => {
                  setEditingQuestion(q);
                  setPresetGroupKey(resolveQuestionGroupMeta(q).key);
                  setModalOpen(true);
                }}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Sửa</span>
              </button>
            )}
            {canShareQ && (
              <button
                type="button"
                onClick={() => setDeleteTargetId(q.id)}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Xóa</span>
              </button>
            )}
          </div>
        </div>

        {/* Compact Answer Preview */}
        <div className="mt-3 text-xs text-slate-600 dark:text-slate-400">
          {q.type === 'multiple_choice' && q.options && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.options.map((opt, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 rounded-md px-3 py-2 ${
                    q.correctOptionIndex === idx
                      ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300'
                  }`}
                >
                  <strong className="shrink-0 font-mono">{OPTION_LETTERS[idx]}.</strong>
                  <span className="min-w-0 flex-1 leading-snug break-words">{opt}</span>
                </div>
              ))}
            </div>
          )}

          {q.type === 'true_false' && q.statements && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.statements.map((st) => (
                <div
                  key={st.id}
                  className="flex items-start justify-between gap-2.5 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2 dark:text-slate-200">
                    <strong className="shrink-0 font-mono">{st.id})</strong>
                    <span className="min-w-0 flex-1 leading-snug break-words">{st.text}</span>
                  </div>
                  <span
                    className={`shrink-0 font-mono font-bold ${
                      st.isTrue
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {st.isTrue ? 'Đúng' : 'Sai'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {q.type === 'short_answer' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">Đáp án chuẩn:</span>
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 font-mono font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                {q.shortAnswer}
              </span>
            </div>
          )}
        </div>
      </article>
    );
  };

  const presetGroupOption = useMemo(() => {
    if (!presetGroupKey) return null;
    return examGroupOptions.find((opt) => opt.key === presetGroupKey) ?? null;
  }, [examGroupOptions, presetGroupKey]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
            Chuẩn hóa theo Chương trình GDPT 2018 &amp; QĐ 764/QĐ-BGDĐT
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Ngân hàng câu hỏi trắc nghiệm 2025
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Phân nhóm gọn gàng theo từng đề thi đã thêm, chuẩn 3 dạng thức và 3 mức độ nhận thức.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
          >
            <Upload className="h-4 w-4" />
            <span>Nhập file Đề &amp; Đáp án</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportJson(filtered)}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-4 w-4" />
            <span className="tabular-nums">Xuất JSON ({filtered.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingQuestion(null);
              setPresetGroupKey(groupFilter !== 'all' ? groupFilter : null);
              setModalOpen(true);
            }}
            className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm câu hỏi mới</span>
          </button>
          {onDeleteAllQuestions && (
            <button
              type="button"
              disabled={deletableQuestionIds.length === 0}
              onClick={() => setConfirmDeleteAllOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
            >
              <Trash2 className="h-4 w-4" />
              <span className="tabular-nums">
                Xóa hết câu hỏi ({deletableQuestionIds.length})
              </span>
            </button>
          )}
        </div>
      </div>

      {importFeedback && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span>{importFeedback}</span>
          <button
            type="button"
            onClick={() => setImportFeedback(null)}
            aria-label="Đóng thông báo nhập file"
            className="cursor-pointer rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm nội dung hoặc chuyên đề..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
            />
          </div>

          <select
            aria-label="Lọc theo bộ đề thi"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
          >
            <option value="all">Tất cả bộ đề / mục</option>
            {examGroupOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.title}
              </option>
            ))}
            {hasStandaloneQuestions && (
              <option value={STANDALONE_GROUP_KEY}>Câu hỏi lẻ (Chưa gắn đề thi)</option>
            )}
          </select>

          <div className="flex items-center gap-1.5">
            <SubjectSearchSelect
              allowAll
              allLabel="Tất cả môn học"
              value={subjectFilter}
              onChange={(val) => setSubjectFilter((val || 'all') as 'all' | SubjectId)}
              ariaLabel="Lọc môn học"
              currentUser={currentUser}
              onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              title="Thêm môn học khác"
              onClick={() => setAddSubjectModalOpen(true)}
              className="inline-flex h-10 cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400 dark:hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Môn</span>
            </button>
          </div>

          <select
            aria-label="Lọc khối lớp"
            value={gradeFilter === 'all' ? 'all' : String(gradeFilter)}
            onChange={(e) =>
              setGradeFilter(
                e.target.value === 'all' ? 'all' : normalizeGradeValue(e.target.value),
              )
            }
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
          >
            <option value="all">Tất cả khối lớp</option>
            {collectAvailableGrades(questions, true).map((g) => (
              <option key={String(g)} value={String(g)}>
                {formatGradeLabel(g)}
              </option>
            ))}
          </select>

          <select
            aria-label="Lọc dạng câu hỏi"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | QuestionType)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
          >
            <option value="all">Tất cả 3 dạng câu hỏi</option>
            <option value="multiple_choice">Phần I · Nhiều lựa chọn</option>
            <option value="true_false">Phần II · Đúng / Sai</option>
            <option value="short_answer">Phần III · Trả lời ngắn</option>
          </select>

          <select
            aria-label="Lọc mức độ nhận thức"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as 'all' | CognitiveLevel)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
          >
            <option value="all">Tất cả mức độ nhận thức</option>
            <option value="biet">Nhận biết</option>
            <option value="hieu">Thông hiểu</option>
            <option value="van_dung">Vận dụng</option>
          </select>
        </div>

        {/* Summary & View Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2 text-slate-600 tabular-nums dark:text-slate-400">
            <span>
              Hiển thị <strong className="text-slate-900 dark:text-slate-100">{groupedExams.length}</strong>{' '}
              mục đề thi
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="text-slate-900 dark:text-slate-100">{filtered.length}</strong> câu hỏi
            </span>
            {hasActiveFilter && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setGroupFilter('all');
                    setSubjectFilter('all');
                    setGradeFilter('all');
                    setTypeFilter('all');
                    setLevelFilter('all');
                  }}
                  className="cursor-pointer font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  Đặt lại bộ lọc
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'grouped' && groupedExams.length > 1 && !hasActiveFilter && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={expandAllGroups}
                  className="cursor-pointer whitespace-nowrap shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Mở rộng tất cả
                </button>
                <button
                  type="button"
                  onClick={collapseAllGroups}
                  className="cursor-pointer whitespace-nowrap shrink-0 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Thu gọn tất cả
                </button>
              </div>
            )}

            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  viewMode === 'grouped'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-50'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Theo từng đề thi
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  viewMode === 'flat'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-50'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Tất cả câu hỏi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Question List */}
      <div className="mt-6 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {questions.length === 0
                ? 'Ngân hàng câu hỏi hiện đang trống'
                : 'Không tìm thấy câu hỏi nào'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {questions.length === 0
                ? 'Nhấn "Nhập file Đề & Đáp án" hoặc "Thêm câu hỏi mới" để tự động tạo mục đề và lưu câu hỏi.'
                : 'Thử nới lỏng bộ lọc hoặc nhấn "Thêm câu hỏi mới" để bổ sung vào ngân hàng.'}
            </p>
          </div>
        ) : viewMode === 'flat' ? (
          <div className="space-y-3">
            {filtered.map((q, idx) => renderQuestionRow(q, idx, false))}
          </div>
        ) : (
          groupedExams.map((group) => {
            const expanded = isGroupExpanded(group.key);
            const groupDeletableIds = group.questions
              .filter((q) => canManageResourceSharing(q, currentUser))
              .map((q) => q.id);

            const partBreakdown = [
              group.p1Count > 0 ? `${group.p1Count} Phần I` : null,
              group.p2Count > 0 ? `${group.p2Count} Phần II` : null,
              group.p3Count > 0 ? `${group.p3Count} Phần III` : null,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <section
                key={group.key}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Accordion Group Header */}
                <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleGroupExpand(group.key)}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
                  >
                    <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                    <span className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-400">
                      {group.kind === 'standalone' ? (
                        <Layers className="h-4 w-4" />
                      ) : expanded ? (
                        <FolderOpen className="h-4 w-4" />
                      ) : (
                        <Folder className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-sm font-bold text-slate-900 sm:text-base dark:text-slate-50">
                        {group.title}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                        {group.subject && group.grade !== undefined && (
                          <>
                            <span className="font-medium text-blue-700 dark:text-blue-400">
                              {getSubjectMeta(group.subject).name} · {formatGradeLabel(group.grade)}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        {group.roomCode && (
                          <>
                            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                              Mã phòng: {group.roomCode}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        {group.kind === 'imported' && (
                          <>
                            <span>Bộ đề nhập từ file</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {group.questions.length} câu hỏi
                        </span>
                        {partBreakdown && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{partBreakdown}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Group Actions */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
                    {group.kind !== 'standalone' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestion(null);
                          setPresetGroupKey(group.key);
                          setModalOpen(true);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Thêm câu</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExportJson(group.questions, group.title)}
                      className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Xuất JSON</span>
                    </button>
                    {onDeleteAllQuestions && groupDeletableIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteGroupTarget({
                            title: group.title,
                            ids: groupDeletableIds,
                          })
                        }
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-slate-700 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Xóa mục</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Questions List with Hairline Dividers */}
                {expanded && (
                  <div className="divide-y divide-slate-100 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {group.questions.map((q, idx) => renderQuestionRow(q, idx, true))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* Import Question & Answer Files Modal */}
      {importModalOpen && (
        <ImportExamFilesModal
          currentUser={currentUser}
          privateClasses={privateClasses}
          onClose={() => setImportModalOpen(false)}
          onImportQuestions={(incoming) => {
            onImportQuestions(incoming);
            const first = incoming[0];
            if (first) {
              const targetTitle = first.sourceExamTitle || 'Bộ đề mới';
              const targetKey = first.sourceExamId
                ? first.sourceExamId.startsWith('exam_')
                  ? `exam:${first.sourceExamId}`
                  : `import:${first.sourceExamId}`
                : `import:${targetTitle}`;
              setExpandedGroupKeys((prev) => {
                const next = new Set(prev);
                next.add(targetKey);
                if (first.sourceExamId) {
                  next.add(`exam:${first.sourceExamId}`);
                  next.add(`import:${first.sourceExamId}`);
                }
                return next;
              });
              setImportFeedback(
                `Đã nhập ${incoming.length} câu hỏi vào mục "${targetTitle}" trong Ngân hàng câu hỏi.`,
              );
            } else {
              setImportFeedback(
                `Đã nhập thành công ${incoming.length} câu hỏi từ file vào Ngân hàng câu hỏi.`,
              );
            }
          }}
          onCreateExam={
            onCreateExam
              ? (exam) => {
                  onCreateExam(exam);
                  setExpandedGroupKeys((prev) => {
                    const next = new Set(prev);
                    next.add(`exam:${exam.id}`);
                    return next;
                  });
                  setImportFeedback(
                    `Đã nhập câu hỏi vào mục "${exam.title}" và tạo phòng thi (Mã phòng ${exam.roomCode}).`,
                  );
                }
              : undefined
          }
        />
      )}

      {/* Create / Edit Question Modal */}
      {modalOpen && (
        <QuestionEditorModal
          initial={editingQuestion}
          presetGroup={presetGroupOption}
          examGroupOptions={examGroupOptions}
          currentUser={currentUser}
          onClose={() => {
            setModalOpen(false);
            setEditingQuestion(null);
            setPresetGroupKey(null);
          }}
          onSave={(saved) => {
            if (editingQuestion) {
              onUpdateQuestion(saved);
            } else {
              onAddQuestion(saved);
            }
            const meta = resolveQuestionGroupMeta(saved);
            setExpandedGroupKeys((prev) => {
              const next = new Set(prev);
              next.add(meta.key);
              return next;
            });
            setModalOpen(false);
            setEditingQuestion(null);
            setPresetGroupKey(null);
          }}
        />
      )}

      {/* Delete Single Question Confirmation */}
      {deleteTargetId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 dark:bg-slate-950/80"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              Xác nhận xóa câu hỏi?
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              Câu hỏi này sẽ bị gỡ khỏi ngân hàng câu hỏi và các đề thi đang liên kết.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="cursor-pointer rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteQuestion(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="cursor-pointer rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Xóa câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Exam Group Questions Confirmation */}
      {deleteGroupTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setDeleteGroupTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                  Xóa toàn bộ câu hỏi trong mục này?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Thao tác này sẽ xóa{' '}
                  <strong className="font-mono text-red-700 tabular-nums dark:text-red-400">
                    {deleteGroupTarget.ids.length} câu hỏi
                  </strong>{' '}
                  thuộc quyền sở hữu của bạn trong mục{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    &ldquo;{deleteGroupTarget.title}&rdquo;
                  </strong>
                  .
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteGroupTarget(null)}
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const count = deleteGroupTarget.ids.length;
                  const title = deleteGroupTarget.title;
                  onDeleteAllQuestions?.(deleteGroupTarget.ids);
                  setDeleteGroupTarget(null);
                  setImportFeedback(`Đã xóa ${count} câu hỏi trong mục "${title}".`);
                }}
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Xóa {deleteGroupTarget.ids.length} câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Questions Confirmation */}
      {confirmDeleteAllOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setConfirmDeleteAllOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-all-questions-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="delete-all-questions-title"
                  className="font-display text-base font-bold text-slate-900 dark:text-slate-50"
                >
                  Xác nhận xóa hết câu hỏi?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Thao tác này sẽ xóa toàn bộ{' '}
                  <strong className="font-mono text-red-700 tabular-nums dark:text-red-400">
                    {deletableQuestionIds.length} câu hỏi
                  </strong>{' '}
                  thuộc quyền sở hữu của bạn và gỡ liên kết khỏi các đề thi tương ứng.
                </p>
                {deletableFilteredIds.length > 0 &&
                  deletableFilteredIds.length < deletableQuestionIds.length && (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                      Bộ lọc hiện tại đang hiển thị{' '}
                      <strong className="tabular-nums">{deletableFilteredIds.length}</strong> /{' '}
                      <strong className="tabular-nums">{deletableQuestionIds.length}</strong> câu
                      hỏi thuộc quyền xóa của bạn.
                    </p>
                  )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteAllOpen(false)}
                className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Hủy
              </button>
              {deletableFilteredIds.length > 0 &&
                deletableFilteredIds.length < deletableQuestionIds.length && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteAllQuestions?.(deletableFilteredIds);
                      setDeleteTargetId(null);
                      setConfirmDeleteAllOpen(false);
                      setImportFeedback(
                        `Đã xóa ${deletableFilteredIds.length} câu hỏi theo bộ lọc khỏi Ngân hàng câu hỏi.`,
                      );
                    }}
                    className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/80"
                  >
                    <span className="tabular-nums">
                      Chỉ xóa đang lọc ({deletableFilteredIds.length})
                    </span>
                  </button>
                )}
              <button
                type="button"
                onClick={() => {
                  const totalCount = deletableQuestionIds.length;
                  onDeleteAllQuestions?.(deletableQuestionIds);
                  setDeleteTargetId(null);
                  setConfirmDeleteAllOpen(false);
                  setImportFeedback(
                    `Đã xóa ${totalCount} câu hỏi khỏi Ngân hàng câu hỏi.`,
                  );
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="tabular-nums">
                  Xóa hết ({deletableQuestionIds.length} câu)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <AddSubjectModal
        open={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setSubjectFilter(created.id);
          setAddSubjectModalOpen(false);
        }}
      />

      {shareTargetQuestion && (
        <ResourceShareModal
          open={Boolean(shareTargetQuestion)}
          onClose={() => setShareTargetQuestion(null)}
          resourceTypeLabel="Câu hỏi"
          resourceTitle={shareTargetQuestion.prompt}
          ownerTeacherId={shareTargetQuestion.ownerTeacherId}
          ownerTeacherName={shareTargetQuestion.ownerTeacherName}
          sharedWith={shareTargetQuestion.sharedWith}
          currentUser={currentUser}
          onSaveShares={(nextSharedWith) => {
            onUpdateQuestion({
              ...shareTargetQuestion,
              sharedWith: nextSharedWith,
            });
            setShareTargetQuestion(null);
          }}
        />
      )}
    </div>
  );
}

interface QuestionEditorModalProps {
  initial: Question | null;
  presetGroup?: ExamGroupOption | null;
  examGroupOptions: ExamGroupOption[];
  currentUser?: UserAccount | null;
  onClose: () => void;
  onSave: (q: Question) => void;
}

function QuestionEditorModal({
  initial,
  presetGroup = null,
  examGroupOptions,
  currentUser = null,
  onClose,
  onSave,
}: QuestionEditorModalProps) {
  useSubjects();
  const [quickAddSubjectOpen, setQuickAddSubjectOpen] = useState(false);

  const initialSelectedGroupKey = (() => {
    if (initial?.sourceExamId) {
      const match = examGroupOptions.find((g) => g.id === initial.sourceExamId);
      if (match) return match.key;
    }
    if (presetGroup) return presetGroup.key;
    return STANDALONE_GROUP_KEY;
  })();

  const [selectedGroupKey, setSelectedGroupKey] = useState<string>(initialSelectedGroupKey);
  const [subject, setSubject] = useState<SubjectId>(
    initial?.subject ?? presetGroup?.subject ?? '',
  );
  const [grade, setGrade] = useState<GradeLevel>(
    initial?.grade ?? presetGroup?.grade ?? 12,
  );
  const [type, setType] = useState<QuestionType>(
    initial?.type ?? 'multiple_choice',
  );
  const [level, setLevel] = useState<CognitiveLevel>(initial?.level ?? 'biet');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [options, setOptions] = useState<[string, string, string, string]>(
    initial?.options ?? ['', '', '', ''],
  );
  const [correctIdx, setCorrectIdx] = useState<0 | 1 | 2 | 3>(
    initial?.correctOptionIndex ?? 0,
  );
  const [statements, setStatements] = useState<
    [
      TrueFalseStatement,
      TrueFalseStatement,
      TrueFalseStatement,
      TrueFalseStatement,
    ]
  >(
    initial?.statements ?? [
      { id: 'a', text: '', isTrue: true },
      { id: 'b', text: '', isTrue: false },
      { id: 'c', text: '', isTrue: true },
      { id: 'd', text: '', isTrue: false },
    ],
  );
  const [shortAnswer, setShortAnswer] = useState(initial?.shortAnswer ?? '');
  const [explanation, setExplanation] = useState(initial?.explanation ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Vui lòng tìm kiếm và chọn Môn học cho câu hỏi.');
      return;
    }
    if (!prompt.trim() || !topic.trim()) {
      setError('Vui lòng nhập đầy đủ Chuyên đề và Nội dung câu hỏi.');
      return;
    }

    if (type === 'multiple_choice' && options.some((o) => !o.trim())) {
      setError('Vui lòng nhập đầy đủ 4 phương án A, B, C, D.');
      return;
    }

    if (type === 'true_false' && statements.some((s) => !s.text.trim())) {
      setError('Vui lòng nhập đầy đủ nội dung cho cả 4 ý a, b, c, d.');
      return;
    }

    if (type === 'short_answer' && (!shortAnswer.trim() || shortAnswer.trim().length > 4)) {
      setError('Đáp án Phần III phải có độ dài từ 1 đến 4 ký tự (chuẩn phiếu tô 2025).');
      return;
    }

    const chosenGroup =
      selectedGroupKey !== STANDALONE_GROUP_KEY
        ? examGroupOptions.find((g) => g.key === selectedGroupKey)
        : undefined;

    const base: Question = {
      id: initial?.id ?? `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      subject,
      grade,
      topic: topic.trim(),
      level,
      type,
      prompt: prompt.trim(),
      explanation: explanation.trim() || 'Đáp án được đối chiếu theo chuẩn chương trình GDPT 2018.',
      isPrivate: initial?.isPrivate ?? true,
      ownerTeacherId: initial?.ownerTeacherId ?? currentUser?.id,
      ownerTeacherName: initial?.ownerTeacherName ?? currentUser?.fullName,
      sharedWith: initial?.sharedWith,
      sourceExamId: chosenGroup ? chosenGroup.id : undefined,
      sourceExamTitle: chosenGroup ? chosenGroup.title : undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    };

    if (type === 'multiple_choice') {
      base.options = options.map((o) => o.trim()) as [string, string, string, string];
      base.correctOptionIndex = correctIdx;
    } else if (type === 'true_false') {
      base.statements = statements.map((s) => ({
        ...s,
        text: s.text.trim(),
      })) as [
        TrueFalseStatement,
        TrueFalseStatement,
        TrueFalseStatement,
        TrueFalseStatement,
      ];
    } else {
      const normalized = shortAnswer.trim();
      const altDot = normalized.replace(/,/g, '.');
      const altComma = normalized.replace(/\./g, ',');
      base.shortAnswer = normalized;
      base.acceptedAnswers = Array.from(new Set([normalized, altDot, altComma]));
    }

    onSave(base);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
            {initial ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới vào Ngân hàng 2025'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {examGroupOptions.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Thuộc bộ đề / Mục lưu trong Ngân hàng câu hỏi
              </label>
              <select
                value={selectedGroupKey}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGroupKey(val);
                  const found = examGroupOptions.find((g) => g.key === val);
                  if (found && !initial) {
                    if (!subject) setSubject(found.subject);
                    setGrade(found.grade);
                  }
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value={STANDALONE_GROUP_KEY}>
                  Câu hỏi lẻ (Chưa gắn đề thi)
                </option>
                {examGroupOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="flex items-center justify-between gap-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Môn học
                </label>
                <button
                  type="button"
                  onClick={() => setQuickAddSubjectOpen(true)}
                  className="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  + Thêm môn
                </button>
              </div>
              <SubjectSearchSelect
                value={subject}
                onChange={(val) => {
                  setSubject(val);
                  if (error) setError(null);
                }}
                placeholder="Tìm tên môn học..."
                ariaLabel="Tìm kiếm và chọn môn học cho câu hỏi"
                currentUser={currentUser}
                onOpenAdvancedAdd={() => setQuickAddSubjectOpen(true)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Khối / Bậc học
              </label>
              <GradeInputControl
                value={grade}
                onChange={setGrade}
                ariaLabel="Chọn hoặc nhập khối từ 1 đến 12, Đại học hoặc Cao đẳng"
                className="mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mức độ nhận thức
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as CognitiveLevel)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="biet">Nhận biết</option>
                <option value="hieu">Thông hiểu</option>
                <option value="van_dung">Vận dụng</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dạng thức câu hỏi 2025
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="multiple_choice">Phần I · Trắc nghiệm 4 lựa chọn</option>
                <option value="true_false">Phần II · Trắc nghiệm Đúng / Sai (4 ý)</option>
                <option value="short_answer">Phần III · Trả lời ngắn (≤ 4 ký tự)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chuyên đề / Chương
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="VD: Ứng dụng đạo hàm"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nội dung câu hỏi / Đề bài
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Nhập câu hỏi rõ ràng..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {type === 'multiple_choice' && (
            <div className="space-y-2.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                4 Phương án trả lời (chọn đáp án đúng)
              </span>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="correct-opt"
                    checked={correctIdx === idx}
                    onChange={() => setCorrectIdx(idx as 0 | 1 | 2 | 3)}
                    aria-label={`Chọn ${OPTION_LETTERS[idx]} làm đáp án đúng`}
                    className="h-4 w-4 text-blue-700"
                  />
                  <span className="w-5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    {OPTION_LETTERS[idx]}.
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...options] as [string, string, string, string];
                      next[idx] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Nội dung phương án ${OPTION_LETTERS[idx]}`}
                    className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              ))}
            </div>
          )}

          {type === 'true_false' && (
            <div className="space-y-2.5">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                4 Mệnh đề thành phần a, b, c, d và đáp án Đúng/Sai
              </span>
              {statements.map((st, idx) => (
                <div key={st.id} className="flex items-center gap-2.5">
                  <span className="w-5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                    {st.id})
                  </span>
                  <input
                    type="text"
                    value={st.text}
                    onChange={(e) => {
                      const next = [...statements] as typeof statements;
                      next[idx] = { ...next[idx], text: e.target.value };
                      setStatements(next);
                    }}
                    placeholder={`Nội dung ý ${st.id})`}
                    className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...statements] as typeof statements;
                      next[idx] = { ...next[idx], isTrue: !next[idx].isTrue };
                      setStatements(next);
                    }}
                    className={`min-w-[68px] cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                      st.isTrue
                        ? 'border-emerald-700 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {st.isTrue ? 'Đúng' : 'Sai'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {type === 'short_answer' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Đáp án số chuẩn (tối đa 4 ký tự, VD: 12,3 hoặc -5)
              </label>
              <input
                type="text"
                maxLength={4}
                value={shortAnswer}
                onChange={(e) =>
                  setShortAnswer(e.target.value.replace(/[^0-9.,-]/g, '').slice(0, 4))
                }
                placeholder="VD: 88,5"
                className="mt-1 h-10 w-40 rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Lời giải / Hướng dẫn chấm
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Giải thích ngắn gọn để thí sinh xem lại sau khi nộp bài..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Lưu câu hỏi
            </button>
          </div>
        </form>
      </div>

      <AddSubjectModal
        open={quickAddSubjectOpen}
        onClose={() => setQuickAddSubjectOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setSubject(created.id);
          setQuickAddSubjectOpen(false);
        }}
      />
    </div>
  );
}
