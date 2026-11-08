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

type DeleteProjectRequest struct {
	ConfirmKey string `json:"confirm_key" binding:"required"`
}

type ProjectSummary struct {
	models.Project
	TotalIssues      int     `json:"total_issues"`
	DoneIssues       int     `json:"done_issues"`
	ActiveSprintID   *string `json:"active_sprint_id,omitempty"`
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
			TotalIssues:      int(totalCount),
			DoneIssues:       int(doneCount),
			ActiveSprintID:   sprintID,
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
		Name:           strings.TrimSpace(req.Name),
		Description:    strings.TrimSpace(req.Description),
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
	userID := middleware.GetUserID(c)
	userRole := middleware.GetUserRole(c)
	projectID := c.Param("id")

	var project models.Project
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// RBAC: Only Admin or Project Lead can edit
	if userRole != middleware.RoleAdmin && project.LeadID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins or the project lead can update this project"})
		return
	}

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If lead is being changed, ensure the new lead is a member of the same workspace
	if req.LeadID != "" && req.LeadID != project.LeadID {
		var member models.OrganizationMember
		if err := h.db.Where("organization_id = ? AND user_id = ?", tenantID, req.LeadID).First(&member).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Selected project lead is not a member of this workspace"})
			return
		}
		project.LeadID = req.LeadID
	}

	project.Name = strings.TrimSpace(req.Name)
	project.Description = strings.TrimSpace(req.Description)
	if req.Color != "" {
		project.Color = req.Color
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
	userID := middleware.GetUserID(c)
	userRole := middleware.GetUserRole(c)
	projectID := c.Param("id")

	var project models.Project
	if err := h.db.Where("organization_id = ? AND id = ?", tenantID, projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// RBAC: Only Admin or Project Lead can delete
	if userRole != middleware.RoleAdmin && project.LeadID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins or the project lead can delete this project"})
		return
	}

	var req DeleteProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide confirm_key to delete the project"})
		return
	}

	if strings.TrimSpace(req.ConfirmKey) != project.Key {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Confirmation key does not match project key"})
		return
	}

	// Transaction to cascade delete
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Get all issue IDs for this project
		var issueIDs []string
		if err := tx.Model(&models.Issue{}).Where("project_id = ?", project.ID).Pluck("id", &issueIDs).Error; err != nil {
			return err
		}

		if len(issueIDs) > 0 {
			// 2. Delete comments
			if err := tx.Where("issue_id IN ?", issueIDs).Delete(&models.Comment{}).Error; err != nil {
				return err
			}
			// 3. Delete subtasks
			if err := tx.Where("issue_id IN ?", issueIDs).Delete(&models.Subtask{}).Error; err != nil {
				return err
			}
			// 4. Delete issues
			if err := tx.Where("id IN ?", issueIDs).Delete(&models.Issue{}).Error; err != nil {
				return err
			}
		}

		// 5. Delete sprints
		if err := tx.Where("project_id = ?", project.ID).Delete(&models.Sprint{}).Error; err != nil {
			return err
		}

		// 6. Delete project
		if err := tx.Where("id = ?", project.ID).Delete(&models.Project{}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}
