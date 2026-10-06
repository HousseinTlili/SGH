import { baseEnvironment } from './environment.base';

// Mock mode: no Keycloak, and the mock gateway (tools/mock) answers on the same port as the real one.
export const environment = {
  ...baseEnvironment,
  production: false,
  mockAuth: true,
};
