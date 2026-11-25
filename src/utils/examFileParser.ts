import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type {
  CognitiveLevel,
  GradeLevel,
  Question,
  QuestionType,
  SubjectId,
  TrueFalseStatement,
} from '../types/exam';
import { OPTION_LETTERS, parseAllowedGradeInput } from './scoring2025';
import { listAllSubjects } from './subjectStore';

export interface ImportDefaults {
  subject: SubjectId;
  grade: GradeLevel;
  defaultLevel: CognitiveLevel;
  defaultTopic: string;
}

export interface ParsedQuestionDraft {
  tempId: string;
  sourceNumber: number;
  sourcePart?: 1 | 2 | 3;
  type: QuestionType;
  subject: SubjectId;
  grade: GradeLevel;
  level: CognitiveLevel;
  topic: string;
  prompt: string;
  options?: [string, string, string, string];
  correctOptionIndex?: 0 | 1 | 2 | 3;
  statements?: [
    TrueFalseStatement,
    TrueFalseStatement,
    TrueFalseStatement,
    TrueFalseStatement,
  ];
  shortAnswer?: string;
  explanation: string;
  answerSource: 'none' | 'embedded' | 'answer_file' | 'manual';
  warnings: string[];
}

export interface ParsedAnswerEntry {
  part?: 1 | 2 | 3;
  number: number;
  part1AnswerIndex?: 0 | 1 | 2 | 3;
  part2Booleans?: Partial<Record<'a' | 'b' | 'c' | 'd', boolean>>;
  shortAnswer?: string;
  explanation?: string;
  rawValue: string;
}

export const SAMPLE_QUESTION_FILE_TXT = `PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn

Câu 1. [Nhận biết] [Chuyên đề: Ứng dụng đạo hàm] Cho hàm số y = x³ - 3x + 1. Giá trị cực đại của hàm số đã cho bằng
A. -1
B. 3
C. 1
D. -3

Câu 2. [Thông hiểu] [Chuyên đề: Nguyên hàm - Tích phân] Tích phân ∫(từ 0 đến 2) (2x + 1) dx bằng
A. 4
B. 5
C. 6
D. 8

PHẦN II. Câu trắc nghiệm đúng sai

Câu 1. [Thông hiểu] [Chuyên đề: Hàm số mũ và Logarit] Cho hàm số f(x) = log₂(x - 1). Xét tính đúng sai của các mệnh đề sau:
a) Tập xác định của hàm số là D = (1; +∞).
b) Đạo hàm của hàm số là f'(x) = 1 / ((x - 1)ln2).
c) Đồ thị hàm số đi qua điểm M(2; 1).
d) Hàm số nghịch biến trên khoảng (1; +∞).

PHẦN III. Câu trắc nghiệm trả lời ngắn

Câu 1. [Vận dụng] [Chuyên đề: Hình học không gian Oxyz] Trong không gian Oxyz, cho hai điểm A(1; 2; -1) và B(3; -2; 3). Tính độ dài đoạn thẳng AB (làm tròn đến hàng phần mười).`;

export const SAMPLE_ANSWER_FILE_TXT = `PHẦN I
Câu 1: B | Lời giải: Ta có y' = 3x² - 3 = 0 ⇔ x = ±1. Tại x = -1 hàm số đạt cực đại y(-1) = 3.
Câu 2: C | Lời giải: Nguyên hàm là x² + x, thay cận từ 0 đến 2 được 4 + 2 = 6.

PHẦN II
Câu 1: a) Đúng, b) Đúng, c) Sai, d) Sai | Lời giải: c) f(2) = log₂(1) = 0 ≠ 1; d) Cơ số 2 > 1 nên hàm số đồng biến trên (1; +∞).

PHẦN III
Câu 1: 6 | Lời giải: AB = √((3-1)² + (-2-2)² + (3-(-1))²) = √(4 + 16 + 16) = 6.`;

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSampleAnswerExcel(filename = 'file_cau_tra_loi_mau.xlsx'): void {
  const rows: Array<Array<string | number>> = [
    ['Phần', 'Câu', 'Đáp án', 'Lời giải'],
    [
      'Phần I',
      1,
      'B',
      "Ta có y' = 3x² - 3 = 0 ⇔ x = ±1. Tại x = -1 hàm số đạt cực đại y(-1) = 3.",
    ],
    [
      'Phần I',
      2,
      'C',
      'Nguyên hàm là x² + x, thay cận từ 0 đến 2 được 4 + 2 = 6.',
    ],
    [
      'Phần II',
      1,
      'a) Đúng, b) Đúng, c) Sai, d) Sai',
      'c) f(2) = log₂(1) = 0 ≠ 1; d) Cơ số 2 > 1 nên hàm số đồng biến trên (1; +∞).',
    ],
    [
      'Phần III',
      1,
      '6',
      'AB = √((3-1)² + (-2-2)² + (3-(-1))²) = √(4 + 16 + 16) = 6.',
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 32 }, { wch: 64 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Dap_an');
  XLSX.writeFile(workbook, filename);
}

/**
 * Extracts readable UTF-8 text from .xlsx, .xls, .ods, .docx, .txt, .md, .csv, .tsv, or .json files.
 */
export async function extractTextFromUploadedFile(file: File): Promise<string> {
  const nameLower = file.name.toLowerCase();

  if (nameLower.endsWith('.doc')) {
    throw new Error(
      'Định dạng .doc cũ (nhị phân) chưa được hỗ trợ trực tiếp trên trình duyệt. Vui lòng lưu lại dưới dạng .docx, .xlsx, .txt, .csv hoặc .json.',
    );
  }
  if (nameLower.endsWith('.pdf')) {
    throw new Error(
      'File PDF chưa hỗ trợ tách văn bản trực tiếp. Vui lòng chuyển sang .xlsx, .docx, .txt, .csv, .json hoặc dán nội dung văn bản vào khung nhập nhanh.',
    );
  }

  if (
    nameLower.endsWith('.xlsx') ||
    nameLower.endsWith('.xls') ||
    nameLower.endsWith('.ods')
  ) {
    const buffer = await file.arrayBuffer();
    return extractExcelAsStructuredText(buffer);
  }

  if (nameLower.endsWith('.docx')) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) {
      throw new Error('Không tìm thấy nội dung word/document.xml trong tệp .docx.');
    }
    const xmlText = await xmlFile.async('string');
    return extractLinesFromWordXml(xmlText);
  }

  const rawText = await file.text();
  return rawText.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
}

function escapeCsvCell(val: string): string {
  if (/[",\n\r]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function detectSheetPartHint(sheetName: string): 1 | 2 | 3 | null {
  const norm = normalizeHeaderKey(sheetName);
  if (
    norm.includes('phan_iii') ||
    norm.includes('phan_3') ||
    norm === 'p3' ||
    norm.includes('tra_loi_ngan')
  ) {
    return 3;
  }
  if (
    norm.includes('phan_ii') ||
    norm.includes('phan_2') ||
    norm === 'p2' ||
    norm.includes('dung_sai')
  ) {
    return 2;
  }
  if (
    norm.includes('phan_i') ||
    norm.includes('phan_1') ||
    norm === 'p1' ||
    norm.includes('nhieu_lua_chon') ||
    norm.includes('trac_nghiem')
  ) {
    return 1;
  }
  return detectSectionHeader(sheetName);
}

function extractExcelAsStructuredText(buffer: ArrayBuffer): string {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    throw new Error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng .xlsx / .xls hợp lệ.');
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('File Excel không có trang tính (sheet) nào.');
  }

  const outputLines: string[] = [];
  let questionCsvHeaderSignature: string | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    const rows = rawRows
      .map((r) => (Array.isArray(r) ? r.map((cell) => String(cell ?? '').trim()) : []))
      .filter((r) => r.some((cell) => cell.length > 0));

    if (rows.length === 0) continue;

    const sheetPartHint = detectSheetPartHint(sheetName);

    // 1. Check if sheet is a Question table (has a prompt/noi_dung/cau_hoi header row)
    const promptHeaderRowIdx = rows.slice(0, 6).findIndex((row) =>
      row
        .map(normalizeHeaderKey)
        .some((k) => ['prompt', 'noi_dung', 'cau_hoi', 'question', 'content', 'de_bai'].includes(k)),
    );

    if (promptHeaderRowIdx !== -1) {
      const headerNorm = rows[promptHeaderRowIdx].map(normalizeHeaderKey);
      const signature = headerNorm.join('|');
      const startRow =
        questionCsvHeaderSignature === signature
          ? promptHeaderRowIdx + 1
          : promptHeaderRowIdx;
      questionCsvHeaderSignature = signature;

      for (let r = startRow; r < rows.length; r++) {
        outputLines.push(rows[r].map(escapeCsvCell).join(','));
      }
      continue;
    }

    // 2. Check if sheet is a Structured Answer table (has answer/dap_an/key header row)
    const answerHeaderRowIdx = rows.slice(0, 8).findIndex((row) => {
      const keys = row.map(normalizeHeaderKey);
      return keys.some((k) =>
        ['answer', 'dap_an', 'dap_an_dung', 'ket_qua', 'tra_loi', 'key'].includes(k),
      );
    });

    if (answerHeaderRowIdx !== -1) {
      const headerRow = rows[answerHeaderRowIdx];
      const headerKeys = headerRow.map(normalizeHeaderKey);

      const ansColIndices = headerKeys
        .map((k, idx) =>
          ['answer', 'dap_an', 'dap_an_dung', 'ket_qua', 'tra_loi', 'key'].includes(k)
            ? idx
            : -1,
        )
        .filter((idx) => idx !== -1);

      const partColIdx = headerKeys.findIndex((k) =>
        ['phan', 'part', 'type', 'dang', 'loai'].includes(k),
      );
      const expColIdx = headerKeys.findIndex((k) =>
        ['explanation', 'loi_giai', 'giai_thich', 'huong_dan'].includes(k),
      );

      let activePart: 1 | 2 | 3 | null = sheetPartHint;
      if (activePart) {
        outputLines.push(
          activePart === 1 ? 'PHẦN I' : activePart === 2 ? 'PHẦN II' : 'PHẦN III',
        );
      }

      // Check rows ABOVE the header row in case sheet title mentions PHẦN I/II/III
      for (let r = 0; r < answerHeaderRowIdx; r++) {
        const headerSection = detectSectionHeader(rows[r].join(' '));
        if (headerSection) {
          activePart = headerSection;
          outputLines.push(
            headerSection === 1 ? 'PHẦN I' : headerSection === 2 ? 'PHẦN II' : 'PHẦN III',
          );
        }
      }

      // Build (numColIdx, ansColIdx) pairs so side-by-side multi-column answer tables also work
      const pairs = ansColIndices.map((ansIdx) => {
        let numIdx = -1;
        for (let c = ansIdx - 1; c >= 0; c--) {
          if (['cau', 'stt', 'number', 'question', 'so_thu_tu', 'ma_cau'].includes(headerKeys[c])) {
            numIdx = c;
            break;
          }
        }
        return { numIdx, ansIdx };
      });

      let fallbackCounter = 1;
      for (let r = answerHeaderRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        const joinedRow = row.filter(Boolean).join(' ');
        const inlineSection = detectSectionHeader(joinedRow);
        if (inlineSection && row.filter(Boolean).length <= 2) {
          activePart = inlineSection;
          outputLines.push(
            inlineSection === 1 ? 'PHẦN I' : inlineSection === 2 ? 'PHẦN II' : 'PHẦN III',
          );
          continue;
        }

        const rowPartRaw = partColIdx !== -1 ? row[partColIdx] : '';
        const rowPartType = normalizeQuestionType(rowPartRaw);
        const rowPart: 1 | 2 | 3 | null =
          rowPartType === 'multiple_choice'
            ? 1
            : rowPartType === 'true_false'
              ? 2
              : rowPartType === 'short_answer'
                ? 3
                : null;

        if (rowPart && rowPart !== activePart) {
          activePart = rowPart;
          outputLines.push(
            rowPart === 1 ? 'PHẦN I' : rowPart === 2 ? 'PHẦN II' : 'PHẦN III',
          );
        }

        const rowExp =
          expColIdx !== -1 ? (row[expColIdx] ?? '').replace(/\|/g, ';').trim() : '';

        for (const pair of pairs) {
          const ansRaw = (row[pair.ansIdx] ?? '').replace(/\|/g, ';').trim();
          if (!ansRaw) continue;

          const numCell = pair.numIdx !== -1 ? row[pair.numIdx] ?? '' : '';
          const numMatch = numCell.match(/(\d+)/);
          const qNum = numMatch ? Number(numMatch[1]) : fallbackCounter;
          fallbackCounter = qNum + 1;

          if (pairs.length === 1 && rowExp) {
            outputLines.push(`Câu ${qNum} | ${ansRaw} | Lời giải: ${rowExp}`);
          } else {
            outputLines.push(`Câu ${qNum} | ${ansRaw}`);
          }
        }
      }
      continue;
    }

    // 3. Check for Horizontal / Matrix answer rows or generic unheaded rows
    if (sheetPartHint) {
      outputLines.push(
        sheetPartHint === 1 ? 'PHẦN I' : sheetPartHint === 2 ? 'PHẦN II' : 'PHẦN III',
      );
    }

    const extractQuestionNumberFromCell = (cell: string): number | null => {
      const m = cell.match(/^(?:Câu|Question|Bài)?\s*(\d{1,3})\s*[:.)]?$/i);
      if (!m) return null;
      const n = Number(m[1]);
      return n >= 1 && n <= 300 ? n : null;
    };

    const consumedRows = new Set<number>();
    for (let r = 0; r < rows.length; r++) {
      if (consumedRows.has(r)) continue;
      const row = rows[r];

      // Try horizontal pair: Row r has >= 2 question numbers, Row r+1 has answers in matching columns
      if (r + 1 < rows.length) {
        const numberCols = row
          .map((cell, cIdx) => ({ cIdx, num: extractQuestionNumberFromCell(cell) }))
          .filter((item): item is { cIdx: number; num: number } => item.num !== null);

        if (numberCols.length >= 2) {
          const nextRow = rows[r + 1];
          const aligned = numberCols.filter(({ cIdx }) => (nextRow[cIdx] ?? '').trim().length > 0);
          if (aligned.length >= 2) {
            for (const { cIdx, num } of aligned) {
              const ansVal = nextRow[cIdx].replace(/\|/g, ';').trim();
              outputLines.push(`Câu ${num} | ${ansVal}`);
            }
            consumedRows.add(r);
            consumedRows.add(r + 1);
            continue;
          }
        }
      }

      const nonEmpty = row.filter(Boolean);
      if (nonEmpty.length === 0) continue;

      const sec = detectSectionHeader(nonEmpty.join(' '));
      if (sec && nonEmpty.length <= 2) {
        outputLines.push(sec === 1 ? 'PHẦN I' : sec === 2 ? 'PHẦN II' : 'PHẦN III');
        continue;
      }

      outputLines.push(nonEmpty.length > 1 ? nonEmpty.join(' | ') : nonEmpty[0]);
    }
  }

  return outputLines.join('\n');
}

function extractLinesFromWordXml(xmlText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Không thể đọc cấu trúc XML bên trong file .docx.');
  }

  const lines: string[] = [];
  const body = doc.getElementsByTagNameNS('*', 'body')[0] ?? doc.documentElement;

  const extractParagraphLines = (pEl: Element): string[] => {
    const parts: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      const local = el.localName;
      if (local === 'Fallback') return;
      if (local === 't' || local === 'delText') {
        parts.push(el.textContent ?? '');
      } else if (local === 'tab') {
        parts.push('\t');
      } else if (local === 'br' || local === 'cr') {
        parts.push('\n');
      } else if (local === 'noBreakHyphen') {
        parts.push('-');
      } else if (local === 'f') {
        const numEl = Array.from(el.childNodes).find(
          (c) => c.nodeType === Node.ELEMENT_NODE && (c as Element).localName === 'num',
        );
        const denEl = Array.from(el.childNodes).find(
          (c) => c.nodeType === Node.ELEMENT_NODE && (c as Element).localName === 'den',
        );
        if (numEl && denEl) {
          walk(numEl);
          parts.push('/');
          walk(denEl);
        } else {
          for (let i = 0; i < el.childNodes.length; i++) {
            walk(el.childNodes[i]);
          }
        }
      } else {
        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i]);
        }
      }
    };
    walk(pEl);
    return parts
      .join('')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/[\u00A0\u202F\u2007\u2009]/g, ' ')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  };

  for (let i = 0; i < body.childNodes.length; i++) {
    const child = body.childNodes[i];
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    if (el.localName === 'p') {
      lines.push(...extractParagraphLines(el));
    } else if (el.localName === 'tbl') {
      const rows = el.getElementsByTagNameNS('*', 'tr');
      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r].getElementsByTagNameNS('*', 'tc');
        const cellTexts: string[] = [];
        for (let c = 0; c < cells.length; c++) {
          const ps = cells[c].getElementsByTagNameNS('*', 'p');
          const pTexts: string[] = [];
          for (let p = 0; p < ps.length; p++) {
            pTexts.push(...extractParagraphLines(ps[p]));
          }
          const cellJoined = pTexts.join('\t').trim();
          if (cellJoined) cellTexts.push(cellJoined);
        }
        const rowLine = cellTexts.join(' | ').trim();
        if (rowLine) lines.push(rowLine);
      }
    }
  }

  return lines.join('\n');
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  const firstLine = clean.split(/\r?\n/)[0] ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const delimiter = tabCount >= commaCount && tabCount >= semiCount && tabCount > 0
    ? '\t'
    : semiCount > commaCount
      ? ';'
      : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}

function normalizeLevel(raw: string | undefined, fallback: CognitiveLevel): CognitiveLevel {
  if (!raw) return fallback;
  const norm = normalizeHeaderKey(raw);
  if (norm.includes('van_dung') || norm === 'vd' || norm === 'vdc' || norm.includes('hard')) {
    return 'van_dung';
  }
  if (norm.includes('hieu') || norm === 'th' || norm.includes('medium')) {
    return 'hieu';
  }
  if (norm.includes('biet') || norm === 'nb' || norm.includes('easy')) {
    return 'biet';
  }
  return fallback;
}

function normalizeSubject(raw: string | undefined, fallback: SubjectId): SubjectId {
  if (!raw) return fallback;
  const norm = normalizeHeaderKey(raw);
  if (norm.includes('toan') || norm === 'math') return 'toan';
  if (norm.includes('vat_li') || norm === 'li' || norm === 'ly' || norm.includes('phys')) {
    return 'vat_li';
  }
  if (norm.includes('hoa') || norm.includes('chem')) return 'hoa_hoc';
  if (norm.includes('tin') || norm.includes('cs') || norm.includes('info')) return 'tin_hoc';
  if (norm.includes('anh') || norm.includes('eng')) return 'tieng_anh';

  // Match custom or dynamically registered subjects by id, name, or shortName
  const allSubjects = listAllSubjects();
  for (const subj of allSubjects) {
    const idNorm = normalizeHeaderKey(subj.id);
    const nameNorm = normalizeHeaderKey(subj.name);
    const shortNorm = normalizeHeaderKey(subj.shortName);
    if (
      norm === idNorm ||
      norm === nameNorm ||
      norm === shortNorm ||
      (nameNorm.length >= 3 && norm.includes(nameNorm))
    ) {
      return subj.id;
    }
  }
  return fallback;
}

function normalizeQuestionType(raw: string | undefined): QuestionType | undefined {
  if (!raw) return undefined;
  const norm = normalizeHeaderKey(raw);
  if (
    norm === 'short_answer' ||
    norm === 'p3' ||
    norm === '3' ||
    norm.includes('phan_iii') ||
    norm.includes('phan_3') ||
    norm.includes('tra_loi_ngan')
  ) {
    return 'short_answer';
  }
  if (
    norm === 'true_false' ||
    norm === 'p2' ||
    norm === '2' ||
    norm.includes('phan_ii') ||
    norm.includes('phan_2') ||
    norm.includes('dung_sai')
  ) {
    return 'true_false';
  }
  if (
    norm === 'multiple_choice' ||
    norm === 'p1' ||
    norm === '1' ||
    norm.includes('phan_i') ||
    norm.includes('phan_1') ||
    norm.includes('nhieu_lua_chon') ||
    norm.includes('trac_nghiem')
  ) {
    return 'multiple_choice';
  }
  return undefined;
}

function parseBoolToken(raw: string): boolean | undefined {
  const norm = normalizeHeaderKey(raw);
  if (
    norm === 'd' ||
    norm === 'dung' ||
    norm === 't' ||
    norm === 'true' ||
    norm === '1' ||
    norm === 'x'
  ) {
    return true;
  }
  if (norm === 's' || norm === 'sai' || norm === 'f' || norm === 'false' || norm === '0') {
    return false;
  }
  return undefined;
}

function parsePart1Letter(raw: string): 0 | 1 | 2 | 3 | undefined {
  const upper = raw.trim().toUpperCase();
  const idx = OPTION_LETTERS.indexOf(upper as (typeof OPTION_LETTERS)[number]);
  if (idx >= 0 && idx <= 3) return idx as 0 | 1 | 2 | 3;
  return undefined;
}

function parsePart2AnswerSpec(
  raw: string,
): Partial<Record<'a' | 'b' | 'c' | 'd', boolean>> | undefined {
  const result: Partial<Record<'a' | 'b' | 'c' | 'd', boolean>> = {};
  const labeledMatches = Array.from(
    raw.matchAll(/(?:^|[,;\s|/-])([abcd])\s*[:.)\-]?\s*(Đúng|Sai|Đ|S|True|False|T|F)\b/gi),
  );
  if (labeledMatches.length > 0) {
    for (const m of labeledMatches) {
      const key = m[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
      const val = parseBoolToken(m[2]);
      if (val !== undefined) result[key] = val;
    }
    if (Object.keys(result).length > 0) return result;
  }

  // Compact sequence like "Đ S Đ S" or "Đ-S-Đ-S" or "TFTT" or "ĐSĐS"
  const compact = raw
    .replace(/đúng/gi, 'Đ')
    .replace(/sai/gi, 'S')
    .replace(/true/gi, 'T')
    .replace(/false/gi, 'F')
    .replace(/[\s\-_,;|/]+/g, '')
    .toUpperCase();
  if (/^[ĐSTF]{2,4}$/.test(compact)) {
    const keys: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < Math.min(4, compact.length); i++) {
      const val = parseBoolToken(compact[i]);
      if (val !== undefined) result[keys[i]] = val;
    }
    if (Object.keys(result).length > 0) return result;
  }

  return undefined;
}

function makeTempId(idx: number): string {
  return `imp_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Parses a question file (.json, .csv, .txt/.md/.docx extracted text) into structured draft questions.
 */
export function parseQuestionFileContent(
  rawText: string,
  defaults: ImportDefaults,
  filename = '',
): ParsedQuestionDraft[] {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return [];

  // 1. JSON format
  if (trimmed.startsWith('[') || trimmed.startsWith('{') || filename.toLowerCase().endsWith('.json')) {
    try {
      const parsedJson = JSON.parse(trimmed) as unknown;
      const items = Array.isArray(parsedJson)
        ? parsedJson
        : typeof parsedJson === 'object' &&
            parsedJson !== null &&
            Array.isArray((parsedJson as { questions?: unknown[] }).questions)
          ? (parsedJson as { questions: unknown[] }).questions
          : null;

      if (items) {
        return items
          .map((item, idx) => mapJsonObjectToDraft(item, idx, defaults))
          .filter((q): q is ParsedQuestionDraft => q !== null);
      }
    } catch {
      // Fall through to CSV/text parser if JSON fails
    }
  }

  // 2. CSV / TSV format
  const lowerName = filename.toLowerCase();
  const firstLine = trimmed.split(/\r?\n/)[0] ?? '';
  const looksLikeCsvHeader =
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.tsv') ||
    ((firstLine.includes(',') || firstLine.includes('\t') || firstLine.includes(';')) &&
      /(cau|question|prompt|noi_dung|content|stt)/i.test(normalizeHeaderKey(firstLine)));

  if (looksLikeCsvHeader) {
    const csvRows = parseCsvRows(trimmed);
    if (csvRows.length >= 2) {
      const headerKeys = csvRows[0].map(normalizeHeaderKey);
      const hasPromptCol = headerKeys.some((k) =>
        ['prompt', 'noi_dung', 'cau_hoi', 'question', 'content', 'de_bai'].includes(k),
      );
      if (hasPromptCol) {
        return csvRows
          .slice(1)
          .map((cols, idx) => mapCsvRowToDraft(headerKeys, cols, idx, defaults))
          .filter((q): q is ParsedQuestionDraft => q !== null);
      }
    }
  }

  // 3. Plain text / Markdown / DOCX extracted text
  return parsePlainTextQuestions(trimmed, defaults);
}

function mapJsonObjectToDraft(
  raw: unknown,
  idx: number,
  defaults: ImportDefaults,
): ParsedQuestionDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const prompt = String(
    obj.prompt ?? obj.question ?? obj.content ?? obj.noiDung ?? '',
  ).trim();
  if (!prompt) return null;

  const sourceNumber = Number(obj.number ?? obj.stt ?? idx + 1) || idx + 1;
  const inferredType =
    normalizeQuestionType(String(obj.type ?? obj.questionType ?? '')) ??
    (Array.isArray(obj.statements)
      ? 'true_false'
      : Array.isArray(obj.options)
        ? 'multiple_choice'
        : obj.shortAnswer !== undefined
          ? 'short_answer'
          : 'multiple_choice');

  const sourcePart: 1 | 2 | 3 =
    inferredType === 'multiple_choice' ? 1 : inferredType === 'true_false' ? 2 : 3;

  const rawGradeVal = obj.grade;
  const grade: GradeLevel =
    rawGradeVal !== undefined && rawGradeVal !== null && String(rawGradeVal).trim() !== ''
      ? (parseAllowedGradeInput(String(rawGradeVal)) ?? defaults.grade)
      : defaults.grade;

  const draft: ParsedQuestionDraft = {
    tempId: makeTempId(idx),
    sourceNumber,
    sourcePart,
    type: inferredType,
    subject: normalizeSubject(typeof obj.subject === 'string' ? obj.subject : undefined, defaults.subject),
    grade,
    level: normalizeLevel(typeof obj.level === 'string' ? obj.level : undefined, defaults.defaultLevel),
    topic: String(obj.topic ?? obj.chuyenDe ?? defaults.defaultTopic).trim() || defaults.defaultTopic,
    prompt,
    explanation: String(obj.explanation ?? obj.loiGiai ?? '').trim(),
    answerSource: 'none',
    warnings: [],
  };

  if (inferredType === 'multiple_choice') {
    const rawOpts = Array.isArray(obj.options)
      ? obj.options.map((o) => String(o ?? '').trim())
      : [
          String(obj.a ?? obj.A ?? '').trim(),
          String(obj.b ?? obj.B ?? '').trim(),
          String(obj.c ?? obj.C ?? '').trim(),
          String(obj.d ?? obj.D ?? '').trim(),
        ];
    draft.options = [
      rawOpts[0] ?? '',
      rawOpts[1] ?? '',
      rawOpts[2] ?? '',
      rawOpts[3] ?? '',
    ];
    if (typeof obj.correctOptionIndex === 'number' && obj.correctOptionIndex >= 0 && obj.correctOptionIndex <= 3) {
      draft.correctOptionIndex = obj.correctOptionIndex as 0 | 1 | 2 | 3;
      draft.answerSource = 'embedded';
    } else if (typeof obj.answer === 'string' || typeof obj.dapAn === 'string') {
      const letterIdx = parsePart1Letter(String(obj.answer ?? obj.dapAn));
      if (letterIdx !== undefined) {
        draft.correctOptionIndex = letterIdx;
        draft.answerSource = 'embedded';
      }
    }
  } else if (inferredType === 'true_false') {
    const stIds: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];
    const rawStmts = Array.isArray(obj.statements) ? obj.statements : [];
    let hasAllBool = rawStmts.length === 4;
    const mapped = stIds.map((id, sIdx) => {
      const stRaw = rawStmts[sIdx] as Record<string, unknown> | string | undefined;
      const text =
        typeof stRaw === 'string'
          ? stRaw.trim()
          : stRaw && typeof stRaw === 'object'
            ? String(stRaw.text ?? '').trim()
            : String(obj[id] ?? '').trim();
      const boolVal =
        stRaw && typeof stRaw === 'object' && typeof stRaw.isTrue === 'boolean'
          ? stRaw.isTrue
          : undefined;
      if (boolVal === undefined) hasAllBool = false;
      return { id, text, isTrue: boolVal ?? false };
    }) as [TrueFalseStatement, TrueFalseStatement, TrueFalseStatement, TrueFalseStatement];
    draft.statements = mapped;
    if (hasAllBool) {
      draft.answerSource = 'embedded';
    } else if (typeof obj.answer === 'string' || typeof obj.dapAn === 'string') {
      const spec = parsePart2AnswerSpec(String(obj.answer ?? obj.dapAn));
      if (spec) {
        draft.statements = draft.statements.map((st) => ({
          ...st,
          isTrue: spec[st.id] ?? st.isTrue,
        })) as typeof draft.statements;
        draft.answerSource = 'embedded';
      }
    }
  } else {
    const sa = String(obj.shortAnswer ?? obj.answer ?? obj.dapAn ?? '').trim();
    if (sa) {
      draft.shortAnswer = sa.slice(0, 4);
      draft.answerSource = 'embedded';
    }
  }

  return finalizeDraftWarnings(draft);
}

function mapCsvRowToDraft(
  headers: string[],
  cols: string[],
  idx: number,
  defaults: ImportDefaults,
): ParsedQuestionDraft | null {
  const get = (...aliases: string[]): string => {
    for (const alias of aliases) {
      const i = headers.indexOf(alias);
      if (i !== -1 && cols[i] !== undefined) return cols[i].trim();
    }
    return '';
  };

  const prompt = get('prompt', 'noi_dung', 'cau_hoi', 'question', 'content', 'de_bai');
  if (!prompt) return null;

  const numRaw = get('stt', 'cau', 'number', 'so_thu_tu');
  const sourceNumber = Number(numRaw.replace(/\D/g, '')) || idx + 1;
  const rawType = get('type', 'dang', 'phan', 'part', 'loai');
  const colA = get('a', 'option_a', 'phuong_an_a', 'y_a');
  const colB = get('b', 'option_b', 'phuong_an_b', 'y_b');
  const colC = get('c', 'option_c', 'phuong_an_c', 'y_c');
  const colD = get('d', 'option_d', 'phuong_an_d', 'y_d');
  const ansRaw = get('answer', 'dap_an', 'correct', 'tra_loi');

  let type = normalizeQuestionType(rawType);
  if (!type) {
    if (ansRaw && parsePart2AnswerSpec(ansRaw)) {
      type = 'true_false';
    } else if (colA || colB || colC || colD) {
      type = 'multiple_choice';
    } else {
      type = 'short_answer';
    }
  }

  const rawGradeText = get('grade', 'khoi', 'lop');
  const grade: GradeLevel = rawGradeText
    ? (parseAllowedGradeInput(rawGradeText) ?? defaults.grade)
    : defaults.grade;

  const draft: ParsedQuestionDraft = {
    tempId: makeTempId(idx),
    sourceNumber,
    sourcePart: type === 'multiple_choice' ? 1 : type === 'true_false' ? 2 : 3,
    type,
    subject: normalizeSubject(get('subject', 'mon', 'mon_hoc'), defaults.subject),
    grade,
    level: normalizeLevel(get('level', 'muc_do', 'nhan_thuc'), defaults.defaultLevel),
    topic: get('topic', 'chuyen_de', 'chuong') || defaults.defaultTopic,
    prompt,
    explanation: get('explanation', 'loi_giai', 'giai_thich', 'huong_dan'),
    answerSource: 'none',
    warnings: [],
  };

  if (type === 'multiple_choice') {
    const rawOpts = [colA, colB, colC, colD].map((o) => normalizeWhitespaceAndPipes(o));
    const hasPrefixAll =
      /^A\s*[.)]\s*/i.test(rawOpts[0]) &&
      /^B\s*[.)]\s*/i.test(rawOpts[1]) &&
      /^C\s*[.)]\s*/i.test(rawOpts[2]) &&
      /^D\s*[.)]\s*/i.test(rawOpts[3]);
    draft.options = (
      hasPrefixAll
        ? rawOpts.map((o) => o.replace(/^[A-D]\s*[.)]\s*/i, '').trim())
        : rawOpts
    ) as [string, string, string, string];
    const letter = parsePart1Letter(ansRaw);
    if (letter !== undefined) {
      draft.correctOptionIndex = letter;
      draft.answerSource = 'embedded';
    }
  } else if (type === 'true_false') {
    const spec = ansRaw ? parsePart2AnswerSpec(ansRaw) : undefined;
    const rawStmts = [colA, colB, colC, colD].map((s) => normalizeWhitespaceAndPipes(s));
    const hasStmtPrefixAll =
      /^a\s*[.)]\s*/i.test(rawStmts[0]) &&
      /^b\s*[.)]\s*/i.test(rawStmts[1]) &&
      /^c\s*[.)]\s*/i.test(rawStmts[2]) &&
      /^d\s*[.)]\s*/i.test(rawStmts[3]);
    const cleanStmts = hasStmtPrefixAll
      ? rawStmts.map((s) => s.replace(/^[a-d]\s*[.)]\s*/i, '').trim())
      : rawStmts;
    draft.statements = [
      { id: 'a', text: cleanStmts[0], isTrue: spec?.a ?? false },
      { id: 'b', text: cleanStmts[1], isTrue: spec?.b ?? false },
      { id: 'c', text: cleanStmts[2], isTrue: spec?.c ?? false },
      { id: 'd', text: cleanStmts[3], isTrue: spec?.d ?? false },
    ];
    if (spec) draft.answerSource = 'embedded';
  } else if (ansRaw) {
    draft.shortAnswer = ansRaw.slice(0, 4);
    draft.answerSource = 'embedded';
  }

  return finalizeDraftWarnings(draft);
}

function detectSectionHeader(line: string): 1 | 2 | 3 | null {
  const cleaned = line.trim();
  if (/^(?:#+\s*)?(?:PHẦN|PART)\s*(?:III|3)\b/i.test(cleaned)) return 3;
  if (/^(?:#+\s*)?(?:PHẦN|PART)\s*(?:II|2)\b/i.test(cleaned)) return 2;
  if (/^(?:#+\s*)?(?:PHẦN|PART)\s*(?:I|1)\b/i.test(cleaned)) return 1;
  return null;
}

function parsePlainTextQuestions(
  text: string,
  defaults: ImportDefaults,
): ParsedQuestionDraft[] {
  const lines = text
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u202F\u2007\u2009]/g, ' ')
    .split(/\r?\n/);
  let currentPart: 1 | 2 | 3 | undefined = undefined;
  const rawBlocks: Array<{
    part?: 1 | 2 | 3;
    number: number;
    lines: string[];
  }> = [];

  let activeBlock: { part?: 1 | 2 | 3; number: number; lines: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionPart = detectSectionHeader(line);
    if (sectionPart !== null) {
      if (activeBlock) {
        rawBlocks.push(activeBlock);
        activeBlock = null;
      }
      currentPart = sectionPart;
      continue;
    }

    const cauMatch = line.match(
      /^(?:\*{1,2})?(?:Câu|Bài|Question)\s*(\d+)\s*[:.)\-]?\s*(?:\*{1,2})?\s*(.*)$/i,
    );
    const numMatch =
      !cauMatch &&
      !/^[A-Da-d]\s*[.)]/.test(line) &&
      line.match(/^(\d{1,3})\s*[.)]\s+(.+)$/);

    if (cauMatch) {
      if (activeBlock) rawBlocks.push(activeBlock);
      const firstContent = cauMatch[2] ? cauMatch[2].replace(/^[\s|]+/, '').trim() : '';
      activeBlock = {
        part: currentPart,
        number: Number(cauMatch[1]),
        lines: firstContent ? [firstContent] : [],
      };
      continue;
    }

    if (numMatch && !activeBlock) {
      activeBlock = {
        part: currentPart,
        number: Number(numMatch[1]),
        lines: [numMatch[2].trim()],
      };
      continue;
    }

    if (numMatch && activeBlock) {
      // Treat top-level "2. ..." as a new question only if the current block already looks finished (has options/statements or part 3)
      const joinedSoFar = activeBlock.lines.join('\n');
      const hasOptionsOrStmts =
        /(?:^|\n)\s*[A-D]\s*[.)]/m.test(joinedSoFar) ||
        /(?:^|\n)\s*[a-d]\s*[.)]/m.test(joinedSoFar) ||
        currentPart === 3;
      if (hasOptionsOrStmts) {
        rawBlocks.push(activeBlock);
        activeBlock = {
          part: currentPart,
          number: Number(numMatch[1]),
          lines: [numMatch[2].trim()],
        };
        continue;
      }
    }

    if (activeBlock) {
      activeBlock.lines.push(line);
    }
  }

  if (activeBlock) {
    rawBlocks.push(activeBlock);
  }

  return rawBlocks.map((block, idx) => parseQuestionBlock(block, idx, defaults));
}

const GEOMETRY_NOUN_BEFORE_UPPER_RE =
  /(?:điểm|đỉnh|góc|cạnh|tại|qua|từ|đến|đoạn|tia|đường|mặt|hình|tập|nhóm|lớp|loại|hạng|bài|câu|phần|mục|chất|nguyên tố|vitamin)\s*$/i;

function normalizeWhitespaceAndPipes(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u202F\u2007\u2009]/g, ' ')
    .replace(/\t+/g, ' ')
    .replace(/^\s*\|\s*/, '')
    .replace(/\s*\|\s*$/, '')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function splitInlineMcOptions(
  rawLine: string,
  expectedNextLetter?: 'B' | 'C' | 'D',
): string[] {
  const line = rawLine
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u202F\u2007\u2009]/g, ' ')
    .trim();
  if (!line) return [];

  type McLetter = 'A' | 'B' | 'C' | 'D';
  type Marker = { index: number; letter: McLetter; endIndex: number };

  const cleanMarkers: Marker[] = [];
  const stickyCandidates: Marker[] = [];

  // Matches A., A), A．, *A., (A), or A: (when colon is followed by whitespace)
  // Also matches lowercase d. / d) when preceded by clean separator in case of typo after C.
  const regex =
    /(?:(\*\s*)?\(([A-D])\)|(\*\s*)?([A-D]|d)(?:\s*([.)．])|\s*([:：])(?=\s)))/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const startIdx = match.index;
    const endIdx = startIdx + match[0].length;
    const isParenWrapped = Boolean(match[2]);
    const hasStar = Boolean(match[1] || match[3]);
    const rawLetter = match[2] ?? match[4];
    const isLowerD = rawLetter === 'd';
    const letter = rawLetter.toUpperCase() as McLetter;
    const prevChar = startIdx > 0 ? line[startIdx - 1] : '';
    const prevTwo = startIdx > 1 ? line.slice(startIdx - 2, startIdx) : '';
    const afterText = line.slice(endIdx);

    // Must have content on the line, OR be at end-of-line after a clean separator when other options already exist
    const hasFollowingContent = /\S/.test(afterText);
    const hasCleanBoundary = startIdx === 0 || /[\s\t|;:,]/.test(prevChar);
    const hasWideGapOrTab =
      startIdx === 0 ||
      prevChar === '\t' ||
      prevChar === '|' ||
      prevChar === ';' ||
      / {2,}$/.test(line.slice(0, startIdx));

    if (isLowerD) {
      // Only treat lowercase d./d) as Option D when separated clearly and after C or when expecting D
      const canAcceptLowerD =
        hasCleanBoundary &&
        (expectedNextLetter === 'D' ||
          cleanMarkers.some((m) => m.letter === 'C') ||
          hasWideGapOrTab);
      if (!canAcceptLowerD || !hasFollowingContent) continue;
    }

    if (hasCleanBoundary) {
      if (!hasFollowingContent && cleanMarkers.length === 0 && !expectedNextLetter) {
        continue;
      }
      if (
        startIdx > 0 &&
        !hasStar &&
        !hasWideGapOrTab &&
        cleanMarkers.length === 0 &&
        !expectedNextLetter &&
        GEOMETRY_NOUN_BEFORE_UPPER_RE.test(line.slice(0, startIdx))
      ) {
        continue;
      }
      cleanMarkers.push({ index: startIdx, letter, endIndex: endIdx });
    } else if (!isParenWrapped && letter !== 'A' && hasFollowingContent) {
      // Sticky marker right after previous option text (e.g. "C. NaOHD. KOH", "C. 90°D. 180°", "C. 12D. 15")
      if (letter === 'C' && prevChar === '°') continue; // Protect "100°C."
      if (prevChar === '/') continue;
      if (letter === 'B' && prevChar === 'A') continue; // Protect "AB."
      if (letter === 'C' && (prevChar === 'B' || prevChar === 'A')) continue; // Protect "BC.", "AC."
      if (letter === 'D' && (prevTwo === 'AB' || prevTwo === 'BC')) continue; // Protect "ABCD.", "BCD."
      stickyCandidates.push({ index: startIdx, letter, endIndex: endIdx });
    }
  }

  // Merge clean markers with needed sticky markers in ascending order
  const markers: Marker[] = [...cleanMarkers];
  const foundLetters = new Set(markers.map((m) => m.letter));

  for (const cand of stickyCandidates) {
    if (foundLetters.has(cand.letter)) continue;
    const prevCleanExists =
      expectedNextLetter === cand.letter ||
      markers.some((m) => m.index < cand.index && m.letter < cand.letter);
    if (prevCleanExists) {
      markers.push(cand);
      foundLetters.add(cand.letter);
    }
  }

  markers.sort((a, b) => a.index - b.index);

  const distinctLetters = new Set(markers.map((m) => m.letter));
  if (distinctLetters.size >= 2) {
    const pieces: string[] = [];
    if (markers[0].index > 0) {
      const prefix = normalizeWhitespaceAndPipes(line.slice(0, markers[0].index));
      if (prefix) pieces.push(prefix);
    }
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : line.length;
      let chunk = normalizeWhitespaceAndPipes(line.slice(start, end));
      if (i + 1 < markers.length) {
        chunk = chunk.replace(/\s*;\s*$/, '').trim();
      }
      if (chunk) pieces.push(chunk);
    }
    return pieces;
  }

  // Handle continuation line containing the expected next option (e.g. wrapped C line ending with "D. ...")
  if (expectedNextLetter && markers.length > 0) {
    const targetMarker = markers.find((m) => m.letter === expectedNextLetter);
    if (targetMarker && targetMarker.index > 0) {
      const before = normalizeWhitespaceAndPipes(line.slice(0, targetMarker.index)).replace(
        /\s*;\s*$/,
        '',
      );
      const after = normalizeWhitespaceAndPipes(line.slice(targetMarker.index));
      if (after) {
        return before ? [before, after] : [after];
      }
    }
  }

  if (markers.length === 1 && markers[0].letter === 'A' && markers[0].index > 0) {
    const before = line.slice(0, markers[0].index).trim();
    if (/[:?]$/.test(before)) {
      const after = normalizeWhitespaceAndPipes(line.slice(markers[0].index));
      if (after) return [normalizeWhitespaceAndPipes(before), after];
    }
  }

  return [normalizeWhitespaceAndPipes(line)].filter(Boolean);
}

function splitInlineTfStatements(rawLine: string): string[] {
  const line = rawLine
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u202F\u2007\u2009]/g, ' ')
    .trim();
  if (!line) return [];

  const markers: Array<{ index: number; letter: 'a' | 'b' | 'c' | 'd' }> = [];
  const regex = /([a-d])\s*([.)．])(?=\s*\S)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const startIdx = match.index;
    const letter = match[1] as 'a' | 'b' | 'c' | 'd';
    const delim = match[2];
    const prevChar = startIdx > 0 ? line[startIdx - 1] : '';
    const hasCleanBoundary = startIdx === 0 || /[\s\t|;:,]/.test(prevChar);

    if (hasCleanBoundary) {
      if (prevChar === '(') continue;
      markers.push({ index: startIdx, letter });
    } else if (markers.length > 0 && delim === ')' && prevChar !== '(') {
      const lastLetter = markers[markers.length - 1].letter;
      if (letter > lastLetter) {
        markers.push({ index: startIdx, letter });
      }
    }
  }

  const distinctLetters = new Set(markers.map((m) => m.letter));
  if (distinctLetters.size >= 2) {
    const pieces: string[] = [];
    if (markers[0].index > 0) {
      const prefix = normalizeWhitespaceAndPipes(line.slice(0, markers[0].index));
      if (prefix) pieces.push(prefix);
    }
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : line.length;
      let chunk = normalizeWhitespaceAndPipes(line.slice(start, end));
      if (i + 1 < markers.length) {
        chunk = chunk.replace(/\s*;\s*$/, '').trim();
      }
      if (chunk) pieces.push(chunk);
    }
    return pieces;
  }

  if (markers.length === 1 && markers[0].letter === 'a' && markers[0].index > 0) {
    const before = line.slice(0, markers[0].index).trim();
    if (/[:?]$/.test(before)) {
      const after = normalizeWhitespaceAndPipes(line.slice(markers[0].index));
      if (after) return [normalizeWhitespaceAndPipes(before), after];
    }
  }

  return [normalizeWhitespaceAndPipes(line)].filter(Boolean);
}

function parseQuestionBlock(
  block: { part?: 1 | 2 | 3; number: number; lines: string[] },
  idx: number,
  defaults: ImportDefaults,
): ParsedQuestionDraft {
  let level: CognitiveLevel = defaults.defaultLevel;
  let topic = defaults.defaultTopic;
  let explanation = '';
  let inlineAnswer = '';

  const contentLines: string[] = [];

  for (const rawLine of block.lines) {
    let line = rawLine;

    // Extract [Nhận biết] / [Thông hiểu] / [Vận dụng]
    const levelTag = line.match(/\[(Nhận biết|Thông hiểu|Vận dụng|Biết|Hiểu|NB|TH|VD)\]/i);
    if (levelTag) {
      level = normalizeLevel(levelTag[1], level);
      line = line.replace(levelTag[0], '').trim();
    }

    // Extract [Chuyên đề: ...]
    const topicTag = line.match(/\[Chuyên đề\s*:\s*([^\]]+)\]/i);
    if (topicTag) {
      topic = topicTag[1].trim() || topic;
      line = line.replace(topicTag[0], '').trim();
    }

    // Standalone Lời giải / Hướng dẫn
    const expMatch = line.match(/^(?:Lời giải|Hướng dẫn|Giải thích)\s*[:\-]\s*(.+)$/i);
    if (expMatch) {
      explanation = explanation ? `${explanation} ${expMatch[1].trim()}` : expMatch[1].trim();
      continue;
    }

    // Standalone Đáp án
    const ansMatch = line.match(/^(?:Đáp án|Key)\s*[:\-]\s*(.+)$/i);
    if (ansMatch) {
      inlineAnswer = ansMatch[1].trim();
      continue;
    }

    if (line) contentLines.push(line);
  }

  // Expand same-line, 2x2 grid, wrapped continuation, or sticky options/statements
  const expandedLines: string[] = [];
  let runningMcKey: 'A' | 'B' | 'C' | 'D' | null = null;
  const nextMcMap: Record<'A' | 'B' | 'C' | 'D', 'B' | 'C' | 'D' | undefined> = {
    A: 'B',
    B: 'C',
    C: 'D',
    D: undefined,
  };

  for (const line of contentLines) {
    const expectedNext = runningMcKey ? nextMcMap[runningMcKey] : undefined;
    const mcSplit = splitInlineMcOptions(line, expectedNext);
    if (mcSplit.length > 1) {
      expandedLines.push(...mcSplit);
      for (const piece of mcSplit) {
        const m = piece.match(/^(?:\*\s*)?(?:\(([A-D])\)|([A-D]|d)\s*[.)．:：])/);
        if (m) runningMcKey = (m[1] ?? m[2]).toUpperCase() as 'A' | 'B' | 'C' | 'D';
      }
      continue;
    }

    const singlePiece = mcSplit[0] ?? normalizeWhitespaceAndPipes(line);
    const singleMcMatch = singlePiece.match(/^(?:\*\s*)?(?:\(([A-D])\)|([A-D])\s*[.)．:：])/);
    if (singleMcMatch) {
      runningMcKey = (singleMcMatch[1] ?? singleMcMatch[2]).toUpperCase() as 'A' | 'B' | 'C' | 'D';
      expandedLines.push(singlePiece);
      continue;
    }

    if (block.part !== 1 && runningMcKey === null) {
      const tfSplit = splitInlineTfStatements(line);
      if (tfSplit.length > 1) {
        expandedLines.push(...tfSplit);
        continue;
      }
    }

    if (singlePiece) expandedLines.push(singlePiece);
  }

  const promptLines: string[] = [];
  const mcOptions: Partial<Record<'A' | 'B' | 'C' | 'D', string>> = {};
  let lastMcKey: 'A' | 'B' | 'C' | 'D' | null = null;
  let embeddedCorrectIdx: 0 | 1 | 2 | 3 | undefined = undefined;
  const tfStatements: Partial<
    Record<'a' | 'b' | 'c' | 'd', { text: string; isTrue?: boolean }>
  > = {};
  let lastTfKey: 'a' | 'b' | 'c' | 'd' | null = null;

  for (const line of expandedLines) {
    const optMatch =
      line.match(/^(\*?)\s*([A-D])\s*[.)．:：]\s*(.*)$/) ??
      line.match(/^(\*?)\s*\(([A-D])\)\s*(.*)$/) ??
      (lastMcKey === 'C' ? line.match(/^(\*?)\s*(d)\s*[.)．:：]\s*(.*)$/) : null);
    if (optMatch) {
      const isStarred = optMatch[1] === '*';
      const letter = optMatch[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      let optText = normalizeWhitespaceAndPipes(optMatch[3]);
      if (/\[(Đúng|Correct)\]\s*$/i.test(optText)) {
        optText = optText.replace(/\[(Đúng|Correct)\]\s*$/i, '').trim();
        embeddedCorrectIdx = OPTION_LETTERS.indexOf(letter) as 0 | 1 | 2 | 3;
      } else if (isStarred) {
        embeddedCorrectIdx = OPTION_LETTERS.indexOf(letter) as 0 | 1 | 2 | 3;
      }
      mcOptions[letter] = optText;
      lastMcKey = letter;
      lastTfKey = null;
      continue;
    }

    const tfMatch = line.match(/^([a-d])\s*[.)．]\s*(.*)$/);
    if (tfMatch && block.part !== 1) {
      const key = tfMatch[1] as 'a' | 'b' | 'c' | 'd';
      let stText = normalizeWhitespaceAndPipes(tfMatch[2]);
      let stBool: boolean | undefined = undefined;
      const inlineBool = stText.match(/\(\s*(Đúng|Sai|Đ|S)\s*\)\s*$/i);
      if (inlineBool) {
        stBool = parseBoolToken(inlineBool[1]);
        stText = stText.replace(inlineBool[0], '').trim();
      }
      tfStatements[key] = { text: stText, isTrue: stBool };
      lastTfKey = key;
      lastMcKey = null;
      continue;
    }

    if (lastMcKey !== null) {
      const prev = mcOptions[lastMcKey] ?? '';
      mcOptions[lastMcKey] = prev ? `${prev} ${line}`.trim() : line;
    } else if (lastTfKey !== null && tfStatements[lastTfKey]) {
      const prev = tfStatements[lastTfKey]!.text;
      tfStatements[lastTfKey] = {
        ...tfStatements[lastTfKey]!,
        text: prev ? `${prev} ${line}`.trim() : line,
      };
    } else {
      promptLines.push(line);
    }
  }

  const hasMc = Object.keys(mcOptions).length >= 2;
  const hasTf = Object.keys(tfStatements).length >= 2;

  let type: QuestionType;
  if (block.part === 2 || (!hasMc && hasTf)) {
    type = 'true_false';
  } else if (block.part === 3 || (!hasMc && !hasTf)) {
    type = 'short_answer';
  } else {
    type = 'multiple_choice';
  }

  const prompt =
    normalizeWhitespaceAndPipes(promptLines.join(' ')) ||
    normalizeWhitespaceAndPipes(block.lines[0] ?? '') ||
    `Câu ${block.number}`;

  const draft: ParsedQuestionDraft = {
    tempId: makeTempId(idx),
    sourceNumber: block.number,
    sourcePart: block.part ?? (type === 'multiple_choice' ? 1 : type === 'true_false' ? 2 : 3),
    type,
    subject: defaults.subject,
    grade: defaults.grade,
    level,
    topic,
    prompt,
    explanation: normalizeWhitespaceAndPipes(explanation),
    answerSource: 'none',
    warnings: [],
  };

  if (type === 'multiple_choice') {
    draft.options = [
      normalizeWhitespaceAndPipes(mcOptions.A ?? ''),
      normalizeWhitespaceAndPipes(mcOptions.B ?? ''),
      normalizeWhitespaceAndPipes(mcOptions.C ?? ''),
      normalizeWhitespaceAndPipes(mcOptions.D ?? ''),
    ];
    if (embeddedCorrectIdx !== undefined) {
      draft.correctOptionIndex = embeddedCorrectIdx;
      draft.answerSource = 'embedded';
    } else if (inlineAnswer) {
      const idxAns = parsePart1Letter(inlineAnswer);
      if (idxAns !== undefined) {
        draft.correctOptionIndex = idxAns;
        draft.answerSource = 'embedded';
      }
    }
  } else if (type === 'true_false') {
    const keys: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];
    const inlineSpec = inlineAnswer ? parsePart2AnswerSpec(inlineAnswer) : undefined;
    let hasAllBool = true;
    draft.statements = keys.map((k) => {
      const item = tfStatements[k];
      const bVal = item?.isTrue ?? inlineSpec?.[k];
      if (bVal === undefined) hasAllBool = false;
      return {
        id: k,
        text: item?.text ?? '',
        isTrue: bVal ?? false,
      };
    }) as [TrueFalseStatement, TrueFalseStatement, TrueFalseStatement, TrueFalseStatement];
    if (hasAllBool || inlineSpec) {
      draft.answerSource = 'embedded';
    }
  } else if (inlineAnswer) {
    draft.shortAnswer = inlineAnswer.slice(0, 4);
    draft.answerSource = 'embedded';
  }

  return finalizeDraftWarnings(draft);
}

/**
 * Parses an answer key file (.json, .csv, .txt/.md/.docx extracted text).
 */
export function parseAnswerFileContent(
  rawText: string,
  filename = '',
): ParsedAnswerEntry[] {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return [];

  // 1. JSON format
  if (trimmed.startsWith('[') || trimmed.startsWith('{') || filename.toLowerCase().endsWith('.json')) {
    try {
      const parsedJson = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsedJson)) {
        return parsedJson
          .map((item, idx) => mapJsonAnswerItem(item, idx))
          .filter((a): a is ParsedAnswerEntry => a !== null);
      }
      if (parsedJson && typeof parsedJson === 'object') {
        const obj = parsedJson as Record<string, unknown>;
        if (Array.isArray(obj.answers)) {
          return obj.answers
            .map((item, idx) => mapJsonAnswerItem(item, idx))
            .filter((a): a is ParsedAnswerEntry => a !== null);
        }
        // Key-value map like { "1": "A", "2": "ĐSĐS", "3": "12,5" }
        const entries: ParsedAnswerEntry[] = [];
        for (const [key, val] of Object.entries(obj)) {
          const num = Number(key.replace(/\D/g, ''));
          if (!num) continue;
          const built = buildAnswerEntryFromRaw(num, String(val ?? ''), undefined);
          if (built) entries.push(built);
        }
        if (entries.length > 0) return entries;
      }
    } catch {
      // Fall through to CSV/text
    }
  }

  // 2. CSV / TSV format
  const lowerName = filename.toLowerCase();
  const firstLine = trimmed.split(/\r?\n/)[0] ?? '';
  const looksLikeCsv =
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.tsv') ||
    ((firstLine.includes(',') || firstLine.includes('\t') || firstLine.includes(';')) &&
      /(cau|stt|number|dap_an|answer)/i.test(normalizeHeaderKey(firstLine)));

  if (looksLikeCsv) {
    const csvRows = parseCsvRows(trimmed);
    if (csvRows.length >= 2) {
      const headers = csvRows[0].map(normalizeHeaderKey);
      const hasAnsCol = headers.some((h) =>
        ['answer', 'dap_an', 'ket_qua', 'tra_loi', 'key'].includes(h),
      );
      if (hasAnsCol) {
        const entries: ParsedAnswerEntry[] = [];
        csvRows.slice(1).forEach((cols, idx) => {
          const get = (...aliases: string[]) => {
            for (const a of aliases) {
              const i = headers.indexOf(a);
              if (i !== -1 && cols[i] !== undefined) return cols[i].trim();
            }
            return '';
          };
          const numRaw = get('cau', 'stt', 'number', 'question', 'so_thu_tu');
          const num = Number(numRaw.replace(/\D/g, '')) || idx + 1;
          const partType = normalizeQuestionType(get('phan', 'part', 'type', 'dang'));
          const part: 1 | 2 | 3 | undefined =
            partType === 'multiple_choice'
              ? 1
              : partType === 'true_false'
                ? 2
                : partType === 'short_answer'
                  ? 3
                  : undefined;
          const ansVal = get('answer', 'dap_an', 'ket_qua', 'tra_loi', 'key');
          const expVal = get('explanation', 'loi_giai', 'giai_thich', 'huong_dan');
          const built = buildAnswerEntryFromRaw(num, ansVal, part, expVal);
          if (built) entries.push(built);
        });
        if (entries.length > 0) return entries;
      }
    }
  }

  // 3. Plain text / Word table text
  const lines = trimmed.split(/\r?\n/);
  let currentPart: 1 | 2 | 3 | undefined = undefined;
  const entries: ParsedAnswerEntry[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const sectionPart = detectSectionHeader(line);
    if (sectionPart !== null) {
      currentPart = sectionPart;
      continue;
    }

    // Ignore table header lines like "Câu | Đáp án | Lời giải"
    if (/^(?:Câu|STT)\s*\|\s*(?:Đáp án|Kết quả)/i.test(line)) {
      continue;
    }

    // Split optional explanation ("| Lời giải: ..." or "Lời giải: ...")
    let mainPart = line;
    let explanation = '';
    const pipeExp = line.match(/^(.+?)\|\s*(?:Lời giải|Giải thích|Hướng dẫn)\s*[:\-]?\s*(.+)$/i);
    if (pipeExp) {
      mainPart = pipeExp[1].trim();
      explanation = pipeExp[2].trim();
    } else {
      const inlineExp = line.match(
        /^(.+?)\s+(?:Lời giải|Giải thích|Hướng dẫn)\s*[:\-]\s*(.+)$/i,
      );
      if (inlineExp) {
        mainPart = inlineExp[1].trim();
        explanation = inlineExp[2].trim();
      }
    }

    // Handle Word table row: "Câu 1 | A" or "1 | Đ - S - Đ - S | Lời giải..."
    if (mainPart.includes('|')) {
      const cells = mainPart.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        const numMatch = cells[0].match(/(\d+)/);
        if (numMatch) {
          const built = buildAnswerEntryFromRaw(
            Number(numMatch[1]),
            cells[1],
            currentPart,
            explanation || cells[2] || '',
          );
          if (built) {
            entries.push(built);
            continue;
          }
        }
      }
    }

    // Handle single line with multiple compact answers: "1.A  2.B  3.C  4.D" or "1A,2B,3C,4D"
    const multiMcMatches = Array.from(
      mainPart.matchAll(/(?:^|[\s,;|])(?:Câu\s*)?(\d{1,3})\s*[:.\-)]?\s*([A-D])(?=\s|$|[,;|])/gi),
    );
    if (
      multiMcMatches.length >= 2 &&
      !/(?:Đúng|Sai|a\)|b\)|c\)|d\))/i.test(mainPart)
    ) {
      for (const m of multiMcMatches) {
        const built = buildAnswerEntryFromRaw(Number(m[1]), m[2], currentPart);
        if (built) entries.push(built);
      }
      continue;
    }

    // Standard single answer line: "Câu 1: A" / "1. Đ - S - Đ - S" / "Câu 1: 12,5"
    const singleMatch = mainPart.match(/^(?:Câu|Bài|Question)?\s*(\d{1,3})\s*[:.)\-]\s*(.+)$/i);
    if (singleMatch) {
      const built = buildAnswerEntryFromRaw(
        Number(singleMatch[1]),
        singleMatch[2].trim(),
        currentPart,
        explanation,
      );
      if (built) {
        entries.push(built);
        continue;
      }
    }

    // Space-only single line like "1 A"
    const spaceMatch = mainPart.match(/^(?:Câu\s*)?(\d{1,3})\s+([A-D]|-?\d+(?:[.,]\d+)?)$/i);
    if (spaceMatch) {
      const built = buildAnswerEntryFromRaw(
        Number(spaceMatch[1]),
        spaceMatch[2].trim(),
        currentPart,
        explanation,
      );
      if (built) entries.push(built);
    }
  }

  return entries;
}

function mapJsonAnswerItem(raw: unknown, idx: number): ParsedAnswerEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const num = Number(obj.number ?? obj.stt ?? idx + 1) || idx + 1;
  const partType = normalizeQuestionType(
    typeof obj.part === 'string'
      ? obj.part
      : typeof obj.type === 'string'
        ? obj.type
        : undefined,
  );
  const part: 1 | 2 | 3 | undefined =
    obj.part === 1 || obj.part === 2 || obj.part === 3
      ? obj.part
      : partType === 'multiple_choice'
        ? 1
        : partType === 'true_false'
          ? 2
          : partType === 'short_answer'
            ? 3
            : undefined;

  const ansVal = String(obj.answer ?? obj.dapAn ?? obj.shortAnswer ?? '').trim();
  const expVal = String(obj.explanation ?? obj.loiGiai ?? '').trim();
  return buildAnswerEntryFromRaw(num, ansVal, part, expVal);
}

function buildAnswerEntryFromRaw(
  number: number,
  rawValue: string,
  part?: 1 | 2 | 3,
  explanation?: string,
): ParsedAnswerEntry | null {
  const clean = rawValue.trim();
  if (!clean) return null;

  const entry: ParsedAnswerEntry = {
    part,
    number,
    rawValue: clean,
    explanation: explanation?.trim() || undefined,
  };

  if (part === 1) {
    const letter = parsePart1Letter(clean);
    if (letter !== undefined) entry.part1AnswerIndex = letter;
    return entry;
  }

  if (part === 2) {
    const spec = parsePart2AnswerSpec(clean);
    if (spec) entry.part2Booleans = spec;
    return entry;
  }

  if (part === 3) {
    entry.shortAnswer = clean.replace(/\s+/g, '').slice(0, 4);
    return entry;
  }

  // Infer type when part is omitted
  const letter = parsePart1Letter(clean);
  if (letter !== undefined) {
    entry.part1AnswerIndex = letter;
    return entry;
  }
  const tfSpec = parsePart2AnswerSpec(clean);
  if (tfSpec) {
    entry.part2Booleans = tfSpec;
    return entry;
  }
  entry.shortAnswer = clean.replace(/\s+/g, '').slice(0, 4);
  return entry;
}

/**
 * Matches parsed answers onto parsed questions using (part, number), then number, then positional fallback.
 */
export function mergeQuestionsAndAnswers(
  questions: ParsedQuestionDraft[],
  answers: ParsedAnswerEntry[],
): ParsedQuestionDraft[] {
  if (answers.length === 0) {
    return questions.map(finalizeDraftWarnings);
  }

  const usedAnswerIndices = new Set<number>();

  const applyEntry = (q: ParsedQuestionDraft, ans: ParsedAnswerEntry): ParsedQuestionDraft => {
    const updated: ParsedQuestionDraft = {
      ...q,
      explanation: ans.explanation ? ans.explanation : q.explanation,
    };

    if (q.type === 'multiple_choice') {
      const idx =
        ans.part1AnswerIndex ?? parsePart1Letter(ans.rawValue);
      if (idx !== undefined) {
        updated.correctOptionIndex = idx;
        updated.answerSource = 'answer_file';
      }
    } else if (q.type === 'true_false') {
      const spec = ans.part2Booleans ?? parsePart2AnswerSpec(ans.rawValue);
      if (spec && updated.statements) {
        updated.statements = updated.statements.map((st) => ({
          ...st,
          isTrue: spec[st.id] ?? st.isTrue,
        })) as typeof updated.statements;
        updated.answerSource = 'answer_file';
      }
    } else {
      const shortVal = (ans.shortAnswer ?? ans.rawValue).replace(/\s+/g, '').slice(0, 4);
      if (shortVal) {
        updated.shortAnswer = shortVal;
        updated.answerSource = 'answer_file';
      }
    }

    return finalizeDraftWarnings(updated);
  };

  return questions.map((q, qIdx) => {
    const qPart: 1 | 2 | 3 =
      q.sourcePart ?? (q.type === 'multiple_choice' ? 1 : q.type === 'true_false' ? 2 : 3);

    // 1. Exact (part, number) match
    let matchIdx = answers.findIndex(
      (a, idx) => !usedAnswerIndices.has(idx) && a.part === qPart && a.number === q.sourceNumber,
    );

    // 2. Match by question number when answer has no section header
    if (matchIdx === -1) {
      matchIdx = answers.findIndex(
        (a, idx) =>
          !usedAnswerIndices.has(idx) &&
          a.part === undefined &&
          a.number === q.sourceNumber &&
          isAnswerCompatible(q.type, a),
      );
    }

    // 3. Fallback: positional match if total counts match cleanly
    if (matchIdx === -1 && answers.length === questions.length && !usedAnswerIndices.has(qIdx)) {
      if (isAnswerCompatible(q.type, answers[qIdx])) {
        matchIdx = qIdx;
      }
    }

    if (matchIdx !== -1) {
      usedAnswerIndices.add(matchIdx);
      return applyEntry(q, answers[matchIdx]);
    }

    return finalizeDraftWarnings(q);
  });
}

function isAnswerCompatible(type: QuestionType, ans: ParsedAnswerEntry): boolean {
  if (type === 'multiple_choice') return ans.part1AnswerIndex !== undefined;
  if (type === 'true_false') return ans.part2Booleans !== undefined;
  return Boolean(ans.shortAnswer || ans.rawValue);
}

export function finalizeDraftWarnings(draft: ParsedQuestionDraft): ParsedQuestionDraft {
  const warnings: string[] = [];

  if (!draft.prompt.trim()) {
    warnings.push('Thiếu nội dung câu hỏi');
  }

  if (draft.type === 'multiple_choice') {
    if (!draft.options || draft.options.some((o) => !o.trim())) {
      warnings.push('Chưa đủ 4 phương án A, B, C, D');
    }
    if (draft.correctOptionIndex === undefined) {
      warnings.push('Chưa có đáp án đúng (A/B/C/D)');
    }
  } else if (draft.type === 'true_false') {
    if (!draft.statements || draft.statements.some((s) => !s.text.trim())) {
      warnings.push('Chưa đủ 4 mệnh đề a, b, c, d');
    }
    if (draft.answerSource === 'none') {
      warnings.push('Chưa đối chiếu đáp án Đúng/Sai từ file trả lời');
    }
  } else if (!draft.shortAnswer?.trim()) {
    warnings.push('Chưa có đáp án trả lời ngắn');
  }

  return { ...draft, warnings };
}

export function convertDraftToQuestion(draft: ParsedQuestionDraft): Question {
  const base: Question = {
    id: `q_imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    subject: draft.subject,
    grade: draft.grade,
    topic: draft.topic.trim() || 'Tổng hợp',
    level: draft.level,
    type: draft.type,
    prompt: draft.prompt.trim(),
    explanation:
      draft.explanation.trim() ||
      'Đáp án được nhập từ bộ file câu hỏi & câu trả lời.',
    createdAt: new Date().toISOString(),
  };

  if (draft.type === 'multiple_choice') {
    base.options = (draft.options ?? ['', '', '', '']).map((o) => o.trim()) as [
      string,
      string,
      string,
      string,
    ];
    base.correctOptionIndex = draft.correctOptionIndex ?? 0;
  } else if (draft.type === 'true_false') {
    base.statements = (
      draft.statements ?? [
        { id: 'a', text: '', isTrue: true },
        { id: 'b', text: '', isTrue: false },
        { id: 'c', text: '', isTrue: true },
        { id: 'd', text: '', isTrue: false },
      ]
    ).map((st) => ({ ...st, text: st.text.trim() })) as [
      TrueFalseStatement,
      TrueFalseStatement,
      TrueFalseStatement,
      TrueFalseStatement,
    ];
  } else {
    const normalized = (draft.shortAnswer ?? '').trim().slice(0, 4);
    const altDot = normalized.replace(/,/g, '.');
    const altComma = normalized.replace(/\./g, ',');
    base.shortAnswer = normalized;
    base.acceptedAnswers = Array.from(new Set([normalized, altDot, altComma].filter(Boolean)));
  }

  return base;
}
