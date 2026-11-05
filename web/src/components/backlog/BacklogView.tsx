import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Issue, Sprint, IssueType } from '../../api/types';
import { TypeIcon } from '../common/TypeIcon';
import { PriorityIcon } from '../common/PriorityIcon';
import {
  Play,
  CheckCircle,
  Plus,
  Calendar,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Flame,
} from 'lucide-react';
import { apiClient } from '../../api/client';

interface BacklogViewProps {
  sprints: Sprint[];
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
  onRefresh: () => void;
  onCreateSprint: () => void;
  onQuickCreateIssue: (sprintId: string | null) => void;
}

export const BacklogView: React.FC<BacklogViewProps> = ({
  sprints,
  issues,
  onIssueClick,
  onRefresh,
  onCreateSprint,
  onQuickCreateIssue,
}) => {
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});
  const [isStartingSprint, setIsStartingSprint] = useState<string | null>(null);
  const [isCompletingSprint, setIsCompletingSprint] = useState<string | null>(null);

  const toggleSprintCollapse = (id: string) => {
    setCollapsedSprints((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeSprint = sprints.find((s) => s.status === 'active');
  const plannedSprints = sprints.filter((s) => s.status === 'planned');

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const targetSprintId = destination.droppableId === 'backlog' ? null : destination.droppableId;

    try {
      await apiClient.patch(`/issues/${draggableId}/move`, {
        sprint_id: targetSprintId ? targetSprintId : '',
        position: destination.index + 1.0,
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartSprint = async (sprintId: string) => {
    try {
      await apiClient.post(`/sprints/${sprintId}/start`, { duration_days: 14 });
      setIsStartingSprint(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteSprint = async (sprintId: string) => {
    try {
      await apiClient.post(`/sprints/${sprintId}/complete`, {});
      setIsCompletingSprint(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const renderIssueRow = (issue: Issue, index: number) => (
    <Draggable key={issue.id} draggableId={issue.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onIssueClick(issue)}
          className={`flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 border-b border-slate-200 transition-colors cursor-pointer group text-sm select-none ${
            snapshot.isDragging ? 'shadow-lg ring-1 ring-blue-500 rounded-lg' : ''
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
            <TypeIcon type={issue.type} />
            <span className="font-semibold text-slate-500 text-xs shrink-0">{issue.key}</span>
            <span className="font-medium text-slate-800 truncate group-hover:text-blue-600">
              {issue.title}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                issue.status === 'done'
                  ? 'bg-emerald-100 text-emerald-700'
                  : issue.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {issue.status.replace('_', ' ')}
            </span>

            {issue.story_points !== null && issue.story_points !== undefined && (
              <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                {issue.story_points}
              </span>
            )}

            <PriorityIcon priority={issue.priority} />

            {issue.assignee ? (
              <div
                className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs"
                title={issue.assignee.full_name}
              >
                {issue.assignee.full_name.charAt(0)}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border border-dashed border-slate-300 text-slate-400 flex items-center justify-center text-[10px]">
                ?
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Sprint Backlog Planning</h2>
            <p className="text-xs text-slate-500">
              Plan iterations, prioritize tickets, and allocate user stories across sprints
            </p>
          </div>
          <button
            onClick={onCreateSprint}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Sprint
          </button>
        </div>

        {/* 1. Active Sprint */}
        {activeSprint && (
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-blue-50/70 border-b border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSprintCollapse(activeSprint.id)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  {collapsedSprints[activeSprint.id] ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-bold text-slate-900">{activeSprint.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">
                    Active Sprint
                  </span>
                </div>
                {activeSprint.goal && (
                  <span className="text-xs text-slate-500 italic hidden md:inline truncate max-w-md">
                    — {activeSprint.goal}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleCompleteSprint(activeSprint.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Complete Sprint
                </button>
              </div>
            </div>

            {!collapsedSprints[activeSprint.id] && (
              <Droppable droppableId={activeSprint.id}>
                {(provided, snapshot) => {
                  const sprintIssues = issues.filter((i) => i.sprint_id === activeSprint.id);
                  return (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[60px] divide-y divide-slate-100 ${
                        snapshot.isDraggingOver ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      {sprintIssues.map((issue, idx) => renderIssueRow(issue, idx))}
                      {provided.placeholder}
                      {sprintIssues.length === 0 && (
                        <div className="p-8 text-center text-xs text-slate-400">
                          Drag issues here to plan this active sprint
                        </div>
                      )}
                      <button
                        onClick={() => onQuickCreateIssue(activeSprint.id)}
                        className="w-full py-2.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-50 font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Create Issue in Sprint
                      </button>
                    </div>
                  );
                }}
              </Droppable>
            )}
          </div>
        )}

        {/* 2. Planned Sprints */}
        {plannedSprints.map((sprint) => (
          <div key={sprint.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSprintCollapse(sprint.id)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  {collapsedSprints[sprint.id] ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                <h3 className="text-sm font-bold text-slate-900">{sprint.name}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  Planned
                </span>
                {sprint.goal && (
                  <span className="text-xs text-slate-500 italic hidden md:inline truncate max-w-md">
                    — {sprint.goal}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleStartSprint(sprint.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Play className="w-3.5 h-3.5" /> Start Sprint
                </button>
              </div>
            </div>

            {!collapsedSprints[sprint.id] && (
              <Droppable droppableId={sprint.id}>
                {(provided, snapshot) => {
                  const sprintIssues = issues.filter((i) => i.sprint_id === sprint.id);
                  return (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[60px] divide-y divide-slate-100 ${
                        snapshot.isDraggingOver ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      {sprintIssues.map((issue, idx) => renderIssueRow(issue, idx))}
                      {provided.placeholder}
                      {sprintIssues.length === 0 && (
                        <div className="p-8 text-center text-xs text-slate-400">
                          Plan this sprint by dragging issues from Backlog
                        </div>
                      )}
                      <button
                        onClick={() => onQuickCreateIssue(sprint.id)}
                        className="w-full py-2.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-50 font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Create Issue in Sprint
                      </button>
                    </div>
                  );
                }}
              </Droppable>
            )}
          </div>
        ))}

        {/* 3. Product Backlog Pool */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Backlog Pool</h3>
              <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                {issues.filter((i) => !i.sprint_id).length} issues
              </span>
            </div>
            <button
              onClick={() => onQuickCreateIssue(null)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add to Backlog
            </button>
          </div>

          <Droppable droppableId="backlog">
            {(provided, snapshot) => {
              const backlogIssues = issues.filter((i) => !i.sprint_id);
              return (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-[80px] divide-y divide-slate-100 ${
                    snapshot.isDraggingOver ? 'bg-slate-100/70' : ''
                  }`}
                >
                  {backlogIssues.map((issue, idx) => renderIssueRow(issue, idx))}
                  {provided.placeholder}
                  {backlogIssues.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Your backlog is clean! Click "Add to Backlog" to capture upcoming work.
                    </div>
                  )}
                </div>
              );
            }}
          </Droppable>
        </div>
      </div>
    </DragDropContext>
  );
};
