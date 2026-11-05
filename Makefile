.PHONY: dev build run test docker-build docker-up clean

# Development: Run backend (frontend run separately via cd web && npm run dev)
dev:
	go run ./cmd/server

# Build everything into a single standalone binary
build:
	cd web && npm run build
	mkdir -p cmd/server/dist
	cp -r web/dist/* cmd/server/dist/
	CGO_ENABLED=0 go build -ldflags="-s -w" -o my-perfect-pm ./cmd/server

# Run tests
test:
	go test -v ./...
	cd web && npm run build

# Docker build (~25MB)
docker-build:
	docker build -t my-perfect-pm:latest .

# Run via docker compose
docker-up:
	docker compose up -d

clean:
	rm -rf my-perfect-pm cmd/server/dist/* web/dist pm.db*
