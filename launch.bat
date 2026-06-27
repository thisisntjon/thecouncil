@echo off
setlocal EnableExtensions

cd /d "%~dp0"

rem Use UTF-8 so the rich terminal dashboard (box-drawing, block bars, arrows)
rem renders correctly instead of mojibake on stock cmd.exe code pages.
chcp 65001 >nul

if /I "%~1"=="fixture" goto run_fixture
if /I "%~1"=="car-wash" goto run_car_wash
if /I "%~1"=="verify" goto run_verify
if /I "%~1"=="test" goto run_test
if /I "%~1"=="mcp" goto run_mcp
if /I "%~1"=="ui-static" goto open_static_ui
if /I "%~1"=="ui" goto run_fixture_ui
if /I "%~1"=="ui-fixture" goto run_fixture_ui
if /I "%~1"=="ui-live" goto run_live_ui
if /I "%~1"=="live-feedback" goto run_live_feedback
if /I "%~1"=="install-ui" goto install_ui
if /I "%~1"=="custom" goto run_custom_arg
if /I "%~1"=="help" goto help
if /I "%~1"=="--help" goto help
if not "%~1"=="" goto unknown

:menu
set "PAUSE_ON_EXIT=1"
cls
echo.
echo   The Council
echo   redact -^> council -^> critique -^> verify -^> synthesize -^> audit
echo   --------------------------------------------------------------
echo     D^)  Run the demo             offline - no keys
echo     U^)  Open browser UI          offline - no keys
echo     V^)  Verify (for reviewers)   offline - no keys
echo     --------------------------------------------------------------
echo     A^)  Advanced / developer              ^>
echo     L^)  Live mode (needs keys, may cost)  ^>
echo     Q^)  Quit
echo.
echo   Everything here is offline ^& safe unless marked Live.
echo   [Enter] = Run the demo
echo.
set /p CHOICE="  Choose [D/U/V/A/L/Q]: "

if "%CHOICE%"=="" goto run_fixture
if /I "%CHOICE%"=="D" goto demo_menu
if /I "%CHOICE%"=="U" goto run_fixture_ui
if /I "%CHOICE%"=="V" goto run_verify
if /I "%CHOICE%"=="A" goto advanced_menu
if /I "%CHOICE%"=="L" goto live_menu
if /I "%CHOICE%"=="Q" goto done
if /I "%CHOICE%"=="exit" goto done
if /I "%CHOICE%"=="H" goto help

echo.
echo   Unknown option: %CHOICE%
echo.
pause
goto menu

:demo_menu
cls
echo.
echo   DEMO   (offline - no keys)
echo   --------------------------------------------------------------
echo     1^)  Default fixture dashboard
echo     2^)  Weighted car-wash scenario
echo     3^)  Custom question
echo     B^)  Back
echo.
set /p DCHOICE="  Choose [1/2/3/B]: "
if "%DCHOICE%"=="" goto run_fixture
if "%DCHOICE%"=="1" goto run_fixture
if "%DCHOICE%"=="2" goto run_car_wash
if "%DCHOICE%"=="3" goto run_custom_prompt
if /I "%DCHOICE%"=="B" goto menu
goto demo_menu

:advanced_menu
cls
echo.
echo   ADVANCED / DEVELOPER   (offline - no keys)
echo   --------------------------------------------------------------
echo     1^)  Run smoke tests
echo     2^)  Run MCP self-test
echo     3^)  Run full capstone verification
echo     B^)  Back
echo.
set /p ACHOICE="  Choose [1/2/3/B]: "
if "%ACHOICE%"=="1" goto run_test
if "%ACHOICE%"=="2" goto run_mcp
if "%ACHOICE%"=="3" goto run_verify
if /I "%ACHOICE%"=="B" goto menu
goto advanced_menu

:live_menu
cls
echo.
echo   LIVE MODE   (optional - needs provider keys, may cost money)
echo   --------------------------------------------------------------
echo     1^)  Start live React UI        (server + client)
echo     2^)  Run live feedback loop
echo     3^)  Install live UI dependencies
echo     B^)  Back
echo.
echo   These call real providers and are NOT required for grading.
echo.
set /p LCHOICE="  Choose [1/2/3/B]: "
if "%LCHOICE%"=="1" goto run_live_ui
if "%LCHOICE%"=="2" goto run_live_feedback
if "%LCHOICE%"=="3" goto install_ui
if /I "%LCHOICE%"=="B" goto menu
goto live_menu

:preflight
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install Node.js or open a terminal where node is available.
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found on PATH.
  echo Install Node.js/npm or open a terminal where npm is available.
  exit /b 1
)
exit /b 0

:run_fixture
call :preflight
if errorlevel 1 goto finish
echo.
echo Running default fixture demo...
call npm.cmd run demo:fixture
goto finish

:run_car_wash
call :preflight
if errorlevel 1 goto finish
echo.
echo Running weighted car-wash demo...
call npm.cmd run demo:car-wash
goto finish

:run_verify
call :preflight
if errorlevel 1 goto finish
echo.
echo Running full capstone verification...
call npm.cmd run verify:capstone
goto finish

:run_test
call :preflight
if errorlevel 1 goto finish
echo.
echo Running smoke tests...
call npm.cmd test
goto finish

:run_mcp
call :preflight
if errorlevel 1 goto finish
echo.
echo Running MCP self-test...
call npm.cmd run mcp:self-test
goto finish

:open_static_ui
echo.
if exist "screenshots\demo-output.html" (
  echo Opening public demo page...
  start "" "%CD%\screenshots\demo-output.html"
) else (
  echo Could not find screenshots\demo-output.html.
  call :mark_error 1
  goto finish
)
goto finish

:run_fixture_ui
call :preflight
if errorlevel 1 goto finish
echo.
echo Starting public fixture UI...
echo UI: http://127.0.0.1:4173
echo This mode uses offline simulated fixture data and does not require API keys.
start "The Council Fixture UI" "%ComSpec%" /k "cd /d ""%CD%"" && npm.cmd run ui:fixture"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
goto finish

:install_ui
call :preflight
if errorlevel 1 goto finish
echo.
echo Installing optional live UI dependencies...
echo This may need internet access.
call npm.cmd --prefix server install
if errorlevel 1 goto finish
call npm.cmd --prefix client install
if errorlevel 1 goto finish
call npm.cmd --prefix shadow-council install
goto finish

:run_live_ui
call :preflight
if errorlevel 1 goto finish
echo.
node scripts\live_preflight.mjs --strict
if errorlevel 1 goto finish
echo Starting optional live UI...
echo API: http://localhost:3001/api/health
echo UI:  http://localhost:5173
start "The Council API" "%ComSpec%" /k "cd /d ""%CD%\server"" && npm.cmd start"
timeout /t 2 /nobreak >nul
start "The Council UI" "%ComSpec%" /k "cd /d ""%CD%\client"" && npm.cmd run dev -- --host 127.0.0.1"
start "" "http://localhost:5173"
goto finish

:run_live_feedback
call :preflight
if errorlevel 1 goto finish
echo.
node scripts\live_preflight.mjs --strict
if errorlevel 1 goto finish
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri http://127.0.0.1:3001/api/health -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Starting optional live API...
  start "The Council API" "%ComSpec%" /k "cd /d ""%CD%\server"" && npm.cmd start"
  timeout /t 4 /nobreak >nul
) else (
  echo Reusing live API at http://127.0.0.1:3001.
)
echo.
echo Running live online feedback loop...
call npm.cmd run live:feedback
goto finish

:run_custom_arg
call :preflight
if errorlevel 1 goto finish
shift
if "%~1"=="" (
  echo Missing custom question.
  echo Usage: launch.bat custom "Your question here"
  exit /b 1
)
set "QUESTION=%~1"
:custom_arg_loop
shift
if "%~1"=="" goto run_custom_question
set "QUESTION=%QUESTION% %~1"
goto custom_arg_loop

:run_custom_prompt
call :preflight
if errorlevel 1 goto finish
echo.
set /p QUESTION="Question: "
if "%QUESTION%"=="" (
  echo No question entered.
  goto finish
)

:run_custom_question
echo.
echo Running custom fixture question...
call npm.cmd run demo:fixture -- "%QUESTION%"
goto finish

:help
echo The Council - local launcher
echo.
echo Interactive menu (just run: launch.bat):
echo   D) Demo  - default fixture / car-wash / custom question   (offline)
echo   U) Open browser fixture UI                                (offline)
echo   V) Verify - full capstone verification                   (offline)
echo   A) Advanced - smoke tests / MCP self-test / verification  (offline)
echo   L) Live mode - React UI / feedback / install deps  (needs keys, may cost)
echo   Q) Quit
echo.
echo Direct commands (offline unless noted):
echo   launch.bat fixture            default fixture dashboard
echo   launch.bat car-wash           weighted car-wash scenario
echo   launch.bat custom "question"  custom fixture question
echo   launch.bat ui                 browser fixture UI
echo   launch.bat verify             full capstone verification
echo   launch.bat test               smoke tests
echo   launch.bat mcp                MCP self-test
echo   launch.bat ui-static          open pre-rendered demo HTML
echo   launch.bat ui-live            live React UI    (needs keys, may cost)
echo   launch.bat live-feedback      live feedback    (needs keys, may cost)
echo   launch.bat install-ui         install live deps
echo.
goto done

:mark_error
exit /b %~1

:unknown
echo Unknown command: %~1
echo.
goto help

:finish
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo Done.
) else (
  echo Finished with exit code %EXIT_CODE%.
)
if "%PAUSE_ON_EXIT%"=="1" pause
exit /b %EXIT_CODE%

:done
if "%PAUSE_ON_EXIT%"=="1" pause
exit /b 0
