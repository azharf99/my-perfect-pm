package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"my-perfect-pm/internal/models"
)

var DB *gorm.DB

func InitDB(dbPath string) (*gorm.DB, error) {
	dir := filepath.Dir(dbPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create db directory %s: %w", dir, err)
		}

		// Verify write permissions in database directory
		testFile := filepath.Join(dir, ".perm_check")
		if f, err := os.OpenFile(testFile, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644); err != nil {
			return nil, fmt.Errorf("database directory %s is not writable (permission denied): %w. Please ensure the user has write access to %s (e.g. run 'sudo chmod -R 777 ./data' on host)", dir, err, dir)
		} else {
			_ = f.Close()
			_ = os.Remove(testFile)
		}
	}

	dsn := fmt.Sprintf("%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", dbPath)

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get sql.DB: %w", err)
	}

	// SQLite optimal connection pool settings for WAL mode:
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Execute SQLite PRAGMAs explicitly
	if _, err := sqlDB.Exec("PRAGMA journal_mode = WAL;"); err != nil {
		log.Printf("Warning: failed to set WAL mode: %v", err)
	}
	if _, err := sqlDB.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		log.Printf("Warning: failed to enable foreign keys: %v", err)
	}
	if _, err := sqlDB.Exec("PRAGMA busy_timeout = 5000;"); err != nil {
		log.Printf("Warning: failed to set busy timeout: %v", err)
	}

	// Auto migrate entities
	err = db.AutoMigrate(
		&models.User{},
		&models.Organization{},
		&models.OrganizationMember{},
		&models.Project{},
		&models.Sprint{},
		&models.Issue{},
		&models.Subtask{},
		&models.Comment{},
		&models.RefreshToken{},
		&models.RecoveryCode{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to auto migrate tables: %w", err)
	}

	DB = db
	return db, nil
}
