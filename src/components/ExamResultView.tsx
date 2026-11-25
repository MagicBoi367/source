import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { CognitiveLevel, ExamSubmission } from '../types/exam';
import { ActionLogModal } from './ActionLogModal';
import {
  classifyAcademicRankTT22,
  COGNITIVE_LEVEL_LABELS,
  formatDurationMMSS,
  formatScoreVi,
  getSubjectMeta,
  isShortAnswerCorrect,
  OPTION_LETTERS,
  scorePart2Question,
} from '../utils/scoring2025';

interface ExamResultViewProps {
  submission: ExamSubmission;
  showSolutions?: boolean;
  onBack: () => void;
}

export function ExamResultView({
  submission,
  showSolutions = true,
  onBack,
}: ExamResultViewProps) {
  const rank = classifyAcademicRankTT22(submission.totalScore);
  const subjectMeta = getSubjectMeta(submission.subject);

  const rankBadgeTone: Record<typeof rank.tone, string> = {
    emerald:
      'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800',
    blue: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/50 dark:border-blue-800',
    amber:
      'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-800',
    red: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/50 dark:border-red-800',
  };

  const resultMap = new Map(
    submission.questionResults.map((r) => [r.questionId, r]),
  );

  const [actionLogOpen, setActionLogOpen] = useState(false);
  const actionLogsCount = submission.actionLogs?.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại</span>
        </button>

        {actionLogsCount > 0 && (
          <button
            type="button"
            onClick={() => setActionLogOpen(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-slate-700 tabular-nums transition-colors hover:border-blue-600 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Xem nhật ký thao tác ({actionLogsCount})</span>
          </button>
        )}
      </div>

      {/* Score Certificate Header */}
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 md:flex-row md:items-center dark:border-slate-800">
          <div>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
              Phiếu kết quả chấm tự động chuẩn Bộ GD&amp;ĐT 2025
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
              {submission.examTitle}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {submission.studentName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">SBD: {submission.studentSbd}</span>
              <span aria-hidden="true">·</span>
              <span>Lớp {submission.studentClass}</span>
              <span aria-hidden="true">·</span>
              <span>Môn {subjectMeta.name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-slate-800 tabular-nums dark:text-slate-200">
                Mã đề {submission.variantCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <div className="text-right">
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Tổng điểm (Thang 10)
              </span>
              <span className="font-mono text-4xl font-extrabold text-blue-700 tabular-nums dark:text-blue-400">
                {formatScoreVi(submission.totalScore)}
              </span>
            </div>
            <div
              className={`rounded-lg border px-3.5 py-2 text-center ${rankBadgeTone[rank.tone]}`}
            >
              <span className="block text-[11px] font-medium opacity-80">Xếp loại TT 22</span>
              <span className="font-display text-sm font-bold">{rank.label}</span>
            </div>
          </div>
        </div>

        {/* Parts Breakdown + Proctoring */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {submission.part1Total > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Phần I · Nhiều lựa chọn</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
                {formatScoreVi(submission.part1Score)} đ
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums dark:text-slate-400">
                Đúng {submission.part1CorrectCount}/{submission.part1Total} câu
              </p>
            </div>
          )}

          {submission.part2TotalStatements > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phần II · Đúng/Sai (Lũy tiến)
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
                {formatScoreVi(submission.part2Score)} đ
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums dark:text-slate-400">
                Đúng {submission.part2CorrectStatements}/{submission.part2TotalStatements} ý nhỏ
              </p>
            </div>
          )}

          {submission.part3Total > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-xs text-slate-500 dark:text-slate-400">Phần III · Trả lời ngắn</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
                {formatScoreVi(submission.part3Score)} đ
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums dark:text-slate-400">
                Đúng {submission.part3CorrectCount}/{submission.part3Total} câu
              </p>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">Thời gian &amp; Giám sát</p>
            <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-slate-100">
              <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              {formatDurationMMSS(submission.elapsedSeconds)}
            </p>
            {submission.submissionReason === 'timeout' && (
              <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
                Tự động nộp khi hết giờ
              </p>
            )}
            <p className="mt-1 flex items-center gap-1 text-xs">
              {submission.violations.length === 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Hợp lệ (0 vi phạm)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {submission.violations.length} cảnh báo chuyển tab
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Cognitive Level Mastery Breakdown */}
        <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            Phân tích năng lực theo 3 mức độ nhận thức (GDPT 2018)
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(['biet', 'hieu', 'van_dung'] as CognitiveLevel[]).map((lvl) => {
              const item = submission.levelBreakdown[lvl];
              const pct = item.max > 0 ? Math.round((item.earned / item.max) * 100) : 0;
              return (
                <div key={lvl} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {COGNITIVE_LEVEL_LABELS[lvl]}
                    </span>
                    <span className="font-mono text-slate-600 tabular-nums dark:text-slate-400">
                      {formatScoreVi(item.earned)} / {formatScoreVi(item.max)} đ ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-700 transition-all dark:bg-blue-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Proctoring Incident Log if any */}
        {submission.violations.length > 0 && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-semibold">
              Nhật ký giám sát phòng thi ({submission.violations.length} sự kiện)
            </p>
            <ul className="mt-2 space-y-1">
              {submission.violations.map((v, i) => (
                <li key={i} className="font-mono tabular-nums">
                  [{new Date(v.timestamp).toLocaleTimeString('vi-VN')}] {v.detail}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Detailed Question-by-Question Review */}
      {showSolutions && (
        <section className="mt-8 space-y-6">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">
            Chi tiết bài làm &amp; Đáp án giải thích
          </h2>

          {/* Part I Review */}
          {submission.variantSnapshot.part1.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Phần I. Trắc nghiệm nhiều lựa chọn
              </h3>
              {submission.variantSnapshot.part1.map((q, idx) => {
                const userChoice = submission.answers.part1[q.id];
                const res = resultMap.get(q.id);
                const isCorrect = res?.isFullyCorrect;

                return (
                  <article
                    key={q.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                        Câu {idx + 1} · {q.topic} · {COGNITIVE_LEVEL_LABELS[q.level]}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          isCorrect
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {isCorrect
                          ? `Đúng (+${formatScoreVi(res?.earned ?? 0)}đ)`
                          : 'Sai (0,00đ)'}
                      </span>
                    </div>

                    <p className="mt-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {q.prompt}
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {q.options.map((opt, oIdx) => {
                        const isRightAns = q.correctOptionIndex === oIdx;
                        const isUserAns = userChoice === oIdx;
                        let style =
                          'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300';
                        if (isRightAns) {
                          style =
                            'border-emerald-300 bg-emerald-50 text-emerald-950 font-semibold dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200';
                        } else if (isUserAns && !isRightAns) {
                          style =
                            'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200';
                        }

                        return (
                          <div
                            key={oIdx}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${style}`}
                          >
                            <span className="flex min-w-0 items-start gap-2 leading-snug">
                              <strong className="shrink-0 font-mono">
                                {OPTION_LETTERS[oIdx]}.
                              </strong>
                              <span className="min-w-0 break-words">{opt}</span>
                            </span>
                            {isRightAns && (
                              <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">
                                Đáp án đúng
                              </span>
                            )}
                            {isUserAns && !isRightAns && (
                              <span className="shrink-0 font-semibold text-red-600 dark:text-red-400">
                                Bạn chọn
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                      <strong>Lời giải:</strong> {q.explanation}
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          {/* Part II Review */}
          {submission.variantSnapshot.part2.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Phần II. Trắc nghiệm Đúng/Sai (Chấm lũy tiến 0,10 · 0,25 · 0,50 · 1,00)
              </h3>
              {submission.variantSnapshot.part2.map((q, idx) => {
                const userStmts = submission.answers.part2[q.id] ?? {};
                const res = resultMap.get(q.id);
                const correctCount = res?.correctStatementsCount ?? 0;
                const earned = res?.earned ?? scorePart2Question(correctCount, 1.0);

                return (
                  <article
                    key={q.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                        Câu {idx + 1} (Phần II) · {q.topic} · {COGNITIVE_LEVEL_LABELS[q.level]}
                      </span>
                      <span className="font-mono font-semibold text-blue-700 tabular-nums dark:text-blue-400">
                        Đúng {correctCount}/4 ý (+{formatScoreVi(earned)}đ)
                      </span>
                    </div>

                    <p className="mt-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {q.prompt}
                    </p>

                    <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                      {(q.statements ?? []).map((stmt) => {
                        const userPick = userStmts[stmt.id];
                        const isMatch = userPick !== undefined && userPick === stmt.isTrue;
                        return (
                          <div
                            key={stmt.id}
                            className="flex flex-col justify-between gap-2 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center"
                          >
                            <span className="text-slate-800 dark:text-slate-200">
                              <strong className="mr-1.5 font-mono">{stmt.id})</strong>
                              {stmt.text}
                            </span>
                            <div className="flex items-center gap-3 shrink-0 font-mono">
                              <span className="text-slate-600 dark:text-slate-400">
                                Bạn chọn:{' '}
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {userPick === undefined
                                    ? 'Bỏ trống'
                                    : userPick
                                      ? 'Đúng'
                                      : 'Sai'}
                                </strong>
                              </span>
                              <span className="text-slate-900 dark:text-slate-100">
                                Đáp án: <strong>{stmt.isTrue ? 'Đúng' : 'Sai'}</strong>
                              </span>
                              {isMatch ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                      <strong>Giải thích chi tiết:</strong> {q.explanation}
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          {/* Part III Review */}
          {submission.variantSnapshot.part3.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Phần III. Trắc nghiệm trả lời ngắn
              </h3>
              {submission.variantSnapshot.part3.map((q, idx) => {
                const userAns = submission.answers.part3[q.id] ?? '';
                const res = resultMap.get(q.id);
                const isCorrect =
                  res?.isFullyCorrect ??
                  isShortAnswerCorrect(userAns, q.shortAnswer, q.acceptedAnswers);

                return (
                  <article
                    key={q.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-slate-100">
                        Câu {idx + 1} (Phần III) · {q.topic} · {COGNITIVE_LEVEL_LABELS[q.level]}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          isCorrect
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {isCorrect
                          ? `Chính xác (+${formatScoreVi(res?.earned ?? 0)}đ)`
                          : 'Chưa đúng (0,00đ)'}
                      </span>
                    </div>

                    <p className="mt-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {q.prompt}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-4 text-xs">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                        <span className="text-slate-500 dark:text-slate-400">
                          Câu trả lời của bạn:{' '}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {userAns || '(Bỏ trống)'}
                        </span>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
                        <span className="text-emerald-800 dark:text-emerald-300">
                          Đáp án chuẩn:{' '}
                        </span>
                        <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">
                          {q.shortAnswer}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                      <strong>Lời giải:</strong> {q.explanation}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      {actionLogOpen && (
        <ActionLogModal
          submission={submission}
          onClose={() => setActionLogOpen(false)}
        />
      )}
    </div>
  );
}
