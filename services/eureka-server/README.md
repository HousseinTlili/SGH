# SGH Eureka Service Discovery Server

Port **8761**, stack **Spring Boot 3.4** with Spring Cloud Netflix Eureka Server.

- **Dashboard**: `http://localhost:8761/`
- **Eureka Service URL**: `http://localhost:8761/eureka/`

## Responsibilities
Central service registry for all microservices, API Gateway, and Config Server in the SGH ecosystem.
Provides dynamic service registration and client-side load balancing (`lb://`).
