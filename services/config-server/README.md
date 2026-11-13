# SGH Spring Cloud Config Server

Port **8888**, stack **Spring Boot 3.4** with Spring Cloud Config Server.

- **Native Config Directory**: `src/main/resources/config/`
- **Config Endpoints**:
  - `http://localhost:8888/patient-service/default`
  - `http://localhost:8888/staff-service/default`
  - `http://localhost:8888/application/default`

## Dynamic Refresh
Downstream Spring Boot microservices consume properties via `spring.config.import=optional:configserver:http://localhost:8888`.
When a property changes in `config/`, clients can dynamically reload values without restarting by invoking:
```bash
curl -X POST http://localhost:8081/actuator/refresh
curl -X POST http://localhost:8086/actuator/refresh
```
Annotated beans using `@RefreshScope` immediately reflect the updated configuration.
