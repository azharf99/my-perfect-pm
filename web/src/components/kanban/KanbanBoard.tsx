import React, { useState } from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { Issue, IssueStatus } from '../../api/types';
import { KanbanCard } from './KanbanCard';
import { Plus } from 'lucide-react';
import { apiClient } from '../../api/client';

interface KanbanBoardProps {
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
  onQuickCreate: (status: IssueStatus) => void;
  onIssuesChange: (issues: Issue[]) => void;
}

const COLUMNS: { id: IssueStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'border-slate-300' },
  { id: 'in_progress', title: 'In Progress', color: 'border-blue-400' },
  { id: 'in_review', title: 'In Review', color: 'border-amber-400' },
  { id: 'done', title: 'Done', color: 'border-emerald-400' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  issues,
  onIssueClick,
  onQuickCreate,
  onIssuesChange,
}) => {
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const sourceStatus = source.droppableId as IssueStatus;
    const destStatus = destination.droppableId as IssueStatus;

    // Clone issues list
    const updatedIssues = [...issues];
    const movedIssueIndex = updatedIssues.findIndex((i) => i.id === draggableId);
    if (movedIssueIndex === -1) return;

    const [movedIssue] = updatedIssues.splice(movedIssueIndex, 1);
    movedIssue.status = destStatus;

    // Find destination column issues
    const destColumnIssues = updatedIssues.filter((i) => i.status === destStatus);

    // Calculate position
    let newPosition = 1.0;
    if (destColumnIssues.length === 0) {
      newPosition = 1.0;
    } else if (destination.index === 0) {
      newPosition = destColumnIssues[0].position / 2.0;
    } else if (destination.index >= destColumnIssues.length) {
      newPosition = destColumnIssues[destColumnIssues.length - 1].position + 1.0;
    } else {
      const prevPos = destColumnIssues[destination.index - 1].position;
      const nextPos = destColumnIssues[destination.index].position;
      newPosition = (prevPos + nextPos) / 2.0;
    }

    movedIssue.position = newPosition;

    // Insert at destination
    updatedIssues.splice(movedIssueIndex, 0, movedIssue);

    // Optimistically update UI
    onIssuesChange(updatedIssues);

    // Persist to backend
    try {
      await apiClient.patch(`/issues/${draggableId}/move`, {
        status: destStatus,
        position: newPosition,
      });
    } catch (err) {
      console.error('Failed to persist move:', err);
      // Revert if API call fails
      onIssuesChange(issues);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full min-h-[calc(100vh-220px)] items-start">
        {COLUMNS.map((col) => {
          const colIssues = issues
            .filter((i) => i.status === col.id)
            .sort((a, b) => a.position - b.position);

          const totalPoints = colIssues.reduce((sum, i) => sum + (i.story_points || 0), 0);

          return (
            <div
              key={col.id}
              className={`bg-slate-100/80 rounded-xl p-3 border-t-4 ${col.color} border-slate-200 shadow-sm flex flex-col max-h-[calc(100vh-200px)]`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {col.title}
                  </h3>
                  <span className="text-xs font-semibold text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
                    {colIssues.length}
                  </span>
                </div>

                {totalPoints > 0 && (
                  <span
                    className="text-[11px] font-semibold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded"
                    title="Total Story Points"
                  >
                    {totalPoints} pts
                  </span>
                )}
              </div>

              {/* Column Droppable Area */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 overflow-y-auto min-h-[120px] transition-colors rounded-lg p-1 ${
                      snapshot.isDraggingOver ? 'bg-blue-50/60 ring-2 ring-blue-300 ring-dashed' : ''
                    }`}
                  >
                    {colIssues.map((issue, index) => (
                      <KanbanCard
                        key={issue.id}
                        issue={issue}
                        index={index}
                        onClick={() => onIssueClick(issue)}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {/* Quick Add Issue Button */}
              <button
                onClick={() => onQuickCreate(col.id)}
                className="mt-2 w-full py-2 px-3 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg flex items-center justify-center gap-1.5 border border-dashed border-slate-300 hover:border-blue-400 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Issue
              </button>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};
