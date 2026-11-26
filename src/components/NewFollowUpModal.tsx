import React, { useEffect, useState } from 'react';
import { Users, X } from 'lucide-react';
import { PatientFollowUpItem } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';

interface NewFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFollowUp: (fu: PatientFollowUpItem) => void;
}

export const NewFollowUpModal: React.FC<NewFollowUpModalProps> = ({ isOpen, onClose, onAddFollowUp }) => {
  const { t, language } = useLanguage();

  const [patientRefId, setPatientRefId] = useState('');
  const [caseCategory, setCaseCategory] = useState(() => t('followUpDefaultCategory'));
  const [followUpReason, setFollowUpReason] = useState(() => t('followUpDefaultReason'));
  const [nextAction, setNextAction] = useState(() => t('followUpDefaultNextAction'));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen) {
      setCaseCategory(t('followUpDefaultCategory'));
      setFollowUpReason(t('followUpDefaultReason'));
      setNextAction(t('followUpDefaultNextAction'));
    }
  }, [isOpen, language, t]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientRefId.trim()) return;

    const newFu: PatientFollowUpItem = {
      id: `fu-${Date.now()}`,
      patientRefId: patientRefId.trim().toUpperCase(),
      caseCategory,
      followUpReason,
      nextAction,
      dueDate,
      status: 'Pending',
      relatedEvidenceIds: [],
      isDemo: false
    };

    onAddFollowUp(newFu);
    setPatientRefId('');
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[95] flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="glass-modal border border-amber-300/30 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto my-auto"
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/15">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="crystal-btn crystal-tile inline-flex items-center gap-1 px-2.5 min-h-[34px] py-1 rounded-xl border border-amber-300/30 text-slate-100 text-xs font-semibold cursor-pointer shrink-0"
            >
              <span aria-hidden="true">↩️</span>
              <span className="hidden sm:inline">{language === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
            </button>
            <Users className="w-4 h-4 text-amber-300 shrink-0" />
            <h3 className="text-sm font-bold text-slate-100 text-depth break-words">{t('addFollowUpTitle')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-200 hover:text-white p-1.5 rounded-lg crystal-tile hover:bg-white/15 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('patientRef')} *</label>
              <input
                type="text"
                required
                placeholder={t('patientRefPlaceholder')}
                value={patientRefId}
                onChange={(e) => setPatientRefId(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400 font-mono"
              />
            </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">{t('dueDateLabel')}</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-slate-300 font-medium">{t('category')}</label>
          <input
            type="text"
            required
            placeholder={t('followUpCategoryPlaceholder')}
            value={caseCategory}
              onChange={(e) => setCaseCategory(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">{t('followUpReason')}</label>
            <textarea
              rows={2}
              required
              value={followUpReason}
              onChange={(e) => setFollowUpReason(e.target.value)}
              className="w-full glass-input rounded-xl p-3 text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">{t('nextAction')}</label>
            <input
              type="text"
              required
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-200 hover:text-white text-xs font-medium cursor-pointer"
          >
            {t('cancelBtn')}
          </button>
          <button
            type="submit"
            className="crystal-btn bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold px-5 py-2 rounded-xl shadow-lg shadow-amber-500/25 cursor-pointer"
          >
            {t('createFollowUpBtn')}
          </button>
        </div>
      </form>
    </div>
  );
};
