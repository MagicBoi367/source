import type {
  ClassAssignment,
  ClassJoinRequest,
  ClassMaterial,
  ClassScheduleSlot,
  ScheduleDayKey,
  TeacherPrivateClass,
} from '../types/exam';

export const SCHEDULE_WEEKDAYS: { key: ScheduleDayKey; label: string; shortLabel: string }[] = [
  { key: 'mon', label: 'Thứ 2', shortLabel: 'T2' },
  { key: 'tue', label: 'Thứ 3', shortLabel: 'T3' },
  { key: 'wed', label: 'Thứ 4', shortLabel: 'T4' },
  { key: 'thu', label: 'Thứ 5', shortLabel: 'T5' },
  { key: 'fri', label: 'Thứ 6', shortLabel: 'T6' },
  { key: 'sat', label: 'Thứ 7', shortLabel: 'T7' },
  { key: 'sun', label: 'Chủ nhật', shortLabel: 'CN' },
];

export const SEED_TEACHER_CLASSES: TeacherPrivateClass[] = [
  {
    id: 'pclass_seed_toan12',
    classCode: '12A1-TOAN',
    name: 'Toán 12A1 — Ôn thi Tốt nghiệp THPT 2025',
    grade: 12,
    subject: 'toan',
    description:
      'Lớp ôn luyện chuyên sâu cấu trúc 3 dạng thức Toán 12 (Hàm số, Nguyên hàm – Tích phân, Oxyz, Xác suất).',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-01T08:00:00.000Z',
  },
  {
    id: 'pclass_seed_toan12_vdc',
    classCode: '12A1-HSG',
    name: 'Toán 12 — Chuyên đề Vận dụng cao',
    grade: 12,
    subject: 'toan',
    description:
      'Nhóm bồi dưỡng câu hỏi Phần II (Đúng/Sai) và Phần III (Trả lời ngắn) mục tiêu 9+.',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-02T08:00:00.000Z',
  },
  {
    id: 'pclass_seed_vatli12',
    classCode: '12A1-VATLI',
    name: 'Vật lí 12 — Nhiệt học & Khí lí tưởng',
    grade: 12,
    subject: 'vat_li',
    description:
      'Lớp học và kiểm tra định kỳ môn Vật lí 12 theo chương trình GDPT 2018.',
    ownerTeacherId: 'GV0003',
    ownerTeacherName: 'Cô Lê Thu Hà',
    createdAt: '2025-05-02T09:00:00.000Z',
  },
];

export const SEED_CLASS_JOIN_REQUESTS: ClassJoinRequest[] = [
  {
    id: 'cjr_seed_student1_toan12',
    classId: 'pclass_seed_toan12',
    classCode: '12A1-TOAN',
    studentUserId: 'HV0001',
    studentName: 'Nguyễn Minh Anh',
    studentSbd: '0102588',
    studentClass: '12A1',
    studentEmail: 'hocsinh@kythi2025.edu.vn',
    status: 'approved',
    requestedAt: '2025-05-01T08:15:00.000Z',
    reviewedAt: '2025-05-01T08:20:00.000Z',
    reviewedByTeacherName: 'ThS. Trần Quốc Bảo',
  },
  {
    id: 'cjr_seed_guest_toan12',
    classId: 'pclass_seed_toan12',
    classCode: '12A1-TOAN',
    studentUserId: 'guest_student',
    studentName: 'Học sinh (Xem thử)',
    studentClass: '12A1',
    status: 'approved',
    requestedAt: '2025-05-01T08:15:00.000Z',
    reviewedAt: '2025-05-01T08:20:00.000Z',
    reviewedByTeacherName: 'ThS. Trần Quốc Bảo',
  },
  {
    id: 'cjr_seed_pending_demo1',
    classId: 'pclass_seed_toan12',
    classCode: '12A1-TOAN',
    studentUserId: 'demo_student_pending_01',
    studentName: 'Trần Gia Huy',
    studentSbd: '0102615',
    studentClass: '12A1',
    studentEmail: 'giahuy.12a1@kythi2025.edu.vn',
    status: 'pending',
    requestedAt: '2025-05-08T14:20:00.000Z',
  },
];

export const SEED_CLASS_MATERIALS: ClassMaterial[] = [
  {
    id: 'cmat_toan_01',
    classId: 'pclass_seed_toan12',
    title: 'Đề cương công thức trọng tâm Toán 12 — Cấu trúc 3 Dạng thức 2025',
    subject: 'toan',
    grade: 12,
    category: 'Tài liệu ôn tập',
    summary:
      'Tổng hợp công thức Giải tích 12 (Đạo hàm, Nguyên hàm – Tích phân), Oxyz và Xác suất có điều kiện.',
    keyPoints: [
      'Khảo sát sự biến thiên, tiệm cận và cực trị hàm bậc 3, phân thức.',
      'Tích phân từng phần, diện tích hình phẳng và thể tích vật tròn xoay.',
      'Phương trình mặt phẳng, đường thẳng, mặt cầu trong không gian Oxyz.',
      'Công thức Bayes và xác suất toàn phần thường gặp ở Phần II & Phần III.',
    ],
    contentText: [
      'ĐỀ CƯƠNG ÔN TẬP TOÁN HỌC 12 — LỚP 12A1-TOAN',
      'Giáo viên gửi: ThS. Trần Quốc Bảo',
      '------------------------------------------------------------------------',
      '1. ỨNG DỤNG ĐẠO HÀM KHẢO SÁT HÀM SỐ',
      '- Hàm bậc ba y = ax^3 + bx^2 + cx + d: có 2 cực trị khi b^2 - 3ac > 0.',
      '- Tiệm cận ngang của y = (ax+b)/(cx+d): y = a/c; tiệm cận đứng: x = -d/c.',
      '',
      '2. NGUYÊN HÀM & TÍCH PHÂN',
      '- S = ∫_a^b |f(x) - g(x)| dx.',
      '- V = π ∫_a^b [f(x)]^2 dx.',
      '',
      '3. HÌNH HỌC KHÔNG GIAN OXYZ',
      '- Mặt cầu tâm I(a;b;c) bán kính R: (x-a)^2 + (y-b)^2 + (z-c)^2 = R^2.',
    ].join('\n'),
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-05T08:00:00.000Z',
  },
  {
    id: 'cmat_toan_02',
    classId: 'pclass_seed_toan12',
    title: 'Phiếu hướng dẫn giải nhanh Phần III (Trả lời ngắn 4 ký tự)',
    subject: 'toan',
    grade: 12,
    category: 'Kỹ năng làm bài',
    summary:
      'Quy tắc làm tròn số, điền dấu trừ (-) và dấu phẩy thập phân chuẩn phiếu chấm OMR 2025.',
    keyPoints: [
      'Chỉ điền tối đa 4 ký tự (bao gồm cả dấu trừ hoặc dấu phẩy/chấm thập phân).',
      'Kiểm tra kỹ yêu cầu làm tròn đến hàng phần mười hay hàng phần trăm.',
    ],
    contentText: [
      'HƯỚNG DẪN PHẦN III — TRẢ LỜI NGẮN TOÁN 12',
      'Giáo viên gửi: ThS. Trần Quốc Bảo',
      '------------------------------------------------------------------------',
      '- Mỗi câu đúng được 0,50 điểm.',
      '- Kết quả âm chiếm 1 ô cho dấu "-", còn lại tối đa 3 chữ số.',
      '- Nên kiểm tra lại điều kiện nghiệm trước khi điền kết quả cuối.',
    ].join('\n'),
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-06T09:00:00.000Z',
  },
  {
    id: 'cmat_toan_hsg_01',
    classId: 'pclass_seed_toan12_vdc',
    title: 'Chuyên đề Tích phân hàm ẩn & Bất đẳng thức hàm số',
    subject: 'toan',
    grade: 12,
    category: 'Chuyên đề nâng cao',
    summary:
      'Các dạng bài toán tích phân liên kết đạo hàm f(x) và f\'(x) mức độ Vận dụng cao.',
    keyPoints: [
      'Nhận diện biểu thức đạo hàm của tích u(x)·v(x) hoặc thương u(x)/v(x).',
      'Khai thác tính chất hàm chẵn, hàm lẻ và đổi biến đối xứng.',
    ],
    contentText:
      'CHUYÊN ĐỀ TÍCH PHÂN HÀM ẨN\nGiáo viên: ThS. Trần Quốc Bảo\n- Sử dụng kỹ thuật nhân thêm nhân tử tích phân e^{g(x)}.',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-07T08:00:00.000Z',
  },
  {
    id: 'cmat_vatli_01',
    classId: 'pclass_seed_vatli12',
    title: 'Tóm tắt Định luật I Nhiệt động lực học & Khí lí tưởng',
    subject: 'vat_li',
    grade: 12,
    category: 'Tài liệu chuyên đề',
    summary:
      'Quy ước dấu ΔU = Q + A, công thức nhiệt nóng chảy riêng và phương trình trạng thái Clapeyron.',
    keyPoints: [
      'Q = m·c·ΔT, Q = λ·m, Q = L·m.',
      'pV = nRT với R = 8,31 J/(mol·K) và T(K) = t(°C) + 273.',
    ],
    contentText:
      'TÓM TẮT VẬT LÍ NHIỆT 12\nGiáo viên: Cô Lê Thu Hà\n- Định luật I: ΔU = Q + A.\n- Khí lí tưởng: p1V1/T1 = p2V2/T2.',
    ownerTeacherId: 'GV0003',
    ownerTeacherName: 'Cô Lê Thu Hà',
    createdAt: '2025-05-04T10:00:00.000Z',
  },
];

export const SEED_CLASS_ASSIGNMENTS: ClassAssignment[] = [
  {
    id: 'casg_toan_01',
    classId: 'pclass_seed_toan12',
    title: 'Bài tập Tuần 1: Khảo sát hàm số & Đường tiệm cận',
    subject: 'toan',
    grade: 12,
    description:
      'Hoàn thành bộ câu hỏi trắc nghiệm nhận biết – thông hiểu về khoảng đồng biến và tiệm cận đồ thị.',
    dueDateLabel: 'Thứ 6 · 21:00',
    estimatedMinutes: 20,
    relatedRoomCode: 'TOAN2025',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-05T08:30:00.000Z',
  },
  {
    id: 'casg_toan_02',
    classId: 'pclass_seed_toan12',
    title: 'Bài tập Tuần 2: Nguyên hàm – Tích phân & Hình học Oxyz',
    subject: 'toan',
    grade: 12,
    description:
      'Luyện tập xác định vectơ pháp tuyến mặt phẳng, tâm – bán kính mặt cầu và tích phân cơ bản.',
    dueDateLabel: 'Chủ nhật · 20:00',
    estimatedMinutes: 25,
    relatedRoomCode: 'TOAN2025',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-06T08:30:00.000Z',
  },
  {
    id: 'casg_toan_hsg_01',
    classId: 'pclass_seed_toan12_vdc',
    title: 'Phiếu luyện tập Vận dụng cao: Xác suất có điều kiện',
    subject: 'toan',
    grade: 12,
    description:
      'Giải 5 bài toán xác suất thực tế chuẩn bị cho phần Trả lời ngắn.',
    dueDateLabel: 'Thứ 7 · 21:00',
    estimatedMinutes: 30,
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-07T09:00:00.000Z',
  },
  {
    id: 'casg_vatli_01',
    classId: 'pclass_seed_vatli12',
    title: 'Bài tập Nhiệt học: Phương trình trạng thái khí lí tưởng',
    subject: 'vat_li',
    grade: 12,
    description:
      'Luyện tập tính áp suất, thể tích và nhiệt độ tuyệt đối trong các đẳng quá trình.',
    dueDateLabel: 'Thứ 5 · 20:00',
    estimatedMinutes: 15,
    relatedRoomCode: 'VATLI25',
    ownerTeacherId: 'GV0003',
    ownerTeacherName: 'Cô Lê Thu Hà',
    createdAt: '2025-05-05T10:00:00.000Z',
  },
];

export const SEED_CLASS_SCHEDULES: ClassScheduleSlot[] = [
  {
    id: 'csch_mon_1',
    classId: 'pclass_seed_toan12',
    dayKey: 'mon',
    timeSlot: '19:30 – 21:00',
    subject: 'toan',
    topic: 'Ứng dụng đạo hàm & Khảo sát hàm số',
    roomOrNote: 'Trực tuyến · Lớp 12A1-TOAN',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-01T08:00:00.000Z',
  },
  {
    id: 'csch_tue_1',
    classId: 'pclass_seed_vatli12',
    dayKey: 'tue',
    timeSlot: '19:30 – 21:00',
    subject: 'vat_li',
    topic: 'Vật lí nhiệt & Định luật I Nhiệt động lực học',
    roomOrNote: 'Trực tuyến · Lớp 12A1-VATLI',
    ownerTeacherId: 'GV0003',
    ownerTeacherName: 'Cô Lê Thu Hà',
    createdAt: '2025-05-01T08:00:00.000Z',
  },
  {
    id: 'csch_wed_1',
    classId: 'pclass_seed_toan12',
    dayKey: 'wed',
    timeSlot: '19:30 – 21:00',
    subject: 'toan',
    topic: 'Nguyên hàm – Tích phân & Hình học Oxyz',
    roomOrNote: 'Chữa bài tập tuần · 12A1-TOAN',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-01T08:00:00.000Z',
  },
  {
    id: 'csch_thu_1',
    classId: 'pclass_seed_toan12_vdc',
    dayKey: 'thu',
    timeSlot: '19:30 – 21:00',
    subject: 'toan',
    topic: 'Chuyên đề Tích phân hàm ẩn & Oxyz nâng cao',
    roomOrNote: 'Lớp 12A1-HSG',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-01T08:00:00.000Z',
  },
  {
    id: 'csch_fri_1',
    classId: 'pclass_seed_vatli12',
    dayKey: 'fri',
    timeSlot: '19:30 – 21:00',
    subject: 'vat_li',
    topic: 'Luyện đề Vật lí 3 phần chuẩn 2025',
    roomOrNote: 'Phòng thi VATLI25',
    ownerTeacherId: 'GV0003',
    ownerTeacherName: 'Cô Lê Thu Hà',
    createdAt: '2025-05-01T08:00:00.000Z',
  },
  {
    id: 'csch_sat_1',
    classId: 'pclass_seed_toan12',
    dayKey: 'sat',
    timeSlot: '14:30 – 16:30',
    subject: 'toan',
    topic: 'Giải đáp thắc mắc & Luyện Đúng/Sai',
    roomOrNote: 'Phụ đạo nhóm 12A1-TOAN',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-01T08:00:00.000Z',
  },
  {
    id: 'csch_sun_1',
    classId: 'pclass_seed_toan12',
    dayKey: 'sun',
    timeSlot: '08:30 – 10:30',
    subject: 'toan',
    topic: 'Thi thử định kỳ tuần (90 phút)',
    roomOrNote: 'Bài thi TOAN2025',
    ownerTeacherId: 'GV0001',
    ownerTeacherName: 'ThS. Trần Quốc Bảo',
    createdAt: '2025-05-01T08:00:00.000Z',
  },
];

export function derivePrivateClassCode(pc: TeacherPrivateClass): string {
  if (pc.classCode && pc.classCode.trim()) {
    return pc.classCode.trim().toUpperCase();
  }
  const toLetters = (val: string) =>
    val
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
  const lettersPart = `${toLetters(pc.subject ?? '').slice(0, 2)}${toLetters(pc.name)}${toLetters(pc.id)}ABC`.slice(
    0,
    3,
  );
  const rawDigits = `${String(pc.grade).replace(/\D/g, '')}${pc.id.replace(/\D/g, '')}12`;
  const digitsPart = rawDigits.slice(0, 2);
  return `${lettersPart}${digitsPart}`;
}

export function downloadClassMaterialTxt(material: ClassMaterial): void {
  const blob = new Blob(['\uFEFF' + material.contentText], {
    type: 'text/plain;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = material.attachmentName || `${material.id}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function resizeAvatarImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Kích thước ảnh tối đa 5MB.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Không thể đọc tệp ảnh.'));
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc tệp ảnh.'));
    reader.readAsDataURL(file);
  });

  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 240;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
