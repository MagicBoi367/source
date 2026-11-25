import { Keyboard, X } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

interface KeyboardShortcutsModalProps {
  mode: 'portal' | 'exam';
  onClose: () => void;
}

const PORTAL_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Điều hướng nhanh',
    items: [
      { keys: ['1'], description: 'Chuyển tới Phòng thi & Tổng quan' },
      { keys: ['2'], description: 'Chuyển tới Tổ chức đề thi' },
      { keys: ['3'], description: 'Chuyển tới Ngân hàng câu hỏi' },
      { keys: ['4'], description: 'Chuyển tới Kết quả thi & Thống kê' },
      { keys: ['5'], description: 'Chuyển tới Trang Quản trị Admin (nếu có quyền)' },
    ],
  },
  {
    title: 'Giao diện & Hộp thoại',
    items: [
      { keys: ['M'], description: 'Thu gọn / mở rộng cột menu bên phải' },
      { keys: ['D'], description: 'Bật / tắt chế độ giao diện tối (Dark Mode)' },
      { keys: ['?'], description: 'Mở hoặc đóng bảng phím tắt' },
      { keys: ['Esc'], description: 'Đóng hộp thoại hoặc quay lại trang trước' },
    ],
  },
];

const EXAM_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Di chuyển câu hỏi',
    items: [
      { keys: ['↓', 'J'], description: 'Chuyển tới câu hỏi tiếp theo' },
      { keys: ['↑', 'K'], description: 'Quay lại câu hỏi trước đó' },
      { keys: ['['], description: 'Nhảy tới câu đã đánh dấu trước đó' },
      { keys: [']'], description: 'Nhảy tới câu đã đánh dấu tiếp theo' },
    ],
  },
  {
    title: 'Chọn & nhập đáp án nhanh',
    items: [
      { keys: ['1', '–', '4'], description: 'Phần I: Chọn đáp án A, B, C, D (hoặc nhấn A–D)' },
      { keys: ['1', '–', '4'], description: 'Phần II: Chuyển Đúng / Sai lần lượt cho ý a), b), c), d)' },
      { keys: ['Enter'], description: 'Phần III: Đưa con trỏ vào ô nhập đáp án ngắn' },
      { keys: ['Esc'], description: 'Thoát khỏi ô nhập số để tiếp tục điều hướng bằng phím' },
    ],
  },
  {
    title: 'Điều khiển phòng thi',
    items: [
      { keys: ['Space'], description: 'Tạm dừng hoặc tiếp tục tính giờ làm bài' },
      { keys: ['B'], description: 'Đánh dấu / bỏ đánh dấu xem lại câu hiện tại' },
      { keys: ['F'], description: 'Bật / tắt chế độ toàn màn hình tập trung' },
      { keys: ['M'], description: 'Bật / tắt âm báo sắp hết giờ (< 5 phút)' },
      { keys: ['D'], description: 'Bật / tắt giao diện tối (Dark Mode)' },
      { keys: ['Ctrl', 'Enter'], description: 'Mở hộp thoại xác nhận nộp bài' },
      { keys: ['?'], description: 'Mở hoặc đóng bảng phím tắt này' },
    ],
  },
];

export function KeyboardShortcutsModal({ mode, onClose }: KeyboardShortcutsModalProps) {
  const groups = mode === 'exam' ? EXAM_SHORTCUT_GROUPS : PORTAL_SHORTCUT_GROUPS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            <h2
              id="keyboard-shortcuts-title"
              className="font-display text-base font-bold text-slate-900 sm:text-lg dark:text-slate-50"
            >
              {mode === 'exam' ? 'Phím tắt trong Phòng thi' : 'Phím tắt Điều hướng Hệ thống'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng phím tắt"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {group.title}
              </h3>
              <ul className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {group.items.map((item, idx) => (
                  <li
                    key={`${group.title}-${idx}`}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                  >
                    <span className="text-slate-700 dark:text-slate-300">{item.description}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((keyLabel, kIdx) =>
                        keyLabel === '–' ? (
                          <span
                            key={kIdx}
                            className="text-xs text-slate-400 dark:text-slate-500"
                          >
                            –
                          </span>
                        ) : (
                          <kbd
                            key={kIdx}
                            className="inline-flex min-w-[26px] items-center justify-center rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {keyLabel}
                          </kbd>
                        ),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Mẹo: Các phím tắt tự động tạm vô hiệu hóa khi bạn đang nhập liệu trong ô tìm kiếm hoặc ô
            nhập số trả lời ngắn. Nhấn <kbd className="rounded border border-slate-300 bg-slate-100 px-1 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">Esc</kbd> để thoát ô nhập liệu.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Đã hiểu (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
