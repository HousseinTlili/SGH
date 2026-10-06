/** Values shared by every environment. environment.ts and environment.mock.ts add the differences. */
export const baseEnvironment = {
  apiBaseUrl: 'http://localhost:8080',
  statusPollMs: 5000,
  keycloak: { url: 'http://localhost:8180', realm: 'sgh', clientId: 'sgh-frontend' },
};
