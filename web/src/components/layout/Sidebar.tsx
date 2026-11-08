import React, { useState, useEffect } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  KanbanSquare,
  ListTodo,
  Users,
  Plus,
  Settings,
  Building2,
  Shield,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { Project } from '../../api/types';
import { usePermissions } from '../../hooks/usePermissions';

export const Sidebar: React.FC = () => {
  const { projectId } = useParams<{ projectId?: string }>();
  const { isAdmin, canWrite, canEditProject } = usePermissions();

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projectId && projects.length > 0) {
      const found = projects.find((p) => p.id === projectId);
      setCurrentProject(found || null);
    } else {
      setCurrentProject(null);
    }
  }, [projectId, projects]);

  const loadProjects = async () => {
    try {
      const res = await apiClient.get('/projects');
      setProjects(res.data);
    } catch (_) {}
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-[calc(100vh-56px)] border-r border-slate-800">
      {/* Global Navigation */}
      <div className="p-3 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1">
          Workspace
        </div>

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Cross-Project Overview</span>
        </NavLink>

        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              isActive && !projectId
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`
          }
        >
          <FolderGit2 className="w-4 h-4" />
          <span>All Projects</span>
        </NavLink>
      </div>

      {/* Selected Project Agile Workspace */}
      {currentProject ? (
        <div className="p-3 border-t border-slate-800 space-y-1">
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Active Project
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: currentProject.color || '#2563eb' }}
            >
              {currentProject.key}
            </span>
          </div>

          <div className="px-3 py-1 text-xs font-bold text-white truncate">
            {currentProject.name}
          </div>

          <NavLink
            to={`/projects/${currentProject.id}/board`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              }`
            }
          >
            <KanbanSquare className="w-4 h-4" />
            <span>Kanban Board</span>
          </NavLink>

          <NavLink
            to={`/projects/${currentProject.id}/backlog`}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              }`
            }
          >
            <ListTodo className="w-4 h-4" />
            <span>Sprint Backlog</span>
          </NavLink>

          {canEditProject(currentProject) && (
            <NavLink
              to={`/projects/${currentProject.id}/settings`}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                }`
              }
            >
              <Settings className="w-4 h-4" />
              <span>Project Settings</span>
            </NavLink>
          )}
        </div>
      ) : null}

      {/* Project Switcher List */}
      <div className="p-3 border-t border-slate-800 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span>Projects ({projects.length})</span>
          {canWrite && (
            <NavLink to="/projects" className="hover:text-white" title="New Project">
              <Plus className="w-3.5 h-3.5" />
            </NavLink>
          )}
        </div>

        <div className="space-y-1 mt-1">
          {projects.map((p) => {
            const isSelected = p.id === projectId;
            return (
              <NavLink
                key={p.id}
                to={`/projects/${p.id}/board`}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                  isSelected
                    ? 'bg-slate-800 font-bold text-white border-l-2 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: p.color || '#2563eb' }}
                  />
                  <span className="truncate">{p.name}</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 shrink-0">{p.key}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Administration Section (Admin only) */}
      {isAdmin && (
        <div className="p-3 border-t border-slate-800 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-purple-400" />
            <span>Administration</span>
          </div>

          <NavLink
            to="/admin/members"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              }`
            }
          >
            <Users className="w-4 h-4" />
            <span>Team Members</span>
          </NavLink>

          <NavLink
            to="/admin/workspace"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              }`
            }
          >
            <Building2 className="w-4 h-4" />
            <span>Workspace Settings</span>
          </NavLink>
        </div>
      )}

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between px-4">
        <span>My Perfect PM v1.0</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
      </div>
    </aside>
  );
};
