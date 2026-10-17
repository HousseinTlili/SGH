param([Parameter(Mandatory=$true)][string]$User, [string]$Password = 'Sgh@dev2026')
$body = @{ grant_type='password'; client_id='sgh-dev-cli'; username=$User; password=$Password }
(Invoke-RestMethod -Method Post -Uri 'http://localhost:8180/realms/sgh/protocol/openid-connect/token' -Body $body).access_token
