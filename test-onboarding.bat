@echo off
REM ===========================================
REM  Test Onboarding Flow - Fresh Mode
REM ===========================================
REM  Double-click this file to test the onboarding
REM  flow as if you were a new user.
REM
REM  This opens http://localhost:5173/start?fresh=1
REM  which bypasses auth and trial checks.
REM ===========================================

echo Opening onboarding in fresh mode...
start "" "http://localhost:5173/start?fresh=1"
