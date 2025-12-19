@echo off
cd /d "C:\Users\Dharmendra\Desktop\projec\lovll\remix-of-remix-of-remix-of-remix-of-tic-tac-math-master"
echo.
echo Checking git status...
git status
echo.
echo Adding all changes...
git add .
echo.
echo Committing changes...
git commit -m "Fix errors and implement missing features: Add error handling, Error Boundary, Supabase validation, loading states, and swipe navigation"
echo.
echo Pushing to GitHub...
git push origin main
echo.
echo Done!
pause
