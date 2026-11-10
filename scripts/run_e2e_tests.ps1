$backend = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "app.main:app", "--port", "8000" -WorkingDirectory "DevOpsPulse\backend" -PassThru
$frontend = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory "DevOpsPulse\frontend" -PassThru

try {
    Write-Host "Waiting 6 seconds for backend and frontend to initialize..."
    Start-Sleep -Seconds 6
    Set-Location "DevOpsPulse\frontend"
    Write-Host "Running Playwright E2E tests and screenshots..."
    npx playwright test
}
finally {
    Write-Host "Cleaning up test processes..."
    if ($backend -and !$backend.HasExited) {
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
    if ($frontend -and !$frontend.HasExited) {
        Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
    }
    # Kill any stray uvicorn or vite processes on port 8000 and 3000
    Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*uvicorn*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
