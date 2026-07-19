@echo off
rem יוצר קיצור דרך "חשבוניות LALUM" על שולחן העבודה, מריצים פעם אחת.
chcp 65001 >nul
powershell -NoProfile -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\חשבוניות LALUM.lnk');" ^
  "$s.TargetPath = '%~dp0invoices.bat';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.IconLocation = 'shell32.dll,265';" ^
  "$s.Description = 'איסוף חשבוניות החודש והכנת מייל להנהלת חשבונות';" ^
  "$s.Save()"
echo קיצור הדרך "חשבוניות LALUM" נוצר על שולחן העבודה.
pause
