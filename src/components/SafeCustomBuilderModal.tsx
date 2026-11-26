import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CheckSquare,
  Copy,
  Edit3,
  FileText,
  FolderPlus,
  LayoutGrid,
  Plus,
  Square,
  Trash2,
  Volume2,
  X
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  CustomBuilderItem,
  CustomBuilderItemType,
  CustomBuilderStoreData,
  CustomChecklistEntry,
  loadCustomBuilderData,
  saveCustomBuilderData
} from '../services/customBuilderService';
import { deleteEvidenceFile } from '../services/evidenceStorage';
import { AttachmentCell } from './AttachmentCell';
import {
  buildJudgeDemoCustomBuilder,
  loadJudgeDemoAuxState,
  saveJudgeDemoAuxState
} from '../services/judgeDemoService';

interface SafeCustomBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ITEM_TYPE_META: Record<
  CustomBuilderItemType,
  { labelTh: string; labelEn: string; badgeCls: string }
> = {
  task_card: {
    labelTh: 'การ์ดงาน',
    labelEn: 'Task Card',
    badgeCls: 'bg-cyan-500/20 text-cyan-100 border-cyan-300/35'
  },
  checklist: {
    labelTh: 'เช็กลิสต์',
    labelEn: 'Checklist',
    badgeCls: 'bg-emerald-500/20 text-emerald-100 border-emerald-300/35'
  },
  script: {
    labelTh: 'สคริปต์งาน',
    labelEn: 'Script',
    badgeCls: 'bg-violet-500/20 text-violet-100 border-violet-300/35'
  }
};

export const SafeCustomBuilderModal: React.FC<SafeCustomBuilderModalProps> = ({
  isOpen,
  onClose
}) => {
  const { language } = useLanguage();
  const { activeWorkspace, recordAudit, isJudgeDemoActive } = useWorkspace();
  const isEn = language === 'en';

  const [store, setStore] = useState<CustomBuilderStoreData>(() =>
    isJudgeDemoActive
      ? loadJudgeDemoAuxState(`cbuilder::${activeWorkspace.id}`, buildJudgeDemoCustomBuilder())
      : loadCustomBuilderData(activeWorkspace.id)
  );
  const [filterType, setFilterType] = useState<CustomBuilderItemType | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showNewCategoryBox, setShowNewCategoryBox] = useState(false);

  // Builder form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<CustomBuilderItemType>('task_card');
  const [formCategory, setFormCategory] = useState<string>(
    store.categories[0] || 'เช็กลิสต์เปิด-ปิดห้องตรวจ'
  );
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScriptText, setFormScriptText] = useState('');
  const [formChecklistText, setFormChecklistText] = useState('');
  const [formAttachmentId, setFormAttachmentId] = useState<string | undefined>(undefined);
  const [inlineSubTaskDrafts, setInlineSubTaskDrafts] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = isJudgeDemoActive
      ? loadJudgeDemoAuxState(`cbuilder::${activeWorkspace.id}`, buildJudgeDemoCustomBuilder())
      : loadCustomBuilderData(activeWorkspace.id);
    setStore(loaded);
    setFormCategory((prev) =>
      loaded.categories.includes(prev) ? prev : loaded.categories[0] || ''
    );
  }, [activeWorkspace.id, isJudgeDemoActive]);

  useEffect(() => {
    if (isJudgeDemoActive) {
      saveJudgeDemoAuxState(`cbuilder::${activeWorkspace.id}`, store);
      return;
    }
    saveCustomBuilderData(activeWorkspace.id, store);
  }, [activeWorkspace.id, store, isJudgeDemoActive]);

  // Stop any browser TTS cleanly when closed/unmounted
  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
      setSpeakingId(null);
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    return store.items.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (filterCategory !== 'all' && item.categoryName !== filterCategory) return false;
      return true;
    });
  }, [store.items, filterType, filterCategory]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingId(null);
    setFormType('task_card');
    setFormCategory(store.categories[0] || 'เช็กลิสต์เปิด-ปิดห้องตรวจ');
    setFormTitle('');
    setFormDescription('');
    setFormScriptText('');
    setFormChecklistText('');
    setFormAttachmentId(undefined);
    setFormError(null);
  };

  const handleAddCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (!store.categories.includes(trimmed)) {
      setStore((prev) => ({
        ...prev,
        categories: [...prev.categories, trimmed]
      }));
      recordAudit('task_create', `Custom builder category created: ${trimmed}`);
    }
    setFormCategory(trimmed);
    setFilterCategory(trimmed);
    setNewCategoryInput('');
    setShowNewCategoryBox(false);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const titleTrimmed = formTitle.trim();
    if (!titleTrimmed) {
      setFormError(isEn ? 'Please enter a title.' : 'กรุณาระบุชื่อหัวข้องานหรือโมดูล');
      return;
    }

    const nowIso = new Date().toISOString();
    const checklistLines: CustomChecklistEntry[] = formChecklistText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text, idx) => ({
        id: `chk-${Date.now()}-${idx}`,
        text,
        done: false
      }));

    if (editingId) {
      setStore((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== editingId) return item;
          return {
            ...item,
            type: formType,
            categoryName: formCategory.trim() || prev.categories[0] || 'งานทั่วไป',
            title: titleTrimmed,
            description: formDescription.trim(),
            scriptText: formScriptText.trim(),
            checklist:
              formType === 'checklist' && checklistLines.length > 0
                ? checklistLines
                : item.checklist,
            attachmentEvidenceId: formAttachmentId,
            updatedAt: nowIso
          };
        })
      }));
      recordAudit('task_update', `Custom builder updated: ${titleTrimmed}`);
    } else {
      const created: CustomBuilderItem = {
        id: `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: formType,
        categoryName: formCategory.trim() || store.categories[0] || 'งานทั่วไป',
        title: titleTrimmed,
        description: formDescription.trim(),
        scriptText: formScriptText.trim(),
        checklist: formType === 'checklist' ? checklistLines : [],
        status: 'active',
        attachmentEvidenceId: formAttachmentId,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      setStore((prev) => ({
        ...prev,
        items: [created, ...prev.items]
      }));
      recordAudit('task_create', `Custom builder item added: ${titleTrimmed}`);
    }

    resetForm();
  };

  const startEditItem = (item: CustomBuilderItem) => {
    setEditingId(item.id);
    setFormType(item.type);
    setFormCategory(item.categoryName);
    setFormTitle(item.title);
    setFormDescription(item.description);
    setFormScriptText(item.scriptText);
    setFormChecklistText(item.checklist.map((c) => c.text).join('\n'));
    setFormAttachmentId(item.attachmentEvidenceId);
    setFormError(null);
  };

  const handleDeleteItem = async (item: CustomBuilderItem) => {
    if (item.attachmentEvidenceId) {
      await deleteEvidenceFile(item.attachmentEvidenceId).catch(() => undefined);
    }
    setStore((prev) => ({
      ...prev,
      items: prev.items.filter((x) => x.id !== item.id)
    }));
    if (editingId === item.id) resetForm();
    recordAudit('task_update', `Custom builder item deleted: ${item.title}`);
  };

  const toggleItemStatus = (id: string) => {
    const nowIso = new Date().toISOString();
    setStore((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'active' ? 'completed' : 'active',
              updatedAt: nowIso
            }
          : item
      )
    }));
  };

  const toggleChecklistEntry = (itemId: string, entryId: string) => {
    const nowIso = new Date().toISOString();
    setStore((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              updatedAt: nowIso,
              checklist: item.checklist.map((c) =>
                c.id === entryId ? { ...c, done: !c.done } : c
              )
            }
          : item
      )
    }));
  };

  const addInlineChecklistEntry = (itemId: string) => {
    const text = (inlineSubTaskDrafts[itemId] || '').trim();
    if (!text) return;
    const nowIso = new Date().toISOString();
    setStore((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              updatedAt: nowIso,
              checklist: [
                ...item.checklist,
                { id: `chk-${Date.now()}`, text, done: false }
              ]
            }
          : item
      )
    }));
    setInlineSubTaskDrafts((prev) => ({ ...prev, [itemId]: '' }));
  };

  const handleCopyScript = async (item: CustomBuilderItem) => {
    const text = item.scriptText || item.description || item.title;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSpeakScript = (item: CustomBuilderItem) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    if (speakingId === item.id) {
      synth.cancel();
      setSpeakingId(null);
      return;
    }
    const text = item.scriptText || item.description || item.title;
    if (!text) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'th-TH';
    utter.rate = 0.96;
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);
    setSpeakingId(item.id);
    synth.speak(utter);
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[102] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-modal rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/15 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-300/35 flex items-center justify-center text-cyan-200 shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {isEn
                  ? 'Safe Custom Module & Task Builder'
                  : 'สร้างงาน / หมวดงานใหม่ (Safe Custom Builder)'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                {isEn
                  ? 'Isolated workspace storage — safely add task cards, checklists & scripts without touching Queue, Stock or Chat.'
                  : 'จัดเก็บแยกส่วนอิสระ (Isolated Storage) — สร้างการ์ดงาน เช็กลิสต์ หรือสคริปต์เพิ่มได้ทันที ไม่กระทบคิว สต๊อก หรือแชท'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="crystal-tile p-2 rounded-xl text-slate-200 hover:text-white cursor-pointer"
            aria-label={isEn ? 'Close' : 'ปิด'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left column: Builder Form */}
          <form
            onSubmit={handleSaveItem}
            className="lg:col-span-5 glass-subcard rounded-2xl p-4 space-y-3 h-fit"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-cyan-100 uppercase tracking-wider">
                {editingId
                  ? isEn
                    ? 'Edit Custom Item'
                    : 'แก้ไขรายการงานที่สร้าง'
                  : isEn
                    ? 'Create New Item'
                    : 'เพิ่มงาน / หมวดงานใหม่'}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
                >
                  {isEn ? 'Cancel edit' : 'ยกเลิกการแก้ไข'}
                </button>
              )}
            </div>

            {/* Type Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-200 mb-1.5">
                {isEn ? 'Module Type' : 'รูปแบบโมดูลย่อย'}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['task_card', 'checklist', 'script'] as CustomBuilderItemType[]).map(
                  (typeKey) => {
                    const active = formType === typeKey;
                    const meta = ITEM_TYPE_META[typeKey];
                    return (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() => setFormType(typeKey)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                          active
                            ? 'bg-cyan-500/25 border-cyan-300/60 text-white'
                            : 'crystal-tile text-slate-300 hover:text-white'
                        }`}
                      >
                        {typeKey === 'task_card' && <LayoutGrid className="w-3.5 h-3.5" />}
                        {typeKey === 'checklist' && <CheckSquare className="w-3.5 h-3.5" />}
                        {typeKey === 'script' && <FileText className="w-3.5 h-3.5" />}
                        <span>{isEn ? meta.labelEn : meta.labelTh}</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Category Selector + New Category */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-200">
                  {isEn ? 'Category' : 'หมวดงาน'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCategoryBox((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] text-cyan-200 hover:text-white cursor-pointer"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>{isEn ? 'New Category' : 'เพิ่มหมวดงานใหม่'}</span>
                </button>
              </div>
              {showNewCategoryBox ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    placeholder={isEn ? 'Category name...' : 'เช่น งานหน้าเคาน์เตอร์บ่าย...'}
                    className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="crystal-btn px-3 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                  >
                    {isEn ? 'Add' : 'เพิ่ม'}
                  </button>
                </div>
              ) : (
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs"
                >
                  {store.categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900 text-white">
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                {isEn ? 'Title' : 'หัวข้องาน / ชื่อรายการ'}
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={
                  isEn
                    ? 'e.g., Room 2 Afternoon Prep Checklist'
                    : 'เช่น เช็กลิสต์เตรียมห้องตรวจบ่าย / สคริปต์นัดขูดหินปูน'
                }
                className="glass-input w-full px-3 py-2 rounded-xl text-xs"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                {isEn ? 'Notes / Details' : 'รายละเอียดเพิ่มเติม'}
              </label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={
                  isEn
                    ? 'Optional notes or owner instructions...'
                    : 'ระบุขั้นตอนหรือหมายเหตุสำหรับทีมหน้างาน...'
                }
                className="glass-input w-full px-3 py-2 rounded-xl text-xs resize-none"
              />
            </div>

            {/* Type-specific fields */}
            {formType === 'checklist' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                  {isEn
                    ? 'Checklist Items (1 per line)'
                    : 'รายการเช็กลิสต์ (ขึ้นบรรทัดใหม่เพื่อแยกข้อ)'}
                </label>
                <textarea
                  rows={4}
                  value={formChecklistText}
                  onChange={(e) => setFormChecklistText(e.target.value)}
                  placeholder={
                    isEn
                      ? 'Check suction pressure\nPrepare sterilization pouch\nVerify X-ray sensor'
                      : 'ตรวจความพร้อมเครื่องดูดน้ำลาย\nจัดชุดเครื่องมือปลอดเชื้อ\nเช็กแผ่นฟิล์มเอกซเรย์'
                  }
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs resize-none"
                />
              </div>
            )}

            {formType === 'script' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                  {isEn ? 'Ready-to-Use Script' : 'ข้อความสคริปต์ (คัดลอก/อ่านออกเสียงได้)'}
                </label>
                <textarea
                  rows={4}
                  value={formScriptText}
                  onChange={(e) => setFormScriptText(e.target.value)}
                  placeholder={
                    isEn
                      ? 'Type script to copy or speak aloud...'
                      : 'พิมพ์สคริปต์สำหรับพูดหน้างาน หรือส่งต่อให้คนไข้...'
                  }
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs resize-none"
                />
              </div>
            )}

            {/* Optional Compressed Photo Attachment */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                {isEn ? 'Reference Photo (Optional)' : 'แนบรูปอ้างอิง (บีบอัดอัตโนมัติ)'}
              </label>
              <AttachmentCell
                evidenceId={formAttachmentId}
                itemTitle={formTitle.trim() || 'Custom Item'}
                contextLabel="Custom Builder"
                onAttached={(evId) => setFormAttachmentId(evId)}
                onRemoved={() => setFormAttachmentId(undefined)}
              />
            </div>

            {formError && <p className="text-[11px] text-rose-300">{formError}</p>}

            <button
              type="submit"
              className="crystal-btn w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {editingId
                  ? isEn
                    ? 'Save Changes'
                    : 'บันทึกการแก้ไข'
                  : isEn
                    ? 'Create in Isolated Module'
                    : 'บันทึกเข้าโมดูลแยกอิสระ'}
              </span>
            </button>
          </form>

          {/* Right column: Saved Items & Filters */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            {/* Filter Controls */}
            <div className="glass-subcard rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'task_card', 'checklist', 'script'] as const).map((tKey) => (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => setFilterType(tKey)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      filterType === tKey
                        ? 'bg-cyan-500/25 border-cyan-300/60 text-white'
                        : 'crystal-tile text-slate-300 hover:text-white'
                    }`}
                  >
                    {tKey === 'all'
                      ? isEn
                        ? `All (${store.items.length})`
                        : `ทั้งหมด (${store.items.length})`
                      : isEn
                        ? ITEM_TYPE_META[tKey].labelEn
                        : ITEM_TYPE_META[tKey].labelTh}
                  </button>
                ))}
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="glass-input px-2.5 py-1.5 rounded-lg text-[11px]"
              >
                <option value="all" className="bg-slate-900 text-white">
                  {isEn ? 'All Categories' : 'ทุกหมวดงาน'}
                </option>
                {store.categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900 text-white">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Cards List */}
            {filteredItems.length === 0 ? (
              <div className="glass-subcard rounded-2xl p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-200">
                  {isEn
                    ? 'No custom cards, checklists or scripts yet'
                    : 'ยังไม่มีการ์ดงาน เช็กลิสต์ หรือสคริปต์ในหมวดนี้'}
                </p>
                <p className="text-xs text-slate-400">
                  {isEn
                    ? 'Use the form on the left to build custom workflows without affecting Queue, Stock or Chat.'
                    : 'สร้างงานหรือหมวดงานใหม่จากฟอร์มด้านซ้าย ข้อมูลจะถูกแยกเก็บอย่างปลอดภัย'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const meta = ITEM_TYPE_META[item.type];
                  const doneCount = item.checklist.filter((c) => c.done).length;
                  return (
                    <div
                      key={item.id}
                      className={`glass-subcard rounded-2xl p-3.5 space-y-2.5 border ${
                        item.status === 'completed'
                          ? 'border-emerald-400/35 opacity-85'
                          : 'border-white/15'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${meta.badgeCls}`}
                            >
                              {isEn ? meta.labelEn : meta.labelTh}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] bg-white/10 text-slate-200 border border-white/15">
                              {item.categoryName}
                            </span>
                            {item.type === 'checklist' && item.checklist.length > 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/15 text-emerald-200 border border-emerald-300/25">
                                {doneCount}/{item.checklist.length}
                              </span>
                            )}
                          </div>
                          <h4
                            className={`text-sm font-bold text-white ${
                              item.status === 'completed' ? 'line-through text-slate-300' : ''
                            }`}
                          >
                            {item.title}
                          </h4>
                          {item.description && (
                            <p className="text-xs text-slate-300 whitespace-pre-line">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleItemStatus(item.id)}
                            className={`crystal-tile px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer ${
                              item.status === 'completed'
                                ? 'text-emerald-200 border-emerald-300/40'
                                : 'text-slate-200 hover:text-white'
                            }`}
                          >
                            {item.status === 'completed'
                              ? isEn
                                ? 'Done'
                                : 'เสร็จแล้ว'
                              : isEn
                                ? 'Mark Done'
                                : 'ปิดงาน'}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditItem(item)}
                            className="crystal-tile p-1.5 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                            title={isEn ? 'Edit' : 'แก้ไข'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteItem(item)}
                            className="crystal-tile p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/25 border-rose-400/30 cursor-pointer"
                            title={isEn ? 'Delete' : 'ลบ'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Checklist interactive rows */}
                      {item.type === 'checklist' && (
                        <div className="space-y-1.5 pt-1">
                          {item.checklist.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => toggleChecklistEntry(item.id, entry.id)}
                              className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                            >
                              {entry.done ? (
                                <CheckSquare className="w-4 h-4 text-emerald-300 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span
                                className={`text-xs ${
                                  entry.done ? 'line-through text-slate-400' : 'text-slate-100'
                                }`}
                              >
                                {entry.text}
                              </span>
                            </button>
                          ))}
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              value={inlineSubTaskDrafts[item.id] || ''}
                              onChange={(e) =>
                                setInlineSubTaskDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addInlineChecklistEntry(item.id);
                                }
                              }}
                              placeholder={
                                isEn ? 'Add checklist step...' : 'เพิ่มข้อย่อยในเช็กลิสต์...'
                              }
                              className="glass-input flex-1 px-2.5 py-1.5 rounded-lg text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => addInlineChecklistEntry(item.id)}
                              className="crystal-tile px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-cyan-100 hover:text-white cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Script box with Copy & Speak */}
                      {item.type === 'script' && item.scriptText && (
                        <div className="rounded-xl bg-slate-950/45 border border-violet-300/25 p-3 space-y-2">
                          <p className="text-xs text-slate-100 whitespace-pre-line leading-relaxed">
                            {item.scriptText}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleCopyScript(item)}
                              className="crystal-tile px-2.5 py-1 rounded-lg text-[11px] font-medium text-cyan-100 inline-flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === item.id ? (
                                <Check className="w-3 h-3 text-emerald-300" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>
                                {copiedId === item.id
                                  ? isEn
                                    ? 'Copied'
                                    : 'คัดลอกแล้ว'
                                  : isEn
                                    ? 'Copy Script'
                                    : 'คัดลอกสคริปต์'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSpeakScript(item)}
                              className={`crystal-tile px-2.5 py-1 rounded-lg text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                                speakingId === item.id
                                  ? 'text-emerald-200 border-emerald-300/45'
                                  : 'text-violet-100'
                              }`}
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>
                                {speakingId === item.id
                                  ? isEn
                                    ? 'Stop'
                                    : 'หยุดอ่าน'
                                  : isEn
                                    ? 'Read Aloud'
                                    : 'ฟังเสียงอ่าน'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline Photo Attachment */}
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <AttachmentCell
                          evidenceId={item.attachmentEvidenceId}
                          itemTitle={item.title}
                          contextLabel="Custom Builder"
                          onAttached={(evId) =>
                            setStore((prev) => ({
                              ...prev,
                              items: prev.items.map((x) =>
                                x.id === item.id
                                  ? {
                                      ...x,
                                      attachmentEvidenceId: evId,
                                      updatedAt: new Date().toISOString()
                                    }
                                  : x
                              )
                            }))
                          }
                          onRemoved={() =>
                            setStore((prev) => ({
                              ...prev,
                              items: prev.items.map((x) =>
                                x.id === item.id
                                  ? {
                                      ...x,
                                      attachmentEvidenceId: undefined,
                                      updatedAt: new Date().toISOString()
                                    }
                                  : x
                              )
                            }))
                          }
                        />
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.updatedAt).toLocaleString('th-TH', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
