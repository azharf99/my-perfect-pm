import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderGit2,
  Save,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Users,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Project, OrganizationMember } from '../api/types';
import { usePermissions } from '../hooks/usePermissions';
import { DeleteProjectDialog } from '../components/project/DeleteProjectDialog';

const PRESET_COLORS = [
  '#2563eb', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#64748b', // Slate
];

export const ProjectSettingsPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { canEditProject, canDeleteProject } = usePermissions();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [leadId, setLeadId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProjectData();
    }
  }, [projectId]);

  const loadProjectData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [projRes, membersRes] = await Promise.all([
        apiClient.get(`/projects/${projectId}`),
        apiClient.get('/members'),
      ]);
      const p: Project = projRes.data;
      setProject(p);
      setName(p.name);
      setDescription(p.description || '');
      setColor(p.color || '#2563eb');
      setLeadId(p.lead_id || '');
      setMembers(membersRes.data || []);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to load project settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !name.trim()) return;

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiClient.put(`/projects/${project.id}`, {
        name: name.trim(),
        description: description.trim(),
        color,
        lead_id: leadId,
      });
      setProject(res.data);
      setSuccessMsg('Project settings saved successfully');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to save project settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleted = () => {
    navigate('/projects');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-slate-400 text-sm">
        Loading project settings...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl border border-slate-200 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Project Not Found</h2>
        <p className="text-sm text-slate-500">
          The requested project does not exist or you do not have permission to view it.
        </p>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
      </div>
    );
  }

  const userCanEdit = canEditProject(project);
  const userCanDelete = canDeleteProject(project);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Navigation & Header */}
      <div>
        <Link
          to={`/projects/${project.id}/board`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Kanban Board
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm"
              style={{ backgroundColor: project.color || '#2563eb' }}
            >
              {project.key}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Project Settings</h1>
              <p className="text-xs text-slate-500">
                Manage configurations, project lead, and lifecycle for {project.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!userCanEdit && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Read-only mode: Only workspace administrators or the assigned project lead can modify these settings.
          </span>
        </div>
      )}

      {/* General Settings Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-slate-600" />
          <h2 className="text-sm font-bold text-slate-800">General Information</h2>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Project Key
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={project.key}
                  disabled
                  className="w-32 px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg text-sm font-mono font-bold cursor-not-allowed"
                />
                <span className="text-[11px] text-slate-400">
                  Unique key used across all agile issues (e.g. {project.key}-1)
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Project Lead
              </label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                disabled={!userCanEdit}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user?.full_name || m.user?.email} ({m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!userCanEdit}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!userCanEdit}
              rows={4}
              placeholder="Detailed description of this project's scope, mission, and deliverables..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Color Accent
            </label>
            <div className="flex items-center gap-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={!userCanEdit}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : ''
                  } disabled:opacity-50`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {userCanEdit && (
            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={isSaving || !name.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Danger Zone */}
      {userCanDelete && (
        <div className="bg-white rounded-xl border border-red-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h2 className="text-sm font-bold">Danger Zone</h2>
            </div>
          </div>

          <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Delete this project</h3>
              <p className="text-xs text-slate-500 max-w-xl">
                Permanently deletes the project space, along with all associated issues, sprints, subtasks, and comments.
                This action is non-reversible.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="px-4 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Project</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteProjectDialog
        project={project}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onProjectDeleted={handleDeleted}
      />
    </div>
  );
};
