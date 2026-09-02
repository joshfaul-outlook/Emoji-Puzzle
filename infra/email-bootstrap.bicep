param appName string = 'emoji-daily-prod'
param emailDomain string = 'auth.emojizzle.com'

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

resource communicationService 'Microsoft.Communication/communicationServices@2025-09-01' = {
  name: '${appName}-communication'
  location: 'global'
  properties: {
    dataLocation: 'United States'
    linkedDomains: []
  }
}

output emailDomainResourceId string = playerEmailDomain.id
