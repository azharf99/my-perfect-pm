import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { KanbanSquare, Plus, X, Calendar, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import { Project, Sprint, Issue } from '../api/types';
import { BacklogView } from '../components/backlog/BacklogView';
import { IssueDetailModal } from '../components/issue/IssueDetailModal';
import { CreateIssueModal } from '../components/issue/CreateIssueModal';

export const BacklogPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [targetSprintId, setTargetSprintId] = useState<string | null>(null);

  // Create Sprint Modal
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [isSubmittingSprint, setIsSubmittingSprint] = useState(false);
  const [sprintError, setSprintError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadAllData(projectId);
    }
  }, [projectId]);

  const loadAllData = async (id: string) => {
    try {
      setIsLoading(true);
      const [projRes, sprintsRes, issuesRes] = await Promise.all([
        apiClient.get(`/projects/${id}`),
        apiClient.get(`/projects/${id}/sprints`),
        apiClient.get(`/issues?project_id=${id}`),
      ]);
      setProject(projRes.data);
      setSprints(sprintsRes.data);
      setIssues(issuesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssueId(issue.id);
    setIsDetailOpen(true);
  };

  const handleQuickCreate = (sprintId: string | null) => {
    setTargetSprintId(sprintId);
    setIsCreateOpen(true);
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim() || !projectId) return;

    setIsSubmittingSprint(true);
    setSprintError(null);

    try {
      await apiClient.post(`/projects/${projectId}/sprints`, {
        name: sprintName.trim(),
        goal: sprintGoal.trim(),
      });
      setIsCreateSprintOpen(false);
      setSprintName('');
      setSprintGoal('');
      loadAllData(projectId);
    } catch (err: any) {
      setSprintError(err.response?.data?.error || 'Failed to create sprint');
    } finally {
      setIsSubmittingSprint(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded text-white font-extrabold text-xs"
              style={{ backgroundColor: project?.color || '#2563eb' }}
            >
              {project?.key}
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {project?.name || 'Project'} Backlog
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Groom user stories, plan sprint milestones, and estimate story points
          </p>
        </div>

        <Link
          to={`/projects/${projectId}/board`}
          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors w-fit"
        >
          <KanbanSquare className="w-4 h-4" />
          <span>Active Board</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px] text-slate-400 text-sm">
          Loading backlog...
        </div>
      ) : (
        <BacklogView
          sprints={sprints}
          issues={issues}
          onIssueClick={handleIssueClick}
          onRefresh={() => projectId && loadAllData(projectId)}
          onCreateSprint={() => {
            const nextNum = sprints.length + 1;
            setSprintName(`Sprint ${nextNum}`);
            setIsCreateSprintOpen(true);
          }}
          onQuickCreateIssue={handleQuickCreate}
        />
      )}

      {/* Create Sprint Modal */}
      {isCreateSprintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-base font-bold text-slate-800">Create Sprint</h2>
              <button
                onClick={() => setIsCreateSprintOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {sprintError && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sprintError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSprint} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Sprint Name *
                </label>
                <input
                  type="text"
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  placeholder="e.g. Sprint 2 - User Onboarding"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Sprint Goal
                </label>
                <textarea
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                  rows={3}
                  placeholder="What is the objective or deliverable of this iteration?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateSprintOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSprint || !sprintName.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {isSubmittingSprint ? 'Creating...' : 'Create Sprint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issueId={selectedIssueId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onIssueUpdated={() => projectId && loadAllData(projectId)}
        onIssueDeleted={() => projectId && loadAllData(projectId)}
      />

      {/* Quick Create Issue Modal */}
      <CreateIssueModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onIssueCreated={() => projectId && loadAllData(projectId)}
        defaultProjectId={projectId}
        defaultSprintId={targetSprintId}
      />
    </div>
  );
};
