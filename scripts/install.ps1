# LUNAMI CLI — Windows installer (PowerShell)
# Usage:
#   irm https://raw.githubusercontent.com/Smok1414/lunami-cli/main/scripts/install.ps1 | iex
# Custom repo:
#   $env:LUNAMI_INSTALL_REPO = 'Smok1414/lunami-cli'; irm ... | iex

$ErrorActionPreference = 'Stop'

$Repo = if ($env:LUNAMI_INSTALL_REPO) { $env:LUNAMI_INSTALL_REPO.Trim() } else { 'Smok1414/lunami-cli' }
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

function Remove-DirectoryForce([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $true
  }

  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
      return -not (Test-Path -LiteralPath $Path)
    } catch {
      if ($attempt -lt 4) {
        Start-Sleep -Seconds 2
      }
    }
  }

  cmd /c "rmdir /s /q `"$Path`"" 2>$null | Out-Null
  return -not (Test-Path -LiteralPath $Path)
}

function Clear-LunamiInstall {
  Write-Step 'Removing previous installation (if any)...'
  npm uninstall -g lunami-cli 2>$null | Out-Null

  $globalRoots = @(
    (Join-Path $env:APPDATA 'npm\node_modules\lunami-cli'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node_modules\lunami-cli'),
    (Join-Path $env:ProgramFiles 'nodejs\node_modules\lunami-cli')
  )

  foreach ($root in $globalRoots) {
    if (Test-Path -LiteralPath $root) {
      if (-not (Remove-DirectoryForce $root)) {
        throw @"
Could not remove locked folder:
  $root

Close all terminals running lunami, then run:
  Remove-Item -Recurse -Force '$root'
  irm https://raw.githubusercontent.com/$Repo/$Branch/scripts/install.ps1 | iex
"@
      }
    }
  }
}

function Install-LunamiFromZip {
  $tempRoot = Join-Path $env:TEMP "lunami-install-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
  $zipPath = Join-Path $tempRoot 'repo.zip'
  $extractDir = Join-Path $tempRoot 'extract'

  try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    $zipUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
    Write-Step "Downloading source ($Branch)..."
    Invoke-WebRequest -Uri $zipUrl -UseBasicParsing -OutFile $zipPath

    Write-Step 'Installing lunami globally (npm)...'
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
    $repoDir = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
    if (-not $repoDir) {
      throw 'Downloaded archive is empty.'
    }

    Push-Location $repoDir.FullName
    try {
      npm install -g . --omit=dev
      if ($LASTEXITCODE -ne 0) {
        throw 'npm install -g . failed'
      }
    } finally {
      Pop-Location
    }
  } finally {
    Remove-DirectoryForce $tempRoot | Out-Null
  }
}

function Install-LunamiFromGit {
  $gitSpec = "git+https://github.com/$Repo.git#$Branch"
  Write-Step 'Installing from git (fallback)...'
  npm install -g $gitSpec --omit=dev
  if ($LASTEXITCODE -ne 0) {
    throw "npm install failed. Try: npm install -g $gitSpec"
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

Clear-LunamiInstall

try {
  Install-LunamiFromZip
} catch {
  Write-Host "[lunami] Zip install failed: $($_.Exception.Message)" -ForegroundColor Yellow
  Clear-LunamiInstall
  Install-LunamiFromGit
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

$npmBin = npm bin -g 2>$null
if ($npmBin -and ($env:Path -notlike "*$npmBin*")) {
  $env:Path = "$npmBin;$env:Path"
}

if (Get-Command lunami -ErrorAction SilentlyContinue) {
  Write-Step 'lunami is on PATH in this session.'
} else {
  Write-Host '  If lunami is not found, add %AppData%\npm to PATH and restart the terminal.' -ForegroundColor Yellow
}
