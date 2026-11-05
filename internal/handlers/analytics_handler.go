package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/models"
)

type AnalyticsHandler struct {
	db *gorm.DB
}

func NewAnalyticsHandler(db *gorm.DB) *AnalyticsHandler {
	return &AnalyticsHandler{db: db}
}

type ProjectProgress struct {
	ID                   string  `json:"id"`
	Key                  string  `json:"key"`
	Name                 string  `json:"name"`
	Color                string  `json:"color"`
	TotalIssues          int     `json:"total_issues"`
	DoneIssues           int     `json:"done_issues"`
	CompletionPercentage float64 `json:"completion_percentage"`
	TotalStoryPoints     int     `json:"total_story_points"`
	DoneStoryPoints      int     `json:"done_story_points"`
	ActiveSprintName     string  `json:"active_sprint_name,omitempty"`
}

type CrossProjectAnalytics struct {
	TotalProjects        int                    `json:"total_projects"`
	TotalIssues          int                    `json:"total_issues"`
	CompletedIssues      int                    `json:"completed_issues"`
	InProgressIssues     int                    `json:"in_progress_issues"`
	OpenIssues           int                    `json:"open_issues"`
	TotalStoryPoints     int                    `json:"total_story_points"`
	CompletedStoryPoints int                    `json:"completed_story_points"`
	ActiveSprints        int                    `json:"active_sprints"`
	OverallProgress      float64                `json:"overall_progress"`
	Projects             []ProjectProgress      `json:"projects"`
	StatusDistribution   map[string]int         `json:"status_distribution"`
	TypeDistribution     map[string]int         `json:"type_distribution"`
	PriorityDistribution map[string]int         `json:"priority_distribution"`
}

func (h *AnalyticsHandler) GetDashboard(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var projects []models.Project
	if err := h.db.Where("organization_id = ?", tenantID).Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch projects"})
		return
	}

	var allIssues []models.Issue
	if err := h.db.Where("organization_id = ?", tenantID).Find(&allIssues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch issues"})
		return
	}

	var activeSprintsCount int64
	h.db.Model(&models.Sprint{}).Where("organization_id = ? AND status = ?", tenantID, models.SprintStatusActive).Count(&activeSprintsCount)

	statusDist := map[string]int{
		"backlog":     0,
		"todo":        0,
		"in_progress": 0,
		"in_review":   0,
		"done":        0,
	}
	typeDist := map[string]int{
		"story": 0,
		"task":  0,
		"bug":   0,
		"epic":  0,
	}
	priorityDist := map[string]int{
		"lowest":  0,
		"low":     0,
		"medium":  0,
		"high":    0,
		"highest": 0,
	}

	totalPoints := 0
	donePoints := 0
	completedIssues := 0
	inProgressIssues := 0
	openIssues := 0

	projectIssueMap := make(map[string][]models.Issue)
	for _, issue := range allIssues {
		projectIssueMap[issue.ProjectID] = append(projectIssueMap[issue.ProjectID], issue)

		statusDist[string(issue.Status)]++
		typeDist[string(issue.Type)]++
		priorityDist[string(issue.Priority)]++

		sp := 0
		if issue.StoryPoints != nil {
			sp = *issue.StoryPoints
		}
		totalPoints += sp

		if issue.Status == models.IssueStatusDone {
			completedIssues++
			donePoints += sp
		} else if issue.Status == models.IssueStatusInProgress || issue.Status == models.IssueStatusInReview {
			inProgressIssues++
		} else {
			openIssues++
		}
	}

	projectProgressList := make([]ProjectProgress, len(projects))
	for i, p := range projects {
		pIssues := projectIssueMap[p.ID]
		pTotal := len(pIssues)
		pDone := 0
		pTotalSP := 0
		pDoneSP := 0

		for _, issue := range pIssues {
			sp := 0
			if issue.StoryPoints != nil {
				sp = *issue.StoryPoints
			}
			pTotalSP += sp

			if issue.Status == models.IssueStatusDone {
				pDone++
				pDoneSP += sp
			}
		}

		var pct float64
		if pTotal > 0 {
			pct = float64(pDone) / float64(pTotal) * 100.0
		}

		var activeSprint models.Sprint
		var activeSprintName string
		if err := h.db.Where("project_id = ? AND status = ?", p.ID, models.SprintStatusActive).First(&activeSprint).Error; err == nil {
			activeSprintName = activeSprint.Name
		}

		projectProgressList[i] = ProjectProgress{
			ID:                   p.ID,
			Key:                  p.Key,
			Name:                 p.Name,
			Color:                p.Color,
			TotalIssues:          pTotal,
			DoneIssues:           pDone,
			CompletionPercentage: pct,
			TotalStoryPoints:     pTotalSP,
			DoneStoryPoints:      pDoneSP,
			ActiveSprintName:     activeSprintName,
		}
	}

	overallPct := 0.0
	if len(allIssues) > 0 {
		overallPct = float64(completedIssues) / float64(len(allIssues)) * 100.0
	}

	analytics := CrossProjectAnalytics{
		TotalProjects:        len(projects),
		TotalIssues:          len(allIssues),
		CompletedIssues:      completedIssues,
		InProgressIssues:     inProgressIssues,
		OpenIssues:           openIssues,
		TotalStoryPoints:     totalPoints,
		CompletedStoryPoints: donePoints,
		ActiveSprints:        int(activeSprintsCount),
		OverallProgress:      overallPct,
		Projects:             projectProgressList,
		StatusDistribution:   statusDist,
		TypeDistribution:     typeDist,
		PriorityDistribution: priorityDist,
	}

	c.JSON(http.StatusOK, analytics)
}
