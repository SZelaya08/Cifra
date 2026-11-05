@echo off
chcp 65001 >nul
cd /d "%~dp0docs"

echo.
echo   Cifra - servidor local
echo   ----------------------
echo.
echo   En este computador:   http://localhost:8000
echo.
echo   Desde el celular, conectado al mismo Wi-Fi, usa una de estas
echo   direcciones y agregale  :8000  al final:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do echo       http://%%a:8000
echo.
echo   Si el celular no abre la pagina, es el Firewall de Windows:
echo   cuando pregunte, permite el acceso en redes privadas.
echo.
echo   Para apagar el servidor, cierra esta ventana o presiona Ctrl+C.
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8000
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    python -m http.server 8000
  ) else (
    echo   No encontre Python en este computador.
    echo   Opciones:
    echo     - abre  Cifra-un-solo-archivo.html  con doble clic, o
    echo     - instala Python desde https://www.python.org/downloads/
    echo       marcando "Add python.exe to PATH", o
    echo     - si tienes Node:  npx --yes serve -l 8000
    echo.
    pause
  )
)
