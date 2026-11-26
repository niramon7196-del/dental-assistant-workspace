import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  ChevronDown,
  Lock,
  Plus,
  KeyRound,
  Check,
  ShieldCheck,
  X,
  User,
  Users,
  Copy,
  Pencil,
  Trash2
} from 'lucide-react';
import {
  getWorkspaceDisplayDescription,
  getWorkspaceDisplayName,
  useWorkspace
} from '../contexts/WorkspaceContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ClinicRole } from '../types/platform';
import { CLINIC_ROLES_ORDER } from '../utils/permissions';
import {
  CLINIC_WORKSPACE_ID,
  PERSONAL_WORKSPACE_ID
} from '../services/workspaceStorage';

interface WorkspaceSwitcherProps {
  onWorkspaceSwitched?: () => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ onWorkspaceSwitched }) => {
  const { t, language } = useLanguage();
  const {
    workspaces,
    activeWorkspace,
    currentRole,
    switchWorkspace,
    createClinicWorkspace,
    joinClinicWorkspace,
    updateWorkspaceMeta,
    deleteWorkspace,
    setCollaborationMode
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'join' | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [clinicDesc, setClinicDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinRole, setJoinRole] = useState<ClinicRole>('assistant');
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [editingWs, setEditingWs] = useState<{ id: string; name: string; description: string } | null>(null);
  const [confirmDeleteWsId, setConfirmDeleteWsId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const roleLabel = (role: ClinicRole): string => {
    const map: Record<ClinicRole, string> = {
      owner: t('roleOwner'),
      administrator: t('roleAdministrator'),
      manager: t('roleManager'),
      assistant: t('roleAssistant')
    };
    return map[role];
  };

  const personalSpaces = workspaces.filter((w) => w.type === 'personal');
  const clinicSpaces = workspaces.filter((w) => w.type === 'clinic');
  const primaryPersonal = personalSpaces[0];
  const primaryClinic =
    clinicSpaces.find((w) => w.id === activeWorkspace.id) ||
    clinicSpaces.find((w) => w.id === CLINIC_WORKSPACE_ID) ||
    clinicSpaces[0];

  const isPersonal = activeWorkspace.type === 'personal';
  const collabMode = activeWorkspace.collaborationMode || 'team';

  const handleSelectWorkspace = (id: string) => {
    switchWorkspace(id);
    setIsOpen(false);
    onWorkspaceSwitched?.();
  };

  const handleQuickPersonal = () => {
    const targetId = primaryPersonal?.id || PERSONAL_WORKSPACE_ID;
    if (activeWorkspace.id !== targetId) {
      switchWorkspace(targetId);
      onWorkspaceSwitched?.();
    }
  };

  const handleQuickAssistant = () => {
    const targetId = primaryClinic?.id || CLINIC_WORKSPACE_ID;
    if (activeWorkspace.type !== 'clinic') {
      switchWorkspace(targetId);
      onWorkspaceSwitched?.();
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  const handleCopyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(activeWorkspace.tenantCode);
    } catch {
      // Clipboard optional
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const res = createClinicWorkspace({ name: clinicName, description: clinicDesc });
    if (!res.ok) {
      setFormError(res.error || 'Failed to create assistant workspace');
      return;
    }
    setClinicName('');
    setClinicDesc('');
    setModalMode(null);
    setIsOpen(false);
    onWorkspaceSwitched?.();
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const res = joinClinicWorkspace(inviteCode, joinRole);
    if (!res.ok) {
      setFormError(res.error || 'Invalid invite code');
      return;
    }
    setInviteCode('');
    setModalMode(null);
    setIsOpen(false);
    onWorkspaceSwitched?.();
  };

  const handleSaveWorkspaceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWs || !editingWs.name.trim()) return;
    updateWorkspaceMeta(editingWs.id, {
      name: editingWs.name,
      description: editingWs.description
    });
    setEditingWs(null);
  };

  return (
    <div className="relative flex items-center gap-1.5 min-w-0 shrink" ref={dropdownRef}>
      {/* 1-Click Dual-Workspace Segmented Toggle */}
      <div
        className={`flex items-center p-1 rounded-xl border min-w-0 crystal-tile ${
          isPersonal
            ? 'border-violet-300/35'
            : 'border-white/20'
        }`}
      >
        <button
          type="button"
          onClick={handleQuickPersonal}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
            isPersonal
              ? 'bg-violet-300/25 text-violet-100 border border-violet-300/45 shadow-sm'
              : 'text-slate-300 hover:text-violet-200 border border-transparent'
          }`}
          title={t('personalSpaceLabel')}
        >
          <Lock className="w-3.5 h-3.5 text-violet-300 shrink-0" />
          <span className="truncate max-w-[92px] sm:max-w-[120px]">{t('dualPersonalBtn')}</span>
        </button>

        <button
          type="button"
          onClick={handleQuickAssistant}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-w-0 ${
            !isPersonal
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/25 border border-violet-400/40'
              : 'text-slate-300 hover:text-slate-100 border border-transparent'
          }`}
          title={t('clinicSpaceLabel')}
        >
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate max-w-[100px] sm:max-w-[130px]">{t('dualAssistantBtn')}</span>
          {!isPersonal && (
            <span className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/25 text-[10px] font-medium text-violet-100 shrink-0">
              {collabMode === 'solo' ? 'Solo' : 'Team'}
            </span>
          )}
        </button>
      </div>

      {/* Team Sync / Workspace Options Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1 px-2 py-2 rounded-xl border crystal-tile text-xs transition-colors cursor-pointer shrink-0 ${
          isPersonal
            ? 'border-violet-300/30 text-violet-200 hover:bg-violet-400/20'
            : 'border-white/20 text-slate-200 hover:text-white hover:bg-white/15'
        }`}
        title={t('workspaceSwitcherLabel')}
        aria-label={t('workspaceSwitcherLabel')}
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 top-full w-[calc(100vw-2rem)] sm:w-96 max-w-sm glass-dropdown rounded-2xl shadow-2xl shadow-black/60 p-3.5 z-[60] space-y-3">
          <div className="flex items-center justify-between px-1 pb-2 border-b border-white/15">
            <span className="text-[11px] font-semibold text-slate-100">
              {t('switchWorkspaceTitle')}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[10px] text-emerald-200 shrink-0">
              <ShieldCheck className="w-3 h-3" />
              {t('tenantIsolationBadge')}
            </span>
          </div>

          {/* Solo vs Team Sync Switch when in Assistant Workspace */}
          {!isPersonal && (
            <div className="p-2.5 rounded-xl glass-subcard space-y-2">
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setCollaborationMode('solo')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold border cursor-pointer transition-colors ${
                    collabMode === 'solo'
                      ? 'bg-violet-600/30 border-violet-300/50 text-violet-100'
                      : 'glass-subcard text-slate-300 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{t('soloModeLabel')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCollaborationMode('team')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold border cursor-pointer transition-colors ${
                    collabMode === 'team'
                      ? 'bg-emerald-600/30 border-emerald-400/50 text-emerald-100'
                      : 'glass-subcard text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{t('teamSyncModeLabel')}</span>
                </button>
              </div>

              {collabMode === 'team' && (
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/15 text-[11px]">
                  <div className="min-w-0">
                    <span className="text-slate-300 block text-[10px]">
                      {t('inviteTeamCodeLabel')}
                    </span>
                    <span className="font-mono font-bold text-emerald-300">
                      {activeWorkspace.tenantCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyInviteCode()}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg crystal-tile hover:bg-white/15 text-slate-100 text-[10px] font-semibold cursor-pointer shrink-0"
                  >
                    {copiedCode ? (
                      <Check className="w-3 h-3 text-emerald-300" />
                    ) : (
                      <Copy className="w-3 h-3 text-violet-300" />
                    )}
                    <span>{copiedCode ? t('copiedInviteCodeMsg') : t('copyInviteCodeBtn')}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Personal Group */}
          <div className="space-y-1">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
              {t('personalSpacesGroup')}
            </p>
            {personalSpaces.map((ws) => {
              const selected = ws.id === activeWorkspace.id;
              const isConfirmDel = confirmDeleteWsId === ws.id;
              return (
                <div
                  key={ws.id}
                  className={`w-full flex items-start justify-between gap-2 px-3 py-2 rounded-xl transition-colors border ${
                    selected
                      ? 'bg-violet-400/25 border-violet-300/50 text-violet-50'
                      : 'glass-subcard text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectWorkspace(ws.id)}
                    className="flex-1 flex items-start gap-2.5 min-w-0 text-left cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {getWorkspaceDisplayName(ws, language)}
                      </p>
                      <p className="text-[10px] text-slate-300 line-clamp-1">
                        {getWorkspaceDisplayDescription(ws, language)}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {selected && <Check className="w-3.5 h-3.5 text-violet-300 mr-0.5" />}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingWs({
                          id: ws.id,
                          name: getWorkspaceDisplayName(ws, language),
                          description: getWorkspaceDisplayDescription(ws, language)
                        });
                      }}
                      className="p-1 rounded-lg crystal-tile text-slate-300 hover:text-white cursor-pointer"
                      title={t('editWorkspaceTitle')}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {workspaces.length > 1 && (
                      isConfirmDel ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteWorkspace(ws.id);
                            setConfirmDeleteWsId(null);
                          }}
                          className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-semibold cursor-pointer"
                        >
                          {t('confirmDeleteWorkspaceBtn')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteWsId(ws.id);
                          }}
                          className="p-1 rounded-lg crystal-tile text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                          title={t('deleteWorkspaceBtn')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Assistant Workspaces Group */}
          <div className="space-y-1">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
              {t('clinicSpacesGroup')}
            </p>
            <div className="max-h-44 overflow-y-auto space-y-1.5">
              {clinicSpaces.map((ws) => {
                const selected = ws.id === activeWorkspace.id;
                const isConfirmDel = confirmDeleteWsId === ws.id;
                return (
                  <div
                    key={ws.id}
                    className={`w-full flex items-start justify-between gap-2 px-3 py-2 rounded-xl transition-colors border ${
                      selected
                        ? 'bg-indigo-500/25 border-indigo-300/50 text-slate-100'
                        : 'glass-subcard text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectWorkspace(ws.id)}
                      className="flex-1 flex items-start gap-2.5 min-w-0 text-left cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold truncate">
                            {getWorkspaceDisplayName(ws, language)}
                          </p>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded crystal-tile text-slate-200 shrink-0">
                            {ws.tenantCode}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 truncate">
                          {t('activeRoleLabel')}: {roleLabel(ws.currentUserRole)}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {selected && <Check className="w-3.5 h-3.5 text-emerald-300 mr-0.5" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingWs({
                            id: ws.id,
                            name: getWorkspaceDisplayName(ws, language),
                            description: getWorkspaceDisplayDescription(ws, language)
                          });
                        }}
                        className="p-1 rounded-lg crystal-tile text-slate-300 hover:text-white cursor-pointer"
                        title={t('editWorkspaceTitle')}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      {workspaces.length > 1 && (
                        isConfirmDel ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteWorkspace(ws.id);
                              setConfirmDeleteWsId(null);
                            }}
                            className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-semibold cursor-pointer"
                          >
                            {t('confirmDeleteWorkspaceBtn')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteWsId(ws.id);
                            }}
                            className="p-1 rounded-lg crystal-tile text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                            title={t('deleteWorkspaceBtn')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions: Create or Join */}
          <div className="pt-2 border-t border-white/15 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setModalMode('create');
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/25 hover:bg-violet-600/35 border border-violet-400/35 text-violet-100 text-[11px] font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="truncate">{t('createNewClinicBtn')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setModalMode('join');
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-100 text-[11px] font-medium cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-300" />
              <span className="truncate">{t('joinClinicBtn')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Create / Join Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="glass-modal rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/15">
              <div className="flex items-center gap-2">
                {modalMode === 'create' ? (
                  <Building2 className="w-4 h-4 text-violet-300" />
                ) : (
                  <KeyRound className="w-4 h-4 text-emerald-300" />
                )}
                <h3 className="text-sm font-bold text-slate-100 text-depth">
                  {modalMode === 'create' ? t('createNewClinicBtn') : t('joinClinicBtn')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1.5 rounded-lg crystal-tile hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-xs text-rose-200">
                {formError}
              </div>
            )}

            {modalMode === 'create' ? (
              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('clinicNameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder={t('clinicNamePlaceholder')}
                    className="w-full glass-input rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('clinicDescLabel')}</label>
                  <textarea
                    rows={2}
                    value={clinicDesc}
                    onChange={(e) => setClinicDesc(e.target.value)}
                    placeholder={t('clinicDescPlaceholder')}
                    className="w-full glass-input rounded-xl p-3 text-slate-100 placeholder:text-slate-400"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-200 hover:text-white font-medium cursor-pointer"
                  >
                    {t('cancelBtn')}
                  </button>
                  <button
                    type="submit"
                    className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium cursor-pointer"
                  >
                    {t('createNewClinicBtn')}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleJoinSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('inviteCodeLabel')}</label>
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder={t('inviteCodePlaceholder')}
                    className="w-full glass-input rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-400 font-mono uppercase"
                  />
                  <p className="text-[11px] text-slate-300">{t('demoInviteHint')}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-200 font-medium">{t('joinRoleLabel')}</label>
                  <select
                    value={joinRole}
                    onChange={(e) => setJoinRole(e.target.value as ClinicRole)}
                    className="w-full glass-input rounded-xl px-3 py-2.5 text-slate-100"
                  >
                    {CLINIC_ROLES_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-200 hover:text-white font-medium cursor-pointer"
                  >
                    {t('cancelBtn')}
                  </button>
                  <button
                    type="submit"
                    className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium cursor-pointer"
                  >
                    {t('joinClinicBtn')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Edit Workspace Modal */}
      {editingWs && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[85] flex items-center justify-center p-4">
          <div className="glass-modal rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/15">
              <h3 className="text-sm font-bold text-slate-100 text-depth">
                {t('editWorkspaceTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setEditingWs(null)}
                className="p-1.5 rounded-lg crystal-tile hover:bg-white/15 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveWorkspaceEdit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-200 font-medium">{t('clinicNameLabel')}</label>
                <input
                  type="text"
                  required
                  value={editingWs.name}
                  onChange={(e) => setEditingWs({ ...editingWs, name: e.target.value })}
                  className="w-full glass-input rounded-xl px-3.5 py-2.5 text-slate-100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-slate-200 font-medium">{t('clinicDescLabel')}</label>
                <textarea
                  rows={2}
                  value={editingWs.description}
                  onChange={(e) => setEditingWs({ ...editingWs, description: e.target.value })}
                  className="w-full glass-input rounded-xl p-3 text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingWs(null)}
                  className="px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 text-slate-200 hover:text-white font-medium cursor-pointer"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="crystal-btn px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium cursor-pointer"
                >
                  {t('saveChangesBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
