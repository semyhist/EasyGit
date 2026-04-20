@echo off
echo === Remote Ekleniyor ve Push Yapiliyor ===

echo [1/2] Origin remote ekleniyor...
git remote add origin https://github.com/semyhist/EasyGit.git

echo [2/2] Force push yapiliyor...
git push origin master --force

echo.
echo === Tamamlandi ===
pause
