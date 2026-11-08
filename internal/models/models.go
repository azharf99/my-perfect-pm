package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Base struct {
	ID        string         `gorm:"primaryKey;size:36" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (b *Base) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.NewString()
	}
	return nil
}

type User struct {
	Base
	Email        string `gorm:"size:255;uniqueIndex;not null" json:"email"`
	PasswordHash string `gorm:"size:255;not null" json:"-"`
	FullName     string `gorm:"size:255;not null" json:"full_name"`
	AvatarURL    string `gorm:"size:512" json:"avatar_url"`
	IsActive     bool   `gorm:"default:true" json:"is_active"`

	MustChangePassword bool       `gorm:"default:false" json:"must_change_password"`
	TOTPSecretEnc      string     `gorm:"size:512" json:"-"`
	TOTPEnabled        bool       `gorm:"default:false" json:"totp_enabled"`
	TOTPLastStep       int64      `gorm:"default:0" json:"-"`
	TokenVersion       int        `gorm:"default:0" json:"-"`
	FailedMFAAttempts  int        `gorm:"default:0" json:"-"`
	MFALockedUntil     *time.Time `json:"-"`
	LastLoginAt        *time.Time `json:"last_login_at"`
}

type Organization struct {
	Base
	Name       string `gorm:"size:255;not null" json:"name"`
	Slug       string `gorm:"size:255;uniqueIndex;not null" json:"slug"`
	Enforce2FA bool   `gorm:"column:enforce_2fa;default:false" json:"enforce_2fa"`
}

type RecoveryCode struct {
	Base
	UserID   string     `gorm:"size:36;index;not null" json:"-"`
	CodeHash string     `gorm:"size:255;not null" json:"-"`
	UsedAt   *time.Time `json:"-"`
}

type OrganizationMember struct {
	Base
	OrganizationID string `gorm:"size:36;index;not null" json:"organization_id"`
	UserID         string `gorm:"size:36;index;not null" json:"user_id"`
	Role           string `gorm:"size:32;not null;default:'member'" json:"role"` // admin, member, viewer

	User         *User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Organization *Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
}

type Project struct {
	Base
	OrganizationID string `gorm:"size:36;index;not null" json:"organization_id"`
	Key            string `gorm:"size:16;not null;index" json:"key"` // e.g. ALPH
	Name           string `gorm:"size:255;not null" json:"name"`
	Description    string `gorm:"type:text" json:"description"`
	LeadID         string `gorm:"size:36" json:"lead_id"`
	Color          string `gorm:"size:32;default:'#2563eb'" json:"color"`

	Lead   *User   `gorm:"foreignKey:LeadID" json:"lead,omitempty"`
	Issues []Issue `gorm:"foreignKey:ProjectID" json:"issues,omitempty"`
}

type SprintStatus string

const (
	SprintStatusPlanned   SprintStatus = "planned"
	SprintStatusActive    SprintStatus = "active"
	SprintStatusCompleted SprintStatus = "completed"
)

type Sprint struct {
	Base
	OrganizationID string       `gorm:"size:36;index;not null" json:"organization_id"`
	ProjectID      string       `gorm:"size:36;index;not null" json:"project_id"`
	Name           string       `gorm:"size:255;not null" json:"name"`
	Goal           string       `gorm:"type:text" json:"goal"`
	StartDate      *time.Time   `json:"start_date"`
	EndDate        *time.Time   `json:"end_date"`
	Status         SprintStatus `gorm:"size:32;default:'planned';index" json:"status"`

	Issues []Issue `gorm:"foreignKey:SprintID" json:"issues,omitempty"`
}

type IssueType string

const (
	IssueTypeStory IssueType = "story"
	IssueTypeTask  IssueType = "task"
	IssueTypeBug   IssueType = "bug"
	IssueTypeEpic  IssueType = "epic"
)

type IssueStatus string

const (
	IssueStatusBacklog    IssueStatus = "backlog"
	IssueStatusTodo       IssueStatus = "todo"
	IssueStatusInProgress IssueStatus = "in_progress"
	IssueStatusInReview   IssueStatus = "in_review"
	IssueStatusDone       IssueStatus = "done"
)

type IssuePriority string

const (
	IssuePriorityLowest  IssuePriority = "lowest"
	IssuePriorityLow     IssuePriority = "low"
	IssuePriorityMedium  IssuePriority = "medium"
	IssuePriorityHigh    IssuePriority = "high"
	IssuePriorityHighest IssuePriority = "highest"
)

type Issue struct {
	Base
	OrganizationID string        `gorm:"size:36;index;not null" json:"organization_id"`
	ProjectID      string        `gorm:"size:36;index;not null" json:"project_id"`
	SprintID       *string       `gorm:"size:36;index" json:"sprint_id"`
	Key            string        `gorm:"size:32;not null;index" json:"key"` // e.g. ALPH-12
	Number         int           `gorm:"not null" json:"number"`
	Title          string        `gorm:"size:512;not null" json:"title"`
	Description    string        `gorm:"type:text" json:"description"`
	Type           IssueType     `gorm:"size:32;default:'task'" json:"type"`
	Status         IssueStatus   `gorm:"size:32;default:'todo';index" json:"status"`
	Priority       IssuePriority `gorm:"size:32;default:'medium'" json:"priority"`
	StoryPoints    *int          `json:"story_points"`
	AssigneeID     *string       `gorm:"size:36;index" json:"assignee_id"`
	ReporterID     string        `gorm:"size:36;not null" json:"reporter_id"`
	Position       float64       `gorm:"default:0;index" json:"position"` // For drag & drop ranking

	Assignee *User     `gorm:"foreignKey:AssigneeID" json:"assignee,omitempty"`
	Reporter *User     `gorm:"foreignKey:ReporterID" json:"reporter,omitempty"`
	Project  *Project  `gorm:"foreignKey:ProjectID" json:"project,omitempty"`
	Sprint   *Sprint   `gorm:"foreignKey:SprintID" json:"sprint,omitempty"`
	Subtasks []Subtask `gorm:"foreignKey:IssueID" json:"subtasks,omitempty"`
	Comments []Comment `gorm:"foreignKey:IssueID" json:"comments,omitempty"`
}

type Subtask struct {
	Base
	IssueID  string `gorm:"size:36;index;not null" json:"issue_id"`
	Title    string `gorm:"size:512;not null" json:"title"`
	IsDone   bool   `gorm:"default:false" json:"is_done"`
	Position int    `gorm:"default:0" json:"position"`
}

type Comment struct {
	Base
	IssueID string `gorm:"size:36;index;not null" json:"issue_id"`
	UserID  string `gorm:"size:36;not null" json:"user_id"`
	Content string `gorm:"type:text;not null" json:"content"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type RefreshToken struct {
	Base
	UserID    string    `gorm:"size:36;index;not null" json:"user_id"`
	TokenHash string    `gorm:"size:255;uniqueIndex;not null" json:"-"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	Revoked   bool      `gorm:"default:false" json:"revoked"`

	UserAgent  string    `gorm:"size:255" json:"user_agent"`
	IP         string    `gorm:"size:64" json:"ip"`
	LastUsedAt time.Time `json:"last_used_at"`
}
