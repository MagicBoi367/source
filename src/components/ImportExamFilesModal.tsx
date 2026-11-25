import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileCheck2,
  FileText,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CognitiveLevel,
  Exam,
  GradeLevel,
  Question,
  SubjectId,
  TeacherPrivateClass,
  UserAccount,
} from '../types/exam';
import {
  convertDraftToQuestion,
  downloadSampleAnswerExcel,
  downloadTextFile,
  extractTextFromUploadedFile,
  finalizeDraftWarnings,
  mergeQuestionsAndAnswers,
  parseAnswerFileContent,
  parseQuestionFileContent,
  SAMPLE_ANSWER_FILE_TXT,
  SAMPLE_QUESTION_FILE_TXT,
  type ImportDefaults,
  type ParsedQuestionDraft,
} from '../utils/examFileParser';
import {
  COGNITIVE_LEVEL_LABELS,
  formatGradeLabel,
  getSubjectMeta,
  OPTION_LETTERS,
} from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import { AddSubjectModal } from './AddSubjectModal';
import { GradeInputControl } from './GradeInputControl';
import { SubjectSearchSelect } from './SubjectSearchSelect';

interface ImportExamFilesModalProps {
  onClose: () => void;
  onImportQuestions: (questions: Question[]) => void;
  onCreateExam?: (exam: Exam) => void;
  defaultCreateExam?: boolean;
  currentUser?: UserAccount | null;
  privateClasses?: TeacherPrivateClass[];
  defaultPrivate?: boolean;
  defaultPrivateClassId?: string;
}

const ACCEPTED_EXTENSIONS = '.txt,.md,.csv,.tsv,.json,.docx,.xlsx,.xls,.ods';

export function ImportExamFilesModal({
  onClose,
  onImportQuestions,
  onCreateExam,
  defaultCreateExam = false,
  currentUser = null,
  privateClasses = [],
  defaultPrivate = false,
  defaultPrivateClassId = '',
}: ImportExamFilesModalProps) {
  useSubjects();
  const [addSubjectModalOpen, setAddSubjectModalOpen] = useState(false);
  const [subject, setSubject] = useState<SubjectId>('');
  const [grade, setGrade] = useState<GradeLevel>(12);
  const [defaultLevel, setDefaultLevel] = useState<CognitiveLevel>('hieu');
  const [defaultTopic, setDefaultTopic] = useState('Tổng hợp');

  const [questionFileName, setQuestionFileName] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionPasteMode, setQuestionPasteMode] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionDragging, setQuestionDragging] = useState(false);

  const [answerFileName, setAnswerFileName] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerPasteMode, setAnswerPasteMode] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [answerDragging, setAnswerDragging] = useState(false);

  const [manualOverrides, setManualOverrides] = useState<
    Record<string, Partial<ParsedQuestionDraft>>
  >({});
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const [alsoCreateExam, setAlsoCreateExam] = useState(
    Boolean(defaultCreateExam && onCreateExam),
  );
  const [examTitle, setExamTitle] = useState('Đề kiểm tra nhập từ file 2025');
  const [roomCode, setRoomCode] = useState(
    () => `DE${String(Math.floor(1000 + Math.random() * 9000))}`,
  );
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [isPrivateExam, setIsPrivateExam] = useState(
    Boolean(currentUser && (defaultPrivate || defaultPrivateClassId || true)),
  );
  const [selectedPrivateClassId, setSelectedPrivateClassId] = useState(
    defaultPrivateClassId,
  );

  const questionInputRef = useRef<HTMLInputElement | null>(null);
  const answerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const defaults: ImportDefaults = useMemo(
    () => ({
      subject: subject || 'toan',
      grade,
      defaultLevel,
      defaultTopic: defaultTopic.trim() || 'Tổng hợp',
    }),
    [defaultLevel, defaultTopic, grade, subject],
  );

  const parsedAnswers = useMemo(
    () => parseAnswerFileContent(answerText, answerFileName ?? ''),
    [answerFileName, answerText],
  );

  const mergedDrafts = useMemo(() => {
    const baseQuestions = parseQuestionFileContent(
      questionText,
      defaults,
      questionFileName ?? '',
    );
    const matched = mergeQuestionsAndAnswers(baseQuestions, parsedAnswers);
    return matched
      .filter((d) => !removedIds.has(d.tempId))
      .map((d, idx) => {
        const key = `${d.sourcePart ?? 0}_${d.sourceNumber}_${idx}`;
        const override = manualOverrides[key] ?? manualOverrides[d.tempId];
        if (!override) return d;
        return finalizeDraftWarnings({
          ...d,
          ...override,
          answerSource: 'manual',
        });
      });
  }, [
    defaults,
    manualOverrides,
    parsedAnswers,
    questionFileName,
    questionText,
    removedIds,
  ]);

  const stats = useMemo(() => {
    const total = mergedDrafts.length;
    const p1 = mergedDrafts.filter((d) => d.type === 'multiple_choice').length;
    const p2 = mergedDrafts.filter((d) => d.type === 'true_false').length;
    const p3 = mergedDrafts.filter((d) => d.type === 'short_answer').length;
    const readyCount = mergedDrafts.filter((d) => d.warnings.length === 0).length;
    const warningCount = total - readyCount;
    const fromAnswerFile = mergedDrafts.filter(
      (d) => d.answerSource === 'answer_file',
    ).length;
    return { total, p1, p2, p3, readyCount, warningCount, fromAnswerFile };
  }, [mergedDrafts]);

  const handleQuestionFile = async (file: File) => {
    setQuestionError(null);
    try {
      const content = await extractTextFromUploadedFile(file);
      setQuestionFileName(file.name);
      setQuestionText(content);
      setManualOverrides({});
      setRemovedIds(new Set());
      const baseTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      if (baseTitle) {
        setExamTitle(baseTitle);
      }
    } catch (err) {
      setQuestionError(
        err instanceof Error ? err.message : 'Không thể đọc file câu hỏi.',
      );
    }
  };

  const handleAnswerFile = async (file: File) => {
    setAnswerError(null);
    try {
      const content = await extractTextFromUploadedFile(file);
      setAnswerFileName(file.name);
      setAnswerText(content);
      setManualOverrides({});
    } catch (err) {
      setAnswerError(
        err instanceof Error ? err.message : 'Không thể đọc file câu trả lời.',
      );
    }
  };

  const loadSamplePair = () => {
    setQuestionError(null);
    setAnswerError(null);
    setQuestionFileName('de_thi_mau_2025.txt');
    setAnswerFileName('dap_an_mau_2025.txt');
    setQuestionText(SAMPLE_QUESTION_FILE_TXT);
    setAnswerText(SAMPLE_ANSWER_FILE_TXT);
    setManualOverrides({});
    setRemovedIds(new Set());
    setExamTitle('Đề kiểm tra mẫu 3 Dạng thức 2025');
  };

  const updateDraftManual = (
    draftKey: string,
    patch: Partial<ParsedQuestionDraft>,
  ) => {
    setManualOverrides((prev) => ({
      ...prev,
      [draftKey]: { ...(prev[draftKey] ?? {}), ...patch },
    }));
  };

  const handleConfirmImport = () => {
    if (mergedDrafts.length === 0) return;
    if (!subject.trim()) {
      setQuestionError('Vui lòng tìm kiếm và chọn Môn học trước khi nhập câu hỏi.');
      return;
    }

    const baseNameTitle = questionFileName
      ? questionFileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
      : '';
    const resolvedExamTitle =
      examTitle.trim() ||
      baseNameTitle ||
      `Đề thi ${getSubjectMeta(subject).name} 2025`;
    const groupExamId =
      alsoCreateExam && onCreateExam
        ? `exam_imp_${Date.now()}`
        : `imp_group_${Date.now()}`;

    const converted = mergedDrafts.map((draft) => {
      const q = convertDraftToQuestion(draft);
      return {
        ...q,
        isPrivate: true,
        ownerTeacherId: currentUser?.id,
        ownerTeacherName: currentUser?.fullName,
        sourceExamId: groupExamId,
        sourceExamTitle: resolvedExamTitle,
      };
    });
    onImportQuestions(converted);

    if (alsoCreateExam && onCreateExam) {
      const p1Ids = converted
        .filter((q) => q.type === 'multiple_choice')
        .map((q) => q.id);
      const p2Ids = converted
        .filter((q) => q.type === 'true_false')
        .map((q) => q.id);
      const p3Ids = converted
        .filter((q) => q.type === 'short_answer')
        .map((q) => q.id);

      const safeDuration = Math.max(5, Math.min(240, Math.round(durationMinutes || 50)));
      const usePrivate = Boolean(currentUser && isPrivateExam);
      const matchedPrivateClass = usePrivate
        ? privateClasses.find((c) => c.id === selectedPrivateClassId)
        : undefined;
      const newExam: Exam = {
        id: groupExamId,
        roomCode: roomCode.trim().toUpperCase() || `DE${Date.now().toString().slice(-4)}`,
        title: resolvedExamTitle,
        subject,
        grade: matchedPrivateClass ? matchedPrivateClass.grade : grade,
        isPrivate: usePrivate,
        ownerTeacherId: currentUser?.id,
        ownerTeacherName: currentUser?.fullName,
        privateClassId: usePrivate && matchedPrivateClass ? matchedPrivateClass.id : undefined,
        category: 'thuong_xuyen',
        duration: safeDuration,
        durationMinutes: safeDuration,
        autoSubmitOnTimeout: true,
        warningMinutes: Math.min(5, Math.max(1, Math.floor(safeDuration / 3))),
        status: 'active',
        part1QuestionIds: p1Ids,
        part2QuestionIds: p2Ids,
        part3QuestionIds: p3Ids,
        part1PointPerQ: 0.25,
        part2PointMaxPerQ: 1.0,
        part3PointPerQ: 0.5,
        shuffleQuestions: false,
        shuffleOptions: true,
        strictProctoring: true,
        showSolutionsAfterSubmit: true,
        createdBy: currentUser?.fullName ?? 'Giáo viên bộ môn',
        createdAt: new Date().toISOString(),
      };
      onCreateExam(newExam);
    }

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-files-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
              Hỗ trợ .xlsx / .xls (Excel), .docx (Word), .txt, .md, .csv, .json
            </p>
            <h2
              id="import-files-modal-title"
              className="mt-0.5 font-display text-lg font-bold text-slate-900 dark:text-slate-50"
            >
              Nhập câu hỏi từ File Đề &amp; File Câu trả lời
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadSamplePair}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800/70 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Nạp thử bộ file mẫu</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hộp thoại nhập file"
              className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Dual File Drop Zones */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Slot 1: Question File */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    1. File câu hỏi (Đề thi)
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile('file_cau_hoi_mau.txt', SAMPLE_QUESTION_FILE_TXT)
                    }
                    className="inline-flex cursor-pointer items-center gap-1 font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Tải mẫu</span>
                  </button>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    |
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuestionPasteMode((v) => !v)}
                    className="inline-flex cursor-pointer items-center gap-1 font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>{questionPasteMode ? 'Ẩn khung dán' : 'Dán văn bản'}</span>
                  </button>
                </div>
              </div>

              <input
                ref={questionInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleQuestionFile(file);
                  e.target.value = '';
                }}
              />

              <div
                role="button"
                tabIndex={0}
                onClick={() => questionInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    questionInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setQuestionDragging(true);
                }}
                onDragLeave={() => setQuestionDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setQuestionDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleQuestionFile(file);
                }}
                className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
                  questionDragging
                    ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40'
                    : questionFileName
                      ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/70 dark:bg-emerald-950/30'
                      : 'border-slate-300 bg-white hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-500'
                }`}
              >
                {questionFileName ? (
                  <>
                    <FileCheck2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    <p className="mt-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                      {questionFileName}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-emerald-700 tabular-nums dark:text-emerald-400">
                      Đã tách được {mergedDrafts.length} câu hỏi · Bấm hoặc kéo file khác để thay
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                    <p className="mt-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Kéo thả file câu hỏi vào đây hoặc bấm để chọn tệp
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Nhận diện tự động Phần I (A-D), Phần II (a-d), Phần III
                    </p>
                  </>
                )}
              </div>

              {(questionFileName || questionText.trim().length > 0) && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono tabular-nums">
                    {questionText.length.toLocaleString('vi-VN')} ký tự
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setQuestionFileName(null);
                      setQuestionText('');
                      setManualOverrides({});
                      setRemovedIds(new Set());
                    }}
                    className="cursor-pointer font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Xóa nội dung câu hỏi
                  </button>
                </div>
              )}

              {questionPasteMode && (
                <textarea
                  rows={5}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Dán trực tiếp nội dung đề thi (Câu 1... A. ... B. ... C. ... D. ...)"
                  className="mt-2.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              )}

              {questionError && (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {questionError}
                </p>
              )}
            </div>

            {/* Slot 2: Answer File */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    2. File câu trả lời (Đáp án &amp; Lời giải)
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => downloadSampleAnswerExcel('file_cau_tra_loi_mau.xlsx')}
                    className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Mẫu Excel</span>
                  </button>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    |
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile('file_cau_tra_loi_mau.txt', SAMPLE_ANSWER_FILE_TXT)
                    }
                    className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
                  >
                    <span>Mẫu .txt</span>
                  </button>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    |
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnswerPasteMode((v) => !v)}
                    className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap font-medium text-slate-600 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-400"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>{answerPasteMode ? 'Ẩn khung dán' : 'Dán văn bản'}</span>
                  </button>
                </div>
              </div>

              <input
                ref={answerInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAnswerFile(file);
                  e.target.value = '';
                }}
              />

              <div
                role="button"
                tabIndex={0}
                onClick={() => answerInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    answerInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setAnswerDragging(true);
                }}
                onDragLeave={() => setAnswerDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setAnswerDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleAnswerFile(file);
                }}
                className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
                  answerDragging
                    ? 'border-emerald-600 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/40'
                    : answerFileName
                      ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800/70 dark:bg-emerald-950/30'
                      : 'border-slate-300 bg-white hover:border-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500'
                }`}
              >
                {answerFileName ? (
                  <>
                    <FileCheck2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    <p className="mt-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                      {answerFileName}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-emerald-700 tabular-nums dark:text-emerald-400">
                      Đã phân tích {parsedAnswers.length} đáp án · Tự động ghép theo số câu &amp; phần
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-slate-400 dark:text-slate-500" />
                    <p className="mt-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Kéo thả file đáp án vào đây hoặc bấm để chọn tệp
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Hỗ trợ Excel (.xlsx, .xls), bảng Word, 1.A 2.B, Đ-S-Đ-S, trả lời ngắn &amp; Lời giải
                    </p>
                  </>
                )}
              </div>

              {(answerFileName || answerText.trim().length > 0) && (
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono tabular-nums">
                    {parsedAnswers.length} mục đáp án được nhận diện
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAnswerFileName(null);
                      setAnswerText('');
                    }}
                    className="cursor-pointer font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Xóa file đáp án
                  </button>
                </div>
              )}

              {answerPasteMode && (
                <textarea
                  rows={5}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Dán bảng đáp án (VD: Câu 1: B | Lời giải: ... hoặc 1.A 2.C)"
                  className="mt-2.5 w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              )}

              {answerError && (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {answerError}
                </p>
              )}
            </div>
          </div>

          {/* Default Metadata for Imported Questions */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <label
                htmlFor="import-exam-group-title"
                className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300"
              >
                Tên đề thi / Mục lưu trong Ngân hàng câu hỏi
              </label>
              <input
                id="import-exam-group-title"
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="VD: Đề kiểm tra Giữa kỳ I — Toán 12"
                className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 focus:border-blue-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Toàn bộ câu hỏi nhập từ đề này sẽ được gom vào một mục riêng mang tên trên để dễ quản lý.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Môn học mặc định
                  </label>
                  <button
                    type="button"
                    onClick={() => setAddSubjectModalOpen(true)}
                    className="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                  >
                    + Thêm môn
                  </button>
                </div>
                <SubjectSearchSelect
                  compact
                  value={subject}
                  onChange={(val) => {
                    setSubject(val);
                    if (questionError) setQuestionError(null);
                  }}
                  placeholder="Tìm tên môn..."
                  ariaLabel="Tìm kiếm và chọn môn học nhập đề"
                  currentUser={currentUser}
                  onOpenAdvancedAdd={() => setAddSubjectModalOpen(true)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Khối / Bậc học
                </label>
                <GradeInputControl
                  compact
                  value={grade}
                  onChange={setGrade}
                  ariaLabel="Chọn hoặc nhập khối từ 1 đến 12, Đại học hoặc Cao đẳng"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Mức độ mặc định
                </label>
                <select
                  value={defaultLevel}
                  onChange={(e) => setDefaultLevel(e.target.value as CognitiveLevel)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="biet">Nhận biết</option>
                  <option value="hieu">Thông hiểu</option>
                  <option value="van_dung">Vận dụng</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Chuyên đề mặc định
                </label>
                <input
                  type="text"
                  value={defaultTopic}
                  onChange={(e) => setDefaultTopic(e.target.value)}
                  placeholder="VD: Ôn tập học kỳ"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Parsed Questions + Matched Answers Preview */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Xem trước &amp; Đối chiếu câu hỏi – câu trả lời ({stats.total} câu)
              </h3>
              {stats.total > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums dark:text-slate-400">
                  <span>Phần I: {stats.p1}</span>
                  <span aria-hidden="true">·</span>
                  <span>Phần II: {stats.p2}</span>
                  <span aria-hidden="true">·</span>
                  <span>Phần III: {stats.p3}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{stats.readyCount} hợp lệ</span>
                  </span>
                  {stats.warningCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{stats.warningCount} cần kiểm tra</span>
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {mergedDrafts.length === 0 ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Chưa có câu hỏi nào được nạp
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Hãy thả file câu hỏi và file câu trả lời vào 2 ô phía trên, hoặc bấm{' '}
                  <strong>Nạp thử bộ file mẫu</strong> để xem cấu trúc chuẩn.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {mergedDrafts.map((draft, idx) => {
                  const overrideKey = `${draft.sourcePart ?? 0}_${draft.sourceNumber}_${idx}`;
                  const partText =
                    draft.type === 'multiple_choice'
                      ? 'Phần I'
                      : draft.type === 'true_false'
                        ? 'Phần II'
                        : 'Phần III';

                  return (
                    <div
                      key={draft.tempId}
                      className={`rounded-xl border p-4 text-xs ${
                        draft.warnings.length > 0
                          ? 'border-amber-300 bg-amber-50/40 dark:border-amber-800/70 dark:bg-amber-950/20'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                              Câu {draft.sourceNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-blue-700 dark:text-blue-400">
                              {partText}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{COGNITIVE_LEVEL_LABELS[draft.level]}</span>
                            <span aria-hidden="true">·</span>
                            <span>{draft.topic}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-semibold ${
                                draft.answerSource === 'answer_file'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : draft.answerSource === 'embedded'
                                    ? 'text-blue-700 dark:text-blue-400'
                                    : draft.answerSource === 'manual'
                                      ? 'text-slate-700 dark:text-slate-300'
                                      : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {draft.answerSource === 'answer_file'
                                ? 'Đã ghép từ file trả lời'
                                : draft.answerSource === 'embedded'
                                  ? 'Đáp án sẵn trong file đề'
                                  : draft.answerSource === 'manual'
                                    ? 'Đã chỉnh thủ công'
                                    : 'Chưa có đáp án'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {draft.prompt}
                          </p>
                        </div>

                        <button
                          type="button"
                          aria-label={`Loại bỏ câu ${draft.sourceNumber}`}
                          onClick={() =>
                            setRemovedIds((prev) => new Set(prev).add(draft.tempId))
                          }
                          className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Interactive Answer Preview / Quick Fix */}
                      {draft.type === 'multiple_choice' && draft.options && (
                        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {draft.options.map((opt, optIdx) => {
                            const isSelected = draft.correctOptionIndex === optIdx;
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() =>
                                  updateDraftManual(overrideKey, {
                                    correctOptionIndex: optIdx as 0 | 1 | 2 | 3,
                                  })
                                }
                                className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors ${
                                  isSelected
                                    ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-200'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                                }`}
                              >
                                <span className="shrink-0 font-mono font-bold">
                                  {OPTION_LETTERS[optIdx]}.
                                </span>
                                <span className="min-w-0 flex-1 leading-snug break-words">
                                  {opt || '(Trống)'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {draft.type === 'true_false' && draft.statements && (
                        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {draft.statements.map((st, sIdx) => (
                            <div
                              key={st.id}
                              className="flex items-start justify-between gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-2 text-slate-700 dark:text-slate-200">
                                <strong className="shrink-0 font-mono">{st.id})</strong>
                                <span className="min-w-0 flex-1 leading-snug break-words">
                                  {st.text || '(Thiếu nội dung ý)'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...(draft.statements ?? [])] as typeof draft.statements;
                                  next[sIdx] = { ...next[sIdx], isTrue: !next[sIdx].isTrue };
                                  updateDraftManual(overrideKey, { statements: next });
                                }}
                                className={`shrink-0 cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                                  st.isTrue
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                }`}
                              >
                                {st.isTrue ? 'Đúng' : 'Sai'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {draft.type === 'short_answer' && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="text-slate-500 dark:text-slate-400">Đáp án chuẩn:</span>
                          <input
                            type="text"
                            maxLength={4}
                            value={draft.shortAnswer ?? ''}
                            onChange={(e) =>
                              updateDraftManual(overrideKey, {
                                shortAnswer: e.target.value
                                  .replace(/[^0-9.,-]/g, '')
                                  .slice(0, 4),
                              })
                            }
                            placeholder="Nhập ≤ 4 ký tự"
                            className="h-8 w-28 rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                      )}

                      {draft.explanation && (
                        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
                          <strong>Lời giải:</strong> {draft.explanation}
                        </p>
                      )}

                      {draft.warnings.length > 0 && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>{draft.warnings.join(' · ')} (có thể bấm chọn nhanh ở trên)</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Optional Direct Exam Creation */}
          {onCreateExam && mergedDrafts.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={alsoCreateExam}
                  onChange={(e) => setAlsoCreateExam(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                <span>Đồng thời tạo thành Đề thi &amp; Phòng thi mới từ bộ câu hỏi vừa nhập</span>
              </label>

              {alsoCreateExam && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Tên kỳ thi / Đề thi
                      </label>
                      <input
                        type="text"
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Mã phòng thi
                      </label>
                      <input
                        type="text"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs font-bold uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Thời lượng (phút)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={240}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {currentUser && (
                    <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                          Quyền riêng tư đề thi
                        </label>
                        <select
                          value={isPrivateExam ? 'private' : 'public'}
                          onChange={(e) => setIsPrivateExam(e.target.value === 'private')}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="public">Công khai theo khối / lớp</option>
                          <option value="private">
                            Riêng tư (Chỉ tài khoản {currentUser.fullName} thấy)
                          </option>
                        </select>
                      </div>

                      {isPrivateExam && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                            Gán vào Lớp thi riêng
                          </label>
                          <select
                            value={selectedPrivateClassId}
                            onChange={(e) => setSelectedPrivateClassId(e.target.value)}
                            className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            <option value="">Đề riêng cá nhân (Chưa gắn lớp riêng)</option>
                            {privateClasses.map((pc) => (
                              <option key={pc.id} value={pc.id}>
                                {pc.name} ({formatGradeLabel(pc.grade)})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {stats.total > 0
              ? `Sẵn sàng nhập ${stats.total} câu hỏi (${stats.fromAnswerFile} câu đối chiếu từ file trả lời).`
              : 'Chấp nhận các định dạng .xlsx, .xls, .docx, .txt, .md, .csv, .json.'}
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={mergedDrafts.length === 0}
              onClick={handleConfirmImport}
              className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-blue-700 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>
                {alsoCreateExam && onCreateExam
                  ? `Nhập ${mergedDrafts.length} câu & Tạo đề thi`
                  : `Nhập ${mergedDrafts.length} câu hỏi vào ngân hàng`}
              </span>
            </button>
          </div>
        </div>
      </div>

      <AddSubjectModal
        open={addSubjectModalOpen}
        onClose={() => setAddSubjectModalOpen(false)}
        currentUser={currentUser}
        onSubjectAdded={(created) => {
          setSubject(created.id);
          setAddSubjectModalOpen(false);
        }}
      />
    </div>
  );
}
