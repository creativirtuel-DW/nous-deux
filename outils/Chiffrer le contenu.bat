@echo off
chcp 65001 >nul
title Nous Deux - chiffrement du contenu
node "%~dp0chiffrer-contenu.mjs"
echo.
pause
