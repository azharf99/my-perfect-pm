import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Flame,
  ListTodo,
  User as UserIcon,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Project, Sprint, Issue, IssueStatus } from '../api/types';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { IssueDetailModal } from '../components/issue/IssueDetailModal';
import { CreateIssueModal } from '../components/issue/CreateIssueModal';

export const BoardPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('active');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');

  // Modals
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<IssueStatus>('todo');

  useEffect(() => {
    if (projectId) {
      loadProjectData(projectId);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadIssues(projectId);
    }
  }, [projectId, selectedSprintId, searchTerm, selectedAssignee]);

  const loadProjectData = async (id: string) => {
    try {
      const [projRes, sprintsRes] = await Promise.all([
        apiClient.get(`/projects/${id}`),
        apiClient.get(`/projects/${id}/sprints`),
      ]);
      setProject(projRes.data);
      setSprints(sprintsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadIssues = async (id: string) => {
    try {
      setIsLoading(true);
      let url = `/issues?project_id=${id}`;

      if (selectedSprintId === 'active') {
        const active = sprints.find((s) => s.status === 'active');
        if (active) {
          url += `&sprint_id=${active.id}`;
        }
      } else if (selectedSprintId !== 'all') {
        url += `&sprint_id=${selectedSprintId}`;
      }

      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      if (selectedAssignee) {
        url += `&assignee_id=${selectedAssignee}`;
      }

      const res = await apiClient.get(url);
      setIssues(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCreate = (status: IssueStatus) => {
    setCreateDefaultStatus(status);
    setIsCreateOpen(true);
  };

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssueId(issue.id);
    setIsDetailOpen(true);
  };

  const handleIssueUpdated = (updated: Issue) => {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleIssueDeleted = (deletedId: string) => {
    setIssues((prev) => prev.filter((i) => i.id !== deletedId));
  };

  const handleIssueCreated = (newIssue: Issue) => {
    setIssues((prev) => [...prev, newIssue]);
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Board Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded text-white font-extrabold text-xs"
              style={{ backgroundColor: project?.color || '#2563eb' }}
            >
              {project?.key}
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {project?.name || 'Project'} Kanban Board
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Drag cards across columns to update task progress in real time
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/projects/${projectId}/backlog`}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ListTodo className="w-4 h-4" />
            <span>Sprint Backlog</span>
          </Link>

          <button
            onClick={() => {
              setCreateDefaultStatus('todo');
              setIsCreateOpen(true);
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search issues, keys..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Sprint Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active Sprint</option>
              <option value="all">All Sprints & Backlog</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <strong>{issues.length}</strong> issues
        </div>
      </div>

      {/* Board Content */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px] text-slate-400 text-sm font-medium">
          Loading Kanban Board...
        </div>
      ) : (
        <KanbanBoard
          issues={issues}
          onIssueClick={handleIssueClick}
          onQuickCreate={handleQuickCreate}
          onIssuesChange={setIssues}
        />
      )}

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issueId={selectedIssueId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onIssueUpdated={handleIssueUpdated}
        onIssueDeleted={handleIssueDeleted}
      />

      {/* Quick Create Issue Modal */}
      <CreateIssueModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onIssueCreated={handleIssueCreated}
        defaultProjectId={projectId}
        defaultStatus={createDefaultStatus}
      />
    </div>
  );
};
