# Security Configuration Guide for realtime-service

## Environment Variables Required

### Production (use `application-prod.properties`)
```bash
export JWT_SECRET="your-jwt-secret-key-matching-api-gateway"
export REDIS_HOST="redis.production.example.com"
export REDIS_PORT="6379"
export REDIS_PASSWORD="your-redis-password"
export INTERNAL_API_KEY="your-secret-internal-api-key-for-inter-service-communication"
export ALLOWED_ORIGINS="https://app.example.com,https://web.example.com"
```

### Development (use `application-dev.properties`)
```bash
export JWT_SECRET="dev-local-jwt-secret"
export INTERNAL_API_KEY="dev-local-api-key"
# Optional: for testing with local Redis
export REDIS_HOST="localhost"
export REDIS_PORT="6380"
```

## Setup Instructions

### For Developers (Local Setup)

1. Copy example file:
   ```bash
   cp src/main/resources/application-dev.properties.example src/main/resources/application-dev.properties
   ```

2. Edit `application-dev.properties` with your local values

3. Run with dev profile:
   ```bash
   mvn spring-boot:run -Dspring-boot.run.profiles=dev
   ```

### For DevOps/Production Deployment

1. **DO NOT** commit `application-prod.properties` to git
2. **DO NOT** hardcode secrets in any properties file
3. Inject environment variables at runtime:
   ```bash
   java -jar realtime-service.jar --spring.profiles.active=prod
   ```

4. Or use Docker/Kubernetes:
   ```yaml
   env:
     - name: JWT_SECRET
       valueFrom:
         secretKeyRef:
           name: realtime-secrets
           key: jwt-secret
     - name: INTERNAL_API_KEY
       valueFrom:
         secretKeyRef:
           name: realtime-secrets
           key: internal-api-key
   ```

## What's NOT Committed

✅ Committed:
- `application.properties` (defaults with placeholders)
- `application-dev.properties.example` (documentation)
- `application-prod.properties.example` (documentation)

❌ NOT Committed:
- `application-dev.properties` (actual dev config)
- `application-prod.properties` (actual prod config)
- `.env` files
- Any file with real secrets

## Verification

After setup, verify secrets are NOT in git:
```bash
git diff HEAD -- src/main/resources/*.properties
git log -p -- src/main/resources/*.properties
```

Should show NO actual secret values, only placeholders like `${JWT_SECRET:}`.

