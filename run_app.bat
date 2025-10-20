@echo off
setlocal

REM Resolve project root (directory of this script)
set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%"

REM Create virtual environment if needed
if not exist venv (
    python -m venv venv
)

call venv\Scripts\activate
pip install --upgrade pip
pip install -r backend\requirements.txt

start "MLI Backend" cmd /c "cd /d \"%SCRIPT_DIR%\" && uvicorn backend.main:app --reload --port 8000"

pushd frontend
call npm install
npm run dev
popd

popd

endlocal
