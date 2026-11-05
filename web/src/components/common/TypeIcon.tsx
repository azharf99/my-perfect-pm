import React from 'react';
import { Bookmark, CheckSquare, AlertCircle, Zap } from 'lucide-react';
import { IssueType } from '../../api/types';

interface TypeIconProps {
  type: IssueType;
  showLabel?: boolean;
  className?: string;
}

export const TypeIcon: React.FC<TypeIconProps> = ({ type, showLabel = false, className = '' }) => {
  switch (type) {
    case 'story':
      return (
        <span className={`inline-flex items-center gap-1.5 text-emerald-600 ${className}`} title="User Story">
          <Bookmark className="w-4 h-4 fill-emerald-500 text-emerald-600" />
          {showLabel && <span className="capitalize font-medium text-xs">Story</span>}
        </span>
      );
    case 'task':
      return (
        <span className={`inline-flex items-center gap-1.5 text-blue-600 ${className}`} title="Task">
          <CheckSquare className="w-4 h-4 fill-blue-50 text-blue-600" />
          {showLabel && <span className="capitalize font-medium text-xs">Task</span>}
        </span>
      );
    case 'bug':
      return (
        <span className={`inline-flex items-center gap-1.5 text-red-600 ${className}`} title="Bug">
          <AlertCircle className="w-4 h-4 fill-red-50 text-red-600" />
          {showLabel && <span className="capitalize font-medium text-xs">Bug</span>}
        </span>
      );
    case 'epic':
      return (
        <span className={`inline-flex items-center gap-1.5 text-purple-600 ${className}`} title="Epic">
          <Zap className="w-4 h-4 fill-purple-500 text-purple-600" />
          {showLabel && <span className="capitalize font-medium text-xs">Epic</span>}
        </span>
      );
    default:
      return null;
  }
};
