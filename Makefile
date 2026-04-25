SHELL := /bin/bash
GO_BIN_DIR := $(CURDIR)/server-go/bin

.PHONY: help setup setup-env setup-backend setup-frontend doctor doctor-local fmt fmt-backend dev backend frontend build build-backend build-web test test-backend verify verify-local verify-local-go verify-backend verify-web verify-web-api verify-web-proxy verify-web-build clean clean-backend clean-frontend

help:
	@printf "Available targets:\n"
	@printf "  make setup            Prepare env file, Go deps, and frontend deps\n"
	@printf "  make doctor           Check shared repo prerequisites\n"
	@printf "  make doctor-local     Check local Go-backed prerequisites\n"
	@printf "  make fmt              Format Go source\n"
	@printf "  make dev              Run backend and frontend together\n"
	@printf "  make backend          Run the Gin backend only\n"
	@printf "  make frontend         Run the Next.js frontend only\n"
	@printf "  make build            Build backend and frontend\n"
	@printf "  make build-backend    Build the Go backend binary\n"
	@printf "  make build-web        Build the Next.js frontend\n"
	@printf "  make test             Run Go backend tests\n"
	@printf "  make verify           Run web verification\n"
	@printf "  make verify-local     Run local-mode verification\n"
	@printf "  make verify-local-go  Smoke-test the real Next-to-Go local path\n"
	@printf "  make verify-backend   Run Go backend tests\n"
	@printf "  make verify-web       Run web verification suite\n"
	@printf "  make clean            Remove generated artifacts\n"

setup: setup-env setup-backend setup-frontend
	@printf "\nSetup complete.\n"
	@printf "Next steps:\n"
	@printf "  1. Run: agora project env write server-go/.env.local --with-secrets\n"
	@printf "  2. Run: make doctor-local\n"
	@printf "  3. Run: make dev\n"

setup-env:
	@if [ ! -f server-go/.env.local ]; then \
		cp server-go/.env.example server-go/.env.local; \
		printf "\nCreated server-go/.env.local. Edit your Agora credentials before running the app.\n"; \
	fi

setup-backend:
	cd server-go && go mod tidy

setup-frontend:
	@if [ ! -d node_modules ]; then \
		printf "Installing workspace dependencies...\n"; \
		pnpm install; \
	fi

doctor:
	@set -e; \
	printf "Checking shared repo prerequisites...\n"; \
	command -v pnpm >/dev/null && printf -- "- pnpm available\n" || { printf -- "- pnpm not found\n"; exit 1; }; \
	test -d node_modules && printf -- "- workspace dependencies installed\n" || { printf -- "- root node_modules missing; run make setup-frontend\n"; exit 1; }

doctor-local: doctor
	@set -e; \
	command -v go >/dev/null && printf -- "- go available\n" || { printf -- "- go not found\n"; exit 1; }; \
	GO_VERSION="$$(go env GOVERSION | sed 's/^go//')"; \
	case "$$GO_VERSION" in \
		1.23*|1.24*|1.25*|1.26*|2.*) printf -- "- go version $$GO_VERSION\n" ;; \
		*) printf -- "- go 1.23 or newer is required; found $$GO_VERSION\n"; exit 1 ;; \
	esac; \
	test -f server-go/.env.local && printf -- "- server-go/.env.local present\n" || { printf -- "- missing server-go/.env.local\n"; exit 1; }; \
	grep -Eq '^AGORA_APP_ID=.+$$' server-go/.env.local && printf -- "- AGORA_APP_ID configured\n" || { printf -- "- AGORA_APP_ID missing in server-go/.env.local\n"; exit 1; }; \
	grep -Eq '^AGORA_APP_CERTIFICATE=.+$$' server-go/.env.local && printf -- "- AGORA_APP_CERTIFICATE configured\n" || { printf -- "- AGORA_APP_CERTIFICATE missing in server-go/.env.local\n"; exit 1; }

fmt: fmt-backend

fmt-backend:
	cd server-go && gofmt -w *.go cmd/fake-server/*.go

dev:
	@set -e; \
	$(MAKE) setup-env >/dev/null; \
	trap 'kill 0' EXIT; \
	( cd server-go && go run . ) & \
	( cd web-client && AGENT_BACKEND_URL=http://localhost:8000 pnpm dev ) & \
	wait

backend:
	cd server-go && go run .

frontend:
	cd web-client && AGENT_BACKEND_URL=http://localhost:8000 pnpm dev

build: build-backend build-web

build-backend:
	mkdir -p "$(GO_BIN_DIR)"
	cd server-go && go build -o "$(GO_BIN_DIR)/agent-quickstart-go" .

build-web:
	cd web-client && pnpm build

test: test-backend

test-backend: verify-backend

verify: verify-web

verify-local: doctor-local verify-backend verify-local-go verify-web-proxy verify-web-build

verify-local-go:
	cd web-client && pnpm node --import tsx scripts/verify-local-go.ts

verify-backend:
	cd server-go && go test ./...

verify-web: doctor verify-web-api verify-web-build

verify-web-api:
	cd web-client && pnpm node --import tsx scripts/verify-api-contracts.ts

verify-web-proxy:
	cd web-client && pnpm node --import tsx scripts/verify-local-proxy.ts

verify-web-build: build-web

clean: clean-backend clean-frontend

clean-backend:
	rm -rf server-go/bin

clean-frontend:
	rm -rf node_modules web-client/node_modules web-client/.next web-client/dist
