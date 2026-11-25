export type UserRole = 'student' | 'teacher' | 'admin';

export interface SystemConfig {
  allowSelfRegistration: boolean;
  allowGuestPreview: boolean;
  announcementEnabled: boolean;
  announcementText: string;
}

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  studentSbd?: string;
  studentClass?: string;
  schoolName?: string;
  subject?: SubjectId;
  avatarUrl?: string;
  facebookUrl?: string;
  enrolledClassIds?: string[];
  createdAt: string;
}

export type SubjectId = string;

export type GradeLevel = number | string;

export type CognitiveLevel = 'biet' | 'hieu' | 'van_dung';

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export type ExamCategory =
  | 'tot_nghiep_2025'
  | 'cuoi_ky'
  | 'giua_ky'
  | 'thuong_xuyen';

export interface TrueFalseStatement {
  id: 'a' | 'b' | 'c' | 'd';
  text: string;
  isTrue: boolean;
}

export type SharePermission = 'view' | 'edit';

export interface ResourceShareGrant {
  teacherId: string;
  teacherEmail: string;
  teacherName: string;
  permission: SharePermission;
  sharedAt: string;
}

export interface Question {
  id: string;
  subject: SubjectId;
  grade: GradeLevel;
  topic: string;
  level: CognitiveLevel;
  type: QuestionType;
  prompt: string;
  // Part I: Multiple choice (4 options A, B, C, D)
  options?: [string, string, string, string];
  correctOptionIndex?: 0 | 1 | 2 | 3;
  // Part II: True/False (4 statements a, b, c, d)
  statements?: [
    TrueFalseStatement,
    TrueFalseStatement,
    TrueFalseStatement,
    TrueFalseStatement,
  ];
  // Part III: Short answer (max 4 chars per MOET 2025 OMR grid)
  shortAnswer?: string;
  acceptedAnswers?: string[];
  explanation: string;
  isPrivate?: boolean;
  ownerTeacherId?: string;
  ownerTeacherName?: string;
  sharedWith?: ResourceShareGrant[];
  sourceExamId?: string;
  sourceExamTitle?: string;
  createdAt: string;
}

export interface TeacherPrivateClass {
  id: string;
  classCode?: string;
  name: string;
  grade: GradeLevel;
  subject?: SubjectId;
  description?: string;
  requireApproval?: boolean;
  ownerTeacherId: string;
  ownerTeacherName: string;
  sharedWith?: ResourceShareGrant[];
  createdAt: string;
}

export type ClassJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ClassJoinRequest {
  id: string;
  classId: string;
  classCode: string;
  studentUserId: string;
  studentName: string;
  studentSbd?: string;
  studentClass?: string;
  studentEmail?: string;
  status: ClassJoinRequestStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewedByTeacherName?: string;
}

export type ScheduleDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface ClassMaterial {
  id: string;
  classId: string;
  title: string;
  subject: SubjectId;
  grade: GradeLevel;
  category: string;
  summary: string;
  keyPoints: string[];
  contentText: string;
  attachmentName?: string;
  ownerTeacherId: string;
  ownerTeacherName: string;
  sharedWith?: ResourceShareGrant[];
  createdAt: string;
}

export interface ClassAssignment {
  id: string;
  classId: string;
  title: string;
  subject: SubjectId;
  grade: GradeLevel;
  description: string;
  dueDateLabel: string;
  estimatedMinutes: number;
  relatedRoomCode?: string;
  ownerTeacherId: string;
  ownerTeacherName: string;
  sharedWith?: ResourceShareGrant[];
  createdAt: string;
}

export interface ClassScheduleSlot {
  id: string;
  classId: string;
  dayKey: ScheduleDayKey;
  timeSlot: string;
  subject: SubjectId;
  topic: string;
  roomOrNote: string;
  ownerTeacherId: string;
  ownerTeacherName: string;
  sharedWith?: ResourceShareGrant[];
  createdAt: string;
}

export interface Exam {
  id: string;
  roomCode: string;
  title: string;
  subject: SubjectId;
  grade: GradeLevel;
  /** Optional list of specific classes (e.g. ['12A1', '12A2']). Empty/omitted means whole grade. */
  targetClasses?: string[];
  /** When true, only the owning teacher user can view and manage this exam */
  isPrivate?: boolean;
  ownerTeacherId?: string;
  ownerTeacherName?: string;
  sharedWith?: ResourceShareGrant[];
  privateClassId?: string;
  category: ExamCategory;
  /** Duration of the exam in minutes */
  duration: number;
  /** Backwards-compatible alias kept synchronized with duration */
  durationMinutes: number;
  /** Automatically lock inputs and submit answers when timer reaches 00:00 */
  autoSubmitOnTimeout: boolean;
  /** Minutes remaining threshold to trigger low-time warning */
  warningMinutes?: number;
  status: 'active' | 'draft' | 'closed';
  part1QuestionIds: string[];
  part2QuestionIds: string[];
  part3QuestionIds: string[];
  part1PointPerQ: number;
  part2PointMaxPerQ: number;
  part3PointPerQ: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  strictProctoring: boolean;
  showSolutionsAfterSubmit: boolean;
  createdBy: string;
  createdAt: string;
}

export interface VariantPart1Question extends Question {
  type: 'multiple_choice';
  options: [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
  // Maps displayed option index (0..3) back to original option index (0..3)
  optionPermutation: [number, number, number, number];
}

export interface ExamVariant {
  variantCode: string;
  part1: VariantPart1Question[];
  part2: Question[];
  part3: Question[];
}

export interface ViolationLog {
  timestamp: string;
  type:
    | 'tab_switch'
    | 'window_blur'
    | 'fullscreen_exit'
    | 'copy_attempt'
    | 'network_offline';
  detail: string;
}

export type ExamActionType =
  | 'started_exam'
  | 'paused_exam'
  | 'resumed_exam'
  | 'flagged_question'
  | 'unflagged_question'
  | 'fullscreen_entered'
  | 'fullscreen_exited'
  | 'sound_muted'
  | 'sound_unmuted'
  | 'low_time_warning'
  | 'network_offline'
  | 'network_online'
  | 'violation'
  | 'submitted_exam';

export interface ExamActionLog {
  id: string;
  timestamp: string;
  elapsedSeconds: number;
  type: ExamActionType;
  detail: string;
  metadata?: {
    questionLabel?: string;
    severity?: 'info' | 'warning';
  };
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface TeacherAlert {
  id: string;
  timestamp: string;
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
  severity: AlertSeverity;
  read: boolean;
}

export interface CandidateAnswers {
  part1: Record<string, number>;
  part2: Record<string, Partial<Record<'a' | 'b' | 'c' | 'd', boolean>>>;
  part3: Record<string, string>;
  flagged: Record<string, boolean>;
}

export interface QuestionGradingResult {
  questionId: string;
  type: QuestionType;
  level: CognitiveLevel;
  earned: number;
  max: number;
  isFullyCorrect: boolean;
  correctStatementsCount?: number;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  examTitle: string;
  roomCode: string;
  subject: SubjectId;
  variantCode: string;
  submittedByUserId?: string;
  studentName: string;
  studentSbd: string;
  studentClass: string;
  startedAt: string;
  submittedAt: string;
  elapsedSeconds: number;
  submissionReason?: 'manual' | 'timeout';
  part1Score: number;
  part2Score: number;
  part3Score: number;
  totalScore: number;
  maxPossibleScore: number;
  part1CorrectCount: number;
  part1Total: number;
  part2CorrectStatements: number;
  part2TotalStatements: number;
  part3CorrectCount: number;
  part3Total: number;
  levelBreakdown: Record<CognitiveLevel, { earned: number; max: number }>;
  questionResults: QuestionGradingResult[];
  violations: ViolationLog[];
  actionLogs?: ExamActionLog[];
  answers: CandidateAnswers;
  variantSnapshot: ExamVariant;
}

export interface SubjectMeta {
  id: SubjectId;
  name: string;
  shortName: string;
  defaultPart1Count: number;
  defaultPart2Count: number;
  defaultPart3Count: number;
  defaultDuration: number;
  defaultPart3Point: number;
  isCustom?: boolean;
}

export type SystemLogCategory =
  | 'auth'
  | 'exam'
  | 'question'
  | 'class'
  | 'user'
  | 'security'
  | 'system';

export type SystemLogLevel = 'info' | 'warning' | 'error';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  category: SystemLogCategory;
  level: SystemLogLevel;
  action: string;
  detail: string;
  actorName: string;
  actorRole: UserRole | 'guest' | 'system';
  actorId?: string;
  targetLabel?: string;
}

