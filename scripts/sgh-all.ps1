param(
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "start"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Run = Join-Path $Root ".run"
$Logs = Join-Path $Run "logs"
$Pids = Join-Path $Run "pids"
$ComposeFile = Join-Path $Root "infra\docker-compose.yml"

New-Item -ItemType Directory -Force -Path $Logs, $Pids | Out-Null

$Modules = @(
    @{ Name = "patient";      Port = 8081; Dir = "services\patient-service";   Command = ".\mvnw.cmd spring-boot:run" },
    @{ Name = "reception";    Port = 8082; Dir = "services\reception-service"; Command = "npm start"; Npm = $true },
    @{ Name = "consultation"; Port = 8083; Dir = "services\doctor-service";    Command = "npm start"; Npm = $true },
    @{ Name = "lab";          Port = 8084; Dir = "services\lab-service";       Command = ".venv\Scripts\python.exe -m uvicorn app.main:app --port 8084"; Python = $true },
    @{ Name = "pharmacy";     Port = 8085; Dir = "services\pharmacy-service";  Command = "npm start"; Npm = $true },
    @{ Name = "staff";        Port = 8086; Dir = "services\staff-service";     Command = ".\mvnw.cmd spring-boot:run" },
    @{ Name = "gateway";      Port = 8080; Dir = "gateway";                    Command = ".\mvnw.cmd spring-boot:run" },
    @{ Name = "frontend";     Port = 4200; Dir = "frontend";                   Command = "npm start"; Npm = $true }
)

function Test-Port([int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync("127.0.0.1", $Port)
        return $task.Wait(500) -and $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Prepare-Module($Module) {
    $directory = Join-Path $Root $Module.Dir

    if ($Module.Npm -and -not (Test-Path (Join-Path $directory "node_modules"))) {
        Write-Host "Installing $($Module.Name) dependencies ..."
        Push-Location $directory
        try {
            & npm ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed for $($Module.Name)" }
        }
        finally {
            Pop-Location
        }
    }

    if ($Module.Python) {
        $python = Join-Path $directory ".venv\Scripts\python.exe"
        if (-not (Test-Path $python)) {
            Write-Host "Creating the Lab Python environment ..."
            & python -m venv (Join-Path $directory ".venv")
            if ($LASTEXITCODE -ne 0) { throw "Python virtual environment creation failed" }
            & $python -m pip install -r (Join-Path $directory "requirements.txt")
            if ($LASTEXITCODE -ne 0) { throw "Lab dependency installation failed" }
        }
    }
}

function Start-Module($Module) {
    if (Test-Port $Module.Port) {
        Write-Host ("UP        {0} (:{1}, already running)" -f $Module.Name, $Module.Port)
        return
    }

    Prepare-Module $Module
    $directory = Join-Path $Root $Module.Dir
    $stdout = Join-Path $Logs "$($Module.Name).log"
    $stderr = Join-Path $Logs "$($Module.Name).error.log"

    $process = Start-Process `
        -FilePath "cmd.exe" `
        -ArgumentList @("/d", "/c", $Module.Command) `
        -WorkingDirectory $directory `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -WindowStyle Hidden `
        -PassThru

    Set-Content -Path (Join-Path $Pids "$($Module.Name).pid") -Value $process.Id

    for ($attempt = 0; $attempt -lt 90; $attempt++) {
        if (Test-Port $Module.Port) {
            Write-Host ("UP        {0} (:{1})" -f $Module.Name, $Module.Port)
            return
        }
        if ($process.HasExited) {
            throw "$($Module.Name) stopped during startup; see $stderr"
        }
        Start-Sleep -Seconds 2
    }

    throw "$($Module.Name) did not start in 3 minutes; see $stdout and $stderr"
}

function Stop-Module($Module) {
    $pidFile = Join-Path $Pids "$($Module.Name).pid"
    if (Test-Path $pidFile) {
        $processId = (Get-Content $pidFile | Select-Object -First 1)
        if ($processId) {
            & taskkill /PID $processId /T /F 2>$null | Out-Null
        }
        Remove-Item $pidFile -Force
    }
    Write-Host "STOPPED   $($Module.Name)"
}

function Start-All {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker Desktop is required and docker was not found."
    }

    Write-Host "Starting PostgreSQL, RabbitMQ and Keycloak ..."
    & docker compose -f $ComposeFile up -d --wait
    if ($LASTEXITCODE -ne 0) { throw "Docker infrastructure startup failed" }

    foreach ($module in $Modules) {
        Start-Module $module
    }

    Write-Host ""
    Write-Host "SGH is ready:"
    Write-Host "  Application  http://localhost:4200"
    Write-Host "  Gateway      http://localhost:8080/health"
    Write-Host "  Keycloak     http://localhost:8180"
    Write-Host "  RabbitMQ     http://localhost:15672"
}

function Stop-All {
    foreach ($module in ($Modules | Select-Object -Reverse)) {
        Stop-Module $module
    }
    & docker compose -f $ComposeFile stop
    Write-Host "Infrastructure stopped; PostgreSQL data was preserved."
}

function Show-Status {
    Write-Host "Infrastructure:"
    & docker compose -f $ComposeFile ps
    Write-Host ""
    Write-Host "Applications:"
    foreach ($module in $Modules) {
        $state = if (Test-Port $Module.Port) { "UP  " } else { "DOWN" }
        Write-Host ("{0}      {1} (:{2})" -f $state, $Module.Name, $Module.Port)
    }
}

switch ($Action) {
    "start"   { Start-All }
    "stop"    { Stop-All }
    "restart" { Stop-All; Start-All }
    "status"  { Show-Status }
}
