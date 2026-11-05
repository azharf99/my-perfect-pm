import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Issue } from '../../api/types';
import { TypeIcon } from '../common/TypeIcon';
import { PriorityIcon } from '../common/PriorityIcon';
import { CheckSquare } from 'lucide-react';

interface KanbanCardProps {
  issue: Issue;
  index: number;
  onClick: () => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ issue, index, onClick }) => {
  const totalSubtasks = issue.subtasks?.length || 0;
  const doneSubtasks = issue.subtasks?.filter((s) => s.is_done).length || 0;

  return (
    <Draggable draggableId={issue.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group mb-2.5 select-none ${
            snapshot.isDragging ? 'shadow-xl ring-2 ring-blue-500 rotate-1' : ''
          }`}
        >
          {/* Card Title */}
          <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 line-clamp-2 mb-3 leading-snug">
            {issue.title}
          </p>

          {/* Subtask mini checklist indicator if any */}
          {totalSubtasks > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 bg-slate-50 py-0.5 px-1.5 rounded w-fit">
              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {doneSubtasks}/{totalSubtasks}
              </span>
            </div>
          )}

          {/* Card Footer */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <TypeIcon type={issue.type} />
              <span className="font-semibold text-slate-600 text-[11px]">{issue.key}</span>
            </div>

            <div className="flex items-center gap-2">
              {issue.story_points !== null && issue.story_points !== undefined && (
                <span
                  className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-full"
                  title="Story Points"
                >
                  {issue.story_points}
                </span>
              )}

              <PriorityIcon priority={issue.priority} />

              {issue.assignee ? (
                <div
                  className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]"
                  title={`Assigned to ${issue.assignee.full_name}`}
                >
                  {issue.assignee.full_name.charAt(0)}
                </div>
              ) : (
                <div
                  className="w-5 h-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400"
                  title="Unassigned"
                >
                  ?
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
