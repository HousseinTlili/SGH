import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { toApiError } from './api-error';

describe('toApiError', () => {
  it('returns the shared error body as sent by the server', () => {
    const body = {
      status: 409,
      error: 'Conflict',
      message: 'Duplicate',
      correlationId: 'b3f1c2d4',
    };
    expect(toApiError(new HttpErrorResponse({ status: 409, error: body }))).toEqual(body);
  });

  it('builds a body for a response that has none, keeping the correlation id header', () => {
    const err = new HttpErrorResponse({
      status: 502,
      statusText: 'Bad Gateway',
      headers: new HttpHeaders({ 'X-Correlation-Id': 'abc12345' }),
      error: '<html>proxy error</html>',
    });
    const body = toApiError(err);
    expect(body.status).toBe(502);
    expect(body.correlationId).toBe('abc12345');
  });

  it('describes a network failure', () => {
    const body = toApiError(
      new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') }),
    );
    expect(body.status).toBe(0);
    expect(body.message).toBe('Cannot reach the server');
  });

  it('copes with a plain Error', () => {
    expect(toApiError(new Error('boom')).message).toBe('boom');
  });
});
