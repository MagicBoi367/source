import type {
  CandidateAnswers,
  CognitiveLevel,
  Exam,
  ExamActionLog,
  ExamSubmission,
  ExamVariant,
  GradeLevel,
  Question,
  QuestionGradingResult,
  ResourceShareGrant,
  SharePermission,
  SubjectId,
  SubjectMeta,
  TeacherPrivateClass,
  UserAccount,
  VariantPart1Question,
} from '../types/exam';

export const DEFAULT_SUBJECT_METADATA: Record<string, SubjectMeta> = {
  toan: {
    id: 'toan',
    name: 'Toán học',
    shortName: 'Toán',
    defaultPart1Count: 12,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultDuration: 90,
    defaultPart3Point: 0.5,
  },
  vat_li: {
    id: 'vat_li',
    name: 'Vật lí',
    shortName: 'Lí',
    defaultPart1Count: 18,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultDuration: 50,
    defaultPart3Point: 0.25,
  },
  hoa_hoc: {
    id: 'hoa_hoc',
    name: 'Hóa học',
    shortName: 'Hóa',
    defaultPart1Count: 18,
    defaultPart2Count: 4,
    defaultPart3Count: 6,
    defaultDuration: 50,
    defaultPart3Point: 0.25,
  },
  tin_hoc: {
    id: 'tin_hoc',
    name: 'Tin học',
    shortName: 'Tin',
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 0,
    defaultDuration: 50,
    defaultPart3Point: 0.25,
  },
  tieng_anh: {
    id: 'tieng_anh',
    name: 'Tiếng Anh',
    shortName: 'Anh',
    defaultPart1Count: 40,
    defaultPart2Count: 0,
    defaultPart3Count: 0,
    defaultDuration: 50,
    defaultPart3Point: 0.25,
  },
};

export const SUBJECT_METADATA: Record<SubjectId, SubjectMeta> = {
  ...DEFAULT_SUBJECT_METADATA,
};

// Hydrate any persisted custom subjects immediately so synchronous lookups work on first render
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem('kythi2025_custom_subjects_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            item &&
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            !DEFAULT_SUBJECT_METADATA[item.id]
          ) {
            SUBJECT_METADATA[item.id] = {
              id: item.id,
              name: item.name,
              shortName:
                typeof item.shortName === 'string' && item.shortName.trim()
                  ? item.shortName.trim()
                  : item.name.slice(0, 8),
              defaultPart1Count: Number(item.defaultPart1Count) || 24,
              defaultPart2Count: Number(item.defaultPart2Count) || 0,
              defaultPart3Count: Number(item.defaultPart3Count) || 0,
              defaultDuration: Number(item.defaultDuration) || 50,
              defaultPart3Point: Number(item.defaultPart3Point) || 0.25,
              isCustom: true,
            };
          }
        }
      }
    }
  }
} catch {
  // Ignore malformed storage entries
}

export function getSubjectMeta(subjectId?: string): SubjectMeta {
  if (subjectId && SUBJECT_METADATA[subjectId]) {
    return SUBJECT_METADATA[subjectId];
  }
  const fallbackLabel = subjectId
    ? subjectId.replace(/_/g, ' ').trim()
    : 'Môn học khác';
  return {
    id: subjectId || 'khac',
    name: fallbackLabel || 'Môn học khác',
    shortName: fallbackLabel ? fallbackLabel.slice(0, 8) : 'Khác',
    defaultPart1Count: 24,
    defaultPart2Count: 4,
    defaultPart3Count: 4,
    defaultDuration: 50,
    defaultPart3Point: 0.25,
    isCustom: true,
  };
}

export const COGNITIVE_LEVEL_LABELS: Record<CognitiveLevel, string> = {
  biet: 'Nhận biết',
  hieu: 'Thông hiểu',
  van_dung: 'Vận dụng',
};

export const EXAM_CATEGORY_LABELS: Record<Exam['category'], string> = {
  tot_nghiep_2025: 'Thử Tốt nghiệp THPT 2025',
  cuoi_ky: 'Kiểm tra Cuối kỳ',
  giua_ky: 'Kiểm tra Giữa kỳ',
  thuong_xuyen: 'Kiểm tra Thường xuyên',
};

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatScoreVi(value: number): string {
  return roundScore(value).toFixed(2).replace('.', ',');
}

/**
 * Progressive scoring for MOET 2025 Part II (True/False - 4 statements per question):
 * 1 correct = 0.10 | 2 correct = 0.25 | 3 correct = 0.50 | 4 correct = 1.00
 */
export function scorePart2Question(correctCount: number, maxPerQuestion = 1.0): number {
  if (correctCount <= 0) return 0;
  if (correctCount === 1) return roundScore(0.1 * maxPerQuestion);
  if (correctCount === 2) return roundScore(0.25 * maxPerQuestion);
  if (correctCount === 3) return roundScore(0.5 * maxPerQuestion);
  return roundScore(1.0 * maxPerQuestion);
}

/**
 * Normalize short-answer numeric strings per MOET 2025 rules (supports both ',' and '.' decimal separators).
 */
export function normalizeShortAnswer(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, '').replace(/,/g, '.').toLowerCase();
}

export function isShortAnswerCorrect(
  userInput: string | undefined,
  canonical: string | undefined,
  acceptedAnswers?: string[],
): boolean {
  const normalizedUser = normalizeShortAnswer(userInput);
  if (!normalizedUser) return false;
  const targets = [canonical, ...(acceptedAnswers ?? [])]
    .filter((v): v is string => Boolean(v))
    .map((v) => normalizeShortAnswer(v));

  if (targets.includes(normalizedUser)) return true;

  // Numeric equivalence check (e.g., "0.5" vs ".5" or "2.50" vs "2.5")
  const userNum = Number(normalizedUser);
  if (!Number.isNaN(userNum) && normalizedUser !== '') {
    return targets.some((t) => {
      const targetNum = Number(t);
      return !Number.isNaN(targetNum) && Math.abs(userNum - targetNum) < 1e-6;
    });
  }
  return false;
}

/**
 * Deterministic PRNG (Mulberry32) so variant codes like 0101, 0102 produce stable reproducible exam sheets.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateExamVariant(
  exam: Exam,
  questionMap: Map<string, Question>,
  variantCode: string,
): ExamVariant {
  const rng = mulberry32(hashSeed(`${exam.id}::${variantCode}`));

  const rawPart1 = exam.part1QuestionIds
    .map((id) => questionMap.get(id))
    .filter((q): q is Question => Boolean(q && q.type === 'multiple_choice'));
  const rawPart2 = exam.part2QuestionIds
    .map((id) => questionMap.get(id))
    .filter((q): q is Question => Boolean(q && q.type === 'true_false'));
  const rawPart3 = exam.part3QuestionIds
    .map((id) => questionMap.get(id))
    .filter((q): q is Question => Boolean(q && q.type === 'short_answer'));

  const orderedP1 = exam.shuffleQuestions ? seededShuffle(rawPart1, rng) : rawPart1;
  const orderedP2 = exam.shuffleQuestions ? seededShuffle(rawPart2, rng) : rawPart2;
  const orderedP3 = exam.shuffleQuestions ? seededShuffle(rawPart3, rng) : rawPart3;

  const part1: VariantPart1Question[] = orderedP1.map((q) => {
    const opts = q.options ?? ['', '', '', ''];
    const origCorrect = q.correctOptionIndex ?? 0;
    const perm: [number, number, number, number] = exam.shuffleOptions
      ? (seededShuffle([0, 1, 2, 3], rng) as [number, number, number, number])
      : [0, 1, 2, 3];

    const shuffledOptions: [string, string, string, string] = [
      opts[perm[0]],
      opts[perm[1]],
      opts[perm[2]],
      opts[perm[3]],
    ];
    const newCorrectIdx = perm.indexOf(origCorrect) as 0 | 1 | 2 | 3;

    return {
      ...q,
      type: 'multiple_choice',
      options: shuffledOptions,
      correctOptionIndex: newCorrectIdx,
      optionPermutation: perm,
    };
  });

  return {
    variantCode,
    part1,
    part2: orderedP2,
    part3: orderedP3,
  };
}

export function calculateExamMaxRawScore(exam: Exam): number {
  return roundScore(
    exam.part1QuestionIds.length * exam.part1PointPerQ +
      exam.part2QuestionIds.length * exam.part2PointMaxPerQ +
      exam.part3QuestionIds.length * exam.part3PointPerQ,
  );
}

export function getExamDurationMinutes(
  exam: Partial<Pick<Exam, 'duration' | 'durationMinutes'>>,
): number {
  const raw = exam.duration ?? exam.durationMinutes ?? 45;
  return Math.max(1, Math.round(raw));
}

export function gradeExamSubmission(
  exam: Exam,
  variant: ExamVariant,
  answers: CandidateAnswers,
  meta: {
    studentName: string;
    studentSbd: string;
    studentClass: string;
    startedAt: string;
    submittedAt: string;
    elapsedSeconds: number;
    submissionReason?: 'manual' | 'timeout';
    violations: ExamSubmission['violations'];
    actionLogs?: ExamActionLog[];
  },
): ExamSubmission {
  let part1Score = 0;
  let part1CorrectCount = 0;

  let part2Score = 0;
  let part2CorrectStatements = 0;
  const part2TotalStatements = variant.part2.length * 4;

  let part3Score = 0;
  let part3CorrectCount = 0;

  const levelBreakdown: Record<CognitiveLevel, { earned: number; max: number }> = {
    biet: { earned: 0, max: 0 },
    hieu: { earned: 0, max: 0 },
    van_dung: { earned: 0, max: 0 },
  };

  const questionResults: QuestionGradingResult[] = [];

  for (const q of variant.part1) {
    const selected = answers.part1[q.id];
    const isCorrect = selected !== undefined && selected === q.correctOptionIndex;
    const max = exam.part1PointPerQ;
    const earned = isCorrect ? max : 0;
    if (isCorrect) part1CorrectCount += 1;
    part1Score += earned;

    levelBreakdown[q.level].max += max;
    levelBreakdown[q.level].earned += earned;
    questionResults.push({
      questionId: q.id,
      type: 'multiple_choice',
      level: q.level,
      earned: roundScore(earned),
      max,
      isFullyCorrect: isCorrect,
    });
  }

  for (const q of variant.part2) {
    const userStmts = answers.part2[q.id] ?? {};
    let correctStmts = 0;
    for (const stmt of q.statements ?? []) {
      const userVal = userStmts[stmt.id];
      if (userVal !== undefined && userVal === stmt.isTrue) {
        correctStmts += 1;
      }
    }
    const max = exam.part2PointMaxPerQ;
    const earned = scorePart2Question(correctStmts, max);
    part2CorrectStatements += correctStmts;
    part2Score += earned;

    levelBreakdown[q.level].max += max;
    levelBreakdown[q.level].earned += earned;
    questionResults.push({
      questionId: q.id,
      type: 'true_false',
      level: q.level,
      earned: roundScore(earned),
      max,
      isFullyCorrect: correctStmts === 4,
      correctStatementsCount: correctStmts,
    });
  }

  for (const q of variant.part3) {
    const userAns = answers.part3[q.id];
    const isCorrect = isShortAnswerCorrect(userAns, q.shortAnswer, q.acceptedAnswers);
    const max = exam.part3PointPerQ;
    const earned = isCorrect ? max : 0;
    if (isCorrect) part3CorrectCount += 1;
    part3Score += earned;

    levelBreakdown[q.level].max += max;
    levelBreakdown[q.level].earned += earned;
    questionResults.push({
      questionId: q.id,
      type: 'short_answer',
      level: q.level,
      earned: roundScore(earned),
      max,
      isFullyCorrect: isCorrect,
    });
  }

  const rawTotal = roundScore(part1Score + part2Score + part3Score);
  const maxPossibleScore = roundScore(
    variant.part1.length * exam.part1PointPerQ +
      variant.part2.length * exam.part2PointMaxPerQ +
      variant.part3.length * exam.part3PointPerQ,
  );

  // Normalize to 10-point scale if custom point structure differs from 10.00
  const totalScore =
    maxPossibleScore > 0 && Math.abs(maxPossibleScore - 10) > 0.01
      ? roundScore((rawTotal / maxPossibleScore) * 10)
      : rawTotal;

  for (const lvl of ['biet', 'hieu', 'van_dung'] as CognitiveLevel[]) {
    levelBreakdown[lvl].earned = roundScore(levelBreakdown[lvl].earned);
    levelBreakdown[lvl].max = roundScore(levelBreakdown[lvl].max);
  }

  return {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    examId: exam.id,
    examTitle: exam.title,
    roomCode: exam.roomCode,
    subject: exam.subject,
    variantCode: variant.variantCode,
    studentName: meta.studentName,
    studentSbd: meta.studentSbd,
    studentClass: meta.studentClass,
    startedAt: meta.startedAt,
    submittedAt: meta.submittedAt,
    elapsedSeconds: meta.elapsedSeconds,
    submissionReason: meta.submissionReason ?? 'manual',
    part1Score: roundScore(part1Score),
    part2Score: roundScore(part2Score),
    part3Score: roundScore(part3Score),
    totalScore,
    maxPossibleScore,
    part1CorrectCount,
    part1Total: variant.part1.length,
    part2CorrectStatements,
    part2TotalStatements,
    part3CorrectCount,
    part3Total: variant.part3.length,
    levelBreakdown,
    questionResults,
    violations: meta.violations,
    actionLogs: meta.actionLogs ?? [],
    answers,
    variantSnapshot: variant,
  };
}

export function classifyAcademicRankTT22(score: number): {
  label: string;
  tone: 'emerald' | 'blue' | 'amber' | 'red';
} {
  if (score >= 8.0) return { label: 'Tốt', tone: 'emerald' };
  if (score >= 6.5) return { label: 'Khá', tone: 'blue' };
  if (score >= 5.0) return { label: 'Đạt', tone: 'amber' };
  return { label: 'Chưa đạt', tone: 'red' };
}

export function formatDurationMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function exportSubmissionsToCsv(
  submissions: ExamSubmission[],
  filename = 'bang_diem_2025.csv',
): void {
  const headers = [
    'Số báo danh',
    'Họ và tên',
    'Lớp / Đơn vị',
    'Môn học',
    'Kỳ thi',
    'Mã phòng',
    'Mã đề',
    'Phần I (Số câu đúng)',
    'Điểm Phần I',
    'Phần II (Số ý đúng)',
    'Điểm Phần II',
    'Phần III (Số câu đúng)',
    'Điểm Phần III',
    'Tổng điểm (Thang 10)',
    'Xếp loại (TT 22)',
    'Thời gian làm (giây)',
    'Hình thức nộp',
    'Số cảnh báo giám sát',
    'Số lần tạm dừng',
    'Số thao tác ghi nhận',
    'Thời điểm nộp bài',
  ];

  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = submissions.map((s) => {
    const logs = s.actionLogs ?? [];
    const pauseCount = logs.filter((l) => l.type === 'paused_exam').length;
    return [
      s.studentSbd,
      s.studentName,
      s.studentClass,
      getSubjectMeta(s.subject).name,
      s.examTitle,
      s.roomCode,
      s.variantCode,
      `${s.part1CorrectCount}/${s.part1Total}`,
      formatScoreVi(s.part1Score),
      `${s.part2CorrectStatements}/${s.part2TotalStatements}`,
      formatScoreVi(s.part2Score),
      `${s.part3CorrectCount}/${s.part3Total}`,
      formatScoreVi(s.part3Score),
      formatScoreVi(s.totalScore),
      classifyAcademicRankTT22(s.totalScore).label,
      s.elapsedSeconds,
      s.submissionReason === 'timeout' ? 'Tự động hết giờ' : 'Thủ công',
      s.violations.length,
      pauseCount,
      logs.length,
      new Date(s.submittedAt).toLocaleString('vi-VN'),
    ];
  });

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const GRADE_LEVELS = [12, 11, 10] as const;

export const SCHOOL_GRADE_NUMBERS = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

export const HIGHER_EDUCATION_GRADES = ['Đại học', 'Cao đẳng'] as const;

export const OTHER_GRADE_LEVELS = ['Khác'] as const;

export const ALLOWED_GRADES: ReadonlyArray<GradeLevel> = [
  ...SCHOOL_GRADE_NUMBERS,
  ...HIGHER_EDUCATION_GRADES,
  ...OTHER_GRADE_LEVELS,
];

export const GRADE_LABELS: Record<number, string> = {
  12: 'Khối 12',
  11: 'Khối 11',
  10: 'Khối 10',
};

export const GRADE_DESCRIPTIONS: Record<number, string> = {
  12: 'Ôn thi Tốt nghiệp THPT 2025 & Kiểm tra định kỳ Lớp 12',
  11: 'Đề kiểm tra giữa kỳ, cuối kỳ & chuyên đề Lớp 11 (GDPT 2018)',
  10: 'Đề kiểm tra nền tảng & thường xuyên Lớp 10 (GDPT 2018)',
};

function stripVietnameseForGrade(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAllowedGradeInput(raw: GradeLevel): GradeLevel | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 1 && raw <= 12 ? raw : null;
  }
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  const plain = stripVietnameseForGrade(trimmed);
  if (
    plain === 'dai hoc' ||
    plain === 'dh' ||
    plain === 'bac dai hoc' ||
    plain === 'khoi dai hoc'
  ) {
    return 'Đại học';
  }
  if (
    plain === 'cao dang' ||
    plain === 'cd' ||
    plain === 'bac cao dang' ||
    plain === 'khoi cao dang'
  ) {
    return 'Cao đẳng';
  }
  if (
    plain === 'khac' ||
    plain === 'bac khac' ||
    plain === 'khoi khac' ||
    plain === 'other'
  ) {
    return 'Khác';
  }

  const numMatch = plain.match(/^(?:(?:khoi|lop)\s*)?(\d{1,2})$/);
  if (numMatch) {
    const numeric = Number(numMatch[1]);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) {
      return numeric;
    }
  }
  return null;
}

export function isValidAllowedGrade(raw: GradeLevel): boolean {
  return parseAllowedGradeInput(raw) !== null;
}

export function getGradeCodeToken(grade: GradeLevel): string {
  const parsed = parseAllowedGradeInput(grade);
  if (parsed === 'Đại học') return 'DH';
  if (parsed === 'Cao đẳng') return 'CD';
  if (parsed === 'Khác') return 'KHAC';
  if (typeof parsed === 'number') return String(parsed);
  return (
    String(grade)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6) || '12'
  );
}

export function sanitizeClassCodeInput(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);
}

export function isValidClassCode5(raw: string): boolean {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{5}$/.test(code)) return false;
  const letterCount = (code.match(/[A-Z]/g) ?? []).length;
  const digitCount = (code.match(/\d/g) ?? []).length;
  return letterCount === 3 && digitCount === 2;
}

export function generateClassCode5(options?: {
  subject?: string;
  name?: string;
  grade?: GradeLevel;
  excludeCodes?: ReadonlySet<string>;
  previousCode?: string;
}): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const toAsciiLetters = (val?: string) =>
    (val ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');

  const subjLetters = toAsciiLetters(options?.subject);
  const nameLetters = toAsciiLetters(options?.name);
  const seedPool = `${subjLetters}${nameLetters}`;

  const exclude = options?.excludeCodes;
  const prev = options?.previousCode?.trim().toUpperCase();

  const shuffleChars = (chars: string[]): string => {
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
    }
    return chars.join('');
  };

  for (let attempt = 0; attempt < 100; attempt += 1) {
    // Pick up to 1 seed letter (on early attempts) + random uppercase letters to total 3 letters,
    // plus 2 random digits, then shuffle all 5 characters across all positions.
    const letterChars: string[] = [];
    if (attempt < 50 && seedPool.length > 0) {
      letterChars.push(seedPool.charAt(Math.floor(Math.random() * seedPool.length)));
    }
    while (letterChars.length < 3) {
      letterChars.push(letters.charAt(Math.floor(Math.random() * letters.length)));
    }
    const digitChars: string[] = [
      digits.charAt(Math.floor(Math.random() * digits.length)),
      digits.charAt(Math.floor(Math.random() * digits.length)),
    ];

    const code = shuffleChars([...letterChars, ...digitChars]);
    if (
      isValidClassCode5(code) &&
      code !== prev &&
      (!exclude || !exclude.has(code))
    ) {
      return code;
    }
  }

  const fallbackChars = [
    letters.charAt(Math.floor(Math.random() * letters.length)),
    letters.charAt(Math.floor(Math.random() * letters.length)),
    letters.charAt(Math.floor(Math.random() * letters.length)),
    digits.charAt(Math.floor(Math.random() * digits.length)),
    digits.charAt(Math.floor(Math.random() * digits.length)),
  ];
  return shuffleChars(fallbackChars);
}

export function normalizeGradeValue(raw: GradeLevel): GradeLevel {
  return parseAllowedGradeInput(raw) ?? 12;
}

export function formatGradeLabel(grade?: GradeLevel | null): string {
  if (grade === undefined || grade === null) return 'Chưa rõ khối';
  const raw = String(grade).trim();
  if (!raw) return 'Chưa rõ khối';
  const parsed = parseAllowedGradeInput(grade);
  if (typeof parsed === 'number') {
    return `Khối ${parsed}`;
  }
  if (parsed === 'Đại học' || parsed === 'Cao đẳng' || parsed === 'Khác') {
    return parsed;
  }
  if (/^\d+$/.test(raw)) {
    return `Khối ${raw}`;
  }
  if (/^(khối|khoi|lớp|lop|đại học|dai hoc|cao đẳng|cao dang|khác|khac)\b/i.test(raw)) {
    return raw;
  }
  return `Lớp ${raw}`;
}

export function getGradeDescription(grade: GradeLevel): string {
  const parsed = parseAllowedGradeInput(grade);
  if (parsed === 'Đại học') {
    return 'Đề kiểm tra, học phần & ôn luyện bậc Đại học';
  }
  if (parsed === 'Cao đẳng') {
    return 'Đề kiểm tra, học phần & ôn luyện bậc Cao đẳng';
  }
  if (parsed === 'Khác') {
    return 'Đề kiểm tra, học phần & ôn luyện bậc học khác';
  }
  const numeric = Number(grade);
  if (Number.isFinite(numeric) && GRADE_DESCRIPTIONS[numeric]) {
    return GRADE_DESCRIPTIONS[numeric];
  }
  return `Đề kiểm tra, bài tập & ôn luyện ${formatGradeLabel(grade)}`;
}

export function areGradesEqual(a?: GradeLevel | null, b?: GradeLevel | null): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
}

export function collectAvailableGrades(
  items: ReadonlyArray<{ grade: GradeLevel }>,
  includeDefaults = true,
): GradeLevel[] {
  const result: GradeLevel[] = includeDefaults ? [...GRADE_LEVELS] : [];
  const seen = new Set(result.map((g) => String(g).trim().toUpperCase()));
  for (const item of items) {
    if (item.grade === undefined || item.grade === null) continue;
    const normalized = normalizeGradeValue(item.grade);
    const key = String(normalized).trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function parseTargetClassesInput(raw: string): string[] {
  const tokens = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(tokens));
}

export function extractGradeFromClassName(studentClass?: string): number | null {
  if (!studentClass) return null;
  const match = studentClass.trim().match(/^(\d{1,2})/);
  if (!match) return null;
  return Number(match[1]);
}

export function formatExamClassScope(exam: Pick<Exam, 'grade' | 'targetClasses'>): string {
  const gradeLabel = formatGradeLabel(exam.grade);
  const classes = (exam.targetClasses ?? []).filter(Boolean);
  if (classes.length === 0) {
    return `${gradeLabel} · Toàn khối`;
  }
  return `${gradeLabel} · Lớp ${classes.join(', ')}`;
}

export function doesExamMatchStudentClass(
  exam: Pick<Exam, 'grade' | 'targetClasses'>,
  studentClass?: string,
): boolean {
  const normalized = (studentClass ?? '').trim().toUpperCase();
  if (!normalized) return true;
  if (String(exam.grade).trim().toUpperCase() === normalized) {
    return true;
  }
  const studentGrade = extractGradeFromClassName(normalized);
  if (studentGrade !== null && typeof exam.grade === 'number' && exam.grade !== studentGrade) {
    return false;
  }
  const targets = (exam.targetClasses ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (targets.length === 0) return true;
  return targets.includes(normalized);
}

export function normalizeClassName(raw?: string): string {
  return (raw ?? '').trim().toUpperCase();
}

export function collectAvailableClasses(
  exams: Pick<Exam, 'targetClasses'>[],
  submissions: Pick<ExamSubmission, 'studentClass'>[],
): string[] {
  const set = new Set<string>();
  for (const ex of exams) {
    for (const cls of ex.targetClasses ?? []) {
      const normalized = normalizeClassName(cls);
      if (normalized) set.add(normalized);
    }
  }
  for (const sub of submissions) {
    const normalized = normalizeClassName(sub.studentClass);
    if (normalized) set.add(normalized);
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }),
  );
}

export interface ShareableResource {
  ownerTeacherId?: string;
  sharedWith?: ResourceShareGrant[];
}

export function isAdminUser(
  currentUser: Pick<UserAccount, 'role'> | null | undefined,
): boolean {
  return currentUser?.role === 'admin';
}

export function isResourceOwner(
  resource: Pick<ShareableResource, 'ownerTeacherId'> | null | undefined,
  currentUser: Pick<UserAccount, 'id'> | null | undefined,
): boolean {
  if (!resource || !currentUser || !resource.ownerTeacherId) return false;
  return resource.ownerTeacherId === currentUser.id;
}

export function getTeacherSharePermission(
  resource: ShareableResource | null | undefined,
  currentUser: Pick<UserAccount, 'id' | 'role'> | null | undefined,
): SharePermission | null {
  if (!resource || !currentUser) return null;
  const grant = resource.sharedWith?.find((g) => g.teacherId === currentUser.id);
  return grant ? grant.permission : null;
}

export function canTeacherViewResource(
  resource: ShareableResource | null | undefined,
  currentUser: Pick<UserAccount, 'id' | 'role'> | null | undefined,
  accessibleClassIds?: ReadonlySet<string>,
  parentClassId?: string,
): boolean {
  if (!resource || !currentUser) return false;
  if (isAdminUser(currentUser)) return true;
  if (isResourceOwner(resource, currentUser)) return true;
  if (getTeacherSharePermission(resource, currentUser) !== null) return true;
  if (parentClassId && accessibleClassIds?.has(parentClassId)) return true;
  return false;
}

export function canTeacherEditResource(
  resource: ShareableResource | null | undefined,
  currentUser: Pick<UserAccount, 'id' | 'role'> | null | undefined,
  editableClassIds?: ReadonlySet<string>,
  parentClassId?: string,
): boolean {
  if (!resource || !currentUser) return false;
  if (isAdminUser(currentUser)) return true;
  if (isResourceOwner(resource, currentUser)) return true;
  if (getTeacherSharePermission(resource, currentUser) === 'edit') return true;
  if (parentClassId && editableClassIds?.has(parentClassId)) return true;
  return false;
}

export function canManageResourceSharing(
  resource: ShareableResource | null | undefined,
  currentUser: Pick<UserAccount, 'id' | 'role'> | null | undefined,
): boolean {
  if (!resource || !currentUser) return false;
  if (isAdminUser(currentUser)) return true;
  return isResourceOwner(resource, currentUser);
}

export function canUserViewExam(
  exam: Pick<Exam, 'isPrivate' | 'ownerTeacherId' | 'sharedWith' | 'privateClassId'>,
  currentUser: Pick<UserAccount, 'id' | 'role'> | null,
  activeRole?: UserAccount['role'],
  accessibleClassIds?: ReadonlySet<string>,
): boolean {
  const effectiveRole = currentUser?.role ?? activeRole;
  if (effectiveRole === 'admin') return true;
  if (effectiveRole === 'teacher') {
    if (!currentUser) return false;
    return canTeacherViewResource(
      exam,
      currentUser,
      accessibleClassIds,
      exam.privateClassId,
    );
  }
  // Student / public portal visibility
  if (!exam.isPrivate) return true;
  if (!currentUser) return false;
  return Boolean(exam.ownerTeacherId && currentUser.id === exam.ownerTeacherId);
}

export const MAX_CLASSES_PER_TEACHER = 5;

export function isTeacherPrivateClassOwner(
  privateClass: Pick<TeacherPrivateClass, 'ownerTeacherId'>,
  currentUser: Pick<UserAccount, 'id' | 'role'> | null,
): boolean {
  if (!currentUser) return false;
  return isAdminUser(currentUser) || currentUser.id === privateClass.ownerTeacherId;
}

export function canUserViewSubmission(
  submission: Pick<ExamSubmission, 'id' | 'examId' | 'studentSbd' | 'submittedByUserId'>,
  exam: Pick<Exam, 'isPrivate' | 'ownerTeacherId' | 'sharedWith' | 'privateClassId'> | undefined,
  currentUser: Pick<UserAccount, 'id' | 'role' | 'studentSbd'> | null,
  activeRole: UserAccount['role'],
  guestSubmissionIds?: ReadonlySet<string>,
  accessibleClassIds?: ReadonlySet<string>,
): boolean {
  const effectiveRole = currentUser?.role ?? activeRole;
  if (effectiveRole === 'admin') return true;

  if (effectiveRole === 'teacher') {
    if (!currentUser || !exam) return false;
    return canUserViewExam(exam, currentUser, 'teacher', accessibleClassIds);
  }

  if (exam && !canUserViewExam(exam, currentUser, effectiveRole, accessibleClassIds)) {
    return false;
  }

  if (effectiveRole === 'student') {
    if (currentUser) {
      if (submission.submittedByUserId) {
        return submission.submittedByUserId === currentUser.id;
      }
      if (submission.id.startsWith('seed_sub_')) {
        return false;
      }
      const userSbd = (currentUser.studentSbd ?? '').trim().toUpperCase();
      return (
        Boolean(userSbd) &&
        submission.studentSbd.trim().toUpperCase() === userSbd
      );
    }
    return Boolean(guestSubmissionIds?.has(submission.id));
  }

  return true;
}




