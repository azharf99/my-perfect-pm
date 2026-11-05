import React from 'react';
import { IssueStatus } from '../../api/types';

interface StatusBadgeProps {
  status: IssueStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  switch (status) {
    case 'backlog':
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 ${className}`}>
          Backlog
        </span>
      );
    case 'todo':
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-slate-200 text-slate-700 ${className}`}>
          To Do
        </span>
      );
    case 'in_progress':
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 ${className}`}>
          In Progress
        </span>
      );
    case 'in_review':
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 ${className}`}>
          In Review
        </span>
      );
    case 'done':
      return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 ${className}`}>
          Done
        </span>
      );
    default:
      return null;
  }
};
