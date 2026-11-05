import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  CheckCircle2,
  Circle,
  MessageSquare,
  Plus,
  Send,
  User as UserIcon,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { Issue, Subtask, Comment, IssueStatus, IssuePriority, IssueType } from '../../api/types';
import { TypeIcon } from '../common/TypeIcon';
import { PriorityIcon } from '../common/PriorityIcon';
import { StatusBadge } from '../common/StatusBadge';

interface IssueDetailModalProps {
  issueId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onIssueUpdated: (updatedIssue: Issue) => void;
  onIssueDeleted: (deletedId: string) => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issueId,
  isOpen,
  onClose,
  onIssueUpdated,
  onIssueDeleted,
}) => {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');

  useEffect(() => {
    if (isOpen && issueId) {
      loadIssueDetail(issueId);
    }
  }, [isOpen, issueId]);

  const loadIssueDetail = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/issues/${id}`);
      setIssue(res.data);
      setTitleInput(res.data.title);
      setDescriptionInput(res.data.description || '');
    } catch (_) {
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateField = async (fields: Partial<Issue>) => {
    if (!issue) return;
    try {
      setIsSaving(true);
      const res = await apiClient.patch(`/issues/${issue.id}`, {
        title: fields.title ?? issue.title,
        description: fields.description ?? issue.description,
        type: fields.type ?? issue.type,
        status: fields.status ?? issue.status,
        priority: fields.priority ?? issue.priority,
        story_points: fields.story_points !== undefined ? fields.story_points : issue.story_points,
        assignee_id: fields.assignee_id !== undefined ? fields.assignee_id : issue.assignee_id,
        sprint_id: fields.sprint_id !== undefined ? fields.sprint_id : issue.sprint_id,
      });
      setIssue(res.data);
      onIssueUpdated(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDescription = () => {
    handleUpdateField({ description: descriptionInput });
  };

  const handleSaveTitle = () => {
    if (titleInput.trim()) {
      handleUpdateField({ title: titleInput.trim() });
      setIsEditingTitle(false);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !newSubtaskTitle.trim()) return;

    try {
      const res = await apiClient.post(`/issues/${issue.id}/subtasks`, {
        title: newSubtaskTitle.trim(),
      });
      const updatedSubtasks = [...(issue.subtasks || []), res.data];
      setIssue({ ...issue, subtasks: updatedSubtasks });
      setNewSubtaskTitle('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSubtask = async (subtask: Subtask) => {
    if (!issue) return;
    try {
      const newDone = !subtask.is_done;
      await apiClient.patch(`/subtasks/${subtask.id}`, { is_done: newDone });
      const updatedSubtasks = (issue.subtasks || []).map((s) =>
        s.id === subtask.id ? { ...s, is_done: newDone } : s
      );
      setIssue({ ...issue, subtasks: updatedSubtasks });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!issue) return;
    try {
      await apiClient.delete(`/subtasks/${subtaskId}`);
      const updatedSubtasks = (issue.subtasks || []).filter((s) => s.id !== subtaskId);
      setIssue({ ...issue, subtasks: updatedSubtasks });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue || !newCommentContent.trim()) return;

    try {
      const res = await apiClient.post(`/issues/${issue.id}/comments`, {
        content: newCommentContent.trim(),
      });
      const updatedComments = [...(issue.comments || []), res.data];
      setIssue({ ...issue, comments: updatedComments });
      setNewCommentContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteIssue = async () => {
    if (!issue) return;
    if (confirm(`Are you sure you want to delete ${issue.key}? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/issues/${issue.id}`);
        onIssueDeleted(issue.id);
        onClose();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (!isOpen) return null;

  const totalSubtasks = issue?.subtasks?.length || 0;
  const doneSubtasks = issue?.subtasks?.filter((s) => s.is_done).length || 0;
  const subtaskProgress = totalSubtasks > 0 ? (doneSubtasks / totalSubtasks) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            {issue && <TypeIcon type={issue.type} showLabel />}
            <span className="text-sm font-bold text-slate-700 bg-slate-200/80 px-2.5 py-0.5 rounded">
              {issue?.key}
            </span>
            {issue?.project && (
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                in {issue.project.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteIssue}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete Issue"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {isLoading || !issue ? (
          <div className="p-12 text-center text-slate-500 font-medium">Loading issue details...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-y-auto divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* Left Column (2 Cols): Details, Subtasks, Comments */}
            <div className="md:col-span-2 p-6 space-y-6 overflow-y-auto">
              {/* Title */}
              <div>
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      className="w-full text-xl font-bold text-slate-900 border border-blue-400 rounded px-2 py-1 focus:outline-none ring-2 ring-blue-100"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveTitle}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingTitle(false)}
                      className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <h1
                    onClick={() => setIsEditingTitle(true)}
                    className="text-xl font-bold text-slate-900 hover:bg-slate-100 p-1.5 -ml-1.5 rounded cursor-pointer transition-colors"
                    title="Click to edit title"
                  >
                    {issue.title}
                  </h1>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  rows={4}
                  placeholder="Add a detailed description..."
                  className="w-full text-sm text-slate-800 border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-slate-50/50"
                />
                {descriptionInput !== (issue.description || '') && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSaveDescription}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700"
                    >
                      Save Description
                    </button>
                    <button
                      onClick={() => setDescriptionInput(issue.description || '')}
                      className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Subtasks / Checklist */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Subtasks Checklist
                    </span>
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {doneSubtasks} / {totalSubtasks}
                    </span>
                  </div>
                  {totalSubtasks > 0 && (
                    <span className="text-xs font-semibold text-slate-500">
                      {Math.round(subtaskProgress)}%
                    </span>
                  )}
                </div>

                {totalSubtasks > 0 && (
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                )}

                <div className="space-y-1.5 mb-3">
                  {(issue.subtasks || []).map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center justify-between group px-2 py-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200"
                    >
                      <button
                        onClick={() => handleToggleSubtask(subtask)}
                        className="flex items-center gap-2.5 text-left flex-1"
                      >
                        {subtask.is_done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            subtask.is_done ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {subtask.title}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteSubtask(subtask.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddSubtask} className="flex gap-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add a new subtask..."
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newSubtaskTitle.trim()}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </form>
              </div>

              {/* Activity & Comments */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Activity & Comments ({issue.comments?.length || 0})
                  </span>
                </div>

                {/* Comment list */}
                <div className="space-y-3 mb-4">
                  {(issue.comments || []).map((comment) => (
                    <div key={comment.id} className="flex gap-3 text-sm">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {comment.user?.full_name?.charAt(0) || 'U'}
                      </div>
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-slate-800">
                            {comment.user?.full_name || 'Team Member'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(comment.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Comment input */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newCommentContent}
                    onChange={(e) => setNewCommentContent(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newCommentContent.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> Post
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column (1 Col): Status, Priority, Sprint, Assignee Details */}
            <div className="p-6 bg-slate-50/70 space-y-5 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <select
                  value={issue.status}
                  onChange={(e) => handleUpdateField({ status: e.target.value as IssueStatus })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Priority
                </label>
                <select
                  value={issue.priority}
                  onChange={(e) => handleUpdateField({ priority: e.target.value as IssuePriority })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
                >
                  <option value="highest">Highest</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="lowest">Lowest</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Story Points
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={issue.story_points ?? ''}
                  onChange={(e) =>
                    handleUpdateField({
                      story_points: e.target.value === '' ? null : parseInt(e.target.value),
                    })
                  }
                  placeholder="None"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Assignee
                </label>
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                    {issue.assignee?.full_name?.charAt(0) || <UserIcon className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {issue.assignee?.full_name || 'Unassigned'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Reporter
                </label>
                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                    {issue.reporter?.full_name?.charAt(0) || 'R'}
                  </div>
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {issue.reporter?.full_name || 'Reporter'}
                  </span>
                </div>
              </div>

              {issue.sprint && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Sprint
                  </label>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                    <p className="font-semibold text-slate-800">{issue.sprint.name}</p>
                    <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {issue.sprint.status}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-400 space-y-1">
                <div>Created {new Date(issue.created_at).toLocaleDateString()}</div>
                <div>Updated {new Date(issue.updated_at).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
