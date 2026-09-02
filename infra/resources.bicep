param location string
@minLength(3)
param appName string
@secure()
param adminPassword string
@secure()
param adminSessionSecret string
@secure()
param playerRecoveryHmacSecret string
@secure()
param openAiApiKey string = ''
param openAiModel string = 'gpt-5.6-luna'
param customDomain string = ''
param emailDomain string = 'auth.emojizzle.com'
@description('Set only after the custom email domain has verified SPF and DKIM in Azure.')
param emailDomainReady bool = false

var uniqueSuffix = take(uniqueString(subscription().subscriptionId, resourceGroup().id, appName), 10)
var storageName = take(replace('${appName}${uniqueSuffix}', '-', ''), 24)

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  #disable-next-line BCP334
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource puzzleCatalog 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'PuzzleCatalog'
}

resource puzzleFeedback 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'PuzzleFeedback'
}

resource playerDirectory 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'PlayerDirectory'
}

resource puzzlePlays 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'PuzzlePlays'
}

resource playerVerifications 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'PlayerVerifications'
}

resource emailService 'Microsoft.Communication/emailServices@2025-09-01' = {
  name: '${appName}-email'
  location: 'global'
  properties: {
    dataLocation: 'United States'
  }
}

resource playerEmailDomain 'Microsoft.Communication/emailServices/domains@2025-09-01' = {
  parent: emailService
  name: emailDomain
  location: 'global'
  properties: {
    domainManagement: 'CustomerManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource playerEmailSender 'Microsoft.Communication/emailServices/domains/senderUsernames@2025-09-01' = if (emailDomainReady) {
  parent: playerEmailDomain
  name: 'players'
  properties: {
    displayName: 'Emojizzle'
    username: 'players'
  }
}

resource communicationService 'Microsoft.Communication/communicationServices@2025-09-01' = {
  name: '${appName}-communication'
  location: 'global'
  properties: {
    dataLocation: 'United States'
    linkedDomains: emailDomainReady ? [playerEmailDomain.id] : []
  }
}

resource site 'Microsoft.Web/staticSites@2023-12-01' = {
  name: appName
  location: location
  sku: { name: 'Free', tier: 'Free' }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

var storageKey = storage.listKeys().keys[0].value
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storageKey};EndpointSuffix=${environment().suffixes.storage}'

resource appSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: site
  name: 'appsettings'
  properties: {
    TABLE_STORAGE_CONNECTION_STRING: storageConnectionString
    ADMIN_PASSWORD: adminPassword
    ADMIN_SESSION_SECRET: adminSessionSecret
    PLAYER_RECOVERY_HMAC_SECRET: playerRecoveryHmacSecret
    VERIFICATION_SENDER: 'acs'
    ACS_EMAIL_CONNECTION_STRING: communicationService.listKeys().primaryConnectionString
    ACS_EMAIL_SENDER_ADDRESS: 'players@${emailDomain}'
    OPENAI_API_KEY: openAiApiKey
    OPENAI_MODEL: openAiModel
    SITE_ORIGIN: empty(customDomain)
      ? 'https://${site.properties.defaultHostname}'
      : 'https://${customDomain}'
  }
}

resource domain 'Microsoft.Web/staticSites/customDomains@2023-12-01' = if (!empty(customDomain)) {
  parent: site
  name: customDomain
  properties: { validationMethod: 'dns-txt-token' }
}

output staticWebAppName string = site.name
output defaultHostname string = site.properties.defaultHostname
output storageAccountName string = storage.name
output emailDomainResourceId string = playerEmailDomain.id
output emailDomainReady bool = emailDomainReady
