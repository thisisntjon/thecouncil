@echo off
setlocal EnableExtensions

cd /d "%~dp0"

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
echo The Council - local launcher
echo.
echo 1. Run default fixture demo
echo 2. Run weighted car-wash demo
echo 3. Run full capstone verification
echo 4. Run smoke tests
echo 5. Run MCP self-test
echo 6. Open public demo page
echo 7. Start public fixture UI
echo 8. Start optional live React UI
echo 9. Run live feedback loop
echo 10. Install optional live UI dependencies
echo 11. Run custom fixture question
echo 12. Exit
echo.
set /p CHOICE="Choose an option: "

if "%CHOICE%"=="1" goto run_fixture
if "%CHOICE%"=="2" goto run_car_wash
if "%CHOICE%"=="3" goto run_verify
if "%CHOICE%"=="4" goto run_test
if "%CHOICE%"=="5" goto run_mcp
if "%CHOICE%"=="6" goto open_static_ui
if "%CHOICE%"=="7" goto run_fixture_ui
if "%CHOICE%"=="8" goto run_live_ui
if "%CHOICE%"=="9" goto run_live_feedback
if "%CHOICE%"=="10" goto install_ui
if "%CHOICE%"=="11" goto run_custom_prompt
if "%CHOICE%"=="12" goto done

echo.
echo Unknown option: %CHOICE%
goto finish

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
echo Interactive:
echo   launch.bat
echo.
echo Direct commands:
echo   launch.bat fixture
echo   launch.bat car-wash
echo   launch.bat verify
echo   launch.bat test
echo   launch.bat mcp
echo   launch.bat ui-static
echo   launch.bat ui
echo   launch.bat ui-fixture
echo   launch.bat ui-live
echo   launch.bat live-feedback
echo   launch.bat install-ui
echo   launch.bat custom "Your question here"
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
