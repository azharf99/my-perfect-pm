package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/models"
)

type IssueHandler struct {
	db *gorm.DB
}

func NewIssueHandler(db *gorm.DB) *IssueHandler {
	return &IssueHandler{db: db}
}

type CreateIssueRequest struct {
	ProjectID   string               `json:"project_id" binding:"required"`
	SprintID    *string              `json:"sprint_id"`
	Title       string               `json:"title" binding:"required,min=1,max=512"`
	Description string               `json:"description"`
	Type        models.IssueType     `json:"type"`
	Status      models.IssueStatus   `json:"status"`
	Priority    models.IssuePriority `json:"priority"`
	StoryPoints *int                 `json:"story_points"`
	AssigneeID  *string              `json:"assignee_id"`
}

type UpdateIssueRequest struct {
	Title       string               `json:"title" binding:"required,min=1,max=512"`
	Description string               `json:"description"`
	Type        models.IssueType     `json:"type"`
	Status      models.IssueStatus   `json:"status"`
	Priority    models.IssuePriority `json:"priority"`
	StoryPoints *int                 `json:"story_points"`
	AssigneeID  *string              `json:"assignee_id"`
	SprintID    *string              `json:"sprint_id"`
}

type MoveIssueRequest struct {
	Status   *models.IssueStatus `json:"status"`
	SprintID *string             `json:"sprint_id"`
	Position float64             `json:"position"`
}

func (h *IssueHandler) List(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	projectID := c.Query("project_id")
	sprintID := c.Query("sprint_id")
	status := c.Query("status")
	assigneeID := c.Query("assignee_id")
	search := c.Query("search")
	isBacklog := c.Query("backlog") // "true" means sprint_id is null or empty

	query := h.db.Where("organization_id = ?", tenantID)

	if projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}

	if isBacklog == "true" {
		query = query.Where("sprint_id IS NULL OR sprint_id = ''")
	} else if sprintID != "" {
		query = query.Where("sprint_id = ?", sprintID)
	}

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if assigneeID != "" {
		query = query.Where("assignee_id = ?", assigneeID)
	}

	if search != "" {
		searchTerm := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(title) LIKE ? OR LOWER(key) LIKE ? OR LOWER(description) LIKE ?", searchTerm, searchTerm, searchTerm)
	}

	var issues []models.Issue
	if err := query.Preload("Assignee").Preload("Reporter").Preload("Project").Preload("Subtasks").Order("position ASC, created_at ASC").Find(&issues).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query issues"})
		return
	}

	c.JSON(http.StatusOK, issues)
}

func (h *IssueHandler) Create(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	userID := middleware.GetUserID(c)

	var req CreateIssueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify project exists in tenant
	var project models.Project
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, req.ProjectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Determine next issue number for project
	var maxNumber int
	row := h.db.Model(&models.Issue{}).Where("project_id = ?", project.ID).Select("COALESCE(MAX(number), 0)").Row()
	_ = row.Scan(&maxNumber)
	nextNumber := maxNumber + 1
	issueKey := fmt.Sprintf("%s-%d", project.Key, nextNumber)

	issueType := req.Type
	if issueType == "" {
		issueType = models.IssueTypeTask
	}

	issueStatus := req.Status
	if issueStatus == "" {
		if req.SprintID != nil && *req.SprintID != "" {
			issueStatus = models.IssueStatusTodo
		} else {
			issueStatus = models.IssueStatusBacklog
		}
	}

	priority := req.Priority
	if priority == "" {
		priority = models.IssuePriorityMedium
	}

	// Determine position (append to bottom)
	var maxPos float64
	rowPos := h.db.Model(&models.Issue{}).Where("project_id = ? AND status = ?", project.ID, issueStatus).Select("COALESCE(MAX(position), 0)").Row()
	_ = rowPos.Scan(&maxPos)

	issue := models.Issue{
		OrganizationID: tenantID,
		ProjectID:      project.ID,
		SprintID:       req.SprintID,
		Key:            issueKey,
		Number:         nextNumber,
		Title:          req.Title,
		Description:    req.Description,
		Type:           issueType,
		Status:         issueStatus,
		Priority:       priority,
		StoryPoints:    req.StoryPoints,
		AssigneeID:     req.AssigneeID,
		ReporterID:     userID,
		Position:       maxPos + 1.0,
	}

	if err := h.db.Create(&issue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create issue"})
		return
	}

	h.db.Preload("Assignee").Preload("Reporter").Preload("Project").First(&issue, "id = ?", issue.ID)
	c.JSON(http.StatusCreated, issue)
}

func (h *IssueHandler) Get(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	issueID := c.Param("id")

	var issue models.Issue
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, issueID).
		Preload("Assignee").
		Preload("Reporter").
		Preload("Project").
		Preload("Sprint").
		Preload("Subtasks", func(db *gorm.DB) *gorm.DB {
			return db.Order("position ASC, created_at ASC")
		}).
		Preload("Comments", func(db *gorm.DB) *gorm.DB {
			return db.Preload("User").Order("created_at ASC")
		}).
		First(&issue).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
		return
	}

	c.JSON(http.StatusOK, issue)
}

func (h *IssueHandler) Update(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	issueID := c.Param("id")

	var issue models.Issue
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, issueID).First(&issue).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
		return
	}

	var req UpdateIssueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	issue.Title = req.Title
	issue.Description = req.Description
	if req.Type != "" {
		issue.Type = req.Type
	}
	if req.Status != "" {
		issue.Status = req.Status
	}
	if req.Priority != "" {
		issue.Priority = req.Priority
	}
	issue.StoryPoints = req.StoryPoints
	issue.AssigneeID = req.AssigneeID
	issue.SprintID = req.SprintID

	if err := h.db.Save(&issue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update issue"})
		return
	}

	h.db.Preload("Assignee").Preload("Reporter").Preload("Project").Preload("Subtasks").First(&issue, "id = ?", issue.ID)
	c.JSON(http.StatusOK, issue)
}

func (h *IssueHandler) Move(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	issueID := c.Param("id")

	var issue models.Issue
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, issueID).First(&issue).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Issue not found"})
		return
	}

	var req MoveIssueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status != nil && *req.Status != "" {
		issue.Status = *req.Status
	}
	if req.SprintID != nil {
		if *req.SprintID == "" {
			issue.SprintID = nil
		} else {
			issue.SprintID = req.SprintID
		}
	}
	issue.Position = req.Position

	if err := h.db.Save(&issue).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update issue position"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Issue moved successfully",
		"id":       issue.ID,
		"status":   issue.Status,
		"sprint_id": issue.SprintID,
		"position": issue.Position,
	})
}

func (h *IssueHandler) Delete(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	issueID := c.Param("id")

	// Cascade delete subtasks & comments
	h.db.Where("issue_id = ?", issueID).Delete(&models.Subtask{})
	h.db.Where("issue_id = ?", issueID).Delete(&models.Comment{})

	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, issueID).Delete(&models.Issue{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete issue"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Issue deleted successfully"})
}
