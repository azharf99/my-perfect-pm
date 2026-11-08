package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/middleware"
	"my-perfect-pm/internal/models"
	"my-perfect-pm/internal/security"
)

type MemberHandler struct {
	db *gorm.DB
}

func NewMemberHandler(db *gorm.DB) *MemberHandler {
	return &MemberHandler{db: db}
}

type AddMemberRequest struct {
	Email    string `json:"email" binding:"required,email"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

// ensureNotLastAdmin checks if modifying/deactivating this member leaves 0 active admins in the workspace.
func (h *MemberHandler) ensureNotLastAdmin(tx *gorm.DB, tenantID, targetUserID string) error {
	var target models.OrganizationMember
	if err := tx.Where("organization_id = ? AND user_id = ?", tenantID, targetUserID).First(&target).Error; err != nil {
		return err
	}
	if target.Role != middleware.RoleAdmin {
		return nil
	}
	var adminCount int64
	tx.Model(&models.OrganizationMember{}).
		Joins("JOIN users ON users.id = organization_members.user_id").
		Where("organization_members.organization_id = ? AND organization_members.role = ? AND users.is_active = ?", tenantID, middleware.RoleAdmin, true).
		Count(&adminCount)

	if adminCount <= 1 {
		return errors.New("cannot perform action on the last active admin of the workspace")
	}
	return nil
}

func (h *MemberHandler) List(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var members []models.OrganizationMember
	if err := h.db.Where("organization_id = ?", tenantID).
		Preload("User").
		Order("created_at ASC").
		Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load workspace members"})
		return
	}

	c.JSON(http.StatusOK, members)
}

func (h *MemberHandler) Add(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var req AddMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A valid email is required"})
		return
	}

	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role == "" {
		role = middleware.RoleMember
	}
	if !middleware.IsValidRole(role) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Allowed roles: admin, member, viewer"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	var tempPassword string
	var member models.OrganizationMember

	err := h.db.Transaction(func(tx *gorm.DB) error {
		var user models.User
		err := tx.Where("email = ?", email).First(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Create user with temporary password and force change on first login
			var genErr error
			tempPassword, genErr = security.GenerateTempPassword()
			if genErr != nil {
				return genErr
			}
			hashed, hashErr := security.HashPassword(tempPassword)
			if hashErr != nil {
				return hashErr
			}
			fullName := strings.TrimSpace(req.FullName)
			if fullName == "" {
				fullName = strings.Split(email, "@")[0]
			}
			user = models.User{
				Email:              email,
				PasswordHash:       hashed,
				FullName:           fullName,
				IsActive:           true,
				MustChangePassword: true,
			}
			if err := tx.Create(&user).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		// Check if already a member of this workspace
		var existing models.OrganizationMember
		if err := tx.Where("organization_id = ? AND user_id = ?", tenantID, user.ID).First(&existing).Error; err == nil {
			return errors.New("user is already a member of this workspace")
		}

		member = models.OrganizationMember{
			OrganizationID: tenantID,
			UserID:         user.ID,
			Role:           role,
		}
		if err := tx.Create(&member).Error; err != nil {
			return err
		}
		member.User = &user
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp := gin.H{
		"member": member,
	}
	if tempPassword != "" {
		resp["temp_password"] = tempPassword
		resp["message"] = "User created. Please share the temporary password with them. They will be prompted to change it on first login."
	} else {
		resp["message"] = "Existing user added to workspace."
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *MemberHandler) UpdateRole(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	targetUserID := c.Param("userId")

	var req UpdateMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role is required"})
		return
	}

	newRole := strings.ToLower(strings.TrimSpace(req.Role))
	if !middleware.IsValidRole(newRole) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if newRole != middleware.RoleAdmin {
			if err := h.ensureNotLastAdmin(tx, tenantID, targetUserID); err != nil {
				return err
			}
		}
		res := tx.Model(&models.OrganizationMember{}).
			Where("organization_id = ? AND user_id = ?", tenantID, targetUserID).
			Update("role", newRole)
		if res.RowsAffected == 0 {
			return errors.New("member not found in this workspace")
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role updated successfully"})
}

func (h *MemberHandler) Deactivate(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	targetUserID := c.Param("userId")

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := h.ensureNotLastAdmin(tx, tenantID, targetUserID); err != nil {
			return err
		}

		var user models.User
		if err := tx.First(&user, "id = ?", targetUserID).Error; err != nil {
			return err
		}

		// Deactivate and revoke sessions
		if err := tx.Model(&user).Updates(map[string]interface{}{
			"is_active":     false,
			"token_version": user.TokenVersion + 1,
		}).Error; err != nil {
			return err
		}

		return tx.Model(&models.RefreshToken{}).Where("user_id = ?", user.ID).Update("revoked", true).Error
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deactivated successfully"})
}

func (h *MemberHandler) Activate(c *gin.Context) {
	targetUserID := c.Param("userId")

	if err := h.db.Model(&models.User{}).Where("id = ?", targetUserID).Update("is_active", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to activate user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User activated successfully"})
}

func (h *MemberHandler) ResetPassword(c *gin.Context) {
	targetUserID := c.Param("userId")

	var user models.User
	if err := h.db.First(&user, "id = ?", targetUserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	tempPassword, err := security.GenerateTempPassword()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate password"})
		return
	}

	hashed, err := security.HashPassword(tempPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&user).Updates(map[string]interface{}{
			"password_hash":         hashed,
			"must_change_password":  true,
			"token_version":         user.TokenVersion + 1,
			"failed_mfa_attempts":   0,
			"mfa_locked_until":      nil,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&models.RefreshToken{}).Where("user_id = ?", user.ID).Update("revoked", true).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"temp_password": tempPassword,
		"message":       "Password reset. Provide this temporary password to the user.",
	})
}

func (h *MemberHandler) Reset2FA(c *gin.Context) {
	targetUserID := c.Param("userId")

	var user models.User
	if err := h.db.First(&user, "id = ?", targetUserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&user).Updates(map[string]interface{}{
			"totp_enabled":        false,
			"totp_secret_enc":     "",
			"totp_last_step":      0,
			"failed_mfa_attempts": 0,
			"mfa_locked_until":    nil,
		}).Error; err != nil {
			return err
		}
		return tx.Unscoped().Where("user_id = ?", user.ID).Delete(&models.RecoveryCode{}).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset 2FA"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Two-factor authentication has been reset for this user"})
}

func (h *MemberHandler) Remove(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	targetUserID := c.Param("userId")

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := h.ensureNotLastAdmin(tx, tenantID, targetUserID); err != nil {
			return err
		}

		// Unassign any issues in this workspace assigned to this user
		if err := tx.Model(&models.Issue{}).
			Where("organization_id = ? AND assignee_id = ?", tenantID, targetUserID).
			Update("assignee_id", nil).Error; err != nil {
			return err
		}

		// Delete membership
		res := tx.Where("organization_id = ? AND user_id = ?", tenantID, targetUserID).
			Delete(&models.OrganizationMember{})
		if res.RowsAffected == 0 {
			return errors.New("member not found in this workspace")
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed from workspace"})
}
