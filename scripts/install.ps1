# LUNAMI CLI — Windows installer (PowerShell)
# Usage:
#   irm https://raw.githubusercontent.com/YOUR_USERNAME/lunami-cli/main/scripts/install.ps1 | iex
# Custom repo:
#   $env:LUNAMI_INSTALL_REPO = 'your-user/lunami-cli'; irm ... | iex

$ErrorActionPreference = 'Stop'

$Repo = if ($env:LUNAMI_INSTALL_REPO) { $env:LUNAMI_INSTALL_REPO.Trim() } else { 'YOUR_USERNAME/lunami-cli' }
$Branch = if ($env:LUNAMI_INSTALL_BRANCH) { $env:LUNAMI_INSTALL_BRANCH.Trim() } else { 'main' }

function Write-Step([string]$Message) {
  Write-Host "[lunami] $Message" -ForegroundColor Cyan
}

function Test-NodeVersion {
  $version = (node -p "process.versions.node" 2>$null)
  if (-not $version) {
    throw 'Node.js is not installed. Install Node 20+ from https://nodejs.org'
  }

  $major = [int]($version.Split('.')[0])
  if ($major -lt 20) {
    throw "Node.js $version found; LUNAMI requires Node 20 or newer."
  }
}

Write-Host ''
Write-Host '  LUNAMI CLI installer' -ForegroundColor White
Write-Host "  repo: $Repo @ $Branch" -ForegroundColor DarkGray
Write-Host ''

Write-Step 'Checking Node.js...'
Test-NodeVersion

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm is not available. Reinstall Node.js from https://nodejs.org'
}

Write-Step 'Installing lunami globally (npm)...'
$gitSpec = "git+https://github.com/$Repo.git#$Branch"
npm install -g $gitSpec
if ($LASTEXITCODE -ne 0) {
  throw "npm install failed. Try: npm install -g $gitSpec"
}

$lunamiHome = Join-Path $env:USERPROFILE '.lunami'
New-Item -ItemType Directory -Force -Path $lunamiHome | Out-Null

$envFile = Join-Path $lunamiHome '.env'
if (-not (Test-Path $envFile)) {
  Write-Step 'Creating ~/.lunami/.env ...'
  $exampleUrl = "https://raw.githubusercontent.com/$Repo/$Branch/.env.example"
  try {
    Invoke-WebRequest -Uri $exampleUrl -UseBasicParsing -OutFile $envFile
  } catch {
    @"
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434
"@ | Set-Content -Path $envFile -Encoding utf8
  }

  Write-Host '  Edit config:' -ForegroundColor Yellow
  Write-Host "  notepad `"$envFile`"" -ForegroundColor DarkGray
}

$mcpFile = Join-Path $lunamiHome 'mcp.json'
if (-not (Test-Path $mcpFile)) {
  $mcpUrl = "https://raw.githubusercontent.com/$Repo/$Branch/mcp.example.json"
  try {
    Invoke-WebRequest -Uri $mcpUrl -UseBasicParsing -OutFile $mcpFile
  } catch {
    # optional
  }
}

Write-Host ''
Write-Host '  Done! Open a NEW terminal and run:' -ForegroundColor Green
Write-Host '    lunami' -ForegroundColor White
Write-Host ''
Write-Host '  Local AI model (optional, no cloud API):' -ForegroundColor Cyan
Write-Host '    1. Install Ollama: https://ollama.com' -ForegroundColor DarkGray
Write-Host '    2. ollama pull llama3.2' -ForegroundColor DarkGray
Write-Host '    3. Set LLM_PROVIDER=ollama in ~/.lunami/.env' -ForegroundColor DarkGray
Write-Host ''

# Refresh PATH in current session if possible
$npmBin = npm bin -g 2>$null
if ($npmBin -and ($env:Path -notlike "*$npmBin*")) {
  $env:Path = "$npmBin;$env:Path"
}

if (Get-Command lunami -ErrorAction SilentlyContinue) {
  Write-Step 'lunami is on PATH in this session.'
} else {
  Write-Host '  If lunami is not found, add %AppData%\npm to PATH and restart the terminal.' -ForegroundColor Yellow
}
