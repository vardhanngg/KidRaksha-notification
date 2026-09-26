@echo off
setlocal
set VERSION=9.6.1
if "%GRADLE_USER_HOME%"=="" set GRADLE_USER_HOME=%USERPROFILE%\.gradle
set DIST=%GRADLE_USER_HOME%\littlewatch\gradle-%VERSION%
if not exist "%DIST%\bin\gradle.bat" (
  echo Gradle %VERSION% is not installed in %DIST%.
  echo Open this project in Android Studio or install Gradle %VERSION% locally.
  exit /b 1
)
call "%DIST%\bin\gradle.bat" -p "%~dp0" %*
endlocal
