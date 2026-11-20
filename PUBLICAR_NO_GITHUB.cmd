@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>&1
if errorlevel 1 (
 echo Git nao encontrado. Instale Git for Windows e tente novamente.
 pause
 exit /b 1
)
git remote get-url origin >nul 2>&1
if errorlevel 1 (
 git remote add origin https://github.com/vellormenswear/vellor-menswear.git
) else (
 echo Remote origin ja existe. Confira se esta apontando para o repositorio correto.
 git remote -v
)
echo.
echo O repositorio privado deve existir e estar VAZIO na conta vellormenswear.
echo Enviando o commit inicial para GitHub...
git push -u origin main
if errorlevel 1 (
 echo ERRO no push. Confira login, permissao de escrita e se o repositorio esta vazio.
 pause
 exit /b 1
)
echo.
echo Envio finalizado! Acesse https://github.com/vellormenswear/vellor-menswear
pause
