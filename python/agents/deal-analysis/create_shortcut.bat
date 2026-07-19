@echo off
rem יוצר קיצור דרך "ניתוח עסקאות LALUM" על שולחן העבודה, מריצים פעם אחת.
chcp 65001 >nul
powershell -NoProfile -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop') + '\ניתוח עסקאות LALUM.lnk');" ^
  "$s.TargetPath = '%~dp0deal.bat';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.IconLocation = 'shell32.dll,21';" ^
  "$s.Description = 'ניתוח כדאיות לעסקת נדל''ן: בחירת עסקה, ניתוח ודוח';" ^
  "$s.Save()"
echo קיצור הדרך "ניתוח עסקאות LALUM" נוצר על שולחן העבודה.
pause
