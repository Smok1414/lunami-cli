#!/usr/bin/env bash
# LUNAMI CLI — install script (macOS / Linux)
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Smok1414/lunami-cli/main/scripts/install.sh | bash
# Custom repo:
#   LUNAMI_INSTALL_REPO=Smok1414/lunami-cli curl -fsSL ... | bash

set -euo pipefail

REPO="${LUNAMI_INSTALL_REPO:-Smok1414/lunami-cli}"
BRANCH="${LUNAMI_INSTALL_BRANCH:-main}"

step() { printf '\033[36m[lunami]\033[0m %s\n' "$1"; }
die() { printf '\033[31m[lunami] error:\033[0m %s\n' "$1" >&2; exit 1; }

remove_dir() {
  local path="$1"
  [ -d "${path}" ] || return 0
  rm -rf "${path}" 2>/dev/null || true
  [ ! -d "${path}" ]
}

clear_previous_install() {
  step 'Removing previous installation (if any)...'
  npm uninstall -g lunami-cli >/dev/null 2>&1 || true

  local prefix
  prefix="$(npm root -g 2>/dev/null || true)"
  if [ -n "${prefix}" ]; then
    remove_dir "${prefix}/lunami-cli" || die "Could not remove ${prefix}/lunami-cli — close terminals using lunami and retry."
  fi
}

install_from_zip() {
  local temp_root zip_url extract_dir repo_dir
  temp_root="$(mktemp -d)"
  zip_url="https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip"

  step "Downloading source (${BRANCH})..."
  curl -fsSL "${zip_url}" -o "${temp_root}/repo.zip"

  step 'Installing lunami globally (npm)...'
  extract_dir="${temp_root}/extract"
  mkdir -p "${extract_dir}"
  unzip -q "${temp_root}/repo.zip" -d "${extract_dir}"
  repo_dir="$(find "${extract_dir}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  [ -n "${repo_dir}" ] || die 'Downloaded archive is empty.'

  (cd "${repo_dir}" && npm install -g . --omit=dev)
  rm -rf "${temp_root}"
}

install_from_git() {
  step 'Installing from git (fallback)...'
  GIT_SPEC="git+https://github.com/${REPO}.git#${BRANCH}"
  npm install -g "${GIT_SPEC}" --omit=dev
}

echo ''
echo '  LUNAMI CLI installer'
echo "  repo: ${REPO} @ ${BRANCH}"
echo ''

step 'Checking Node.js...'
if ! command -v node >/dev/null 2>&1; then
  die 'Node.js is not installed. Install Node 20+ from https://nodejs.org'
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "${NODE_MAJOR}" -lt 20 ]; then
  die "Node $(node -v) found; LUNAMI requires Node 20+."
fi

command -v npm >/dev/null 2>&1 || die 'npm is not available.'
command -v unzip >/dev/null 2>&1 || die 'unzip is required (e.g. apt install unzip).'

clear_previous_install

if ! install_from_zip; then
  printf '\033[33m[lunami]\033[0m Zip install failed, trying git...\n'
  clear_previous_install
  install_from_git
fi

LUNAMI_HOME="${HOME}/.lunami"
mkdir -p "${LUNAMI_HOME}"

ENV_FILE="${LUNAMI_HOME}/.env"
if [ ! -f "${ENV_FILE}" ]; then
  step 'Creating ~/.lunami/.env ...'
  EXAMPLE_URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}/.env.example"
  if curl -fsSL "${EXAMPLE_URL}" -o "${ENV_FILE}" 2>/dev/null; then
    :
  else
    cat > "${ENV_FILE}" <<'EOF'
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434
EOF
  fi
  echo "  Edit: ${ENV_FILE}"
fi

MCP_FILE="${LUNAMI_HOME}/mcp.json"
if [ ! -f "${MCP_FILE}" ]; then
  MCP_URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}/mcp.example.json"
  curl -fsSL "${MCP_URL}" -o "${MCP_FILE}" 2>/dev/null || true
fi

echo ''
echo '  Done! Run:'
echo '    lunami'
echo ''
echo '  Local AI model (optional):'
echo '    1. https://ollama.com'
echo '    2. ollama pull llama3.2'
echo '    3. LLM_PROVIDER=ollama in ~/.lunami/.env'
echo ''
