package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/models"
)

type WorkspaceHandler struct {
	db *gorm.DB
}

func NewWorkspaceHandler(db *gorm.DB) *WorkspaceHandler {
	return &WorkspaceHandler{db: db}
}

type UpdateWorkspaceRequest struct {
	Name       *string `json:"name"`
	Enforce2FA *bool   `json:"enforce_2fa"`
}

func (h *WorkspaceHandler) Get(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var org models.Organization
	if err := h.db.First(&org, "id = ?", tenantID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	// Also count members without 2FA
	var totalMembers int64
	var membersWithout2FA int64
	h.db.Model(&models.OrganizationMember{}).Where("organization_id = ?", tenantID).Count(&totalMembers)
	h.db.Model(&models.OrganizationMember{}).
		Joins("JOIN users ON users.id = organization_members.user_id").
		Where("organization_members.organization_id = ? AND users.totp_enabled = ?", tenantID, false).
		Count(&membersWithout2FA)

	c.JSON(http.StatusOK, gin.H{
		"workspace":             org,
		"total_members":         totalMembers,
		"members_without_2fa":   membersWithout2FA,
	})
}

func (h *WorkspaceHandler) Update(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var org models.Organization
	if err := h.db.First(&org, "id = ?", tenantID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	var req UpdateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		if len(trimmed) < 2 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Workspace name must be at least 2 characters"})
			return
		}
		org.Name = trimmed
	}

	if req.Enforce2FA != nil {
		org.Enforce2FA = *req.Enforce2FA
	}

	if err := h.db.Save(&org).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update workspace"})
		return
	}

	c.JSON(http.StatusOK, org)
}
