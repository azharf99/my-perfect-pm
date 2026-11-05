export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  user?: User;
  organization?: Organization;
}

export interface Project {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  description: string;
  lead_id: string;
  color: string;
  lead?: User;
  total_issues?: number;
  done_issues?: number;
  active_sprint_id?: string;
  active_sprint_name?: string;
  created_at: string;
  updated_at: string;
}

export type SprintStatus = 'planned' | 'active' | 'completed';

export interface Sprint {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status: SprintStatus;
  created_at: string;
}

export type IssueType = 'story' | 'task' | 'bug' | 'epic';
export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type IssuePriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';

export interface Subtask {
  id: string;
  issue_id: string;
  title: string;
  is_done: boolean;
  position: number;
}

export interface Comment {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  user?: User;
  created_at: string;
}

export interface Issue {
  id: string;
  organization_id: string;
  project_id: string;
  sprint_id?: string | null;
  key: string;
  number: number;
  title: string;
  description: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  story_points?: number | null;
  assignee_id?: string | null;
  reporter_id: string;
  position: number;
  assignee?: User;
  reporter?: User;
  project?: Project;
  sprint?: Sprint;
  subtasks?: Subtask[];
  comments?: Comment[];
  created_at: string;
  updated_at: string;
}

export interface ProjectProgress {
  id: string;
  key: string;
  name: string;
  color: string;
  total_issues: number;
  done_issues: number;
  completion_percentage: number;
  total_story_points: number;
  done_story_points: number;
  active_sprint_name?: string;
}

export interface CrossProjectAnalytics {
  total_projects: number;
  total_issues: number;
  completed_issues: number;
  in_progress_issues: number;
  open_issues: number;
  total_story_points: number;
  completed_story_points: number;
  active_sprints: number;
  overall_progress: number;
  projects: ProjectProgress[];
  status_distribution: Record<string, number>;
  type_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
}
