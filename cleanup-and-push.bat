@echo off
echo === Git History Temizleniyor ===

echo [1/5] node_modules ve dist history'den siliniyor...
git filter-branch --force --index-filter "git rm -rf --cached --ignore-unmatch node_modules/ dist/" --prune-empty --tag-name-filter cat -- --all

echo [2/5] Eski referanslar temizleniyor...
git for-each-ref --format="delete %%(refname)" refs/original | git update-ref --stdin

echo [3/5] Reflog temizleniyor...
git reflog expire --expire=now --all

echo [4/5] GC calistiriliyor...
git gc --prune=now --aggressive

echo [5/5] Force push yapiliyor...
git push origin master --force

echo.
echo === Tamamlandi ===
pause
