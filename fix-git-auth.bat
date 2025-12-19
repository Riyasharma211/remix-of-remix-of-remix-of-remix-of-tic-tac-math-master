@echo off
cd /d "C:\Users\Dharmendra\Desktop\projec\lovll\remix-of-remix-of-remix-of-remix-of-tic-tac-math-master"
echo.
echo Current remote URL:
git remote -v
echo.
echo.
echo To fix authentication, you have 2 options:
echo.
echo Option 1: Update remote URL with your GitHub username
echo   git remote set-url origin https://YOUR_USERNAME@github.com/Riyasharma211/remix-of-remix-of-remix-of-remix-of-tic-tac-math-master.git
echo.
echo Option 2: Use Personal Access Token
echo   1. Go to: https://github.com/settings/tokens
echo   2. Generate new token (classic) with 'repo' permissions
echo   3. Use token as password when pushing
echo.
echo Option 3: Switch to SSH (if you have SSH keys set up)
echo   git remote set-url origin git@github.com:Riyasharma211/remix-of-remix-of-remix-of-remix-of-tic-tac-math-master.git
echo.
pause
