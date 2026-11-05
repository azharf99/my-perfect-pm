package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"my-perfect-pm/internal/models"
)

type SubtaskHandler struct {
	db *gorm.DB
}

func NewSubtaskHandler(db *gorm.DB) *SubtaskHandler {
	return &SubtaskHandler{db: db}
}

type CreateSubtaskRequest struct {
	Title string `json:"title" binding:"required"`
}

type UpdateSubtaskRequest struct {
	Title  *string `json:"title"`
	IsDone *bool   `json:"is_done"`
}

func (h *SubtaskHandler) Create(c *gin.Context) {
	issueID := c.Param("id")
	if issueID == "" {
		issueID = c.Param("issueId")
	}

	var req CreateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var maxPos int
	row := h.db.Model(&models.Subtask{}).Where("issue_id = ?", issueID).Select("COALESCE(MAX(position), 0)").Row()
	_ = row.Scan(&maxPos)

	subtask := models.Subtask{
		IssueID:  issueID,
		Title:    req.Title,
		IsDone:   false,
		Position: maxPos + 1,
	}

	if err := h.db.Create(&subtask).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subtask"})
		return
	}

	c.JSON(http.StatusCreated, subtask)
}

func (h *SubtaskHandler) Update(c *gin.Context) {
	subtaskID := c.Param("id")

	var subtask models.Subtask
	if err := h.db.First(&subtask, "id = ?", subtaskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subtask not found"})
		return
	}

	var req UpdateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Title != nil {
		subtask.Title = *req.Title
	}
	if req.IsDone != nil {
		subtask.IsDone = *req.IsDone
	}

	if err := h.db.Save(&subtask).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subtask"})
		return
	}

	c.JSON(http.StatusOK, subtask)
}

func (h *SubtaskHandler) Delete(c *gin.Context) {
	subtaskID := c.Param("id")

	if err := h.db.Delete(&models.Subtask{}, "id = ?", subtaskID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete subtask"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subtask deleted successfully"})
}
