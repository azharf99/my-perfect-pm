package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/models"
)

type ProjectHandler struct {
	db *gorm.DB
}

func NewProjectHandler(db *gorm.DB) *ProjectHandler {
	return &ProjectHandler{db: db}
}

type CreateProjectRequest struct {
	Key         string `json:"key" binding:"required,min=2,max=10"`
	Name        string `json:"name" binding:"required,min=2,max=255"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

type UpdateProjectRequest struct {
	Name        string `json:"name" binding:"required,min=2,max=255"`
	Description string `json:"description"`
	Color       string `json:"color"`
	LeadID      string `json:"lead_id"`
}

type ProjectSummary struct {
	models.Project
	TotalIssues     int `json:"total_issues"`
	DoneIssues      int `json:"done_issues"`
	ActiveSprintID  *string `json:"active_sprint_id,omitempty"`
	ActiveSprintName string  `json:"active_sprint_name,omitempty"`
}

func (h *ProjectHandler) List(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var projects []models.Project
	if err := h.db.Where("organization_id = ?", tenantID).Preload("Lead").Order("created_at DESC").Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch projects"})
		return
	}

	summaries := make([]ProjectSummary, len(projects))
	for i, p := range projects {
		var totalCount, doneCount int64
		h.db.Model(&models.Issue{}).Where("project_id = ?", p.ID).Count(&totalCount)
		h.db.Model(&models.Issue{}).Where("project_id = ? AND status = ?", p.ID, models.IssueStatusDone).Count(&doneCount)

		var activeSprint models.Sprint
		var sprintID *string
		var sprintName string
		if err := h.db.Where("project_id = ? AND status = ?", p.ID, models.SprintStatusActive).First(&activeSprint).Error; err == nil {
			sprintID = &activeSprint.ID
			sprintName = activeSprint.Name
		}

		summaries[i] = ProjectSummary{
			Project:          p,
			TotalIssues:     int(totalCount),
			DoneIssues:      int(doneCount),
			ActiveSprintID:  sprintID,
			ActiveSprintName: sprintName,
		}
	}

	c.JSON(http.StatusOK, summaries)
}

func (h *ProjectHandler) Create(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	userID := middleware.GetUserID(c)

	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Key = strings.ToUpper(strings.TrimSpace(req.Key))

	// Check if key already exists in this tenant
	var existing models.Project
	if err := h.db.Where("organization_id = ? AND key = ?", tenantID, req.Key).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "A project with this key already exists"})
		return
	}

	color := req.Color
	if color == "" {
		color = "#2563eb"
	}

	project := models.Project{
		OrganizationID: tenantID,
		Key:            req.Key,
		Name:           req.Name,
		Description:    req.Description,
		LeadID:         userID,
		Color:          color,
	}

	if err := h.db.Create(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	h.db.Preload("Lead").First(&project, "id = ?", project.ID)
	c.JSON(http.StatusCreated, project)
}

func (h *ProjectHandler) Get(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	projectID := c.Param("id")

	var project models.Project
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, projectID).Preload("Lead").First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) Update(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	projectID := c.Param("id")

	var project models.Project
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	project.Name = req.Name
	project.Description = req.Description
	if req.Color != "" {
		project.Color = req.Color
	}
	if req.LeadID != "" {
		project.LeadID = req.LeadID
	}

	if err := h.db.Save(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	h.db.Preload("Lead").First(&project, "id = ?", project.ID)
	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) Delete(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	projectID := c.Param("id")

	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, projectID).Delete(&models.Project{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

func (h *ProjectHandler) ListMembers(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var members []models.OrganizationMember
	if err := h.db.Where("organization_id = ?", tenantID).Preload("User").Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load members"})
		return
	}

	c.JSON(http.StatusOK, members)
}
