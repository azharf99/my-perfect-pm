package database

import (
	"log"
	"time"

	"my-perfect-pm/internal/config"
	"my-perfect-pm/internal/models"
	"my-perfect-pm/internal/security"

	"gorm.io/gorm"
)

func SeedInitialData(db *gorm.DB) error {
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		return nil // Already seeded
	}

	log.Println("Database is empty. Seeding default admin and demo agile projects...")
	cfg := config.Load()

	// 1. Create Default Admin User
	hashedPassword, err := security.HashPassword(cfg.AdminPassword)
	if err != nil {
		return err
	}

	adminUser := models.User{
		Email:        cfg.AdminEmail,
		PasswordHash: hashedPassword,
		FullName:     "System Administrator",
		AvatarURL:          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&auto=format&fit=crop&q=80",
		IsActive:           true,
		MustChangePassword: cfg.Environment == "production" && cfg.UsingDefaultAdminPassword(),
	}
	if err := db.Create(&adminUser).Error; err != nil {
		return err
	}

	// 2. Create Default Workspace / Organization
	org := models.Organization{
		Name: "Acme Global",
		Slug: "acme-global",
	}
	if err := db.Create(&org).Error; err != nil {
		return err
	}

	// Link admin to organization
	member := models.OrganizationMember{
		OrganizationID: org.ID,
		UserID:         adminUser.ID,
		Role:           "admin",
	}
	if err := db.Create(&member).Error; err != nil {
		return err
	}

	// 3. Project 1: Alpha Core Engine (Active Sprint with Kanban issues)
	projAlpha := models.Project{
		OrganizationID: org.ID,
		Key:            "ALPH",
		Name:           "Alpha Core Engine",
		Description:    "Core high-performance microservices architecture, Gin backend, and security primitives.",
		LeadID:         adminUser.ID,
		Color:          "#2563eb",
	}
	if err := db.Create(&projAlpha).Error; err != nil {
		return err
	}

	now := time.Now().UTC()
	twoWeeksLater := now.Add(14 * 24 * time.Hour)
	sprintAlpha := models.Sprint{
		OrganizationID: org.ID,
		ProjectID:      projAlpha.ID,
		Name:           "Sprint 1 - Foundation & MVP",
		Goal:           "Deliver robust JWT security, SQLite WAL mode, and interactive drag-and-drop Kanban board.",
		StartDate:      &now,
		EndDate:        &twoWeeksLater,
		Status:         models.SprintStatusActive,
	}
	if err := db.Create(&sprintAlpha).Error; err != nil {
		return err
	}

	sp5, sp3, sp8, sp2 := 5, 3, 8, 2
	issuesAlpha := []models.Issue{
		{
			OrganizationID: org.ID,
			ProjectID:      projAlpha.ID,
			SprintID:       &sprintAlpha.ID,
			Key:            "ALPH-1",
			Number:         1,
			Title:          "Setup secure JWT session management with HttpOnly cookies",
			Description:    "Store access and refresh tokens in HttpOnly, SameSite=Lax cookies to completely eliminate token theft via XSS.",
			Type:           models.IssueTypeStory,
			Status:         models.IssueStatusDone,
			Priority:       models.IssuePriorityHigh,
			StoryPoints:    &sp5,
			AssigneeID:     &adminUser.ID,
			ReporterID:     adminUser.ID,
			Position:       1.0,
		},
		{
			OrganizationID: org.ID,
			ProjectID:      projAlpha.ID,
			SprintID:       &sprintAlpha.ID,
			Key:            "ALPH-2",
			Number:         2,
			Title:          "Configure pure-Go SQLite with WAL mode & foreign keys",
			Description:    "Utilize glebarez/sqlite to achieve CGO-free, fast compiling static binaries with high concurrency.",
			Type:           models.IssueTypeTask,
			Status:         models.IssueStatusDone,
			Priority:       models.IssuePriorityMedium,
			StoryPoints:    &sp3,
			AssigneeID:     &adminUser.ID,
			ReporterID:     adminUser.ID,
			Position:       2.0,
		},
		{
			OrganizationID: org.ID,
			ProjectID:      projAlpha.ID,
			SprintID:       &sprintAlpha.ID,
			Key:            "ALPH-3",
			Number:         3,
			Title:          "Build interactive drag-and-drop Agile Kanban board",
			Description:    "Provide smooth column-to-column and rank reordering with optimistic updates and status synchronization.",
			Type:           models.IssueTypeStory,
			Status:         models.IssueStatusInProgress,
			Priority:       models.IssuePriorityHighest,
			StoryPoints:    &sp8,
			AssigneeID:     &adminUser.ID,
			ReporterID:     adminUser.ID,
			Position:       1.0,
		},
		{
			OrganizationID: org.ID,
			ProjectID:      projAlpha.ID,
			SprintID:       &sprintAlpha.ID,
			Key:            "ALPH-4",
			Number:         4,
			Title:          "Implement Token Bucket rate limiting middleware",
			Description:    "Protect API and auth routes against credential stuffing and DoS by enforcing configurable request thresholds.",
			Type:           models.IssueTypeTask,
			Status:         models.IssueStatusInReview,
			Priority:       models.IssuePriorityHigh,
			StoryPoints:    &sp3,
			AssigneeID:     &adminUser.ID,
			ReporterID:     adminUser.ID,
			Position:       1.0,
		},
		{
			OrganizationID: org.ID,
			ProjectID:      projAlpha.ID,
			SprintID:       &sprintAlpha.ID,
			Key:            "ALPH-5",
			Number:         5,
			Title:          "Audit and verify CSRF protection on state-changing endpoints",
			Description:    "Ensure all POST/PUT/PATCH/DELETE calls strictly require matching X-CSRF-Token custom headers.",
			Type:           models.IssueTypeBug,
			Status:         models.IssueStatusTodo,
			Priority:       models.IssuePriorityHigh,
			StoryPoints:    &sp2,
			AssigneeID:     &adminUser.ID,
			ReporterID:     adminUser.ID,
			Position:       1.0,
		},
	}

	for i := range issuesAlpha {
		if err := db.Create(&issuesAlpha[i]).Error; err != nil {
			return err
		}
	}

	// Subtasks for ALPH-3
	subtasks := []models.Subtask{
		{IssueID: issuesAlpha[2].ID, Title: "Integrate @hello-pangea/dnd library", IsDone: true, Position: 1},
		{IssueID: issuesAlpha[2].ID, Title: "Design responsive column layout with Tailwind CSS", IsDone: true, Position: 2},
		{IssueID: issuesAlpha[2].ID, Title: "Implement instant optimistic drag feedback & server persistence", IsDone: false, Position: 3},
	}
	for i := range subtasks {
		if err := db.Create(&subtasks[i]).Error; err != nil {
			return err
		}
	}

	// Comment for ALPH-1
	comment := models.Comment{
		IssueID: issuesAlpha[0].ID,
		UserID:  adminUser.ID,
		Content: "Implemented secure double-cookie scheme with 15-minute access token and 7-day refresh token rotation. Anti-CSRF token verification confirmed.",
	}
	if err := db.Create(&comment).Error; err != nil {
		return err
	}

	// 4. Project 2: Nebula Mobile App (Backlog & Planned Sprint)
	projNebula := models.Project{
		OrganizationID: org.ID,
		Key:            "NEB",
		Name:           "Nebula Mobile App",
		Description:    "React Native companion application for on-the-go agile tracking, push notifications, and quick triage.",
		LeadID:         adminUser.ID,
		Color:          "#8b5cf6",
	}
	if err := db.Create(&projNebula).Error; err != nil {
		return err
	}

	startDateNext := now.Add(14 * 24 * time.Hour)
	endDateNext := now.Add(28 * 24 * time.Hour)
	sprintNebula := models.Sprint{
		OrganizationID: org.ID,
		ProjectID:      projNebula.ID,
		Name:           "Sprint 1 - Mobile UI MVP",
		Goal:           "Build mobile design system and native bottom navigation.",
		StartDate:      &startDateNext,
		EndDate:        &endDateNext,
		Status:         models.SprintStatusPlanned,
	}
	if err := db.Create(&sprintNebula).Error; err != nil {
		return err
	}

	sp13 := 13
	issuesNebula := []models.Issue{
		{
			OrganizationID: org.ID,
			ProjectID:      projNebula.ID,
			SprintID:       &sprintNebula.ID,
			Key:            "NEB-1",
			Number:         1,
			Title:          "Design mobile navigation shell and gesture controls",
			Description:    "Implement bottom tab bar with Project switcher and fast ticket creation sheet.",
			Type:           models.IssueTypeStory,
			Status:         models.IssueStatusTodo,
			Priority:       models.IssuePriorityHigh,
			StoryPoints:    &sp5,
			AssigneeID:     &adminUser.ID,
			ReporterID:     adminUser.ID,
			Position:       1.0,
		},
		{
			OrganizationID: org.ID,
			ProjectID:      projNebula.ID,
			SprintID:       nil, // In Backlog
			Key:            "NEB-2",
			Number:         2,
			Title:          "Implement offline data synchronization queue",
			Description:    "Allow users to update ticket statuses and add comments while offline, syncing on reconnect.",
			Type:           models.IssueTypeEpic,
			Status:         models.IssueStatusBacklog,
			Priority:       models.IssuePriorityMedium,
			StoryPoints:    &sp13,
			AssigneeID:     nil,
			ReporterID:     adminUser.ID,
			Position:       1.0,
		},
		{
			OrganizationID: org.ID,
			ProjectID:      projNebula.ID,
			SprintID:       nil, // In Backlog
			Key:            "NEB-3",
			Number:         3,
			Title:          "Fix touch gesture delay on card tap",
			Description:    "Resolve 300ms tap delay in mobile web view when interacting with kanban cards.",
			Type:           models.IssueTypeBug,
			Status:         models.IssueStatusBacklog,
			Priority:       models.IssuePriorityLow,
			StoryPoints:    &sp2,
			AssigneeID:     nil,
			ReporterID:     adminUser.ID,
			Position:       2.0,
		},
	}
	for i := range issuesNebula {
		if err := db.Create(&issuesNebula[i]).Error; err != nil {
			return err
		}
	}

	log.Println("Database seeding completed successfully.")
	log.Printf("Demo Admin Login: %s / %s!", cfg.AdminEmail, cfg.AdminPassword)
	return nil
}
