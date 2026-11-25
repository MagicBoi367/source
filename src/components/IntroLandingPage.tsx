import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Layers,
  Lock,
  LogIn,
  Moon,
  Printer,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import type { UserAccount, UserRole } from '../types/exam';

export const NTPEXION_LOGO_PATH = '/assets/aistudio/logo_dcbecf4a.png';

interface IntroLandingPageProps {
  embedded?: boolean;
  currentUser: UserAccount | null;
  role: UserRole;
  isDark: boolean;
  onToggleTheme: () => void;
  stats: {
    examsCount: number;
    questionsCount: number;
    classesCount: number;
    submissionsCount: number;
  };
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onEnterWorkspace: (preferredRole?: UserRole) => void;
}

export function IntroLandingPage({
  embedded = false,
  currentUser,
  role,
  isDark,
  onToggleTheme,
  stats,
  onOpenAuth,
  onEnterWorkspace,
}: IntroLandingPageProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  const primaryCtaLabel = currentUser
    ? 'Vào không gian làm việc'
    : 'Đăng nhập hệ thống';

  const handlePrimaryCta = () => {
    if (currentUser) {
      onEnterWorkspace(currentUser.role);
    } else {
      onOpenAuth('login');
    }
  };

  return (
    <div
      className={
        embedded
          ? 'bg-slate-50 text-slate-900 dark:bg-[#040D22] dark:text-slate-100'
          : 'flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-[#040D22] dark:text-slate-100'
      }
    >
      {/* Standalone Top Bar (strict 3-zone contract when viewed before login) */}
      {!embedded && (
        <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm dark:border-[#102558] dark:bg-[#061844]/95">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
            <a
              href="#top"
              className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF]"
            >
              {!logoFailed && (
                <img
                  src={NTPEXION_LOGO_PATH}
                  alt="NTPEXION"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="h-9 w-auto rounded-md border border-slate-200/80 bg-white px-1 py-0.5 object-contain"
                />
              )}
              <span className="font-display text-lg font-extrabold tracking-tight text-[#061844] dark:text-white">
                NTPE<span className="text-[#0057FF] dark:text-[#00D4FF]">X</span>ION
              </span>
            </a>

            <nav
              aria-label="Giới thiệu nền tảng"
              className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              <a
                href="#tinh-nang"
                className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#0057FF] dark:hover:text-[#22D3EE]"
              >
                Tính năng
              </a>
              <a
                href="#vai-tro"
                className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#0057FF] dark:hover:text-[#22D3EE]"
              >
                Vai trò
              </a>
              <a
                href="#quy-trinh"
                className="whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#0057FF] dark:hover:text-[#22D3EE]"
              >
                Quy trình
              </a>
              <button
                type="button"
                onClick={() => onEnterWorkspace(role)}
                className="cursor-pointer whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#0057FF] dark:hover:text-[#22D3EE]"
              >
                Xem thử phòng thi
              </button>
            </nav>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#1B3A82] dark:bg-[#0B225B] dark:text-slate-200 dark:hover:bg-[#12307A]"
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#0057FF] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#061844] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF] dark:bg-[#0057FF] dark:hover:bg-[#06B6D4] dark:hover:text-[#040D22]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>{primaryCtaLabel}</span>
              </button>
            </div>
          </div>
        </header>
      )}

      <main id="top" className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* ================================================================= */}
        {/* HERO SPLIT: Proposition + Official NTPEXION Brand Showcase        */}
        {/* ================================================================= */}
        <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 sm:p-10 lg:col-span-7 dark:border-[#132B66] dark:bg-[#08173D]">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#0057FF] dark:text-[#22D3EE]">
                NTPEXION · Innovation in Every Exam
              </p>
              <h1
                style={{ fontSize: 'clamp(2.1rem, 3.6vw, 3.25rem)', lineHeight: 1.12 }}
                className="mt-4 max-w-2xl font-display font-extrabold tracking-tight text-[#061844] [text-wrap:balance] dark:text-white"
              >
                Nền tảng Thi Trắc Nghiệm Trực Tuyến Chuẩn Xác &amp; Hiện Đại
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                <strong className="font-semibold text-[#061844] dark:text-white">NTPEXION</strong>{' '}
                hỗ trợ toàn diện từ khâu xây dựng ngân hàng câu hỏi, trộn mã đề tự động theo 3 dạng
                thức trắc nghiệm 2025, tổ chức lớp học riêng tư bằng mã 5 ký tự đến giám sát phòng
                thi thời gian thực và xuất bảng điểm chuẩn hành chính.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Phổ thông Khối 1–12</span>
                <span aria-hidden="true">·</span>
                <span>Cao đẳng &amp; Đại học</span>
                <span aria-hidden="true">·</span>
                <span>Chuẩn Thông tư 24/2024/TT-BGDĐT</span>
              </div>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#0057FF] px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#061844] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF] dark:hover:bg-[#06B6D4] dark:hover:text-[#040D22]"
              >
                <span>{currentUser ? 'Vào trang làm việc' : 'Đăng nhập / Bắt đầu ngay'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {!currentUser && (
                <button
                  type="button"
                  onClick={() => onEnterWorkspace(role)}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-[#061844] transition-colors duration-150 hover:border-[#0057FF] hover:text-[#0057FF] dark:border-[#1E3F8A] dark:bg-[#0B225B] dark:text-slate-100 dark:hover:border-[#22D3EE] dark:hover:text-[#22D3EE]"
                >
                  <span>Trải nghiệm phòng thi</span>
                </button>
              )}

              <a
                href="#tinh-nang"
                className="inline-flex h-11 items-center px-2 text-sm font-semibold text-[#0057FF] underline-offset-4 hover:underline dark:text-[#22D3EE]"
              >
                Tìm hiểu tính năng
              </a>
            </div>
          </div>

          {/* Right Brand Focal Card (Navy Blue - Electric Blue - Cyan) */}
          <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#061844] via-[#0B2B78] to-[#0057FF] p-7 text-white sm:p-8 lg:col-span-5">
            <div className="rounded-xl border border-white/15 bg-white p-6 shadow-lg">
              {!logoFailed ? (
                <img
                  src={NTPEXION_LOGO_PATH}
                  alt="Logo chính thức NTPEXION — Innovation in Every Exam"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                  className="mx-auto h-40 w-full object-contain sm:h-44"
                />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center text-center">
                  <span className="font-display text-3xl font-extrabold tracking-tight text-[#061844]">
                    NTPE<span className="text-[#0057FF]">X</span>ION
                  </span>
                  <span className="mt-1 text-xs font-medium italic text-slate-600">
                    Innovation in Every Exam.
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-3 border-t border-white/15 pt-5 text-xs">
              <div className="flex items-start justify-between gap-4">
                <span className="text-cyan-200/90">Thương hiệu</span>
                <span className="font-display font-bold tracking-wide text-white">NTPEXION</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-cyan-200/90">Thông điệp</span>
                <span className="text-right font-medium text-white">
                  Innovation in Every Exam
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-cyan-200/90">Cấu trúc đánh giá</span>
                <span className="text-right font-medium text-white">
                  Phần I · Phần II lũy tiến · Phần III
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-cyan-200/90">Phân quyền lớp học</span>
                <span className="text-right font-medium text-cyan-200">
                  Mã lớp 5 ký tự bảo mật · Giới hạn 5 lớp/GV
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 4-COLUMN QUANTITATIVE CAPABILITY STRIP                             */}
        {/* ================================================================= */}
        <section
          aria-label="Thông số nền tảng NTPEXION"
          className="mt-6 grid grid-cols-2 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-[#132B66] dark:border-[#132B66] dark:bg-[#08173D]"
        >
          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Đề thi trên hệ thống
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#061844] tabular-nums dark:text-white">
              {stats.examsCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Sẵn sàng tổ chức &amp; thi thử
            </p>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Ngân hàng câu hỏi
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
              {stats.questionsCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Đủ 3 dạng thức chuẩn 2025
            </p>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Lớp học đang vận hành
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#061844] tabular-nums dark:text-white">
              {stats.classesCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Quản lý tài liệu &amp; lịch học
            </p>
          </div>
          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Lượt bài đã chấm điểm
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-[#0891B2] tabular-nums dark:text-[#22D3EE]">
              {stats.submissionsCount}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Chấm tự động thang điểm 10,00
            </p>
          </div>
        </section>

        {/* ================================================================= */}
        {/* CORE CAPABILITIES (ASYMMETRIC BENTO GRID)                         */}
        {/* ================================================================= */}
        <section id="tinh-nang" className="mt-16 scroll-mt-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#0057FF] dark:text-[#22D3EE]">
              Năng lực cốt lõi
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#061844] [text-wrap:balance] sm:text-3xl dark:text-white">
              Mọi công cụ cần thiết cho một kỳ thi trắc nghiệm minh bạch và hiệu quả
            </h2>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* 01 Wide */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 lg:col-span-7 dark:border-[#132B66] dark:bg-[#08173D]">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-xl font-bold text-[#061844] dark:text-white">
                    01. Ma trận đề thi 2025 &amp; Trộn mã đề tự động
                  </h3>
                  <Layers className="h-5 w-5 shrink-0 text-[#0057FF] dark:text-[#22D3EE]" />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Hỗ trợ đầy đủ 3 dạng thức câu hỏi: Trắc nghiệm nhiều lựa chọn (Phần I), Đúng/Sai
                  tính điểm lũy tiến 0,1 – 0,25 – 0,5 – 1,0 (Phần II) và Trả lời ngắn (Phần III).
                  Tự động hoán vị thứ tự câu hỏi, đáp án và xuất bản in A4 rõ nét.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500 dark:border-[#132B66] dark:text-slate-400">
                <span>Nhập đề Word / Excel / Text</span>
                <span aria-hidden="true">·</span>
                <span>Tạo mã đề 0101–0104</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-[#0057FF] dark:text-[#22D3EE]">
                  <Printer className="h-3.5 w-3.5" />
                  In đề chuẩn A4
                </span>
              </div>
            </article>

            {/* 02 Compact */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 lg:col-span-5 dark:border-[#132B66] dark:bg-[#08173D]">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-xl font-bold text-[#061844] dark:text-white">
                    02. Lớp học riêng tư &amp; Lịch học tuần
                  </h3>
                  <CalendarDays className="h-5 w-5 shrink-0 text-[#0891B2] dark:text-[#22D3EE]" />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Mỗi lớp được cấp mã 5 ký tự trộn chữ hoa và số duy nhất. Giáo viên duyệt học sinh
                  vào lớp, chia sẻ tài liệu ôn tập, giao bài tập và quản lý thời khóa biểu Thứ 2 –
                  Chủ nhật tập trung trong từng lớp.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500 dark:border-[#132B66] dark:text-slate-400">
                <span>Tối đa 5 lớp/Giáo viên</span>
                <span aria-hidden="true">·</span>
                <span>Duyệt yêu cầu tham gia</span>
              </div>
            </article>

            {/* 03 Compact */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 lg:col-span-5 dark:border-[#132B66] dark:bg-[#08173D]">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-xl font-bold text-[#061844] dark:text-white">
                    03. Phòng thi trực tuyến &amp; Giám sát TT 09
                  </h3>
                  <ShieldCheck className="h-5 w-5 shrink-0 text-[#0057FF] dark:text-[#22D3EE]" />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Tự động phát hiện chuyển tab, rời cửa sổ trình duyệt hoặc mất kết nối mạng và gửi
                  cảnh báo ngay tới giáo viên phụ trách. Tự động lưu tiến độ và nộp bài đúng hạn.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500 dark:border-[#132B66] dark:text-slate-400">
                <span>Cảnh báo chuyển tab</span>
                <span aria-hidden="true">·</span>
                <span>Đếm ngược thời gian thực</span>
              </div>
            </article>

            {/* 04 Wide */}
            <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 lg:col-span-7 dark:border-[#132B66] dark:bg-[#08173D]">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-xl font-bold text-[#061844] dark:text-white">
                    04. Ngân hàng câu hỏi đa cấp học &amp; Bảng điểm chi tiết
                  </h3>
                  <ClipboardCheck className="h-5 w-5 shrink-0 text-[#0891B2] dark:text-[#22D3EE]" />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Quản lý câu hỏi linh hoạt từ Khối 1 đến Khối 12, Cao đẳng và Đại học theo nhiều
                  môn học tự chọn. Ngay khi thí sinh nộp bài, hệ thống chấm điểm từng phần, xếp loại
                  học lực và xuất file CSV phục vụ lưu trữ sổ điểm.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500 dark:border-[#132B66] dark:text-slate-400">
                <span>Khối 1–12, Cao đẳng &amp; Đại học</span>
                <span aria-hidden="true">·</span>
                <span>Phân tích lời giải sau thi</span>
                <span aria-hidden="true">·</span>
                <span>Xuất bảng điểm CSV</span>
              </div>
            </article>
          </div>
        </section>

        {/* ================================================================= */}
        {/* ROLES & WORKFLOWS                                                 */}
        {/* ================================================================= */}
        <section
          id="vai-tro"
          className="mt-16 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-7 sm:p-10 dark:border-[#132B66] dark:bg-[#08173D]"
        >
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end dark:border-[#132B66]">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#0057FF] dark:text-[#22D3EE]">
                Phân quyền rõ ràng
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#061844] dark:text-white">
                Thiết kế chuyên biệt cho từng vai trò sử dụng
              </h2>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Giao diện tự động điều chỉnh theo tài khoản đăng nhập để giữ thao tác tập trung, không
              lẫn lộn chức năng.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:divide-x md:divide-slate-200 dark:md:divide-[#132B66]">
            {/* Student */}
            <div className="flex flex-col justify-between md:pr-6">
              <div>
                <div className="flex items-center gap-2 text-[#0057FF] dark:text-[#22D3EE]">
                  <GraduationCap className="h-5 w-5" />
                  <h3 className="font-display text-lg font-bold text-[#061844] dark:text-white">
                    Học sinh &amp; Sinh viên
                  </h3>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                    <span>Nhập mã lớp 5 ký tự để tham gia lớp học và nhận tài liệu ôn tập.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                    <span>Vào phòng thi theo mã phòng, làm bài và xem đáp án chi tiết tức thì.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                    <span>Theo dõi lịch học tuần và lịch sử bảng điểm cá nhân mọi lúc.</span>
                  </li>
                </ul>
              </div>
              {!currentUser && (
                <button
                  type="button"
                  onClick={() => onEnterWorkspace('student')}
                  className="mt-6 inline-flex cursor-pointer items-center gap-1.5 self-start text-xs font-semibold text-[#0057FF] hover:underline dark:text-[#22D3EE]"
                >
                  <span>Xem thử góc Học sinh</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Teacher */}
            <div className="flex flex-col justify-between md:px-6">
              <div>
                <div className="flex items-center gap-2 text-[#0057FF] dark:text-[#22D3EE]">
                  <BookOpenCheck className="h-5 w-5" />
                  <h3 className="font-display text-lg font-bold text-[#061844] dark:text-white">
                    Giáo viên &amp; Giảng viên
                  </h3>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                    <span>Trang chủ tinh gọn gồm Lớp học và Lịch học; mọi tài liệu, bài tập, bài thi và bảng điểm nằm gọn trong từng lớp.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                    <span>Tạo tối đa 5 lớp riêng tư với mã lớp tự sinh tránh trùng lặp.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                    <span>Nhận cảnh báo giám sát phòng thi và phê duyệt học sinh vào lớp.</span>
                  </li>
                </ul>
              </div>
              {!currentUser && (
                <button
                  type="button"
                  onClick={() => onEnterWorkspace('teacher')}
                  className="mt-6 inline-flex cursor-pointer items-center gap-1.5 self-start text-xs font-semibold text-[#0057FF] hover:underline dark:text-[#22D3EE]"
                >
                  <span>Xem thử góc Giáo viên</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Admin */}
            <div className="flex flex-col justify-between md:pl-6">
              <div>
                <div className="flex items-center gap-2 text-[#0057FF] dark:text-[#22D3EE]">
                  <Lock className="h-5 w-5" />
                  <h3 className="font-display text-lg font-bold text-[#061844] dark:text-white">
                    Quản trị viên Hệ thống
                  </h3>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                    <span>Điều phối toàn bộ tài khoản Học sinh, Giáo viên và phân quyền truy cập.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                    <span>Theo dõi nhật ký hoạt động, cấu hình thông báo và thống kê điểm số.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                    <span>Sao lưu toàn bộ dữ liệu hệ thống dưới định dạng JSON an toàn.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 3-STEP WORKFLOW + BOTTOM CONVERSION CTA                           */}
        {/* ================================================================= */}
        <section id="quy-trinh" className="mt-16 scroll-mt-24">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#132B66] dark:bg-[#08173D]">
              <p className="font-mono text-xs font-bold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                Bước 01
              </p>
              <h3 className="mt-2 font-display text-base font-bold text-[#061844] dark:text-white">
                Đăng nhập hoặc Tạo tài khoản
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Chọn vai trò Học sinh hoặc Giáo viên để nhận không gian làm việc và bộ công cụ phù
                hợp ngay lập tức.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#132B66] dark:bg-[#08173D]">
              <p className="font-mono text-xs font-bold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                Bước 02
              </p>
              <h3 className="mt-2 font-display text-base font-bold text-[#061844] dark:text-white">
                Kết nối Lớp học qua Mã 5 ký tự
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Giáo viên mở lớp và chia sẻ mã lớp; học sinh nhập mã để đồng bộ đề thi, tài liệu,
                bài tập và thời khóa biểu.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-[#132B66] dark:bg-[#08173D]">
              <p className="font-mono text-xs font-bold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                Bước 03
              </p>
              <h3 className="mt-2 font-display text-base font-bold text-[#061844] dark:text-white">
                Tổ chức thi &amp; Phân tích kết quả
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Thí sinh làm bài trong môi trường giám sát nghiêm túc; hệ thống tự động chấm điểm và
                xuất báo cáo ngay khi kết thúc.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-between gap-6 rounded-2xl bg-gradient-to-r from-[#061844] via-[#0B2B78] to-[#0057FF] p-8 text-white sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <p className="text-xs font-semibold tracking-wide text-cyan-300">
                NTPEXION · Innovation in Every Exam
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight [text-wrap:balance]">
                Sẵn sàng tổ chức kỳ thi trực tuyến đầu tiên của bạn
              </h2>
              <p className="mt-2 text-sm text-slate-200">
                Truy cập ngay hệ thống NTPEXION để tạo lớp học, soạn đề thi hoặc vào phòng thi trực
                tuyến.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {!currentUser && (
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-cyan-300/60 bg-white/10 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <span>Đăng ký miễn phí</span>
                </button>
              )}
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#06B6D4] px-6 text-sm font-bold text-[#040D22] transition-colors hover:bg-[#22D3EE]"
              >
                <span>{currentUser ? 'Mở không gian chính' : 'Đăng nhập ngay'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {!embedded && (
        <footer className="mt-8 border-t border-slate-200 bg-white dark:border-[#102558] dark:bg-[#061844]">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8 dark:text-slate-300">
            <p className="font-medium">
              <strong className="font-bold text-[#061844] dark:text-white">NTPEXION</strong> ·
              Innovation in Every Exam · Hệ thống Thi Trắc nghiệm Trực tuyến
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="cursor-pointer font-semibold text-[#0057FF] hover:underline dark:text-[#22D3EE]"
              >
                Đăng nhập
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onEnterWorkspace(role)}
                className="cursor-pointer font-semibold text-slate-700 hover:text-[#0057FF] dark:text-slate-200 dark:hover:text-[#22D3EE]"
              >
                Xem thử hệ thống
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
