param(
  [Parameter(Mandatory=$false)]
  [string]$Repositorio = "https://github.com/vellormenswear/vellor-menswear.git"
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git não está instalado. Instale Git for Windows, reabra o PowerShell e tente novamente."
}
if ($Repositorio -notmatch '^https://github\.com/vellormenswear/[A-Za-z0-9_.-]+(?:\.git)?$') {
  throw "Use a URL HTTPS do repositório PRIVADO criado na conta vellormenswear."
}
if (-not (Test-Path '.git')) { git init -b main }
$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and $remote) {
  if ($remote -ne $Repositorio) {
    throw "Já existe um remote origin diferente ($remote). Não vou sobrescrever."
  }
} else {
  git remote add origin $Repositorio
}
Write-Host "Enviando a versão do projeto para $Repositorio" -ForegroundColor Green
Write-Host "O GitHub pode pedir autenticação no navegador. NÃO informe senhas nesta conversa." 
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "Falha no push. Confira se o repositório existe e está vazio e se você tem permissão." }
Write-Host "Push concluído! Peça ao outro desenvolvedor para clonar o repositório privado." -ForegroundColor Green
