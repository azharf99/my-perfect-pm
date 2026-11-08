import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Project } from '../../api/types';

interface DeleteProjectDialogProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onProjectDeleted: (projectId: string) => void;
}

export const DeleteProjectDialog: React.FC<DeleteProjectDialogProps> = ({
  project,
  isOpen,
  onClose,
  onProjectDeleted,
}) => {
  const [confirmKey, setConfirmKey] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isMatched = confirmKey.trim() === project.key;

  const handleDelete = async () => {
    if (!isMatched) return;

    setIsDeleting(true);
    setError(null);

    try {
      await apiClient.delete(`/projects/${project.id}`, {
        data: { confirm_key: confirmKey.trim() },
      });

      onProjectDeleted(project.id);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-red-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 className="text-base font-bold">Delete Project</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            Are you sure you want to delete <span className="font-bold text-slate-900">{project.name}</span>?
          </p>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
            <p className="font-semibold">⚠️ Irreversible Action & Cascading Deletion:</p>
            <p>
              This will permanently remove the project and cascadingly delete all of its sprints, issues, subtasks, and comments.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Type <span className="font-mono font-bold text-red-600 select-all">{project.key}</span> to confirm:
            </label>
            <input
              type="text"
              value={confirmKey}
              onChange={(e) => setConfirmKey(e.target.value)}
              placeholder={`Enter "${project.key}"`}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-red-100 border border-red-300 rounded text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isMatched || isDeleting}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Project Permanently'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
