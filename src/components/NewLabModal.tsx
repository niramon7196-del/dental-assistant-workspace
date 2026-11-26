import React, { useState } from 'react';
import { FlaskConical, X } from 'lucide-react';
import { LabOrder, LabWorkType } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { locales, translateLabWorkType } from '../utils/i18n';

interface NewLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLab: (lab: LabOrder) => void;
}

export const NewLabModal: React.FC<NewLabModalProps> = ({ isOpen, onClose, onAddLab }) => {
  const { t, language } = useLanguage();

  const [orderReference, setOrderReference] = useState('');
  const [workType, setWorkType] = useState<LabWorkType>('Crown');
  const [laboratoryName, setLaboratoryName] = useState('');
  const [dentistName, setDentistName] = useState('');
  const [patientRefId, setPatientRefId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState(
    new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0]
  );
  const [trackingNumber, setTrackingNumber] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderReference.trim()) return;

    const cleanPatient = patientRefId.trim().toUpperCase();
    const newLab: LabOrder = {
      id: `lab-${Date.now()}`,
      orderReference: orderReference.trim(),
      workType,
      laboratoryName: laboratoryName.trim(),
      dentistName: dentistName.trim(),
      patientRefId: cleanPatient || '-',
      dateSent: new Date().toISOString().split('T')[0],
      expectedReturnDate,
      deliveryTrackingNumber: trackingNumber.trim(),
      status: 'Ordered',
      supportingFiles: cleanPatient ? [`lab_slip_${cleanPatient.toLowerCase()}.pdf`] : [],
      workHistory: [
        {
          id: `wh-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
          status: 'Ordered',
          notes: t('labOrderPlacedManually'),
          localized: {
            th: { notes: locales.th.labOrderPlacedManually },
            en: { notes: locales.en.labOrderPlacedManually }
          }
        }
      ],
      isDemo: false
    };

    onAddLab(newLab);
    setOrderReference('');
    setLaboratoryName('');
    setDentistName('');
    setPatientRefId('');
    setTrackingNumber('');
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
        className="glass-modal border border-emerald-300/30 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto my-auto"
      >
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/15">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="crystal-btn crystal-tile inline-flex items-center gap-1 px-2.5 min-h-[34px] py-1 rounded-xl border border-emerald-300/30 text-slate-100 text-xs font-semibold cursor-pointer shrink-0"
            >
              <span aria-hidden="true">↩️</span>
              <span className="hidden sm:inline">{language === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
            </button>
            <FlaskConical className="w-4 h-4 text-emerald-300 shrink-0" />
            <h3 className="text-sm font-bold text-slate-100 text-depth break-words">{t('createLabTitle')}</h3>
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
              <label className="text-slate-300 font-medium">{t('orderReferenceLabel')}</label>
              <input
                type="text"
                required
                placeholder="LAB-001"
                value={orderReference}
                onChange={(e) => setOrderReference(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('filterWorkType')}</label>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value as LabWorkType)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="Denture">{translateLabWorkType('Denture', language)}</option>
                <option value="Crown">{translateLabWorkType('Crown', language)}</option>
                <option value="Retainer">{translateLabWorkType('Retainer', language)}</option>
                <option value="Surgical Guide">{translateLabWorkType('Surgical Guide', language)}</option>
                <option value="Other">{translateLabWorkType('Other', language)}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('labNameLabel')}</label>
              <input
                type="text"
                required
                placeholder={t('labNamePlaceholder')}
                value={laboratoryName}
                onChange={(e) => setLaboratoryName(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('dentistNameLabel')}</label>
              <input
                type="text"
                required
                placeholder={t('dentistNamePlaceholder')}
                value={dentistName}
                onChange={(e) => setDentistName(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-medium">{t('patientRef')}</label>
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
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">{t('trackingNumber')}</label>
            <input
              type="text"
              placeholder={t('labTrackingPlaceholder')}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400 font-mono"
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
            className="crystal-btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-lg shadow-emerald-600/30 cursor-pointer"
          >
            {t('createLabBtn')}
          </button>
        </div>
      </form>
    </div>
  );
};
