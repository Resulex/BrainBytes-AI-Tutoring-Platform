#!/usr/bin/env bash
# =============================================================================
# BrainBytes Deployment Script
# =============================================================================
# Usage:
#   ./scripts/deploy.sh [ENVIRONMENT]
#
# Environments: test (default), staging, production
#
# Prerequisites:
#   - Docker & Docker Compose installed on the target host
#   - SSH access to DEPLOY_HOST with DEPLOY_SSH_KEY
#   - GHCR_TOKEN set for pushing images to GitHub Container Registry
#   - Environment variables defined in .env or exported in shell
# =============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────

ENVIRONMENT="${1:-test}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
GIT_SHA="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
IMAGE_TAG="${GIT_SHA}-${TIMESTAMP}"

# Docker registry (defaults to GitHub Container Registry)
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
GHCR_USERNAME="${GHCR_USERNAME:-Resulex}"
GHCR_REPO="${GHCR_REPO:-brainbytes}"

# Full image names
BACKEND_IMAGE="${DOCKER_REGISTRY}/${GHCR_USERNAME}/${GHCR_REPO}-backend:${IMAGE_TAG}"
FRONTEND_IMAGE="${DOCKER_REGISTRY}/${GHCR_USERNAME}/${GHCR_REPO}-frontend:${IMAGE_TAG}"
BACKEND_LATEST="${DOCKER_REGISTRY}/${GHCR_USERNAME}/${GHCR_REPO}-backend:latest"
FRONTEND_LATEST="${DOCKER_REGISTRY}/${GHCR_USERNAME}/${GHCR_REPO}-frontend:latest"

# Deployment target
DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/brainbytes}"

# ── Logging ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC}  $(date '+%H:%M:%S') $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $(date '+%H:%M:%S') $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%H:%M:%S') $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*"; }

# ── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           BrainBytes Deployment Script                      ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║ Environment : ${ENVIRONMENT}"
echo "║ Image Tag   : ${IMAGE_TAG}"
echo "║ Timestamp   : ${TIMESTAMP}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Build Docker Images ──────────────────────────────────────────────

log_info "Building Docker images..."

cd "$PROJECT_ROOT"

docker build \
  --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000}" \
  -t "$FRONTEND_IMAGE" \
  -t "$FRONTEND_LATEST" \
  ./frontend

log_ok "Frontend image built: $FRONTEND_IMAGE"

docker build \
  -t "$BACKEND_IMAGE" \
  -t "$BACKEND_LATEST" \
  ./backend

log_ok "Backend image built: $BACKEND_IMAGE"

# ── Step 2: Push Images to Registry ──────────────────────────────────────────

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  log_info "Logging into Docker registry: $DOCKER_REGISTRY"
  echo "$GHCR_TOKEN" | docker login "$DOCKER_REGISTRY" -u "$GHCR_USERNAME" --password-stdin

  log_info "Pushing images to registry..."
  docker push "$FRONTEND_IMAGE"
  docker push "$FRONTEND_LATEST"
  docker push "$BACKEND_IMAGE"
  docker push "$BACKEND_LATEST"

  log_ok "Images pushed successfully"
else
  log_warn "GHCR_TOKEN not set — skipping registry push"
fi

# ── Step 3: Deploy to Target Host ────────────────────────────────────────────

deploy_via_ssh() {
  local ssh_opts="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

  if [[ -n "$DEPLOY_SSH_KEY" ]]; then
    ssh_opts="$ssh_opts -i $DEPLOY_SSH_KEY"
  fi

  log_info "Deploying to $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH ..."

  # Copy compose file and env to remote host
  scp $ssh_opts "$PROJECT_ROOT/docker-compose.yml" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
  scp $ssh_opts "$PROJECT_ROOT/docker-compose.e2e.yml" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/" 2>/dev/null || true
  scp $ssh_opts "$PROJECT_ROOT/test-composition.sh" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/" 2>/dev/null || true

  # Pull latest images and restart services on remote
  ssh $ssh_opts "$DEPLOY_USER@$DEPLOY_HOST" << REMOTE_SCRIPT
    set -e
    cd "$DEPLOY_PATH"

    echo "=== Logging into Docker registry ==="
    echo "$GHCR_TOKEN" | docker login "$DOCKER_REGISTRY" -u "$GHCR_USERNAME" --password-stdin

    echo "=== Pulling latest images ==="
    docker pull "$FRONTEND_LATEST"
    docker pull "$BACKEND_LATEST"

    echo "=== Restarting services ==="
    # Use docker compose (v2 syntax) — fall back to docker-compose (v1)
    if command -v docker compose &>/dev/null; then
      docker compose down --remove-orphans
      docker compose up -d --wait
    else
      docker-compose down --remove-orphans
      docker-compose up -d
    fi

    echo "=== Pruning old images ==="
    docker image prune -af --filter "until=72h" || true

    echo "=== Deployment complete ==="
REMOTE_SCRIPT

  log_ok "Deployment to $DEPLOY_HOST complete"
}

if [[ -n "$DEPLOY_HOST" ]]; then
  deploy_via_ssh
else
  log_warn "DEPLOY_HOST not set — skipping remote deployment"
  log_info "To deploy locally, run: docker compose up -d"
fi

# ── Step 4: Verify Deployment ────────────────────────────────────────────────

verify_deployment() {
  log_info "Verifying deployment..."

  local verify_host="${1:-localhost}"
  local verify_port="${2:-3000}"
  local verify_frontend_port="${3:-8080}"
  local max_retries=12
  local retry=0

  # Check backend
  log_info "Checking backend (http://${verify_host}:${verify_port})..."
  while [[ $retry -lt $max_retries ]]; do
    if curl -sf "http://${verify_host}:${verify_port}/" > /dev/null 2>&1; then
      log_ok "Backend is healthy"
      break
    fi
    retry=$((retry + 1))
    log_warn "Backend not ready (attempt $retry/$max_retries), retrying..."
    sleep 5
  done

  if [[ $retry -ge $max_retries ]]; then
    log_error "Backend health check FAILED after $max_retries attempts"
    return 1
  fi

  # Check frontend
  retry=0
  log_info "Checking frontend (http://${verify_host}:${verify_frontend_port})..."
  while [[ $retry -lt $max_retries ]]; do
    if curl -sf "http://${verify_host}:${verify_frontend_port}/" > /dev/null 2>&1; then
      log_ok "Frontend is healthy"
      break
    fi
    retry=$((retry + 1))
    log_warn "Frontend not ready (attempt $retry/$max_retries), retrying..."
    sleep 5
  done

  if [[ $retry -ge $max_retries ]]; then
    log_error "Frontend health check FAILED after $max_retries attempts"
    return 1
  fi

  log_ok "All services verified successfully"
  return 0
}

if [[ -n "$DEPLOY_HOST" ]]; then
  verify_deployment "$DEPLOY_HOST" 3000 8080
else
  verify_deployment "localhost" 3000 8080 || log_warn "Local verification failed — check docker compose logs"
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                 Deployment Summary                          ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║ Environment  : ${ENVIRONMENT}"
echo "║ Image Tag    : ${IMAGE_TAG}"
echo "║ Backend      : ${BACKEND_IMAGE}"
echo "║ Frontend     : ${FRONTEND_IMAGE}"
echo "║ Target Host  : ${DEPLOY_HOST:-localhost}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

log_ok "Deployment finished successfully!"
