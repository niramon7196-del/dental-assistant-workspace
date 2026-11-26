import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, ImagePlus, Trash2, ZoomIn, X } from 'lucide-react';
import { EvidenceItem } from '../types/dental';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { deleteEvidenceFile, getEvidenceFile, saveEvidenceFile } from '../services/evidenceStorage';
import {
  formatFileSize,
  MAX_INBOX_FILE_BYTES,
  resolveNormalizedMimeType
} from '../services/aiService';

interface AttachmentCellProps {
  evidenceId?: string;
  itemTitle: string;
  contextLabel: string;
  relatedTaskId?: string;
  relatedLabId?: string;
  relatedPatientId?: string;
  relatedInboxId?: string;
  onAttached: (evidenceId: string, filename: string) => void;
  onRemoved?: (evidenceId?: string) => void;
  variant?: 'row' | 'card' | 'banner';
  readOnly?: boolean;
}

export const AttachmentCell: React.FC<AttachmentCellProps> = ({
  evidenceId,
  itemTitle,
  contextLabel,
  relatedTaskId,
  relatedLabId,
  relatedPatientId,
  relatedInboxId,
  onAttached,
  onRemoved,
  variant = 'row',
  readOnly = false
}) => {
  const { t, language } = useLanguage();
  const { setEvidenceList, recordAudit } = useWorkspace();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    let createdBlobUrl: string | null = null;

    if (!evidenceId) {
      setThumbUrl(null);
      return;
    }

    (async () => {
      try {
        const stored = await getEvidenceFile(evidenceId);
        if (active && stored && stored.mimeType.startsWith('image/')) {
          if (stored.dataUrl) {
            setThumbUrl(stored.dataUrl);
          } else {
            createdBlobUrl = URL.createObjectURL(stored.blob);
            setThumbUrl(createdBlobUrl);
          }
        } else if (active) {
          setThumbUrl(null);
        }
      } catch {
        if (active) setThumbUrl(null);
      }
    })();

    return () => {
      active = false;
      if (createdBlobUrl && createdBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [evidenceId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);

    if (file.size > MAX_INBOX_FILE_BYTES) {
      setErrorMsg(t('fileSizeExceeded').replace('{size}', formatFileSize(file.size)));
      return;
    }

    const mimeType = resolveNormalizedMimeType(file);
    if (!mimeType.startsWith('image/')) {
      setErrorMsg(language === 'en' ? 'Please select an image file.' : 'กรุณาเลือกไฟล์รูปภาพ');
      return;
    }

    const previousEvId = evidenceId;
    const nowTs = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const evId = `ev-att-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      await saveEvidenceFile(evId, file, file.name, mimeType, nowTs);
    } catch {
      setErrorMsg(
        language === 'en'
          ? 'Could not save photo to browser storage.'
          : 'ไม่สามารถบันทึกรูปลงพื้นที่จัดเก็บของเบราว์เซอร์ได้'
      );
      return;
    }

    // Clean up replaced inline attachment so iPad LocalStorage stays lean
    if (previousEvId && previousEvId !== evId && previousEvId.startsWith('ev-att-')) {
      await deleteEvidenceFile(previousEvId).catch(() => undefined);
    }

    const newEv: EvidenceItem = {
      id: evId,
      originalFilename: file.name,
      fileType: 'image',
      uploadDateTime: nowTs.slice(0, 16),
      receivedTimestamp: nowTs,
      relatedTaskId,
      relatedLabId,
      relatedPatientId,
      relatedInboxId,
      description: `${contextLabel}: ${itemTitle}`,
      fileSize: formatFileSize(file.size),
      mimeType,
      hasStoredFile: true,
      isDemo: false
    };

    setEvidenceList((prev) => [
      newEv,
      ...prev.filter(
        (item) => !(previousEvId && previousEvId.startsWith('ev-att-') && item.id === previousEvId)
      )
    ]);
    onAttached(evId, file.name);
    recordAudit('task_update', `Photo attached: ${itemTitle} (${file.name})`);
  };

  const handleRemovePhoto = async () => {
    setErrorMsg(null);
    const targetId = evidenceId;
    setIsLightboxOpen(false);
    setThumbUrl(null);

    if (targetId) {
      await deleteEvidenceFile(targetId).catch(() => undefined);
      if (targetId.startsWith('ev-att-') || targetId.startsWith('ev-row-')) {
        setEvidenceList((prev) => prev.filter((item) => item.id !== targetId));
      }
    }

    onRemoved?.(targetId);
    recordAudit('task_update', `Photo removed: ${itemTitle}`);
  };

  const lightboxModal =
    isLightboxOpen && thumbUrl
      ? createPortal(
          <div
            onClick={() => setIsLightboxOpen(false)}
            className="fixed inset-0 z-[105] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-modal rounded-2xl max-w-2xl w-full p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/15">
                <p className="text-xs font-semibold text-slate-100 truncate">{itemTitle}</p>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="crystal-tile px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-violet-100 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>{t('changePhotoShort')}</span>
                    </button>
                  )}
                  {!readOnly && onRemoved && (
                    <button
                      type="button"
                      onClick={() => void handleRemovePhoto()}
                      className="crystal-tile px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-rose-200 hover:bg-rose-500/25 border-rose-400/35 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('deletePhotoShort')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(false)}
                    className="crystal-tile p-1.5 rounded-lg text-slate-200 hover:text-white cursor-pointer"
                    aria-label={t('close')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="glass-subcard rounded-xl p-2 flex items-center justify-center max-h-[72vh] overflow-hidden">
                <img
                  src={thumbUrl}
                  alt={itemTitle}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[68vh] object-contain rounded-lg"
                />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  if (variant === 'banner') {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => void handleFileChange(e)}
          className="hidden"
        />
        {thumbUrl ? (
          <div className="relative group w-full h-36 rounded-xl overflow-hidden border border-white/20 glass-subcard">
            <img
              src={thumbUrl}
              alt={itemTitle}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setIsLightboxOpen(true)}
            />
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent flex items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                className="crystal-tile px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{t('zoneZoomPhotoHint')}</span>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="crystal-tile px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-violet-100 inline-flex items-center gap-1 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{t('changePhotoShort')}</span>
                </button>
              )}
              {!readOnly && onRemoved && (
                <button
                  type="button"
                  onClick={() => void handleRemovePhoto()}
                  className="crystal-tile px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-rose-200 hover:bg-rose-500/30 border-rose-400/35 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('deletePhotoShort')}</span>
                </button>
              )}
            </div>
          </div>
        ) : !readOnly ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="glass-subcard w-full py-2.5 px-3 rounded-xl border border-dashed border-white/20 hover:border-violet-300/45 text-[11px] text-slate-300 hover:text-white inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5 text-violet-300" />
            <span>{t('zoneAddPhotoBtn')}</span>
          </button>
        ) : null}
        {errorMsg && <p className="text-[10px] text-rose-300 mt-1">{errorMsg}</p>}
        {lightboxModal}
      </>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => void handleFileChange(e)}
        className="hidden"
      />
      {thumbUrl ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsLightboxOpen(true);
          }}
          title={t('zoneZoomPhotoHint')}
          className="relative group w-10 h-10 rounded-xl overflow-hidden border border-violet-300/45 glass-subcard cursor-pointer shrink-0 block"
        >
          <img
            src={thumbUrl}
            alt={itemTitle}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <span className="absolute inset-0 bg-slate-950/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <ZoomIn className="w-3.5 h-3.5 text-white" />
          </span>
        </button>
      ) : (
        <div
          className={`${
            variant === 'card' ? 'w-9 h-9' : 'w-10 h-10'
          } rounded-xl crystal-tile flex items-center justify-center text-slate-300/70 shrink-0`}
        >
          <ImageIcon className="w-4 h-4" />
        </div>
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/35 border border-violet-300/35 text-violet-100 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
        >
          <ImagePlus className="w-3 h-3" />
          <span>{thumbUrl ? t('changePhotoShort') : t('attachPhotoShort')}</span>
        </button>
      )}
      {thumbUrl && !readOnly && onRemoved && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleRemovePhoto();
          }}
          title={t('deletePhotoShort')}
          aria-label={t('deletePhotoShort')}
          className="crystal-tile p-1 rounded-lg text-rose-300 hover:bg-rose-500/25 border border-rose-400/30 transition-colors cursor-pointer shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
      {errorMsg && <span className="text-[10px] text-rose-300">{errorMsg}</span>}
      {lightboxModal}
    </div>
  );
};
