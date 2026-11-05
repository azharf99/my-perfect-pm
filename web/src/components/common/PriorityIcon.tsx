import React from 'react';
import { ChevronDown, ChevronsDown, Minus, ChevronUp, ChevronsUp } from 'lucide-react';
import { IssuePriority } from '../../api/types';

interface PriorityIconProps {
  priority: IssuePriority;
  showLabel?: boolean;
  className?: string;
}

export const PriorityIcon: React.FC<PriorityIconProps> = ({ priority, showLabel = false, className = '' }) => {
  switch (priority) {
    case 'highest':
      return (
        <span className={`inline-flex items-center gap-1 text-red-600 font-medium ${className}`} title="Highest Priority">
          <ChevronsUp className="w-4 h-4 text-red-600" />
          {showLabel && <span>Highest</span>}
        </span>
      );
    case 'high':
      return (
        <span className={`inline-flex items-center gap-1 text-orange-600 font-medium ${className}`} title="High Priority">
          <ChevronUp className="w-4 h-4 text-orange-500" />
          {showLabel && <span>High</span>}
        </span>
      );
    case 'medium':
      return (
        <span className={`inline-flex items-center gap-1 text-yellow-600 font-medium ${className}`} title="Medium Priority">
          <Minus className="w-4 h-4 text-yellow-500" />
          {showLabel && <span>Medium</span>}
        </span>
      );
    case 'low':
      return (
        <span className={`inline-flex items-center gap-1 text-blue-600 font-medium ${className}`} title="Low Priority">
          <ChevronDown className="w-4 h-4 text-blue-500" />
          {showLabel && <span>Low</span>}
        </span>
      );
    case 'lowest':
      return (
        <span className={`inline-flex items-center gap-1 text-slate-500 font-medium ${className}`} title="Lowest Priority">
          <ChevronsDown className="w-4 h-4 text-slate-400" />
          {showLabel && <span>Lowest</span>}
        </span>
      );
    default:
      return null;
  }
};
