#!/usr/bin/env pwsh

param(
  [string]$RegistryName = $env:AZURE_CONTAINER_REGISTRY_NAME,
  [string]$RegistryEndpoint = $env:AZURE_CONTAINER_REGISTRY_ENDPOINT,
  [string]$ResourceGroup = $env:AZURE_RESOURCE_GROUP_NAME,
  [string]$ImageTag = "latest"
)

if (-not $RegistryName) {
  Write-Error "AZURE_CONTAINER_REGISTRY_NAME environment variable not set"
  exit 1
}

if (-not $RegistryEndpoint) {
  Write-Error "AZURE_CONTAINER_REGISTRY_ENDPOINT environment variable not set"
  exit 1
}

$ImageName = "web"
$FullImageName = "$RegistryEndpoint/$ImageName`:$ImageTag"

Write-Host "Building Docker image: $FullImageName"
docker build -t $FullImageName -f ./web/Dockerfile ./web

if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker build failed"
  exit 1
}

Write-Host "Logging in to Azure Container Registry: $RegistryName"
az acr login --name $RegistryName

if ($LASTEXITCODE -ne 0) {
  Write-Error "Azure Container Registry login failed"
  exit 1
}

Write-Host "Pushing image to registry: $FullImageName"
docker push $FullImageName

if ($LASTEXITCODE -ne 0) {
  Write-Error "Docker push failed"
  exit 1
}

Write-Host "Successfully pushed image: $FullImageName"
