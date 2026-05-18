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

step 'Installing lunami globally (npm)...'
GIT_SPEC="git+https://github.com/${REPO}.git#${BRANCH}"
npm install -g "${GIT_SPEC}"

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
