import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountManagerModal } from './components/AccountManagerModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { ExamLobbyModal } from './components/ExamLobbyModal';
import { ExamManager } from './components/ExamManager';
import { ExamResultView } from './components/ExamResultView';
import { ExamRoom } from './components/ExamRoom';
import { Header, type AppView } from './components/Header';
import { IntroLandingPage } from './components/IntroLandingPage';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { PortalOverview } from './components/PortalOverview';
import { PrintableExamModal } from './components/PrintableExamModal';
import { QuestionBankManager } from './components/QuestionBankManager';
import { ResultsLedger } from './components/ResultsLedger';
import { RightSidebar } from './components/RightSidebar';
import type { StudentHomeSectionId } from './components/StudentHomeDashboard';
import type { TeacherClassRoomTab } from './components/TeacherHomeDashboard';
import { TeacherAlertToastStack } from './components/TeacherNotificationCenter';
import { UserProfileModal } from './components/UserProfileModal';
import { derivePrivateClassCode } from './data/studentPortalData';
import { useExamStore } from './hooks/useExamStore';
import { useTheme } from './hooks/useTheme';
import type {
  Exam,
  ExamSubmission,
  ExamVariant,
  SystemLogEntry,
  TeacherAlert,
  UserAccount,
} from './types/exam';
import {
  appendSystemLog,
  clearSystemLogs,
  readSystemLogs,
  resetSeedSystemLogs,
  subscribeSystemLogs,
} from './utils/systemLogs';
import {
  ensureSeedAccounts,
  getCurrentSessionUser,
  resetSeedAccounts,
  setCurrentSessionUserId,
} from './utils/authStore';
import {
  canTeacherViewResource,
  canUserViewExam,
  canUserViewSubmission,
  generateExamVariant,
} from './utils/scoring2025';
import {
  clearAllTeacherAlerts,
  markAllTeacherAlertsRead,
  markTeacherAlertRead,
  pushTeacherAlert,
  readTeacherAlerts,
  resetSeedTeacherAlerts,
  subscribeTeacherAlerts,
} from './utils/teacherAlerts';

const TEACHER_ALERT_SOUND_KEY = 'kythi2025_teacher_alert_sound_v1';
const RIGHT_SIDEBAR_COLLAPSED_KEY = 'kythi2025_right_sidebar_collapsed_v1';
const GUEST_SUBMISSION_IDS_KEY = 'kythi2025_guest_sub_ids_v1';

interface ActiveSession {
  exam: Exam;
  variant: ExamVariant;
  candidate: {
    studentName: string;
    studentSbd: string;
    studentClass: string;
  };
}

export default function App() {
  const {
    questions,
    questionMap,
    exams,
    privateClasses,
    classJoinRequests,
    classMaterials,
    classAssignments,
    classSchedules,
    submissions,
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
    addSubmission,
    deleteSubmission,
    resetAllDemoData,
  } = useExamStore();

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    getCurrentSessionUser(),
  );
  const [guestMode, setGuestMode] = useState(false);
  const [showIntroOnStart, setShowIntroOnStart] = useState(true);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [accountModalTab, setAccountModalTab] = useState<'create' | 'list' | null>(null);
  const [profileModalTab, setProfileModalTab] = useState<'view_edit' | 'password' | null>(
    null,
  );

  const [activeView, setActiveView] = useState<AppView>('portal');
  const [activeStudentSection, setActiveStudentSection] =
    useState<StudentHomeSectionId | null>(null);
  const [studentSectionRequest, setStudentSectionRequest] = useState<{
    sectionId: StudentHomeSectionId;
    nonce: number;
  } | null>(null);
  const [activeTeacherClassId, setActiveTeacherClassId] = useState<string | null>(null);
  const [activeTeacherClassTab, setActiveTeacherClassTab] =
    useState<TeacherClassRoomTab | null>(null);
  const [lobbyExam, setLobbyExam] = useState<Exam | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [selectedSubmission, setSelectedSubmission] =
    useState<ExamSubmission | null>(null);
  const [printableExam, setPrintableExam] = useState<Exam | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [resetToast, setResetToast] = useState(false);
  const [alerts, setAlerts] = useState<TeacherAlert[]>(() => readTeacherAlerts());
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>(() => readSystemLogs());
  const [liveToasts, setLiveToasts] = useState<TeacherAlert[]>([]);
  const [alertFocus, setAlertFocus] = useState<{ sbd: string; nonce: number } | null>(null);
  const [resultsInitialFilter, setResultsInitialFilter] = useState<{
    examId?: string;
    className?: string;
    nonce: number;
  } | null>(null);
  const [alertSoundEnabled, setAlertSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(TEACHER_ALERT_SOUND_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(RIGHT_SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileRightSidebarOpen, setMobileRightSidebarOpen] = useState(false);
  const [guestSubmissionIds, setGuestSubmissionIds] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(GUEST_SUBMISSION_IDS_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
    } catch {
      return new Set();
    }
  });
  const { isDark, toggleTheme } = useTheme();
  const activeSessionRef = useRef(activeSession);
  const roleRef = useRef(role);
  const activeViewRef = useRef(activeView);
  const alertSoundRef = useRef(alertSoundEnabled);
  const currentUserRef = useRef(currentUser);
  const allExamMapRef = useRef<Map<string, Exam>>(new Map());

  useEffect(() => {
    void ensureSeedAccounts();
  }, []);

  useEffect(() => {
    if (currentUser && role !== currentUser.role) {
      setRole(currentUser.role);
    }
  }, [currentUser, role, setRole]);

  useEffect(() => {
    if (
      role === 'student' &&
      (activeView === 'exam_manager' ||
        activeView === 'question_bank' ||
        activeView === 'admin')
    ) {
      setActiveView('portal');
    } else if (role !== 'admin' && activeView === 'admin') {
      setActiveView('portal');
    }
  }, [activeView, role]);

  const effectiveRole = currentUser?.role ?? role;

  const accessiblePrivateClasses = useMemo(() => {
    if (effectiveRole === 'admin') return privateClasses;
    if (effectiveRole === 'teacher') {
      return privateClasses.filter((pc) => canTeacherViewResource(pc, currentUser));
    }
    return [];
  }, [privateClasses, currentUser, effectiveRole]);

  const accessibleClassIds = useMemo(
    () => new Set(accessiblePrivateClasses.map((pc) => pc.id)),
    [accessiblePrivateClasses],
  );

  const accessibleClassIdsRef = useRef(accessibleClassIds);
  useEffect(() => {
    accessibleClassIdsRef.current = accessibleClassIds;
  }, [accessibleClassIds]);

  const pendingJoinRequestsCount = useMemo(() => {
    return classJoinRequests.filter(
      (r) => accessibleClassIds.has(r.classId) && r.status === 'pending',
    ).length;
  }, [classJoinRequests, accessibleClassIds]);

  const activeTeacherClassObj = useMemo(() => {
    if (effectiveRole !== 'teacher' || activeView !== 'portal' || !activeTeacherClassId) {
      return null;
    }
    return accessiblePrivateClasses.find((pc) => pc.id === activeTeacherClassId) ?? null;
  }, [accessiblePrivateClasses, activeTeacherClassId, activeView, effectiveRole]);

  const activeTeacherClassSummary = useMemo(() => {
    if (!activeTeacherClassObj) return null;
    return {
      id: activeTeacherClassObj.id,
      name: activeTeacherClassObj.name,
      code: derivePrivateClassCode(activeTeacherClassObj),
    };
  }, [activeTeacherClassObj]);

  const activeTeacherClassPendingCount = useMemo(() => {
    if (!activeTeacherClassObj) return 0;
    return classJoinRequests.filter(
      (r) => r.classId === activeTeacherClassObj.id && r.status === 'pending',
    ).length;
  }, [activeTeacherClassObj, classJoinRequests]);

  useEffect(() => {
    if (activeTeacherClassId && (!activeTeacherClassObj || role !== 'teacher')) {
      setActiveTeacherClassId(null);
      setActiveTeacherClassTab(null);
    }
  }, [activeTeacherClassId, activeTeacherClassObj, role]);

  const allExamMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  const visibleQuestions = useMemo(() => {
    if (effectiveRole === 'admin') return questions;
    if (effectiveRole === 'teacher') {
      return questions.filter((q) => canTeacherViewResource(q, currentUser));
    }
    return questions;
  }, [questions, currentUser, effectiveRole]);

  const visibleExams = useMemo(
    () =>
      exams.filter((ex) =>
        canUserViewExam(ex, currentUser, effectiveRole, accessibleClassIds),
      ),
    [exams, currentUser, effectiveRole, accessibleClassIds],
  );

  const visibleClassMaterials = useMemo(() => {
    if (effectiveRole === 'admin' || effectiveRole === 'student') return classMaterials;
    return classMaterials.filter((m) =>
      canTeacherViewResource(m, currentUser, accessibleClassIds, m.classId),
    );
  }, [classMaterials, currentUser, effectiveRole, accessibleClassIds]);

  const visibleClassAssignments = useMemo(() => {
    if (effectiveRole === 'admin' || effectiveRole === 'student') return classAssignments;
    return classAssignments.filter((a) =>
      canTeacherViewResource(a, currentUser, accessibleClassIds, a.classId),
    );
  }, [classAssignments, currentUser, effectiveRole, accessibleClassIds]);

  const visibleClassSchedules = useMemo(() => {
    if (effectiveRole === 'admin' || effectiveRole === 'student') return classSchedules;
    return classSchedules.filter((s) =>
      canTeacherViewResource(s, currentUser, accessibleClassIds, s.classId),
    );
  }, [classSchedules, currentUser, effectiveRole, accessibleClassIds]);

  const visibleSubmissions = useMemo(
    () =>
      submissions.filter((sub) =>
        canUserViewSubmission(
          sub,
          allExamMap.get(sub.examId),
          currentUser,
          role,
          guestSubmissionIds,
          accessibleClassIds,
        ),
      ),
    [submissions, allExamMap, currentUser, role, guestSubmissionIds, accessibleClassIds],
  );

  const visibleAlerts = useMemo(() => {
    if (effectiveRole === 'student') return [];
    if (effectiveRole === 'admin') return alerts;
    return alerts.filter((al) => {
      const ex = allExamMap.get(al.examId);
      if (!ex) return false;
      return canUserViewExam(ex, currentUser, effectiveRole, accessibleClassIds);
    });
  }, [alerts, allExamMap, currentUser, effectiveRole, accessibleClassIds]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    allExamMapRef.current = allExamMap;
  }, [allExamMap]);

  useEffect(() => {
    alertSoundRef.current = alertSoundEnabled;
    try {
      localStorage.setItem(TEACHER_ALERT_SOUND_KEY, String(alertSoundEnabled));
    } catch {
      // Ignore storage error
    }
  }, [alertSoundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(
        RIGHT_SIDEBAR_COLLAPSED_KEY,
        String(rightSidebarCollapsed),
      );
    } catch {
      // Ignore storage error
    }
  }, [rightSidebarCollapsed]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        GUEST_SUBMISSION_IDS_KEY,
        JSON.stringify(Array.from(guestSubmissionIds)),
      );
    } catch {
      // Ignore storage error
    }
  }, [guestSubmissionIds]);

  const playTeacherAlertTone = useCallback(() => {
    if (!alertSoundRef.current || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const playNotes = () => {
        const now = ctx.currentTime;
        [
          { freq: 784, offset: 0, dur: 0.12 },
          { freq: 1046.5, offset: 0.14, dur: 0.2 },
        ].forEach(({ freq, offset, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + offset);
          gain.gain.setValueAtTime(0.0001, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.09, now + offset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + dur + 0.02);
        });
        window.setTimeout(() => {
          ctx.close().catch(() => {});
        }, 600);
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(playNotes).catch(() => {});
      } else {
        playNotes();
      }
    } catch {
      // Ignore audio errors
    }
  }, []);

  useEffect(() => {
    return subscribeTeacherAlerts(
      (incoming) => {
        if (activeSessionRef.current) return;
        const incomingExam = allExamMapRef.current.get(incoming.examId);
        const effRole = currentUserRef.current?.role ?? roleRef.current;
        if (effRole !== 'admin') {
          if (
            !incomingExam ||
            !canUserViewExam(
              incomingExam,
              currentUserRef.current,
              effRole,
              accessibleClassIdsRef.current,
            )
          ) {
            return;
          }
        }

        const shouldShowToast =
          roleRef.current === 'teacher' ||
          roleRef.current === 'admin' ||
          activeViewRef.current === 'results' ||
          activeViewRef.current === 'exam_manager' ||
          activeViewRef.current === 'question_bank' ||
          activeViewRef.current === 'admin';
        if (!shouldShowToast) return;

        setLiveToasts((prev) => {
          if (prev.some((t) => t.id === incoming.id)) return prev;
          return [incoming, ...prev].slice(0, 4);
        });
        playTeacherAlertTone();
        window.setTimeout(() => {
          setLiveToasts((prev) => prev.filter((t) => t.id !== incoming.id));
        }, 8500);
      },
      (synced) => {
        setAlerts(synced);
      },
    );
  }, [playTeacherAlertTone]);

  useEffect(() => {
    return subscribeSystemLogs((synced) => {
      setSystemLogs(synced);
    });
  }, []);

  const handleInspectAlert = useCallback((alert: TeacherAlert) => {
    setAlerts(markTeacherAlertRead(alert.id));
    setLiveToasts((prev) => prev.filter((t) => t.id !== alert.id));
    setSelectedSubmission(null);
    setLobbyExam(null);
    setPrintableExam(null);
    setActiveView('results');
    setAlertFocus({ sbd: alert.studentSbd, nonce: Date.now() });
  }, []);

  const handleTriggerTestAlert = useCallback(() => {
    const sampleEvents = [
      {
        actionType: 'violation' as const,
        title: 'Chuyển tab trình duyệt',
        detail: 'Phát hiện thí sinh rời thẻ trình duyệt phòng thi trong khi đang làm bài',
        severity: 'critical' as const,
      },
      {
        actionType: 'network_offline' as const,
        title: 'Mất kết nối mạng',
        detail: 'Thí sinh bị mất kết nối mạng Internet trong phòng thi trực tuyến',
        severity: 'critical' as const,
      },
      {
        actionType: 'paused_exam' as const,
        title: 'Tạm dừng bài thi',
        detail: 'Thí sinh tạm dừng làm bài (thời gian còn lại 32:15)',
        severity: 'warning' as const,
      },
    ];
    const picked = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
    const refSub = visibleSubmissions[2] ?? visibleSubmissions[0];
    pushTeacherAlert({
      studentName: refSub?.studentName ?? 'Lê Hoàng Nam',
      studentSbd: refSub?.studentSbd ?? '0102483',
      studentClass: refSub?.studentClass ?? '12A2',
      examId: refSub?.examId ?? 'exam_toan_tn2025',
      examTitle: refSub?.examTitle ?? 'Đề tham khảo Tốt nghiệp THPT 2025 — Môn Toán',
      roomCode: refSub?.roomCode ?? 'TOAN2025',
      variantCode: refSub?.variantCode ?? '0103',
      ...picked,
    });
  }, [visibleSubmissions]);

  // Global keyboard shortcuts when outside active ExamRoom
  useEffect(() => {
    if (activeSession || (!currentUser && !guestMode)) return;

    const VIEW_BY_DIGIT: Record<string, AppView> = {
      '0': 'intro',
      '1': 'portal',
      '2': 'exam_manager',
      '3': 'question_bank',
      '4': 'results',
      '5': 'admin',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (isEditable && target) {
          target.blur();
          return;
        }
        if (mobileRightSidebarOpen) {
          setMobileRightSidebarOpen(false);
        } else if (profileModalTab) {
          setProfileModalTab(null);
        } else if (accountModalTab) {
          setAccountModalTab(null);
        } else if (shortcutsOpen) {
          setShortcutsOpen(false);
        } else if (lobbyExam) {
          setLobbyExam(null);
        } else if (printableExam) {
          setPrintableExam(null);
        } else if (selectedSubmission) {
          setSelectedSubmission(null);
        }
        return;
      }

      if (isEditable) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      // Skip background shortcuts while any overlay modal is open
      if (profileModalTab || accountModalTab || shortcutsOpen || lobbyExam || printableExam) return;

      const targetView = VIEW_BY_DIGIT[e.key];
      if (targetView) {
        if (
          role === 'student' &&
          (targetView === 'exam_manager' ||
            targetView === 'question_bank' ||
            targetView === 'admin')
        ) {
          return;
        }
        if (targetView === 'admin' && role !== 'admin') {
          return;
        }
        e.preventDefault();
        setSelectedSubmission(null);
        setActiveTeacherClassId(null);
        setActiveTeacherClassTab(null);
        setActiveView(targetView);
        return;
      }

      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTheme();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setRightSidebarCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    accountModalTab,
    activeSession,
    currentUser,
    guestMode,
    lobbyExam,
    mobileRightSidebarOpen,
    printableExam,
    profileModalTab,
    role,
    selectedSubmission,
    shortcutsOpen,
    toggleTheme,
  ]);

  const firstActiveExam = useMemo(
    () => visibleExams.find((e) => e.status === 'active') ?? null,
    [visibleExams],
  );

  const handlePrimaryAction = () => {
    setSelectedSubmission(null);
    setActiveTeacherClassId(null);
    setActiveTeacherClassTab(null);
    if (role === 'teacher' || role === 'admin') {
      setActiveView('exam_manager');
    } else if (firstActiveExam) {
      setLobbyExam(firstActiveExam);
    } else {
      setActiveView('portal');
    }
  };

  const handleJoinByRoomCode = (code: string): string | null => {
    const found = visibleExams.find(
      (ex) => ex.roomCode.toUpperCase() === code.toUpperCase(),
    );
    if (!found) {
      return `Không tìm thấy phòng thi mang mã "${code}". Hãy thử TOAN2025, VATLI25, HOAHOC25 hoặc TINHOC15.`;
    }
    if (found.status !== 'active') {
      return `Phòng thi "${code}" hiện đang đóng.`;
    }
    setLobbyExam(found);
    return null;
  };

  const handleStartExam = (candidate: {
    studentName: string;
    studentSbd: string;
    studentClass: string;
    variantCode: string;
  }) => {
    if (!lobbyExam) return;
    const variant = generateExamVariant(lobbyExam, questionMap, candidate.variantCode);
    appendSystemLog({
      category: 'exam',
      level: 'info',
      action: 'Vào phòng thi trực tuyến',
      detail: `${candidate.studentName} (${candidate.studentSbd} · ${candidate.studentClass}) bắt đầu làm đề "${lobbyExam.title}".`,
      actorName: candidate.studentName,
      actorRole: currentUser?.role ?? role,
      actorId: currentUser?.id,
      targetLabel: `${lobbyExam.roomCode} · Mã đề ${candidate.variantCode}`,
    });
    setActiveSession({
      exam: lobbyExam,
      variant,
      candidate: {
        studentName: candidate.studentName,
        studentSbd: candidate.studentSbd,
        studentClass: candidate.studentClass,
      },
    });
    setLobbyExam(null);
    setSelectedSubmission(null);
  };

  const handleSubmitComplete = (submission: ExamSubmission) => {
    const stampedSubmission: ExamSubmission = currentUser
      ? { ...submission, submittedByUserId: currentUser.id }
      : submission;
    if (!currentUser && role === 'student') {
      setGuestSubmissionIds((prev) => {
        const next = new Set(prev);
        next.add(stampedSubmission.id);
        return next;
      });
    }
    addSubmission(stampedSubmission);
    setActiveSession(null);
    setSelectedSubmission(stampedSubmission);
  };

  const handleAuthenticated = (user: UserAccount) => {
    setCurrentUser(user);
    setGuestMode(false);
    setShowIntroOnStart(false);
    setRole(user.role);
    setSelectedSubmission(null);
    setActiveTeacherClassId(null);
    setActiveTeacherClassTab(null);
    setLobbyExam(null);
    setPrintableExam(null);
    setActiveView(user.role === 'admin' ? 'admin' : 'portal');
  };

  const handleLogout = () => {
    if (currentUser) {
      appendSystemLog({
        category: 'auth',
        level: 'info',
        action: 'Đăng xuất tài khoản',
        detail: `${currentUser.fullName} (${currentUser.email}) đã đăng xuất khỏi hệ thống.`,
        actorName: currentUser.fullName,
        actorRole: currentUser.role,
        actorId: currentUser.id,
        targetLabel: currentUser.email,
      });
    }
    setCurrentSessionUserId(null);
    setCurrentUser(null);
    setProfileModalTab(null);
    setGuestMode(false);
    setShowIntroOnStart(false);
    setSelectedSubmission(null);
    setActiveTeacherClassId(null);
    setActiveTeacherClassTab(null);
    setLobbyExam(null);
    setPrintableExam(null);
    setAuthInitialMode('login');
  };

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthInitialMode(mode);
    setShowIntroOnStart(false);
    setGuestMode(false);
  };

  // Live Examination Room takes full distraction-free viewport
  if (activeSession) {
    return (
      <ExamRoom
        exam={activeSession.exam}
        variant={activeSession.variant}
        candidate={activeSession.candidate}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onSubmitComplete={handleSubmitComplete}
        onAbortExit={() => {
          appendSystemLog({
            category: 'exam',
            level: 'warning',
            action: 'Thoát phòng thi giữa chừng',
            detail: `${activeSession.candidate.studentName} (${activeSession.candidate.studentSbd}) đã rời phòng thi "${activeSession.exam.title}" trước khi nộp bài.`,
            actorName: activeSession.candidate.studentName,
            actorRole: currentUser?.role ?? role,
            actorId: currentUser?.id,
            targetLabel: activeSession.exam.roomCode,
          });
          setActiveSession(null);
        }}
      />
    );
  }

  // Show NTPEXION Introduction or Login / Register screen when unauthenticated and not in guest preview
  if (!currentUser && !guestMode) {
    if (showIntroOnStart) {
      return (
        <IntroLandingPage
          currentUser={null}
          role={role}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          stats={{
            examsCount: visibleExams.length,
            questionsCount: questions.length,
            classesCount: privateClasses.length,
            submissionsCount: visibleSubmissions.length,
          }}
          onOpenAuth={(mode = 'login') => handleOpenAuth(mode)}
          onEnterWorkspace={(preferredRole) => {
            if (preferredRole) setRole(preferredRole);
            setShowIntroOnStart(false);
            setGuestMode(true);
            setActiveView('portal');
          }}
        />
      );
    }

    return (
      <AuthScreen
        initialMode={authInitialMode}
        allowSelfRegistration={systemConfig.allowSelfRegistration}
        allowGuestPreview={systemConfig.allowGuestPreview}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onAuthenticated={handleAuthenticated}
        onContinueGuest={() => {
          setShowIntroOnStart(false);
          setGuestMode(true);
        }}
        onOpenIntro={() => setShowIntroOnStart(true)}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#040D22] dark:text-slate-100">
      <Header
        activeView={activeView}
        onNavigate={(view) => {
          setSelectedSubmission(null);
          setActiveStudentSection(null);
          setActiveTeacherClassId(null);
          setActiveTeacherClassTab(null);
          setActiveView(view);
        }}
        role={role}
        currentUser={currentUser}
        onPrimaryAction={handlePrimaryAction}
        onOpenAuth={handleOpenAuth}
        onOpenProfile={(tab = 'view_edit') => setProfileModalTab(tab)}
        onOpenAccountManager={(tab) => setAccountModalTab(tab)}
        onLogout={handleLogout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        alerts={visibleAlerts}
        alertSoundEnabled={alertSoundEnabled}
        onToggleAlertSound={() => setAlertSoundEnabled((v) => !v)}
        onMarkAlertRead={(id) => setAlerts(markTeacherAlertRead(id))}
        onMarkAllAlertsRead={() => setAlerts(markAllTeacherAlertsRead())}
        onClearAlerts={() => {
          setAlerts(clearAllTeacherAlerts());
          setLiveToasts([]);
        }}
        onInspectAlert={handleInspectAlert}
        onTriggerTestAlert={handleTriggerTestAlert}
        rightSidebarCollapsed={rightSidebarCollapsed}
        onToggleRightSidebar={() => setRightSidebarCollapsed((v) => !v)}
        onOpenMobileRightSidebar={() => setMobileRightSidebarOpen(true)}
        activePortalSection={
          activeView === 'portal' && !selectedSubmission ? activeStudentSection : null
        }
        onSelectPortalSection={(sectionId) => {
          setSelectedSubmission(null);
          setActiveView('portal');
          setActiveTeacherClassId(null);
          setActiveTeacherClassTab(null);
          setActiveStudentSection(sectionId);
          setStudentSectionRequest({ sectionId, nonce: Date.now() });
        }}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">
        {selectedSubmission ? (
          <ExamResultView
            submission={selectedSubmission}
            showSolutions={
              visibleExams.find((e) => e.id === selectedSubmission.examId)
                ?.showSolutionsAfterSubmit ?? true
            }
            onBack={() => setSelectedSubmission(null)}
          />
        ) : activeView === 'intro' ? (
          <IntroLandingPage
            embedded
            currentUser={currentUser}
            role={role}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            stats={{
              examsCount: visibleExams.length,
              questionsCount: visibleQuestions.length,
              classesCount:
                effectiveRole === 'teacher'
                  ? accessiblePrivateClasses.length
                  : privateClasses.length,
              submissionsCount: visibleSubmissions.length,
            }}
            onOpenAuth={handleOpenAuth}
            onEnterWorkspace={(preferredRole) => {
              if (!currentUser && preferredRole) {
                setRole(preferredRole);
              }
              setActiveView('portal');
            }}
          />
        ) : activeView === 'portal' ? (
          <PortalOverview
            role={role}
            currentUser={currentUser}
            systemConfig={systemConfig}
            privateClasses={accessiblePrivateClasses}
            allPrivateClasses={privateClasses}
            classJoinRequests={classJoinRequests}
            classMaterials={visibleClassMaterials}
            classAssignments={visibleClassAssignments}
            classSchedules={visibleClassSchedules}
            onAddPrivateClass={addPrivateClass}
            onUpdatePrivateClass={updatePrivateClass}
            onDeletePrivateClass={deletePrivateClass}
            onRequestJoinClass={(targetClass) =>
              requestJoinClass({
                targetClass,
                studentUserId: currentUser?.id ?? 'guest_student',
                studentName: currentUser?.fullName ?? 'Học sinh (Xem thử)',
                studentSbd: currentUser?.studentSbd,
                studentClass: currentUser?.studentClass,
                studentEmail: currentUser?.email,
                actorRole: currentUser?.role ?? 'guest',
              })
            }
            onCancelJoinRequest={(reqId) =>
              cancelJoinRequest(reqId, {
                name: currentUser?.fullName ?? 'Học sinh (Xem thử)',
                role: currentUser?.role ?? 'guest',
                id: currentUser?.id,
              })
            }
            onReviewJoinRequest={(reqId, decision) =>
              reviewClassJoinRequest(reqId, decision, {
                name: currentUser?.fullName ?? 'Giáo viên',
                role: currentUser?.role ?? role,
                id: currentUser?.id,
              })
            }
            onRemoveClassMember={(classId, studentUserId) =>
              removeClassMembership(classId, studentUserId, {
                name: currentUser?.fullName ?? 'Người dùng',
                role: currentUser?.role ?? role,
                id: currentUser?.id,
                reason: role === 'teacher' ? 'teacher_removed' : 'student_left',
              })
            }
            onAddClassMaterial={addClassMaterial}
            onUpdateClassMaterial={updateClassMaterial}
            onDeleteClassMaterial={deleteClassMaterial}
            onAddClassAssignment={addClassAssignment}
            onUpdateClassAssignment={updateClassAssignment}
            onDeleteClassAssignment={deleteClassAssignment}
            onAddScheduleSlot={addClassScheduleSlot}
            onUpdateScheduleSlot={updateClassScheduleSlot}
            onDeleteScheduleSlot={deleteClassScheduleSlot}
            onChangeRole={(nextRole) => {
              setSelectedSubmission(null);
              setRole(nextRole);
            }}
            onOpenAuth={handleOpenAuth}
            exams={visibleExams}
            questions={visibleQuestions}
            submissions={visibleSubmissions}
            onSelectExamToStart={(exam) => setLobbyExam(exam)}
            onJoinByRoomCode={handleJoinByRoomCode}
            onOpenPrintableExam={(exam) => setPrintableExam(exam)}
            onNavigate={(view) => setActiveView(view)}
            onCreateExam={() => setActiveView('exam_manager')}
            onViewSubmission={(sub) => setSelectedSubmission(sub)}
            requestedStudentSection={studentSectionRequest}
            onStudentSectionActivated={(sec) => setActiveStudentSection(sec)}
            activeTeacherClassId={activeTeacherClassId}
            onActiveTeacherClassChange={(clsId) => {
              setActiveTeacherClassId(clsId);
              if (clsId === null) setActiveTeacherClassTab(null);
            }}
            activeTeacherClassTab={activeTeacherClassTab}
            onActiveTeacherClassTabChange={(tab) => setActiveTeacherClassTab(tab)}
          />
        ) : activeView === 'question_bank' ? (
          <QuestionBankManager
            questions={visibleQuestions}
            exams={visibleExams}
            currentUser={currentUser}
            privateClasses={accessiblePrivateClasses}
            onAddQuestion={addQuestion}
            onUpdateQuestion={updateQuestion}
            onDeleteQuestion={deleteQuestion}
            onDeleteAllQuestions={deleteAllQuestions}
            onImportQuestions={importQuestions}
            onCreateExam={addExam}
          />
        ) : activeView === 'exam_manager' ? (
          <ExamManager
            exams={visibleExams}
            questions={visibleQuestions}
            submissions={visibleSubmissions}
            currentUser={currentUser}
            privateClasses={accessiblePrivateClasses}
            classMaterials={visibleClassMaterials}
            classAssignments={visibleClassAssignments}
            classSchedules={visibleClassSchedules}
            onAddExam={addExam}
            onUpdateExam={updateExam}
            onDeleteExam={deleteExam}
            onAddQuestion={addQuestion}
            onAddPrivateClass={addPrivateClass}
            onUpdatePrivateClass={updatePrivateClass}
            onDeletePrivateClass={deletePrivateClass}
            onAddClassMaterial={addClassMaterial}
            onDeleteClassMaterial={deleteClassMaterial}
            onAddClassAssignment={addClassAssignment}
            onDeleteClassAssignment={deleteClassAssignment}
            onAddClassScheduleSlot={addClassScheduleSlot}
            onUpdateClassScheduleSlot={updateClassScheduleSlot}
            onDeleteClassScheduleSlot={deleteClassScheduleSlot}
            onImportQuestions={importQuestions}
            onPrintExam={(exam) => setPrintableExam(exam)}
            onStartExam={(exam) => setLobbyExam(exam)}
            onViewExamResults={(examId, className) => {
              setSelectedSubmission(null);
              setResultsInitialFilter({ examId, className, nonce: Date.now() });
              setActiveView('results');
            }}
            onOpenAuth={handleOpenAuth}
          />
        ) : activeView === 'results' ? (
          <ResultsLedger
            submissions={visibleSubmissions}
            exams={visibleExams}
            role={role}
            currentUser={currentUser}
            isDark={isDark}
            alerts={visibleAlerts}
            focusAlert={alertFocus}
            initialFilter={resultsInitialFilter}
            onMarkAlertRead={(id) => setAlerts(markTeacherAlertRead(id))}
            onViewSubmission={(sub) => setSelectedSubmission(sub)}
          />
        ) : activeView === 'admin' && role === 'admin' ? (
          <AdminDashboard
            currentUser={currentUser}
            isDark={isDark}
            questions={questions}
            exams={visibleExams}
            submissions={visibleSubmissions}
            alerts={visibleAlerts}
            systemLogs={systemLogs}
            systemConfig={systemConfig}
            onUpdateSystemConfig={updateSystemConfig}
            onNavigate={(view) => setActiveView(view)}
            onUpdateExam={updateExam}
            onDeleteExam={deleteExam}
            onDeleteAllExams={() => {
              deleteAllExams(visibleExams.map((e) => e.id));
              setLobbyExam(null);
              setPrintableExam(null);
            }}
            onDeleteAllQuestions={() => deleteAllQuestions()}
            onPrintExam={(exam) => setPrintableExam(exam)}
            onViewSubmission={(sub) => setSelectedSubmission(sub)}
            onDeleteSubmission={deleteSubmission}
            onMarkAlertRead={(id) => setAlerts(markTeacherAlertRead(id))}
            onMarkAllAlertsRead={() => setAlerts(markAllTeacherAlertsRead())}
            onClearAlerts={() => {
              setAlerts(clearAllTeacherAlerts());
              setLiveToasts([]);
            }}
            onTriggerTestAlert={handleTriggerTestAlert}
            onClearSystemLogs={() => setSystemLogs(clearSystemLogs())}
            onSwitchAccount={(user) => {
              setCurrentUser(user);
              setRole(user.role);
              setSelectedSubmission(null);
              setLobbyExam(null);
              setPrintableExam(null);
              setActiveView(user.role === 'admin' ? 'admin' : 'portal');
            }}
            onResetAllData={() => {
              resetAllDemoData();
              void resetSeedAccounts();
              setAlerts(resetSeedTeacherAlerts());
              setSystemLogs(resetSeedSystemLogs());
              setLiveToasts([]);
            }}
          />
        ) : (
          <PortalOverview
            role={role}
            currentUser={currentUser}
            systemConfig={systemConfig}
            privateClasses={accessiblePrivateClasses}
            allPrivateClasses={privateClasses}
            classJoinRequests={classJoinRequests}
            classMaterials={visibleClassMaterials}
            classAssignments={visibleClassAssignments}
            classSchedules={visibleClassSchedules}
            onAddPrivateClass={addPrivateClass}
            onUpdatePrivateClass={updatePrivateClass}
            onDeletePrivateClass={deletePrivateClass}
            onRequestJoinClass={(targetClass) =>
              requestJoinClass({
                targetClass,
                studentUserId: currentUser?.id ?? 'guest_student',
                studentName: currentUser?.fullName ?? 'Học sinh (Xem thử)',
                studentSbd: currentUser?.studentSbd,
                studentClass: currentUser?.studentClass,
                studentEmail: currentUser?.email,
                actorRole: currentUser?.role ?? 'guest',
              })
            }
            onCancelJoinRequest={(reqId) =>
              cancelJoinRequest(reqId, {
                name: currentUser?.fullName ?? 'Học sinh (Xem thử)',
                role: currentUser?.role ?? 'guest',
                id: currentUser?.id,
              })
            }
            onReviewJoinRequest={(reqId, decision) =>
              reviewClassJoinRequest(reqId, decision, {
                name: currentUser?.fullName ?? 'Giáo viên',
                role: currentUser?.role ?? role,
                id: currentUser?.id,
              })
            }
            onRemoveClassMember={(classId, studentUserId) =>
              removeClassMembership(classId, studentUserId, {
                name: currentUser?.fullName ?? 'Người dùng',
                role: currentUser?.role ?? role,
                id: currentUser?.id,
                reason: role === 'teacher' ? 'teacher_removed' : 'student_left',
              })
            }
            onAddClassMaterial={addClassMaterial}
            onUpdateClassMaterial={updateClassMaterial}
            onDeleteClassMaterial={deleteClassMaterial}
            onAddClassAssignment={addClassAssignment}
            onUpdateClassAssignment={updateClassAssignment}
            onDeleteClassAssignment={deleteClassAssignment}
            onAddScheduleSlot={addClassScheduleSlot}
            onUpdateScheduleSlot={updateClassScheduleSlot}
            onDeleteScheduleSlot={deleteClassScheduleSlot}
            onChangeRole={(nextRole) => {
              setSelectedSubmission(null);
              setRole(nextRole);
            }}
            onOpenAuth={handleOpenAuth}
            exams={visibleExams}
            questions={visibleQuestions}
            submissions={visibleSubmissions}
            onSelectExamToStart={(exam) => setLobbyExam(exam)}
            onJoinByRoomCode={handleJoinByRoomCode}
            onOpenPrintableExam={(exam) => setPrintableExam(exam)}
            onNavigate={(view) => setActiveView(view)}
            onCreateExam={() => setActiveView('exam_manager')}
            onViewSubmission={(sub) => setSelectedSubmission(sub)}
            requestedStudentSection={studentSectionRequest}
            onStudentSectionActivated={(sec) => setActiveStudentSection(sec)}
            activeTeacherClassId={activeTeacherClassId}
            onActiveTeacherClassChange={(clsId) => {
              setActiveTeacherClassId(clsId);
              if (clsId === null) setActiveTeacherClassTab(null);
            }}
            activeTeacherClassTab={activeTeacherClassTab}
            onActiveTeacherClassTabChange={(tab) => setActiveTeacherClassTab(tab)}
          />
        )}
      </main>

      <footer className="no-print mt-12 border-t border-slate-200 bg-white dark:border-[#132B66] dark:bg-[#061844]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8 dark:text-slate-300">
          <p>
            <strong className="font-bold text-[#061844] dark:text-white">NTPEXION</strong> ·
            Innovation in Every Exam · Hệ thống Tổ chức Thi và Kiểm tra Trắc nghiệm Trực tuyến
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setSelectedSubmission(null);
                setActiveView('intro');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="cursor-pointer font-semibold text-[#0057FF] hover:underline dark:text-[#22D3EE]"
            >
              Giới thiệu NTPEXION
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Phím tắt (?)
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                resetAllDemoData();
                void resetSeedAccounts();
                setAlerts(resetSeedTeacherAlerts());
                setSystemLogs(resetSeedSystemLogs());
                setLiveToasts([]);
                setResetToast(true);
                setTimeout(() => setResetToast(false), 3000);
              }}
              className="cursor-pointer font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {resetToast ? 'Đã khôi phục dữ liệu mẫu!' : 'Khôi phục dữ liệu mẫu'}
            </button>
          </div>
        </div>
      </footer>
        </div>

        <RightSidebar
          activeView={activeView}
          onNavigate={(view) => {
            setSelectedSubmission(null);
            setActiveStudentSection(null);
            setActiveTeacherClassId(null);
            setActiveTeacherClassTab(null);
            setActiveView(view);
          }}
          role={role}
          currentUser={currentUser}
          collapsed={rightSidebarCollapsed}
          onToggleCollapse={() => setRightSidebarCollapsed((v) => !v)}
          mobileOpen={mobileRightSidebarOpen}
          onCloseMobile={() => setMobileRightSidebarOpen(false)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onPrimaryAction={handlePrimaryAction}
          onOpenAuth={handleOpenAuth}
          onOpenProfile={(tab = 'view_edit') => setProfileModalTab(tab)}
          onOpenAccountManager={(tab) => setAccountModalTab(tab)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onLogout={handleLogout}
          unreadAlertsCount={visibleAlerts.filter((a) => !a.read).length}
          pendingJoinRequestsCount={pendingJoinRequestsCount}
          activeStudentSection={
            activeView === 'portal' && !selectedSubmission ? activeStudentSection : null
          }
          onSelectStudentSection={(sectionId) => {
            setSelectedSubmission(null);
            setActiveView('portal');
            setActiveTeacherClassId(null);
            setActiveTeacherClassTab(null);
            setActiveStudentSection(sectionId);
            setStudentSectionRequest({ sectionId, nonce: Date.now() });
          }}
          activeTeacherClass={
            !selectedSubmission ? activeTeacherClassSummary : null
          }
          activeTeacherClassTab={activeTeacherClassTab}
          activeTeacherClassPendingCount={activeTeacherClassPendingCount}
          onSelectTeacherClassTab={(tab) => {
            setSelectedSubmission(null);
            setActiveView('portal');
            setActiveTeacherClassTab(tab);
          }}
          onExitTeacherClass={() => {
            setActiveTeacherClassId(null);
            setActiveTeacherClassTab(null);
          }}
        />
      </div>

      {lobbyExam && (
        <ExamLobbyModal
          exam={lobbyExam}
          currentUser={currentUser}
          onCancel={() => setLobbyExam(null)}
          onStartExam={handleStartExam}
        />
      )}

      {printableExam && (
        <PrintableExamModal
          exam={printableExam}
          questionMap={questionMap}
          onClose={() => setPrintableExam(null)}
        />
      )}

      {shortcutsOpen && (
        <KeyboardShortcutsModal
          mode="portal"
          onClose={() => setShortcutsOpen(false)}
        />
      )}

      {profileModalTab && currentUser && (
        <UserProfileModal
          currentUser={currentUser}
          initialTab={profileModalTab}
          onClose={() => setProfileModalTab(null)}
          onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        />
      )}

      {accountModalTab && (
        <AccountManagerModal
          initialTab={accountModalTab}
          currentUser={currentUser}
          onClose={() => setAccountModalTab(null)}
          onAccountChanged={(user) => {
            setCurrentUser(user);
            setSelectedSubmission(null);
            setActiveTeacherClassId(null);
            setActiveTeacherClassTab(null);
            setLobbyExam(null);
            setPrintableExam(null);
            if (user) {
              setRole(user.role);
              setActiveView(user.role === 'admin' ? 'admin' : 'portal');
            }
          }}
        />
      )}

      <TeacherAlertToastStack
        toasts={liveToasts}
        onDismiss={(id) => setLiveToasts((prev) => prev.filter((t) => t.id !== id))}
        onInspectAlert={handleInspectAlert}
      />
    </div>
  );
}
