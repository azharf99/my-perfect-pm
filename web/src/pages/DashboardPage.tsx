import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderGit2,
  Flame,
  CheckCircle2,
  TrendingUp,
  Layers,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { CrossProjectAnalytics, ProjectProgress } from '../api/types';

export const DashboardPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<CrossProjectAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/analytics/dashboard');
      setAnalytics(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-500 font-semibold text-sm animate-pulse">
          Loading Cross-Project Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Cross-Project Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track velocity, agile progress, and sprint health across all concurrent projects in your workspace.
          </p>
        </div>

        <Link
          to="/projects"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </Link>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Projects
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{analytics.total_projects}</span>
            <span className="text-xs text-slate-500">concurrent</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Running Sprints
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{analytics.active_sprints}</span>
            <span className="text-xs text-slate-500">sprints in flight</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Overall Completion
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">
              {Math.round(analytics.overall_progress)}%
            </span>
            <span className="text-xs text-slate-500">
              {analytics.completed_issues}/{analytics.total_issues} issues done
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Story Points Velocity
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-600">
              {analytics.completed_story_points}
            </span>
            <span className="text-xs text-slate-500">of {analytics.total_story_points} pts delivered</span>
          </div>
        </div>
      </div>

      {/* Projects Progress List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-base text-slate-900">Project Progress Breakdown</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {analytics.projects?.length || 0} Total Projects
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {(analytics.projects || []).map((proj: ProjectProgress) => (
            <div
              key={proj.id}
              className="p-6 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              {/* Project Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: proj.color || '#2563eb' }}
                  />
                  <h3 className="font-bold text-slate-900 text-sm">{proj.name}</h3>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {proj.key}
                  </span>
                  {proj.active_sprint_name && (
                    <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Sprint: {proj.active_sprint_name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                  <span>
                    <strong>{proj.done_issues}</strong> of <strong>{proj.total_issues}</strong> issues
                    completed
                  </span>
                  <span>•</span>
                  <span>
                    <strong>{proj.done_story_points}</strong> of <strong>{proj.total_story_points}</strong>{' '}
                    story points
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-3 max-w-xl">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${proj.completion_percentage}%`,
                      backgroundColor: proj.color || '#2563eb',
                    }}
                  />
                </div>
              </div>

              {/* Progress & Quick Actions */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">
                    {Math.round(proj.completion_percentage)}%
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Done</div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/projects/${proj.id}/board`}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                  >
                    Board <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    to={`/projects/${proj.id}/backlog`}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Backlog
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {(!analytics.projects || analytics.projects.length === 0) && (
            <div className="p-12 text-center text-slate-400 text-sm">
              No projects created yet. Click "New Project" to start tracking your work!
            </div>
          )}
        </div>
      </div>

      {/* Distribution Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Issues by Status
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.status_distribution || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-xs">
                <span className="capitalize font-medium text-slate-700">
                  {status.replace('_', ' ')}
                </span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {String(count)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Issue Type Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Issues by Type
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.type_distribution || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className="capitalize font-medium text-slate-700">{type}</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {String(count)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Issues by Priority
          </h3>
          <div className="space-y-3">
            {Object.entries(analytics.priority_distribution || {}).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between text-xs">
                <span className="capitalize font-medium text-slate-700">{priority}</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {String(count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
