@minLength(1)
param environmentName string

@minLength(1)
param location string

param tags object = {}

// Basic tier keeps cost low while supporting Always On for Next.js production workloads.
var appServicePlanName = 'asp-${environmentName}'
var webAppBaseName = toLower('app-${environmentName}-${uniqueString(resourceGroup().id)}')
var webAppName = take(webAppBaseName, 60)
var containerRegistryName = toLower('cr${replace(environmentName, '-', '')}${uniqueString(resourceGroup().id)}')

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: take(containerRegistryName, 50)
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: 'B1'
    tier: 'Basic'
    size: 'B1'
    family: 'B'
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerRegistry.properties.loginServer}/web:latest'
      minTlsVersion: '1.2'
      ftpsState: 'FtpsOnly'
      alwaysOn: true
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${containerRegistry.properties.loginServer}'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: containerRegistry.listCredentials().username
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: containerRegistry.listCredentials().passwords[0].value
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
      ]
    }
  }
}

output webAppName string = webApp.name
output webAppUri string = 'https://${webApp.properties.defaultHostName}'
output containerRegistryName string = containerRegistry.name
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output containerRegistryId string = containerRegistry.id
