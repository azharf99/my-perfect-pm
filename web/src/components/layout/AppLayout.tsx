import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { CreateIssueModal } from '../issue/CreateIssueModal';
import { Issue } from '../../api/types';

export const AppLayout: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleIssueCreated = (newIssue: Issue) => {
    // If user created an issue in a project, navigate to that project's board or refresh
    navigate(`/projects/${newIssue.project_id}/board`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar onOpenCreateIssue={() => setIsCreateModalOpen(true)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <CreateIssueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onIssueCreated={handleIssueCreated}
      />
    </div>
  );
};
