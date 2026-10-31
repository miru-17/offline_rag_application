# RAGENTIS offline installer (Windows + Docker Desktop). No internet is used.
# Safe to run again: existing data and an existing .env are kept.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Step($text) { Write-Host $text -ForegroundColor Cyan }
function RandomText([int]$bytes) {
    $b = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    return [Convert]::ToBase64String($b)
}

Step "1/6 Checking the package..."
$bad = @()
foreach ($line in Get-Content SHA256SUMS) {
    $parts = $line -split '\s+', 2
    $file = $parts[1].TrimStart('*')
    if ($file.StartsWith('./')) { $file = $file.Substring(2) }
    $actual = (Get-FileHash -Algorithm SHA256 -Path $file).Hash.ToLower()
    if ($actual -ne $parts[0]) { $bad += $file }
}
if ($bad.Count -gt 0) { throw "The package is damaged ($($bad -join ', ')). Copy it again." }
docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker Desktop is not running or 'docker compose' is missing." }

Step "2/6 Loading Docker images (a few minutes)..."
docker load -i images.tar
if ($LASTEXITCODE -ne 0) { throw "docker load failed." }

Step "3/6 Settings (.env)..."
if (Test-Path .env) {
    Write-Host "    keeping the existing .env"
} else {
    $pg = (RandomText 36) -replace '[/+=]', ''
    $jwt = (RandomText 48) -replace '[/+=]', ''
    $fernet = (RandomText 32).Replace('+', '-').Replace('/', '_')
    $model = ((Get-Content models\MODELS.txt) -split ' ')[0]
    $embedding = (Get-Content models\EMBEDDING_MODEL.txt).Trim()
    $text = Get-Content .env.example -Raw
    $text = $text -replace '(?m)^POSTGRES_PASSWORD=.*$', "POSTGRES_PASSWORD=$pg"
    $text = $text -replace '(?m)^JWT_SECRET_KEY=.*$', "JWT_SECRET_KEY=$jwt"
    $text = $text -replace '(?m)^DATA_ENCRYPTION_KEY=.*$', "DATA_ENCRYPTION_KEY=$fernet"
    $text = $text -replace '(?m)^OLLAMA_MODEL=.*$', "OLLAMA_MODEL=$model"
    $text = $text -replace '(?m)^EMBEDDING_MODEL=.*$', "EMBEDDING_MODEL=$embedding"
    $text += "`n# Fixed project name so volumes are found again after updates.`nCOMPOSE_PROJECT_NAME=ragentis`n"
    [System.IO.File]::WriteAllText((Join-Path $PSScriptRoot ".env"), $text, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "    created .env with new random secrets - BACK IT UP (see docs\ADMIN_GUIDE.md)" -ForegroundColor Yellow
}
$project = ((Select-String -Path .env -Pattern '^COMPOSE_PROJECT_NAME=(.*)$').Matches | Select-Object -First 1).Groups[1].Value
if (-not $project) { $project = ((Split-Path -Leaf $PSScriptRoot).ToLower() -replace '[^a-z0-9_-]', '') }

Step "4/6 Installing the AI models (only into empty volumes)..."
function CopyIntoVolume($volume, $folder, $image) {
    docker volume create $volume | Out-Null
    $src = (Resolve-Path $folder).Path
    docker run --rm --entrypoint sh -v "${volume}:/dst" -v "${src}:/src:ro" $image -c 'if [ -z "$(ls -A /dst 2>/dev/null)" ]; then cp -a /src/. /dst/ && echo "    copied"; else echo "    already present - kept"; fi'
    if ($LASTEXITCODE -ne 0) { throw "Copying $folder failed." }
}
CopyIntoVolume "${project}_ollama_data" "models\ollama" "ollama/ollama:latest"
CopyIntoVolume "${project}_hf_cache" "models\hf_cache" "ragentis-backend:latest"
docker run --rm --entrypoint sh -v "${project}_hf_cache:/hf" ragentis-backend:latest -c "chown -R 10001:10001 /hf" | Out-Null

Step "5/6 Starting RAGENTIS..."
New-Item -ItemType Directory -Force -Path watch, certs | Out-Null
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed. See: docker compose logs" }

Step "6/6 Waiting for the server..."
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
    docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ok) { throw "The server did not start. See: docker compose logs backend" }
$port = ((Select-String -Path .env -Pattern '^RAGENTIS_HTTPS_PORT=(.*)$').Matches | Select-Object -First 1).Groups[1].Value
if (-not $port) { $port = "8443" }
Write-Host ""
Write-Host "RAGENTIS is running:  https://localhost:$port" -ForegroundColor Green
Write-Host "First visit: create the administrator account, then install the licence file."
Write-Host "Your browser warns about the certificate until the RAGENTIS root certificate"
Write-Host "is trusted - see docs\ADMIN_GUIDE.md section 3."
