targetScope = 'subscription'

@description('Azure region for the production resources.')
param location string = 'eastus2'
param resourceGroupName string = 'emoji-daily-prod-rg'
@minLength(3)
param appName string = 'emoji-daily-prod'
@secure()
param adminPassword string
@secure()
param adminSessionSecret string
@description('Email that receives the $1 monthly budget alert.')
param budgetEmail string
@description('Production custom hostname. Set to an empty string only to use the generated Azure hostname.')
param customDomain string = 'emojizzle.com'
@description('First day of the current month, generated at deployment time.')
param budgetStartDate string = utcNow('yyyy-MM-01')

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
}

module production './resources.bicep' = {
  name: 'emojiDailyProduction'
  scope: resourceGroup
  params: {
    location: location
    appName: appName
    adminPassword: adminPassword
    adminSessionSecret: adminSessionSecret
    customDomain: customDomain
  }
}

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'emoji-daily-monthly-budget'
  properties: {
    category: 'Cost'
    amount: 1
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: budgetStartDate
      endDate: '2099-12-31'
    }
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [resourceGroupName]
      }
    }
    notifications: {
      Actual_GreaterThan_80_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [budgetEmail]
        contactGroups: []
        contactRoles: []
      }
      Forecast_GreaterThan_100_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [budgetEmail]
        contactGroups: []
        contactRoles: []
      }
    }
  }
}

output staticWebAppName string = production.outputs.staticWebAppName
output defaultHostname string = production.outputs.defaultHostname
output storageAccountName string = production.outputs.storageAccountName
