targetScope = 'subscription'

@minLength(1)
param environmentName string

@minLength(1)
param location string

var tags = {
  'azd-env-name': environmentName
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module appInfra './resources.bicep' = {
  name: 'appinfra-${uniqueString(environmentName, location)}'
  scope: resourceGroup
  params: {
    environmentName: environmentName
    location: location
    tags: tags
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP_NAME string = resourceGroup.name
output SERVICE_WEB_NAME string = appInfra.outputs.webAppName
output SERVICE_WEB_URI string = appInfra.outputs.webAppUri
output AZURE_CONTAINER_REGISTRY_NAME string = appInfra.outputs.containerRegistryName
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = appInfra.outputs.containerRegistryLoginServer
