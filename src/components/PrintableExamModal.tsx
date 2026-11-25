import { Printer, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Exam, Question } from '../types/exam';
import {
  formatGradeLabel,
  generateExamVariant,
  getExamDurationMinutes,
  getSubjectMeta,
  OPTION_LETTERS,
} from '../utils/scoring2025';

interface PrintableExamModalProps {
  exam: Exam;
  questionMap: Map<string, Question>;
  onClose: () => void;
}

const VARIANT_CODES = ['0101', '0102', '0103', '0104'];

export function PrintableExamModal({
  exam,
  questionMap,
  onClose,
}: PrintableExamModalProps) {
  const [variantCode, setVariantCode] = useState('0101');
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);

  const variant = useMemo(
    () => generateExamVariant(exam, questionMap, variantCode),
    [exam, questionMap, variantCode],
  );

  const subjectMeta = getSubjectMeta(exam.subject);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-0 sm:p-6 dark:bg-slate-950/85 print:static print:overflow-visible print:bg-white print:p-0"
    >
      <div className="mx-auto max-w-4xl rounded-none bg-white shadow-2xl sm:rounded-xl print:max-w-none print:rounded-none print:shadow-none">
        {/* Non-print toolbar */}
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 sm:rounded-t-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Chọn mã đề trộn:
            </span>
            {VARIANT_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setVariantCode(code)}
                className={`cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs font-bold ${
                  variantCode === code
                    ? 'border-blue-700 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {code}
              </button>
            ))}

            <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeAnswerKey}
                onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-blue-700"
              />
              <span>Kèm bảng đáp án chấm</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Printer className="h-4 w-4" />
              <span>In đề thi / Lưu PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng bản xem trước"
              className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Official MOET 2025 Printable Sheet */}
        <div className="p-8 text-slate-900 sm:p-12">
          {/* Official Header Table */}
          <div className="grid grid-cols-12 gap-4 border-b-2 border-slate-900 pb-4 text-center text-xs">
            <div className="col-span-5 space-y-1">
              <p className="font-semibold uppercase">SỞ GIÁO DỤC VÀ ĐÀO TẠO</p>
              <p className="font-bold uppercase">ĐỀ THI CHUẨN CẤU TRÚC 2025</p>
              <p className="italic">(Đề thi có cấu trúc 3 phần trắc nghiệm)</p>
            </div>
            <div className="col-span-7 space-y-1">
              <p className="font-bold uppercase">
                KỲ THI ĐÁNH GIÁ CHẤT LƯỢNG NĂM HỌC 2024 – 2025
              </p>
              <p className="font-bold uppercase">
                Môn thi: {subjectMeta.name.toUpperCase()} — {formatGradeLabel(exam.grade).toUpperCase()}
              </p>
              <p>
                Thời gian làm bài: <strong>{getExamDurationMinutes(exam)} phút</strong>, không kể
                thời gian phát đề
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span>Họ và tên thí sinh: ....................................................</span>
              <span className="ml-4">Số báo danh: ........................</span>
            </div>
            <div className="border-2 border-slate-900 px-3 py-1 font-mono text-sm font-bold">
              Mã đề: {variant.variantCode}
            </div>
          </div>

          {/* Part I */}
          {variant.part1.length > 0 && (
            <section className="mt-6 space-y-4">
              <h3 className="text-sm font-bold uppercase">
                PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.{' '}
                <span className="font-normal normal-case">
                  Thí sinh trả lời từ câu 1 đến câu {variant.part1.length}. Mỗi câu hỏi thí sinh
                  chỉ chọn một phương án.
                </span>
              </h3>
              <div className="space-y-3 text-sm">
                {variant.part1.map((q, idx) => (
                  <div key={q.id} className="break-inside-avoid">
                    <p>
                      <strong>Câu {idx + 1}:</strong> {q.prompt}
                    </p>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 pl-4 text-[13px]">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx}>
                          <strong>{OPTION_LETTERS[oIdx]}.</strong> {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Part II */}
          {variant.part2.length > 0 && (
            <section className="mt-7 space-y-4">
              <h3 className="text-sm font-bold uppercase">
                PHẦN II. Câu trắc nghiệm đúng sai.{' '}
                <span className="font-normal normal-case">
                  Thí sinh trả lời từ câu 1 đến câu {variant.part2.length}. Trong mỗi ý a), b), c),
                  d) ở mỗi câu, thí sinh chọn đúng hoặc sai.
                </span>
              </h3>
              <div className="space-y-3 text-sm">
                {variant.part2.map((q, idx) => (
                  <div key={q.id} className="break-inside-avoid">
                    <p>
                      <strong>Câu {idx + 1}:</strong> {q.prompt}
                    </p>
                    <div className="mt-1.5 space-y-1 pl-4 text-[13px]">
                      {(q.statements ?? []).map((st) => (
                        <div key={st.id}>
                          <strong>{st.id})</strong> {st.text}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Part III */}
          {variant.part3.length > 0 && (
            <section className="mt-7 space-y-4">
              <h3 className="text-sm font-bold uppercase">
                PHẦN III. Câu trắc nghiệm trả lời ngắn.{' '}
                <span className="font-normal normal-case">
                  Thí sinh trả lời từ câu 1 đến câu {variant.part3.length}.
                </span>
              </h3>
              <div className="space-y-3 text-sm">
                {variant.part3.map((q, idx) => (
                  <div key={q.id} className="break-inside-avoid">
                    <p>
                      <strong>Câu {idx + 1}:</strong> {q.prompt}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="mt-8 text-center text-xs font-bold uppercase">
            ---------- HẾT ----------
          </p>

          {/* Optional Answer Key */}
          {includeAnswerKey && (
            <section className="mt-10 border-t-2 border-dashed border-slate-400 pt-6">
              <h3 className="text-sm font-bold uppercase">
                ĐÁP ÁN CHÍNH THỨC — MÃ ĐỀ {variant.variantCode}
              </h3>

              {variant.part1.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold">Phần I (Nhiều lựa chọn):</p>
                  <div className="mt-1.5 flex flex-wrap gap-3 font-mono text-xs">
                    {variant.part1.map((q, idx) => (
                      <span key={q.id} className="rounded border border-slate-300 px-2 py-1">
                        {idx + 1}: <strong>{OPTION_LETTERS[q.correctOptionIndex]}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {variant.part2.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold">Phần II (Đúng/Sai):</p>
                  <div className="mt-1.5 flex flex-wrap gap-3 font-mono text-xs">
                    {variant.part2.map((q, idx) => (
                      <span key={q.id} className="rounded border border-slate-300 px-2 py-1">
                        C{idx + 1}:{' '}
                        <strong>
                          {(q.statements ?? [])
                            .map((s) => `${s.id}-${s.isTrue ? 'Đ' : 'S'}`)
                            .join(' ')}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {variant.part3.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold">Phần III (Trả lời ngắn):</p>
                  <div className="mt-1.5 flex flex-wrap gap-3 font-mono text-xs">
                    {variant.part3.map((q, idx) => (
                      <span key={q.id} className="rounded border border-slate-300 px-2 py-1">
                        C{idx + 1}: <strong>{q.shortAnswer}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
