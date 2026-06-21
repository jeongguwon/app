@if "%SCM_TRACE_ON%" NEQ "" @echo on

:: ----------------------
:: KUDU Deployment Script
:: ----------------------

:: Identify the deployment source
IF DEFINED DEPLOYMENT_SOURCE (
  SET DEPLOYMENT_SOURCE_PATH=%DEPLOYMENT_SOURCE%
) ELSE (
  GOTO Cleanup
)

:: Install dependencies
call :ExecuteCmd !NPM_CMD! install --prefer-offline --no-audit

IF !ERRORLEVEL! NEQ 0 goto error

:: Build
call :ExecuteCmd !NPM_CMD! run build

IF !ERRORLEVEL! NEQ 0 goto error

:: Web App Root
IF NOT DEFINED WEBROOT_PATH SET WEBROOT_PATH=%DEPLOYMENT_TARGET%

:: Kudu sync
IF /I "%DEPLOYMENT_CLEANTARGET%" EQU "true" (
  RD /S /Q "%DEPLOYMENT_TARGET%"
  IF !ERRORLEVEL! NEQ 0 goto error
)

REM robocopy "%DEPLOYMENT_SOURCE%" "%DEPLOYMENT_TARGET%" /E +:.git /XD .next .git node_modules
robocopy "%DEPLOYMENT_SOURCE%" "%DEPLOYMENT_TARGET%" /E /XD .next .git node_modules

goto success

:ExecuteCmd
setlocal
set _CMD_=%*
(%_CMD_%) 2>NUL
exit /b %ERRORLEVEL%

:error
endlocal
echo An error has occurred during web site deployment.
call :exitSetErrorLevel
call :exitFromFunction 2>NUL

:success
endlocal
call :exitFromFunction 2>NUL

:exitSetErrorLevel
exit /b 1

:exitFromFunction
()
exit /b 0
