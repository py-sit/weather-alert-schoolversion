::[Bat To Exe Converter]
::
::YAwzoRdxOk+EWAjk
::fBw5plQjdCyDJGyX8VAjFEkAGVPQAE+/Fb4I5/jH/OGGrkgPQN1uR9vnzbGPNOgW+AvtdplN
::YAwzuBVtJxjWCl3EqQJgSA==
::ZR4luwNxJguZRRnk
::Yhs/ulQjdF+5
::cxAkpRVqdFKZSjk=
::cBs/ulQjdFe5
::ZR41oxFsdFKZSDk=
::eBoioBt6dFKZSTk=
::cRo6pxp7LAbNWATEpCI=
::egkzugNsPRvcWATEpCI=
::dAsiuh18IRvcCxnZtBJQ
::cRYluBh/LU+EWAnk
::YxY4rhs+aU+JeA==
::cxY6rQJ7JhzQF1fEqQJQ
::ZQ05rAF9IBncCkqN+0xwdVs0
::ZQ05rAF9IAHYFVzEqQJQ
::eg0/rx1wNQPfEVWB+kM9LVsJDGQ=
::fBEirQZwNQPfEVWB+kM9LVsJDGQ=
::cRolqwZ3JBvQF1fEqQJQ
::dhA7uBVwLU+EWDk=
::YQ03rBFzNR3SWATElA==
::dhAmsQZ3MwfNWATElA==
::ZQ0/vhVqMQ3MEVWAtB9wSA==
::Zg8zqx1/OA3MEVWAtB9wSA==
::dhA7pRFwIByZRRnk
::Zh4grVQjdCyDJGyX8VAjFEkAGVPQAE+/Fb4I5/jH/OGGrkgPQN1uR9vnyaCPMvRd713hFQ==
::YB416Ek+ZG8=
::
::
::978f952a14a936cc963da21a135fa983
@echo off
chcp 65001 >nul
echo 正在启动气象预警系统...

REM 设置窗口标题
title 气象预警系统

REM 检查Python是否安装
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Python未安装或未添加到PATH中，请安装Python后再试！
    pause
    exit /b
)

REM 检查是否存在app.py
if not exist app.py (
    echo 未找到app.py文件，请确保在正确的目录中运行！
    pause
    exit /b
)

REM 检查是否需要安装依赖?
echo 正在检查依赖..
python -c "import flask" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo 正在安装Flask...
    pip install flask flask_sqlalchemy flask_cors
)

REM 启动应用
echo 正在启动应用服务器，请稍候..
echo 应用启动后，将自动打开浏览器
echo 按Ctrl+C可以停止服务器

REM 创建启动和打开浏览器的脚本
echo @echo off > open_browser.bat
echo timeout /t 3 > open_browser.bat
echo start http://localhost:8000 >> open_browser.bat
echo exit >> open_browser.bat

REM 在后台启动脚本打开浏览器
start /b open_browser.bat

REM 启动Flask应用
python app.py

REM 如果应用意外退出
echo 应用已停止运行
pause
