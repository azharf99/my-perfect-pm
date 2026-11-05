package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/models"
)

type SprintHandler struct {
	db *gorm.DB
}

func NewSprintHandler(db *gorm.DB) *SprintHandler {
	return &SprintHandler{db: db}
}

type CreateSprintRequest struct {
	Name      string     `json:"name" binding:"required"`
	Goal      string     `json:"goal"`
	StartDate *time.Time `json:"start_date"`
	EndDate   *time.Time `json:"end_date"`
}

type StartSprintRequest struct {
	DurationDays int        `json:"duration_days"`
	StartDate    *time.Time `json:"start_date"`
	EndDate      *time.Time `json:"end_date"`
	Goal         string     `json:"goal"`
}

type CompleteSprintRequest struct {
	MoveIncompleteToSprintID *string `json:"move_incomplete_to_sprint_id"` // null = move to backlog
}

func (h *SprintHandler) ListByProject(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	projectID := c.Param("id")
	if projectID == "" {
		projectID = c.Param("projectId")
	}

	var sprints []models.Sprint
	if err := h.db.Where("organization_id = ? AND project_id = ?", tenantID, projectID).
		Order("CASE status WHEN 'active' THEN 1 WHEN 'planned' THEN 2 ELSE 3 END, created_at DESC").
		Find(&sprints).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sprints"})
		return
	}

	c.JSON(http.StatusOK, sprints)
}

func (h *SprintHandler) Create(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	projectID := c.Param("id")
	if projectID == "" {
		projectID = c.Param("projectId")
	}

	var req CreateSprintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sprint := models.Sprint{
		OrganizationID: tenantID,
		ProjectID:      projectID,
		Name:           req.Name,
		Goal:           req.Goal,
		StartDate:      req.StartDate,
		EndDate:        req.EndDate,
		Status:         models.SprintStatusPlanned,
	}

	if err := h.db.Create(&sprint).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sprint"})
		return
	}

	c.JSON(http.StatusCreated, sprint)
}

func (h *SprintHandler) Start(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	sprintID := c.Param("id")

	var sprint models.Sprint
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, sprintID).First(&sprint).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sprint not found"})
		return
	}

	if sprint.Status == models.SprintStatusActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sprint is already active"})
		return
	}

	var req StartSprintRequest
	_ = c.ShouldBindJSON(&req)

	now := time.Now().UTC()
	sprint.StartDate = &now
	if req.EndDate != nil {
		sprint.EndDate = req.EndDate
	} else {
		duration := 14
		if req.DurationDays > 0 {
			duration = req.DurationDays
		}
		endDate := now.Add(time.Duration(duration) * 24 * time.Hour)
		sprint.EndDate = &endDate
	}

	if req.Goal != "" {
		sprint.Goal = req.Goal
	}

	sprint.Status = models.SprintStatusActive

	if err := h.db.Save(&sprint).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start sprint"})
		return
	}

	c.JSON(http.StatusOK, sprint)
}

func (h *SprintHandler) Complete(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	sprintID := c.Param("id")

	var sprint models.Sprint
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, sprintID).First(&sprint).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sprint not found"})
		return
	}

	var req CompleteSprintRequest
	_ = c.ShouldBindJSON(&req)

	tx := h.db.Begin()

	// Move incomplete issues (status != done) to next sprint or backlog (sprint_id = nil)
	var moveTargetSprintID *string = req.MoveIncompleteToSprintID
	if err := tx.Model(&models.Issue{}).
		Where("sprint_id = ? AND status != ?", sprintID, models.IssueStatusDone).
		Update("sprint_id", moveTargetSprintID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rollover incomplete issues"})
		return
	}

	sprint.Status = models.SprintStatusCompleted
	if err := tx.Save(&sprint).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete sprint"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, sprint)
}
