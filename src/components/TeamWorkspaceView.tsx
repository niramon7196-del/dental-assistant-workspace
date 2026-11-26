import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  ShieldCheck,
  Clock,
  Plus,
  DoorOpen,
  Download,
  Check,
  X,
  Server,
  Pencil,
  Trash2
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  ALL_PERMISSION_ACTIONS,
  CLINIC_ROLES_ORDER,
  canPerform
} from '../utils/permissions';
import { ClinicRole, WorkspaceMember } from '../types/platform';
import { formatDateByLanguage } from '../utils/i18n';

export const TeamWorkspaceView: React.FC = () => {
  const { t, language } = useLanguage();
  const {
    activeWorkspace,
    currentRole,
    setCurrentUserRole,
    hasPermission,
    addClinicMember,
    updateClinicMemberRole,
    updateClinicMember,
    deleteClinicMember,
    addClinicRoom,
    updateClinicRoom,
    deleteClinicRoom,
    auditLogs,
    clearAuditLogs,
    exportActiveWorkspaceBackup
  } = useWorkspace();

  const [subTab, setSubTab] = useState<'members' | 'roles' | 'audit'>('members');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<ClinicRole>('assistant');
  const [newRoom, setNewRoom] = useState('');
  const [backupMsg, setBackupMsg] = useState(false);

  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [confirmDeleteMemberId, setConfirmDeleteMemberId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState<string | null>(null);
  const [draftRoomName, setDraftRoomName] = useState('');
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<string | null>(null);
  const [confirmClearAudit, setConfirmClearAudit] = useState(false);

  const canManageMembers = hasPermission('manage_members');
  const canManageSettings = hasPermission('manage_settings');
  const canViewAudit = hasPermission('view_audit_logs');

  const roleLabel = (role: ClinicRole): string => {
    const map: Record<ClinicRole, string> = {
      owner: t('roleOwner'),
      administrator: t('roleAdministrator'),
      manager: t('roleManager'),
      assistant: t('roleAssistant')
    };
    return map[role];
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    const ok = addClinicMember({
      name: newName,
      email: newEmail,
      role: newRole,
      assignedRooms: activeWorkspace.rooms.slice(0, 1)
    });
    if (ok) {
      setNewName('');
      setNewEmail('');
    }
  };

  const handleAddRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.trim()) return;
    if (addClinicRoom(newRoom)) {
      setNewRoom('');
    }
  };

  const handleDownloadBackup = () => {
    const json = exportActiveWorkspaceBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-backup-${activeWorkspace.tenantCode.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMsg(true);
    setTimeout(() => setBackupMsg(false), 3500);
  };

  const handleSaveEditMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editingMember.name.trim() || !editingMember.email.trim()) return;
    updateClinicMember(editingMember.id, {
      name: editingMember.name,
      email: editingMember.email,
      role: editingMember.role,
      assignedRooms: editingMember.assignedRooms
    });
    setEditingMember(null);
  };

  const handleSaveRoomRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoomName || !draftRoomName.trim()) return;
    const ok = updateClinicRoom(editingRoomName, draftRoomName);
    if (ok || draftRoomName.trim() === editingRoomName) {
      setEditingRoomName(null);
      setDraftRoomName('');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Compact Toolbar: Sub-tabs + Role Simulator */}
      <div className="crystal-tile rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {activeWorkspace.type === 'clinic' && (
            <div className="flex items-center gap-2 glass-subcard px-3 py-1.5 rounded-xl text-xs">
              <span className="text-slate-300">{t('roleSimulatorLabel')}</span>
              <select
                value={currentRole}
                onChange={(e) => setCurrentUserRole(e.target.value as ClinicRole)}
                className="glass-input rounded-lg px-2 py-1 text-violet-200 font-semibold text-xs"
              >
                {CLINIC_ROLES_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 glass-subcard p-1 rounded-xl text-xs">
          <button
              type="button"
              onClick={() => setSubTab('members')}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer ${
                subTab === 'members' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('teamSubmenuMembers')}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('roles')}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer ${
                subTab === 'roles' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('teamSubmenuRoles')}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('audit')}
              className={`px-3 py-1.5 rounded-lg font-medium cursor-pointer ${
                subTab === 'audit' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('teamSubmenuAudit')}
            </button>
        </div>
      </div>

      {subTab === 'members' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Clinic Members List */}
          <div className="lg:col-span-2 neon-glass rounded-2xl p-6 shadow-xl space-y-5">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              <span>{t('teamMembersTitle')}</span>
            </h3>

            {canManageMembers && activeWorkspace.type === 'clinic' && (
              <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('memberNamePlaceholder')}
                  className="glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
                />
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={t('memberEmailPlaceholder')}
                  className="glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as ClinicRole)}
                  className="glass-input rounded-xl px-3 py-2 text-slate-100"
                >
                  {CLINIC_ROLES_ORDER.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="crystal-btn flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium px-3 py-2 rounded-xl cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('addMemberBtn')}</span>
                </button>
              </form>
            )}

            <div className="space-y-2.5">
              {activeWorkspace.members.map((m) => {
                const isConfirmDel = confirmDeleteMemberId === m.id;
                return (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl glass-subcard"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-violet-500/25 border border-violet-300/40 flex items-center justify-center text-xs font-bold text-violet-200 shrink-0">
                        {m.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">{m.name}</p>
                        <p className="text-[11px] text-slate-300 truncate">
                          {m.email} • {m.assignedRooms.join(', ') || t('noRoomLabel')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {canManageMembers && activeWorkspace.type === 'clinic' ? (
                        <>
                          <select
                            value={m.role}
                            onChange={(e) => updateClinicMemberRole(m.id, e.target.value as ClinicRole)}
                            className="glass-input rounded-lg px-2.5 py-1 text-[11px] text-slate-100"
                          >
                            {CLINIC_ROLES_ORDER.map((r) => (
                              <option key={r} value={r}>
                                {roleLabel(r)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setEditingMember({ ...m })}
                            className="p-1.5 rounded-lg crystal-tile text-slate-200 hover:text-white cursor-pointer"
                            title={t('editBtn')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {activeWorkspace.members.length > 1 && (
                            isConfirmDel ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteClinicMember(m.id);
                                    setConfirmDeleteMemberId(null);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold cursor-pointer"
                                >
                                  {t('confirmDeleteBtn')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMemberId(null)}
                                  className="p-1 rounded-lg crystal-tile text-slate-300 hover:text-white cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteMemberId(m.id)}
                                className="p-1.5 rounded-lg crystal-tile text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                                title={t('deleteBtn')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg crystal-tile text-[11px] text-slate-200 font-medium">
                          {roleLabel(m.role)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clinical Rooms */}
          <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-emerald-400" />
              <span>{t('clinicalRoomsTitle')}</span>
            </h3>

            {canManageSettings && activeWorkspace.type === 'clinic' && (
              <form onSubmit={handleAddRoom} className="flex gap-2 text-xs">
                <input
                  type="text"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  placeholder={t('addRoomPlaceholder')}
                  className="flex-1 glass-input rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="crystal-btn px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium cursor-pointer"
                >
                  {t('addRoomBtn')}
                </button>
              </form>
            )}

            <div className="space-y-2">
              {activeWorkspace.rooms.map((room) => {
                const isEditingThis = editingRoomName === room;
                const isConfirmDel = confirmDeleteRoom === room;
                return (
                  <div
                    key={room}
                    className="px-3.5 py-2.5 rounded-xl glass-subcard text-xs text-slate-100 font-medium flex items-center justify-between gap-2"
                  >
                    {isEditingThis ? (
                      <form onSubmit={handleSaveRoomRename} className="flex-1 flex items-center gap-1.5">
                        <input
                          type="text"
                          required
                          value={draftRoomName}
                          onChange={(e) => setDraftRoomName(e.target.value)}
                          className="flex-1 glass-input rounded-lg px-2.5 py-1 text-xs text-slate-100"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          {t('saveChangesBtn')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRoomName(null);
                            setDraftRoomName('');
                          }}
                          className="p-1 rounded-lg crystal-tile text-slate-300 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="truncate">{room}</span>
                        {canManageSettings && activeWorkspace.type === 'clinic' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRoomName(room);
                                setDraftRoomName(room);
                              }}
                              className="p-1 rounded-lg crystal-tile text-slate-200 hover:text-white cursor-pointer"
                              title={t('editRoomTitle')}
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            {isConfirmDel ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteClinicRoom(room);
                                    setConfirmDeleteRoom(null);
                                  }}
                                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold cursor-pointer"
                                >
                                  {t('confirmDeleteBtn')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteRoom(null)}
                                  className="p-0.5 rounded crystal-tile text-slate-300 hover:text-white cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteRoom(room)}
                                className="p-1 rounded-lg crystal-tile text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                                title={t('deleteBtn')}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === 'roles' && (
        <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-4 overflow-x-auto">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{t('rbacMatrixTitle')}</span>
          </h3>

          <table className="w-full text-left text-xs text-slate-200">
            <thead className="glass-table-head border-b border-white/15 text-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">{t('modulePermissionReqLabel')}</th>
                {CLINIC_ROLES_ORDER.map((r) => (
                  <th key={r} className="py-3 px-4 text-center">
                    <span className={r === currentRole ? 'text-violet-300 font-bold' : ''}>
                      {roleLabel(r)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {ALL_PERMISSION_ACTIONS.map((perm) => (
                <tr key={perm} className="hover:bg-white/5">
                  <td className="py-3 px-4 font-medium text-slate-100">{t(`perm_${perm}`)}</td>
                  {CLINIC_ROLES_ORDER.map((r) => {
                    const allowed = canPerform(r, perm, 'clinic');
                    return (
                      <td key={r} className="py-3 px-4 text-center">
                        {allowed ? (
                          <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-slate-500 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'audit' && (
        <div className="space-y-6">
          <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>{t('auditLogsTitle')}</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2 self-start">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl crystal-tile hover:bg-white/15 text-xs font-medium text-slate-100 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{t('exportBackupBtn')}</span>
                </button>
                {auditLogs.length > 0 && canViewAudit && (
                  confirmClearAudit ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          clearAuditLogs();
                          setConfirmClearAudit(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('confirmClearAllBtn')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAudit(false)}
                        className="crystal-tile px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-white cursor-pointer"
                      >
                        {t('cancelBtn')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAudit(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl crystal-tile text-rose-200 hover:bg-rose-500/20 border-rose-400/30 text-xs font-medium cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('clearAuditLogsBtn')}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {backupMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-200">
                {t('backupDownloadedMsg')}
              </div>
            )}

            {!canViewAudit ? (
              <p className="text-xs text-amber-300">{t('moduleAccessDeniedNotice')}</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-xs text-slate-300">{t('noAuditLogsYet')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl glass-subcard flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-500/20 text-violet-200 border border-violet-400/30">
                          {log.actionType}
                        </span>
                        <span className="font-medium text-slate-100">{log.summary}</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {log.actorName} ({roleLabel(log.actorRole)})
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-300 shrink-0">
                      {formatDateByLanguage(log.timestamp, language)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Honest Multi-Clinic Architecture & Readiness Card */}
          <div className="neon-glass rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-2.5">
              <Server className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-100">{t('archReadinessTitle')}</h3>
                <p className="text-xs text-slate-300 mt-0.5">{t('archReadinessSubtitle')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-400/35 space-y-1.5">
                <span className="font-semibold text-emerald-300 block">{t('archLiveLayerTitle')}</span>
                <p className="text-[11px] text-slate-200 leading-relaxed">{t('archLiveLayerDesc')}</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-400/35 space-y-1.5">
                <span className="font-semibold text-amber-300 block">{t('archNextBackendTitle')}</span>
                <p className="text-[11px] text-slate-200 leading-relaxed">{t('archNextBackendDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingMember &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[80] flex items-center justify-center p-4">
            <div className="glass-modal rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/15">
                <h3 className="text-sm font-bold text-slate-100">{t('editMemberTitle')}</h3>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="p-1.5 rounded-lg crystal-tile text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveEditMember} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    {t('memberNamePlaceholder')}
                  </label>
                  <input
                    type="text"
                    required
                    value={editingMember.name}
                    onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    {t('memberEmailPlaceholder')}
                  </label>
                  <input
                    type="email"
                    required
                    value={editingMember.email}
                    onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    {t('activeRoleLabel')}
                  </label>
                  <select
                    value={editingMember.role}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, role: e.target.value as ClinicRole })
                    }
                    className="w-full glass-input rounded-xl px-3 py-2 text-slate-100"
                  >
                    {CLINIC_ROLES_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                {activeWorkspace.rooms.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] text-slate-300">
                      {t('clinicalRoomsTitle')}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {activeWorkspace.rooms.map((rm) => {
                        const checked = editingMember.assignedRooms.includes(rm);
                        return (
                          <label
                            key={rm}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer ${
                              checked
                                ? 'bg-violet-600/30 border-violet-300/50 text-violet-100'
                                : 'glass-subcard text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setEditingMember({
                                  ...editingMember,
                                  assignedRooms: checked
                                    ? editingMember.assignedRooms.filter((r) => r !== rm)
                                    : [...editingMember.assignedRooms, rm]
                                })
                              }
                              className="sr-only"
                            />
                            <span>{rm}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-4 py-2 rounded-xl crystal-tile text-slate-200 hover:text-white cursor-pointer"
                  >
                    {t('cancelBtn')}
                  </button>
                  <button
                    type="submit"
                    className="crystal-btn px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold cursor-pointer"
                  >
                    {t('saveChangesBtn')}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
