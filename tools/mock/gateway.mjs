// Mock API gateway (port 8080) for building the Angular app without any backend.
// Behaviour follows "Angular - Mock API" and "Gateway Config" in the specification:
//   - same route table as the real gateway, paths forwarded unchanged
//   - no JWT validation, CORS only for the Angular dev server
//   - X-Correlation-Id is created when missing and echoed
//   - GET /gateway/health/services reports each service by calling its /health
//   - POST /gateway/mock/down/{service} and /up/{service} simulate a crash without stopping anything
//   - a service that is down, or not running, answers with the structured 503 body
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const PORT = Number(process.env.GATEWAY_PORT ?? 8080);
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:4200';
const HOST = '127.0.0.1'; // Prism listens on 127.0.0.1 by default

export const SERVICES = {
  patient: { port: 8081, label: 'Patient' },
  reception: { port: 8082, label: 'Reception' },
  consultation: { port: 8083, label: 'Consultation' },
  lab: { port: 8084, label: 'Lab' },
  pharmacy: { port: 8085, label: 'Pharmacy' },
  staff: { port: 8086, label: 'Staff' },
};

// The route table is data: one line per prefix (see Gateway Config, "Route table").
export const ROUTES = [
  ['/api/patients', 'patient'],
  ['/api/appointments', 'reception'],
  ['/api/invoices', 'reception'],
  ['/api/consultations', 'consultation'],
  ['/api/vitals', 'consultation'],
  ['/api/lab-requests', 'lab'],
  ['/api/lab-results', 'lab'],
  ['/api/tests', 'lab'],
  ['/api/drugs', 'pharmacy'],
  ['/api/stock', 'pharmacy'],
  ['/api/prescriptions', 'pharmacy'],
  ['/api/staff', 'staff'],
  ['/api/roles', 'staff'],
  ['/api/me', 'staff'],
];

export function serviceFor(pathname) {
  const route = ROUTES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return route ? route[1] : null;
}

const down = new Set();
let cache = { at: 0, services: null };

function unavailable(res, service, correlationId) {
  res.status(503).json({
    status: 503,
    error: 'Service Unavailable',
    service,
    message: `${SERVICES[service].label} service is unavailable, please try again later`,
    correlationId,
  });
}

async function probe(name) {
  if (down.has(name)) {
    return 'DOWN';
  }
  try {
    const response = await fetch(`http://${HOST}:${SERVICES[name].port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok ? 'UP' : 'DOWN';
  } catch {
    return 'DOWN';
  }
}

async function serviceStates() {
  // cached for 2 seconds like the real gateway, but a mock up/down switch shows at once
  const manual = [...down].sort().join(',');
  if (cache.services && Date.now() - cache.at < 2000 && cache.manual === manual) {
    return cache.services;
  }
  const names = Object.keys(SERVICES);
  const states = await Promise.all(names.map(probe));
  const services = Object.fromEntries(names.map((n, i) => [n, states[i]]));
  cache = { at: Date.now(), services, manual };
  return services;
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // CORS (only the Angular dev server) and correlation id
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin === ALLOWED_ORIGIN) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Correlation-Id, Prefer',
        'Access-Control-Expose-Headers': 'X-Correlation-Id, Location',
        Vary: 'Origin',
      });
    }
    const correlationId = req.headers['x-correlation-id'] || randomBytes(4).toString('hex');
    req.headers['x-correlation-id'] = correlationId;
    req.correlationId = correlationId;
    res.set('X-Correlation-Id', correlationId);
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'UP' }));

  app.get('/gateway/health/services', async (_req, res) => {
    res.json({
      gateway: 'UP',
      services: await serviceStates(),
      checkedAt: new Date().toISOString(),
    });
  });

  app.post('/gateway/mock/:action/:service', (req, res) => {
    const { action, service } = req.params;
    if (!SERVICES[service] || (action !== 'down' && action !== 'up')) {
      return res
        .status(404)
        .json({ status: 404, error: 'Not Found', message: `Unknown service or action: ${action}/${service}` });
    }
    if (action === 'down') {
      down.add(service);
    } else {
      down.delete(service);
    }
    cache = { at: 0, services: null };
    res.json({ service, down: down.has(service) });
  });

  // a service marked down answers 503 without being called
  app.use((req, res, next) => {
    const service = serviceFor(req.path);
    if (service && down.has(service)) {
      return unavailable(res, service, req.correlationId);
    }
    next();
  });

  for (const [name, { port }] of Object.entries(SERVICES)) {
    app.use(
      createProxyMiddleware({
        target: `http://${HOST}:${port}`,
        changeOrigin: true,
        // v3 keeps the full path; the filter selects this service's prefixes
        pathFilter: (pathname) => serviceFor(pathname) === name,
        on: {
          error: (_err, req, res) => {
            if (typeof res.status === 'function' && !res.headersSent) {
              unavailable(res, name, req.correlationId);
            }
          },
        },
      }),
    );
  }

  app.use((req, res) => {
    res.status(404).json({
      timestamp: new Date().toISOString(),
      status: 404,
      error: 'Not Found',
      message: `No route for ${req.path}`,
      path: req.path,
      correlationId: req.correlationId,
    });
  });

  return app;
}

// Start only when run directly (node gateway.mjs), not when start.mjs imports the service list.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(PORT, () => console.log(`mock gateway listening on http://localhost:${PORT}`));
}
