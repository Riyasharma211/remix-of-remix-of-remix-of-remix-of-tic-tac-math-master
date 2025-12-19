@echo off
cd /d "C:\Users\Dharmendra\Desktop\projec\lovll\remix-of-remix-of-remix-of-remix-of-tic-tac-math-master"
echo.
echo ========================================
echo FORCE PUSHING TO GITHUB
echo ========================================
echo.
echo WARNING: This will overwrite remote history!
echo.
pause
echo.
echo Force pushing to origin/main...
git push --force origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Force push completed!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Force push failed. Check authentication.
    echo ========================================
    echo.
    echo You may need to:
    echo 1. Use Personal Access Token as password
    echo 2. Or update remote URL with your username
    echo.
)
echo.
pause
