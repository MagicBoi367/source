import { CalendarDays, Clock, Edit3, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  derivePrivateClassCode,
  SCHEDULE_WEEKDAYS,
} from '../data/studentPortalData';
import type {
  ClassScheduleSlot,
  ScheduleDayKey,
  SubjectId,
  TeacherPrivateClass,
  UserAccount,
} from '../types/exam';
import { canTeacherEditResource, getSubjectMeta } from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import { SubjectSearchSelect } from './SubjectSearchSelect';

interface WeeklyCalendarScheduleProps {
  slots: ClassScheduleSlot[];
  classes: TeacherPrivateClass[];
  canEdit: boolean;
  currentUser: UserAccount | null;
  onAddSlot?: (slot: ClassScheduleSlot) => void;
  onUpdateSlot?: (slot: ClassScheduleSlot) => void;
  onDeleteSlot?: (id: string) => void;
  emptyNotice?: string;
}

export function WeeklyCalendarSchedule({
  slots,
  classes,
  canEdit,
  currentUser,
  onAddSlot,
  onUpdateSlot,
  onDeleteSlot,
  emptyNotice,
}: WeeklyCalendarScheduleProps) {
  useSubjects();
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const editableClasses = useMemo(
    () => classes.filter((c) => canTeacherEditResource(c, currentUser)),
    [classes, currentUser],
  );
  const editableClassMap = useMemo(
    () => new Map(editableClasses.map((c) => [c.id, c])),
    [editableClasses],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ClassScheduleSlot | null>(null);
  const [dayKey, setDayKey] = useState<ScheduleDayKey>('mon');
  const [classId, setClassId] = useState<string>(
    editableClasses[0]?.id ?? classes[0]?.id ?? '',
  );
  const [timeSlot, setTimeSlot] = useState('19:30 – 21:00');
  const [subject, setSubject] = useState<SubjectId>(
    editableClasses[0]?.subject ?? classes[0]?.subject ?? currentUser?.subject ?? '',
  );
  const [topic, setTopic] = useState('');
  const [roomOrNote, setRoomOrNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const openAddModal = (presetDay: ScheduleDayKey) => {
    if (!canEdit) return;
    setEditingSlot(null);
    setDayKey(presetDay);
    const defaultClass = editableClasses[0] ?? classes[0];
    setClassId(defaultClass?.id ?? '');
    setTimeSlot('19:30 – 21:00');
    setSubject(defaultClass?.subject ?? currentUser?.subject ?? '');
    setTopic('');
    setRoomOrNote(
      defaultClass
        ? `Lớp ${derivePrivateClassCode(defaultClass)}`
        : 'Trực tuyến',
    );
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (slot: ClassScheduleSlot) => {
    if (!canEdit) return;
    setEditingSlot(slot);
    setDayKey(slot.dayKey);
    setClassId(slot.classId);
    setTimeSlot(slot.timeSlot);
    setSubject(slot.subject);
    setTopic(slot.topic);
    setRoomOrNote(slot.roomOrNote);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !currentUser) return;
    const cleanTopic = topic.trim();
    const cleanTime = timeSlot.trim();
    if (!subject.trim()) {
      setFormError('Vui lòng tìm kiếm và chọn môn học cho buổi học.');
      return;
    }
    if (!cleanTime || !cleanTopic) {
      setFormError('Vui lòng nhập khung giờ và nội dung buổi học.');
      return;
    }
    const targetClassId =
      (classId && editableClassMap.has(classId) ? classId : editableClasses[0]?.id) ||
      (editingSlot ? editingSlot.classId : 'general');

    if (editingSlot && onUpdateSlot) {
      onUpdateSlot({
        ...editingSlot,
        classId: targetClassId,
        dayKey,
        timeSlot: cleanTime,
        subject,
        topic: cleanTopic,
        roomOrNote: roomOrNote.trim() || 'Trực tuyến',
      });
    } else if (onAddSlot) {
      onAddSlot({
        id: `csch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        classId: targetClassId,
        dayKey,
        timeSlot: cleanTime,
        subject,
        topic: cleanTopic,
        roomOrNote: roomOrNote.trim() || 'Trực tuyến',
        ownerTeacherId: currentUser.id,
        ownerTeacherName: currentUser.fullName,
        createdAt: new Date().toISOString(),
      });
    }
    setModalOpen(false);
    setEditingSlot(null);
  };

  return (
    <div>
      {canEdit && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Chế độ Giáo viên: Bấm <strong>+ Thêm</strong> ở bất kỳ ngày nào từ Thứ 2 đến Chủ nhật để cập nhật lịch học cho học sinh.
          </p>
          <button
            type="button"
            onClick={() => openAddModal('mon')}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm buổi học vào lịch</span>
          </button>
        </div>
      )}

      {/* 7-Column Calendar Grid: Thứ 2 -> Chủ nhật (horizontal scroll on narrow mobile, 7 cols on xl/lg) */}
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[920px] grid-cols-7 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {SCHEDULE_WEEKDAYS.map((day) => {
            const daySlots = slots
              .filter((s) => s.dayKey === day.key)
              .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

            return (
              <div key={day.key} className="flex min-h-[240px] flex-col">
                {/* Day Column Header */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div>
                    <span className="block font-display text-xs font-bold text-slate-900 dark:text-slate-100">
                      {day.label}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 tabular-nums dark:text-slate-400">
                      {daySlots.length} buổi
                    </span>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openAddModal(day.key)}
                      title={`Thêm lịch ${day.label}`}
                      aria-label={`Thêm lịch ${day.label}`}
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Day Column Body */}
                <div className="flex-1 space-y-2.5 p-2.5">
                  {daySlots.length === 0 ? (
                    <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-2 text-center dark:border-slate-800">
                      <CalendarDays className="h-4 w-4 text-slate-300 dark:text-slate-700" />
                      <span className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                        Trống lịch
                      </span>
                    </div>
                  ) : (
                    daySlots.map((slot) => {
                      const cls = classMap.get(slot.classId);
                      const classCode = cls ? derivePrivateClassCode(cls) : '';
                      const isOwner =
                        canEdit &&
                        Boolean(
                          currentUser &&
                            (currentUser.role === 'admin' ||
                              slot.ownerTeacherId === currentUser.id ||
                              (cls && canTeacherEditResource(cls, currentUser))),
                        );

                      return (
                        <div
                          key={slot.id}
                          className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/50"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-700 tabular-nums dark:text-blue-400">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>{slot.timeSlot}</span>
                            </span>
                          </div>

                          <p className="mt-1.5 font-semibold text-slate-900 dark:text-slate-100">
                            {getSubjectMeta(slot.subject).name}
                          </p>

                          <p className="mt-1 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
                            {slot.topic}
                          </p>

                          <div className="mt-2 space-y-0.5 border-t border-slate-200/70 pt-1.5 text-[10px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            {classCode && (
                              <p className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                Lớp: {classCode}
                              </p>
                            )}
                            <p className="truncate">GV: {slot.ownerTeacherName}</p>
                            <p className="truncate">{slot.roomOrNote}</p>
                          </div>

                          {isOwner && (
                            <div className="mt-2 flex items-center justify-end gap-1 border-t border-slate-200/70 pt-1.5 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => openEditModal(slot)}
                                aria-label="Sửa lịch học"
                                className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-white hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Sửa</span>
                              </button>
                              {onDeleteSlot && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteSlot(slot.id)}
                                  aria-label="Xóa lịch học"
                                  className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Xóa</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {slots.length === 0 && emptyNotice && (
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          {emptyNotice}
        </p>
      )}

      {/* Teacher-Only Add/Edit Schedule Modal */}
      {canEdit && modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingSlot ? 'Cập nhật buổi học' : 'Thêm buổi học vào lịch'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                {editingSlot ? 'Chỉnh sửa buổi học' : 'Thêm buổi học mới'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot} className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Ngày trong tuần
                  </label>
                  <select
                    value={dayKey}
                    onChange={(e) => setDayKey(e.target.value as ScheduleDayKey)}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {SCHEDULE_WEEKDAYS.map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Khung giờ
                  </label>
                  <input
                    type="text"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    placeholder="19:30 – 21:00"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Lớp học
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setClassId(nextId);
                      const found = classMap.get(nextId);
                      if (found?.subject) setSubject(found.subject);
                    }}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {editableClasses.length === 0 ? (
                      <option value="general">Lịch chung</option>
                    ) : (
                      editableClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {derivePrivateClassCode(c)} · {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Môn học
                  </label>
                  <SubjectSearchSelect
                    value={subject}
                    onChange={(val) => {
                      setSubject(val);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Tìm tên môn..."
                    ariaLabel="Tìm kiếm và chọn môn học cho lịch học"
                    currentUser={currentUser}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nội dung / Chuyên đề buổi học
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="VD: Ôn tập Nguyên hàm – Tích phân & Oxyz"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Phòng học / Ghi chú
                </label>
                <input
                  type="text"
                  value={roomOrNote}
                  onChange={(e) => setRoomOrNote(e.target.value)}
                  placeholder="VD: Phòng trực tuyến hoặc Phòng thi TOAN2025"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              {formError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  {editingSlot ? 'Lưu buổi học' : 'Thêm vào lịch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
