import { useAuth } from '../context/AuthContext';
import { Project } from '../api/types';

export const usePermissions = () => {
  const { user, role } = useAuth();

  const isAdmin = role === 'admin';
  const isMember = role === 'member';
  const isViewer = role === 'viewer';

  // Admin and Member can perform mutating actions on issues/sprints; Viewer is read-only
  const canWrite = isAdmin || isMember;

  // Project update/delete requires workspace Admin OR being the designated Project Lead
  const canEditProject = (project?: Project | { lead_id?: string } | null): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    return !!project && project.lead_id === user.id;
  };

  const canDeleteProject = (project?: Project | { lead_id?: string } | null): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    return !!project && project.lead_id === user.id;
  };

  const canManageUsers = isAdmin;
  const canManageWorkspace = isAdmin;

  return {
    isAdmin,
    isMember,
    isViewer,
    canWrite,
    canEditProject,
    canDeleteProject,
    canManageUsers,
    canManageWorkspace,
  };
};
