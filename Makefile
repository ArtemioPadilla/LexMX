# LexMX - Mexican Legal AI Assistant
# Comprehensive Makefile for developer workflow automation

# Configuration
NODE_VERSION := 18
DIST_DIR := dist
PUBLIC_DIR := public
CORPUS_DIR := $(PUBLIC_DIR)/legal-corpus
EMBEDDINGS_DIR := $(PUBLIC_DIR)/embeddings
SCRIPTS_DIR := scripts
SRC_DIR := src

# Colors for output
BOLD := \033[1m
RED := \033[31m
GREEN := \033[32m
YELLOW := \033[33m
BLUE := \033[34m
MAGENTA := \033[35m
CYAN := \033[36m
RESET := \033[0m

# Default target
.DEFAULT_GOAL := help

# Detect OS for different commands
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Linux)
	OPEN_CMD := xdg-open
endif
ifeq ($(UNAME_S),Darwin)
	OPEN_CMD := open
endif
ifeq ($(OS),Windows_NT)
	OPEN_CMD := start
endif

##@ Help
.PHONY: help
help: ## Display this help message
	@echo "$(BOLD)$(CYAN)LexMX - Mexican Legal AI Assistant$(RESET)"
	@echo "$(BOLD)$(CYAN)=====================================$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "$(BOLD)Usage:$(RESET) make $(CYAN)<target>$(RESET)\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BOLD)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BOLD)$(YELLOW)Examples:$(RESET)"
	@echo "  make dev              # Start development server"
	@echo "  make build            # Build for production"
	@echo "  make corpus           # Build complete legal corpus"
	@echo "  make qa               # Run all quality checks"
	@echo "  make deploy           # Deploy to GitHub Pages"
	@echo ""

##@ Development
.PHONY: install dev start build preview clean-dist
install: ## Install dependencies
	@echo "$(BOLD)$(BLUE)📦 Installing dependencies...$(RESET)"
	@npm install --legacy-peer-deps
	@echo "$(GREEN)✅ Dependencies installed successfully$(RESET)"

dev: install ## Start development server with hot reload
	@echo "$(BOLD)$(BLUE)🚀 Starting development server...$(RESET)"
	@echo "$(YELLOW)💡 Visit: http://localhost:4321$(RESET)"
	@npm run dev

start: dev ## Alias for dev command

build: install ## Build for production
	@echo "$(BOLD)$(BLUE)🏗️  Building for production...$(RESET)"
	@npm run build
	@$(MAKE) --no-print-directory build-stats
	@echo "$(GREEN)✅ Build completed successfully$(RESET)"

preview: build ## Preview production build locally
	@echo "$(BOLD)$(BLUE)👀 Starting preview server...$(RESET)"
	@echo "$(YELLOW)💡 Visit: http://localhost:4321$(RESET)"
	@npm run preview

clean-dist: ## Clean build artifacts
	@echo "$(BOLD)$(YELLOW)🧹 Cleaning build artifacts...$(RESET)"
	@rm -rf $(DIST_DIR)
	@echo "$(GREEN)✅ Build artifacts cleaned$(RESET)"

##@ Testing & Quality
.PHONY: test test-unit test-e2e test-all lint type-check format qa quality
test: test-unit ## Run unit tests only (use test-all for comprehensive testing)
	@echo "$(BOLD)$(BLUE)🧪 Running unit tests...$(RESET)"
	@npm run test

test-unit: install ## Run unit tests only
	@echo "$(BOLD)$(BLUE)🔬 Running unit tests...$(RESET)"
	@npm run test

test-e2e: install ## Run end-to-end tests
	@echo "$(BOLD)$(BLUE)🎭 Running E2E tests...$(RESET)"
	@echo "$(YELLOW)🔧 Cleaning up any existing dev servers...$(RESET)"
	@node scripts/kill-dev-servers.js
	@echo "$(YELLOW)📦 Ensuring Playwright browsers are installed...$(RESET)"
	@npx playwright install --with-deps
	@npm run test:e2e

test-all: install ## Run all tests (unit + E2E)
	@echo "$(BOLD)$(BLUE)🧪 Running all tests...$(RESET)"
	@echo "$(BLUE)📝 Running unit tests first...$(RESET)"
	@npm run test
	@echo "$(BLUE)🎭 Running E2E tests...$(RESET)"
	@npx playwright install --with-deps
	@npm run test:e2e
	@echo "$(GREEN)✅ All tests completed!$(RESET)"

lint: install ## Run ESLint
	@echo "$(BOLD)$(BLUE)🔍 Running linter...$(RESET)"
	@npm run lint

lint-fix: install ## Run ESLint with auto-fix
	@echo "$(BOLD)$(BLUE)🔧 Running linter with auto-fix...$(RESET)"
	@npm run lint -- --fix

type-check: install ## Run TypeScript type checking
	@echo "$(BOLD)$(BLUE)📝 Running type checking...$(RESET)"
	@npm run type-check

format: install ## Format code with Prettier
	@echo "$(BOLD)$(BLUE)💅 Formatting code...$(RESET)"
	@npx prettier --write "$(SRC_DIR)/**/*.{ts,tsx,astro,js,jsx,json,md}"
	@echo "$(GREEN)✅ Code formatted$(RESET)"

qa: lint type-check test ## Run all quality assurance checks
	@echo "$(BOLD)$(GREEN)🎯 All quality checks passed!$(RESET)"

quality: qa ## Alias for qa command

##@ Legal Corpus Management
.PHONY: corpus corpus-build corpus-embeddings corpus-clean corpus-stats corpus-validate
corpus: corpus-build corpus-embeddings ## Build complete legal corpus with embeddings
	@echo "$(BOLD)$(GREEN)📚 Legal corpus build completed!$(RESET)"

corpus-build: ## Build legal document corpus
	@echo "$(BOLD)$(BLUE)📖 Building legal corpus...$(RESET)"
	@node $(SCRIPTS_DIR)/build-corpus.js
	@echo "$(GREEN)✅ Legal corpus built successfully$(RESET)"

corpus-embeddings: ## Generate embeddings for legal corpus
	@echo "$(BOLD)$(BLUE)🧮 Generating embeddings...$(RESET)"
	@if [ -n "$$OPENAI_API_KEY" ]; then \
		echo "$(GREEN)🔑 Using OpenAI API for embeddings$(RESET)"; \
		node $(SCRIPTS_DIR)/generate-embeddings.js; \
	else \
		echo "$(YELLOW)⚠️  No OPENAI_API_KEY found, using simulated embeddings$(RESET)"; \
		node $(SCRIPTS_DIR)/generate-embeddings.js; \
	fi
	@echo "$(GREEN)✅ Embeddings generated successfully$(RESET)"

corpus-clean: ## Clean corpus and embeddings
	@echo "$(BOLD)$(YELLOW)🧹 Cleaning legal corpus...$(RESET)"
	@rm -rf $(CORPUS_DIR)
	@rm -rf $(EMBEDDINGS_DIR)
	@rm -rf data/raw-legal-docs
	@echo "$(GREEN)✅ Legal corpus cleaned$(RESET)"

corpus-stats: ## Show corpus statistics
	@echo "$(BOLD)$(CYAN)📊 Legal Corpus Statistics$(RESET)"
	@echo "$(BOLD)========================$(RESET)"
	@if [ -f "$(CORPUS_DIR)/metadata.json" ]; then \
		echo "$(BLUE)Documents:$(RESET) $$(jq -r '.totalDocuments' $(CORPUS_DIR)/metadata.json)"; \
		echo "$(BLUE)Total Size:$(RESET) $$(jq -r '.totalSize' $(CORPUS_DIR)/metadata.json) bytes"; \
		echo "$(BLUE)Build Date:$(RESET) $$(jq -r '.buildDate' $(CORPUS_DIR)/metadata.json)"; \
		echo "$(BLUE)Legal Areas:$(RESET)"; \
		jq -r '.legalAreas | to_entries[] | "  - \(.key): \(.value) documents"' $(CORPUS_DIR)/metadata.json; \
	else \
		echo "$(RED)❌ No corpus metadata found. Run 'make corpus-build' first.$(RESET)"; \
	fi
	@if [ -f "$(EMBEDDINGS_DIR)/embeddings-metadata.json" ]; then \
		echo ""; \
		echo "$(BLUE)Embeddings:$(RESET) $$(jq -r '.corpus.processedChunks' $(EMBEDDINGS_DIR)/embeddings-metadata.json) chunks"; \
		echo "$(BLUE)Dimensions:$(RESET) $$(jq -r '.provider.dimensions' $(EMBEDDINGS_DIR)/embeddings-metadata.json)"; \
		echo "$(BLUE)Model:$(RESET) $$(jq -r '.provider.model' $(EMBEDDINGS_DIR)/embeddings-metadata.json)"; \
	fi

corpus-validate: ## Validate legal corpus integrity
	@echo "$(BOLD)$(BLUE)🔍 Validating legal corpus...$(RESET)"
	@if [ -d "$(CORPUS_DIR)" ]; then \
		echo "$(GREEN)✅ Corpus directory exists$(RESET)"; \
		if [ -f "$(CORPUS_DIR)/metadata.json" ]; then \
			echo "$(GREEN)✅ Metadata file exists$(RESET)"; \
			if jq empty $(CORPUS_DIR)/metadata.json 2>/dev/null; then \
				echo "$(GREEN)✅ Metadata is valid JSON$(RESET)"; \
			else \
				echo "$(RED)❌ Metadata JSON is invalid$(RESET)"; \
				exit 1; \
			fi; \
		else \
			echo "$(RED)❌ Metadata file missing$(RESET)"; \
			exit 1; \
		fi; \
	else \
		echo "$(RED)❌ Corpus directory missing$(RESET)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ Legal corpus validation passed$(RESET)"

##@ Deployment
.PHONY: deploy deploy-dry-run build-stats
deploy: build corpus ## Deploy to GitHub Pages
	@echo "$(BOLD)$(BLUE)🚀 Deploying to GitHub Pages...$(RESET)"
	@echo "$(YELLOW)💡 This will be handled by GitHub Actions$(RESET)"
	@echo "$(YELLOW)💡 Push to main branch to trigger deployment$(RESET)"

deploy-dry-run: build ## Simulate deployment without actually deploying
	@echo "$(BOLD)$(BLUE)🧪 Dry run deployment simulation...$(RESET)"
	@echo "$(GREEN)✅ Build completed successfully$(RESET)"
	@echo "$(GREEN)✅ All assets generated$(RESET)"
	@echo "$(GREEN)✅ Ready for deployment$(RESET)"

build-stats: ## Show build statistics
	@echo "$(BOLD)$(CYAN)📊 Build Statistics$(RESET)"
	@echo "$(BOLD)==================$(RESET)"
	@if [ -d "$(DIST_DIR)" ]; then \
		echo "$(BLUE)Build size:$(RESET) $$(du -sh $(DIST_DIR) | cut -f1)"; \
		echo "$(BLUE)File count:$(RESET) $$(find $(DIST_DIR) -type f | wc -l)"; \
		echo "$(BLUE)JS files:$(RESET) $$(find $(DIST_DIR) -name "*.js" | wc -l)"; \
		echo "$(BLUE)CSS files:$(RESET) $$(find $(DIST_DIR) -name "*.css" | wc -l)"; \
		echo "$(BLUE)HTML files:$(RESET) $$(find $(DIST_DIR) -name "*.html" | wc -l)"; \
		echo "$(BLUE)Largest files:$(RESET)"; \
		find $(DIST_DIR) -type f -exec du -h {} + | sort -rh | head -5 | sed 's/^/  /'; \
	else \
		echo "$(RED)❌ No build directory found. Run 'make build' first.$(RESET)"; \
	fi

##@ Docker Support
.PHONY: docker-build docker-run docker-clean docker-shell
docker-build: ## Build Docker image
	@echo "$(BOLD)$(BLUE)🐳 Building Docker image...$(RESET)"
	@docker build -t lexmx:latest .
	@echo "$(GREEN)✅ Docker image built successfully$(RESET)"

docker-run: ## Run application in Docker container
	@echo "$(BOLD)$(BLUE)🐳 Running Docker container...$(RESET)"
	@echo "$(YELLOW)💡 Visit: http://localhost:8080$(RESET)"
	@docker run -p 8080:80 --rm lexmx:latest

docker-clean: ## Clean Docker images and containers
	@echo "$(BOLD)$(YELLOW)🧹 Cleaning Docker artifacts...$(RESET)"
	@docker system prune -f
	@docker rmi lexmx:latest 2>/dev/null || true
	@echo "$(GREEN)✅ Docker artifacts cleaned$(RESET)"

docker-shell: ## Open shell in Docker container
	@echo "$(BOLD)$(BLUE)🐳 Opening Docker shell...$(RESET)"
	@docker run -it --rm lexmx:latest /bin/sh

##@ Maintenance
.PHONY: clean clean-all clean-ports update-deps security-audit outdated
clean: clean-dist ## Clean build artifacts only
	@echo "$(GREEN)✅ Clean completed$(RESET)"

clean-ports: ## Kill all dev servers and free up ports
	@echo "$(BOLD)$(YELLOW)🔧 Cleaning up dev server ports...$(RESET)"
	@node scripts/kill-dev-servers.js
	@echo "$(GREEN)✅ Ports cleaned$(RESET)"

clean-all: clean-dist corpus-clean ## Clean everything (build + corpus)
	@echo "$(BOLD)$(YELLOW)🧹 Deep cleaning...$(RESET)"
	@rm -rf node_modules
	@rm -rf .astro
	@rm -rf temp
	@echo "$(GREEN)✅ Deep clean completed$(RESET)"

update-deps: ## Update all dependencies
	@echo "$(BOLD)$(BLUE)📦 Updating dependencies...$(RESET)"
	@npm update
	@npm audit fix --audit-level moderate
	@echo "$(GREEN)✅ Dependencies updated$(RESET)"

security-audit: ## Run security audit
	@echo "$(BOLD)$(BLUE)🔒 Running security audit...$(RESET)"
	@npm audit --audit-level moderate
	@echo "$(GREEN)✅ Security audit completed$(RESET)"

outdated: ## Check for outdated dependencies
	@echo "$(BOLD)$(BLUE)📋 Checking for outdated dependencies...$(RESET)"
	@npm outdated || true

##@ Information
.PHONY: info version env doctor
info: ## Show project information
	@echo "$(BOLD)$(CYAN)LexMX Project Information$(RESET)"
	@echo "$(BOLD)========================$(RESET)"
	@echo "$(BLUE)Project:$(RESET) $$(jq -r '.name' package.json)"
	@echo "$(BLUE)Version:$(RESET) $$(jq -r '.version' package.json)"
	@echo "$(BLUE)Description:$(RESET) $$(jq -r '.description' package.json)"
	@echo "$(BLUE)Node Version:$(RESET) $$(node --version)"
	@echo "$(BLUE)NPM Version:$(RESET) $$(npm --version)"
	@echo "$(BLUE)OS:$(RESET) $$(uname -s)"
	@echo "$(BLUE)Architecture:$(RESET) $$(uname -m)"

version: ## Show version information
	@jq -r '.version' package.json

env: ## Show environment information
	@echo "$(BOLD)$(CYAN)Environment Variables$(RESET)"
	@echo "$(BOLD)=====================$(RESET)"
	@echo "$(BLUE)NODE_ENV:$(RESET) $${NODE_ENV:-not set}"
	@echo "$(BLUE)OPENAI_API_KEY:$(RESET) $${OPENAI_API_KEY:+set}"
	@echo "$(BLUE)ANTHROPIC_API_KEY:$(RESET) $${ANTHROPIC_API_KEY:+set}"
	@echo "$(BLUE)GOOGLE_AI_API_KEY:$(RESET) $${GOOGLE_AI_API_KEY:+set}"

doctor: ## Run system health check
	@echo "$(BOLD)$(BLUE)🩺 Running system health check...$(RESET)"
	@echo ""
	@echo "$(BOLD)Node.js:$(RESET)"
	@if command -v node >/dev/null 2>&1; then \
		echo "  $(GREEN)✅ Node.js $(shell node --version) installed$(RESET)"; \
	else \
		echo "  $(RED)❌ Node.js not found$(RESET)"; \
	fi
	@echo "$(BOLD)NPM:$(RESET)"
	@if command -v npm >/dev/null 2>&1; then \
		echo "  $(GREEN)✅ NPM $(shell npm --version) installed$(RESET)"; \
	else \
		echo "  $(RED)❌ NPM not found$(RESET)"; \
	fi
	@echo "$(BOLD)Dependencies:$(RESET)"
	@if [ -d "node_modules" ]; then \
		echo "  $(GREEN)✅ Dependencies installed$(RESET)"; \
	else \
		echo "  $(YELLOW)⚠️  Dependencies not installed (run 'make install')$(RESET)"; \
	fi
	@echo "$(BOLD)Legal Corpus:$(RESET)"
	@if [ -d "$(CORPUS_DIR)" ]; then \
		echo "  $(GREEN)✅ Legal corpus available$(RESET)"; \
	else \
		echo "  $(YELLOW)⚠️  Legal corpus not built (run 'make corpus')$(RESET)"; \
	fi
	@echo "$(BOLD)Embeddings:$(RESET)"
	@if [ -d "$(EMBEDDINGS_DIR)" ]; then \
		echo "  $(GREEN)✅ Embeddings available$(RESET)"; \
	else \
		echo "  $(YELLOW)⚠️  Embeddings not generated (run 'make corpus-embeddings')$(RESET)"; \
	fi

##@ Quick Actions
.PHONY: quick-start full-setup
quick-start: install corpus dev ## Quick start for new developers
	@echo "$(BOLD)$(GREEN)🎉 Quick start completed! Visit http://localhost:4321$(RESET)"

full-setup: install corpus build qa ## Complete setup with all checks
	@echo "$(BOLD)$(GREEN)🎉 Full setup completed successfully!$(RESET)"

# Hidden utility targets
.PHONY: _check-node _check-npm
_check-node:
	@command -v node >/dev/null 2>&1 || { echo "$(RED)❌ Node.js is required$(RESET)"; exit 1; }

_check-npm:
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)❌ NPM is required$(RESET)"; exit 1; }

# Prevent make from deleting intermediate files
.PRECIOUS: $(CORPUS_DIR)/%.json $(EMBEDDINGS_DIR)/%.json