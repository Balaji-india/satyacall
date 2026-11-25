@echo off
rem Downloads the faster-whisper "base" model (~145 MB) for Say-It-Back into backend\models.
rem Safe to re-run: resumes a partial download. Each file is saved as .part and renamed only
rem when complete, so the server never loads a half-downloaded model.
set DIR=%~dp0models\faster-whisper-base
set URL=https://huggingface.co/Systran/faster-whisper-base/resolve/main
mkdir "%DIR%" 2>nul
for %%F in (config.json tokenizer.json vocabulary.txt model.bin) do (
  if not exist "%DIR%\%%F" (
    curl -L -C - --retry 5 -o "%DIR%\%%F.part" "%URL%/%%F" && move /y "%DIR%\%%F.part" "%DIR%\%%F" >nul
  )
)
dir "%DIR%"
