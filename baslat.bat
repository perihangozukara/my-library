@echo off
chcp 65001 >nul
title Kitapligim
cd /d "%~dp0"
echo Kitapligim aciliyor: http://localhost:8765
echo Bu pencere acik kaldikca uygulama calisir. Kapatmak icin pencereyi kapat.
start "" http://localhost:8765/
python -m http.server 8765 --bind 127.0.0.1
