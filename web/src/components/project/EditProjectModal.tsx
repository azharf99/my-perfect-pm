import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Save, FolderGit2, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Project, OrganizationMember } from '../../api/types';

interface EditProjectModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: (updated: Project) => void;
}

const PRESET_COLORS = [
  '#2563eb', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#64748b', // Slate
];

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  project,
  isOpen,
  onClose,
  onProjectUpdated,
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [color, setColor] = useState(project.color || '#2563eb');
  const [leadId, setLeadId] = useState(project.lead_id || '');
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(project.name);
      setDescription(project.description || '');
      setColor(project.color || '#2563eb');
      setLeadId(project.lead_id || '');
      setError(null);
      loadMembers();
    }
  }, [isOpen, project]);

  const loadMembers = async () => {
    try {
      const res = await apiClient.get('/members');
      setMembers(res.data);
    } catch (_) {}
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiClient.put(`/projects/${project.id}`, {
        name: name.trim(),
        description: description.trim(),
        color,
        lead_id: leadId,
      });

      onProjectUpdated(res.data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update project settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-800">Edit Project Details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Key (Disabled) */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Project Key (Immutable)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={project.key}
                disabled
                className="w-32 px-3 py-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-lg text-sm font-mono font-bold cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                Issue IDs depend on this key (e.g. {project.key}-101) and cannot be changed.
              </span>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this project about?"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Project Lead */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Project Lead
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user?.full_name || m.user?.email} ({m.user?.email}) - {m.role}
                </option>
              ))}
            </select>
          </div>

          {/* Theme Color */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Badge & Theme Color
            </label>
            <div className="flex items-center gap-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
