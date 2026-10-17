# Keycloak & Infrastructure Verification Notes

**Date:** 2026-10-17  
**Keycloak Version:** `quay.io/keycloak/keycloak:26.8.1`  
**RabbitMQ Version:** `rabbitmq:4.3.6-management`  
**PostgreSQL Version:** `postgres:16.15`

---

## 1. Keycloak Realm Setup & Custom Attributes

In Keycloak 26.x, custom attributes (`staffId`, `patientId`) are governed by the declarative user profile. The working configuration in `infra/keycloak/sgh-realm.json`:

1. **Declarative User Profile Provider:**
   Defined under `components["org.keycloak.userprofile.UserProfileProvider"]`:
   ```json
   {
     "name": "staffId",
     "displayName": "Staff id",
     "validations": {},
     "permissions": {
       "view": ["admin"],
       "edit": ["admin"]
     },
     "multivalued": false
   },
   {
     "name": "patientId",
     "displayName": "Patient id",
     "validations": {},
     "permissions": {
       "view": ["admin"],
       "edit": ["admin"]
     },
     "multivalued": false
   }
   ```

2. **Protocol Mappers on Clients (`sgh-dev-cli` & `sgh-frontend`):**
   Attribute mapper `oidc-usermodel-attribute-mapper` maps the user attribute to JWT claim:
   ```json
   {
     "name": "staffId",
     "protocol": "openid-connect",
     "protocolMapper": "oidc-usermodel-attribute-mapper",
     "consentRequired": false,
     "config": {
       "user.attribute": "staffId",
       "claim.name": "staffId",
       "jsonType.label": "String",
       "access.token.claim": "true",
       "id.token.claim": "true",
       "userinfo.token.claim": "true"
     }
   }
   ```

3. **Service Account Client (`sgh-reception-svc`):**
   - Direct client credentials grant enabled (`serviceAccountsEnabled: true`).
   - Dedicated service account user `service-account-sgh-reception-svc` carries the realm role `RECEPTIONIST`.

4. **Verified Tokens:**
   - `doctor1`: includes `staffId = b2b2b2b2-0000-4000-8000-000000000001`, role `DOCTOR`.
   - `patient1`: includes `patientId = a1a1a1a1-0000-4000-8000-000000000001`, role `PATIENT`.
   - `admin1`: includes `staffId = b2b2b2b2-0000-4000-8000-000000000007`, role `ADMIN`.
   - `sgh-reception-svc` (client_credentials): includes role `RECEPTIONIST`.

---

## 2. RabbitMQ 4.x Definition Loading Pitfalls

When using `load_definitions` (`rabbitmq.conf: load_definitions = /etc/rabbitmq/definitions.json`) with RabbitMQ 4.x:
1. **Virtual Host (`/`) Missing:** RabbitMQ 4 terminates boot if definitions lack a `"vhosts"` array defining `"/"` (`Error during startup: {error,<<"Please create virtual host \"/\" prior to importing definitions.">>}`).
   - Fix: Added `"vhosts": [{ "name": "/" }]` to `infra/rabbitmq/definitions.json`.
2. **User Authentication:** When definitions are imported, `RABBITMQ_DEFAULT_USER` is bypassed by the definition loader, leaving no users.
   - Fix: Added user `sgh` with password `sgh_dev_password`, tag `administrator`, and full regex permissions on `/` into `infra/rabbitmq/definitions.json`.
