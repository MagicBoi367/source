import { AlertTriangle, CheckCircle2, Clock, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import type { Exam, UserAccount } from '../types/exam';
import {
  calculateExamMaxRawScore,
  EXAM_CATEGORY_LABELS,
  formatGradeLabel,
  formatScoreVi,
  getExamDurationMinutes,
  getSubjectMeta,
} from '../utils/scoring2025';

interface ExamLobbyModalProps {
  exam: Exam;
  currentUser?: UserAccount | null;
  onCancel: () => void;
  onStartExam: (candidate: {
    studentName: string;
    studentSbd: string;
    studentClass: string;
    variantCode: string;
  }) => void;
}

const VARIANT_CODES = ['0101', '0102', '0103', '0104'];

export function ExamLobbyModal({
  exam,
  currentUser,
  onCancel,
  onStartExam,
}: ExamLobbyModalProps) {
  const [studentName, setStudentName] = useState(
    currentUser?.fullName ?? 'Nguyễn Minh Anh',
  );
  const [studentSbd, setStudentSbd] = useState(
    currentUser?.role === 'admin'
      ? 'ADMIN-TEST'
      : currentUser?.role === 'teacher'
        ? 'GV-TEST'
        : currentUser?.studentSbd ?? '0102588',
  );
  const [studentClass, setStudentClass] = useState(
    currentUser?.role === 'admin'
      ? 'QUẢN TRỊ VIÊN'
      : currentUser?.role === 'teacher'
        ? 'GIÁO VIÊN'
        : currentUser?.studentClass ?? '12A1',
  );
  const [variantCode, setVariantCode] = useState(
    exam.shuffleQuestions || exam.shuffleOptions
      ? VARIANT_CODES[Math.floor(Math.random() * VARIANT_CODES.length)]
      : '0101',
  );
  const [acceptedRules, setAcceptedRules] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const subjectMeta = getSubjectMeta(exam.subject);
  const maxRaw = calculateExamMaxRawScore(exam);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentSbd.trim() || !studentClass.trim()) {
      setError('Vui lòng điền đầy đủ Họ tên, Số báo danh và Lớp / Đơn vị.');
      return;
    }
    if (!acceptedRules) {
      setError('Thí sinh cần xác nhận tuân thủ Quy chế thi trực tuyến trước khi làm bài.');
      return;
    }
    onStartExam({
      studentName: studentName.trim(),
      studentSbd: studentSbd.trim().toUpperCase(),
      studentClass: studentClass.trim().toUpperCase(),
      variantCode,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lobby-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/75"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
              Xác nhận thông tin thí sinh · Mã phòng {exam.roomCode}
            </p>
            <h2
              id="lobby-title"
              className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-slate-50"
            >
              {exam.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onCancel}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Exam Specs Summary */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Môn thi</span>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {subjectMeta.name} · {formatGradeLabel(exam.grade)}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Hình thức</span>
              <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                {EXAM_CATEGORY_LABELS[exam.category]}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Thời gian</span>
              <p className="mt-0.5 inline-flex items-center gap-1 font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                {getExamDurationMinutes(exam)} phút
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Cấu trúc đề thi</span>
              <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                {[
                  exam.part1QuestionIds.length > 0
                    ? `${exam.part1QuestionIds.length} P.I`
                    : null,
                  exam.part2QuestionIds.length > 0
                    ? `${exam.part2QuestionIds.length} P.II`
                    : null,
                  exam.part3QuestionIds.length > 0
                    ? `${exam.part3QuestionIds.length} P.III`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' + ') || '0 câu'}{' '}
                ({formatScoreVi(maxRaw)}đ)
              </p>
            </div>
          </div>

          {/* Candidate Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="cand-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Họ và tên thí sinh
              </label>
              <input
                id="cand-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
                placeholder="Ví dụ: Nguyễn Văn An"
              />
            </div>

            <div>
              <label
                htmlFor="cand-sbd"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Số báo danh (SBD)
              </label>
              <input
                id="cand-sbd"
                type="text"
                value={studentSbd}
                onChange={(e) => setStudentSbd(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 uppercase focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
                placeholder="0102588"
              />
            </div>

            <div>
              <label
                htmlFor="cand-class"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Lớp / Đơn vị dự thi
              </label>
              <input
                id="cand-class"
                type="text"
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 uppercase focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
                placeholder="12A1"
              />
            </div>
          </div>

          {/* Exam Variant Selector */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Mã đề phát hành ngẫu nhiên
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {VARIANT_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setVariantCode(code)}
                  className={`cursor-pointer rounded-lg border px-4 py-2 font-mono text-xs font-semibold tabular-nums transition-colors ${
                    variantCode === code
                      ? 'border-blue-700 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Mã đề {code}
                </button>
              ))}
            </div>
          </div>

          {/* MOET 2025 Regulation Box */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              <span>Quy chế phòng thi trực tuyến (Thông tư 24/2024 &amp; Thông tư 09/2021)</span>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-slate-600 dark:text-slate-300">
              {exam.part2QuestionIds.length > 0 && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Phần II (Đúng/Sai) chấm lũy tiến từng câu: đúng 1 ý đạt 0,10đ · 2 ý đạt 0,25đ ·
                    3 ý đạt 0,50đ · 4 ý đạt 1,00đ.
                  </span>
                </li>
              )}
              {exam.part3QuestionIds.length > 0 && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Phần III (Trả lời ngắn) nhập tối đa 4 ký tự gồm chữ số, dấu âm (-) hoặc dấu phẩy
                    thập phân (,).
                  </span>
                </li>
              )}
              {exam.autoSubmitOnTimeout !== false && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Đồng hồ đếm ngược {getExamDurationMinutes(exam)} phút: khi hết giờ, hệ thống sẽ
                    tự động khóa bài và thu bài chấm điểm ngay lập tức.
                  </span>
                </li>
              )}
              {exam.strictProctoring && (
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Hệ thống giám sát sẽ ghi nhận mọi hành vi chuyển tab, rời cửa sổ trình duyệt
                    hoặc sao chép văn bản vào biên bản nộp bài.
                  </span>
                </li>
              )}
            </ul>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={acceptedRules}
              onChange={(e) => setAcceptedRules(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 dark:border-slate-600"
            />
            <span>
              Tôi xác nhận đúng thông tin cá nhân và cam kết tự giác làm bài nghiêm túc theo quy
              chế thi hiện hành của Bộ Giáo dục và Đào tạo.
            </span>
          </label>

          {error && (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Vào phòng thi &amp; Bắt đầu tính giờ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
