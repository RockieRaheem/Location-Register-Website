$ErrorActionPreference = 'Stop'
$baseUrl = 'http://localhost:3000/api/location-registry'

$statistics = Invoke-RestMethod -Uri "$baseUrl/statistics?countryCode=UG"
$schema = Invoke-RestMethod -Uri "$baseUrl/countries/UG/schema"
$regions = Invoke-RestMethod -Uri "$baseUrl/countries/UG/locations?parentUid=$($schema.rootLocationUid)&limit=20"
$districtSearch = Invoke-RestMethod -Uri "$baseUrl/countries/UG/locations?level=2&search=KAMPALA&limit=20"
$kampala = $districtSearch.items | Where-Object { $_.name -eq 'KAMPALA' } | Select-Object -First 1
if ($null -eq $kampala) { throw 'KAMPALA was not returned by canonical location search' }
$ancestors = Invoke-RestMethod -Uri "$baseUrl/locations/$($kampala.uid)/ancestors"

$kenyaSchema = Invoke-RestMethod -Uri "$baseUrl/countries/KE/schema"
$createBody = @{
  countryCode = 'KE'
  parentUid = $kenyaSchema.rootLocationUid
  levelOrder = 1
  name = '__DATABASE API SMOKE TEST__'
  type = 'County'
  metadata = @{ testOnly = $true }
} | ConvertTo-Json -Depth 5
$created = Invoke-RestMethod -Method Post -Uri "$baseUrl/locations" -ContentType 'application/json' -Body $createBody

$updateBody = @{ name = '__DATABASE API SMOKE TEST UPDATED__' } | ConvertTo-Json
$updated = Invoke-RestMethod -Method Patch -Uri "$baseUrl/locations/$($created.uid)" -ContentType 'application/json' -Body $updateBody
if ($updated.name -ne '__DATABASE API SMOKE TEST UPDATED__') { throw 'Location update did not persist' }

$invalidParentRejected = $false
try {
  $invalidBody = @{
    countryCode = 'KE'
    parentUid = $kenyaSchema.rootLocationUid
    levelOrder = 2
    name = '__INVALID LEVEL__'
    type = 'Invalid'
  } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$baseUrl/locations" -ContentType 'application/json' -Body $invalidBody | Out-Null
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 404) { $invalidParentRejected = $true }
}
if (-not $invalidParentRejected) { throw 'An unconfigured hierarchy level was not rejected' }

$nigeriaSchema = Invoke-RestMethod -Uri "$baseUrl/countries/NG/schema"
$parentOneBody = @{
  countryCode = 'NG'; parentUid = $nigeriaSchema.rootLocationUid; levelOrder = 1
  name = '__MOVE TEST PARENT ONE__'; type = 'Test Level 1'; metadata = @{ testOnly = $true }
} | ConvertTo-Json -Depth 5
$parentTwoBody = @{
  countryCode = 'NG'; parentUid = $nigeriaSchema.rootLocationUid; levelOrder = 1
  name = '__MOVE TEST PARENT TWO__'; type = 'Test Level 1'; metadata = @{ testOnly = $true }
} | ConvertTo-Json -Depth 5
$parentOne = Invoke-RestMethod -Method Post -Uri "$baseUrl/locations" -ContentType 'application/json' -Body $parentOneBody
$parentTwo = Invoke-RestMethod -Method Post -Uri "$baseUrl/locations" -ContentType 'application/json' -Body $parentTwoBody
$childBody = @{
  countryCode = 'NG'; parentUid = $parentOne.uid; levelOrder = 2
  name = '__MOVE TEST CHILD__'; type = 'Test Level 2'; metadata = @{ testOnly = $true }
} | ConvertTo-Json -Depth 5
$child = Invoke-RestMethod -Method Post -Uri "$baseUrl/locations" -ContentType 'application/json' -Body $childBody

$crossCountryMoveRejected = $false
try {
  $crossCountryBody = @{ parentUid = $created.uid } | ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$baseUrl/locations/$($child.uid)/move" -ContentType 'application/json' -Body $crossCountryBody | Out-Null
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 400) { $crossCountryMoveRejected = $true }
}
if (-not $crossCountryMoveRejected) { throw 'Cross-country move was not rejected' }

$moveBody = @{ parentUid = $parentTwo.uid } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$baseUrl/locations/$($child.uid)/move" -ContentType 'application/json' -Body $moveBody | Out-Null
$movedAncestors = Invoke-RestMethod -Uri "$baseUrl/locations/$($child.uid)/ancestors"
if (($movedAncestors | Select-Object -ExpandProperty uid) -notcontains $parentTwo.uid) { throw 'Moved location closure paths were not rebuilt' }
if (($movedAncestors | Select-Object -ExpandProperty uid) -contains $parentOne.uid) { throw 'Old ancestor remained after move' }

Invoke-RestMethod -Method Delete -Uri "$baseUrl/locations/$($child.uid)" | Out-Null
Invoke-RestMethod -Method Delete -Uri "$baseUrl/locations/$($parentOne.uid)" | Out-Null
Invoke-RestMethod -Method Delete -Uri "$baseUrl/locations/$($parentTwo.uid)" | Out-Null

Invoke-RestMethod -Method Delete -Uri "$baseUrl/locations/$($created.uid)" | Out-Null
$deleteConfirmed = $false
try {
  Invoke-RestMethod -Uri "$baseUrl/locations/$($created.uid)" | Out-Null
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 404) { $deleteConfirmed = $true }
}
if (-not $deleteConfirmed) { throw 'Deleted smoke-test location is still accessible' }

@{
  valid = $true
  ugandaAdministrativeLocations = $statistics.administrative_locations
  ugandaHierarchyLevels = $schema.levels.Count
  ugandaRegions = $regions.total
  kampalaUid = $kampala.uid
  kampalaAncestorChain = @($ancestors | ForEach-Object { $_.name })
  createUpdateDelete = 'passed'
  invalidLevelConstraint = 'passed'
  moveAndClosureRebuild = 'passed'
  crossCountryMoveConstraint = 'passed'
} | ConvertTo-Json -Depth 6
