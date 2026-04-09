@echo off
echo ========================================
echo Pushing Server Changes to GitHub
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Git status...
git status

echo.
echo Adding new and modified files...
git add models/Feedback.js
git add routes/feedback.js
git add utils/emailTemplate.js
git add index.js

echo.
echo Committing changes...
git commit -m "Add feedback and automated communication system - Added Feedback model for storing attendee feedback - Added feedback routes for sending thank you emails and feedback requests - Added email templates for thank you and feedback request messages - Updated main server to register feedback routes - Supports bulk email sending to checked-in attendees - Includes feedback statistics and rating system"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo Done! Check above for any errors.
echo ========================================
pause
