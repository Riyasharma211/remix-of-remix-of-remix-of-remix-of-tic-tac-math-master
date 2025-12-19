@echo off
cd /d "C:\Users\Dharmendra\Desktop\projec\lovll\remix-of-remix-of-remix-of-remix-of-tic-tac-math-master"
echo.
echo ========================================
echo Pushing to GitHub
echo ========================================
echo.
echo Current remote:
git remote -v
echo.
echo.
echo Attempting to push...
echo.
echo NOTE: If asked for credentials:
echo   - Username: Your GitHub username (Riyasharma211)
echo   - Password: Use Personal Access Token (NOT your GitHub password)
echo.
git push origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Changes pushed to GitHub!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Push failed. Authentication required.
    echo ========================================
    echo.
    echo To get Personal Access Token:
    echo 1. Go to: https://github.com/settings/tokens
    echo 2. Click "Generate new token (classic)"
    echo 3. Give it a name, select "repo" scope
    echo 4. Copy the token and use it as password
    echo.
)
echo.
pause
