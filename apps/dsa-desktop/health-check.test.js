const test = require('node:test');
const assert = require('node:assert/strict');

const { buildHealthCheckUrls, probeHealthUrls } = require('./health-check');

test('buildHealthCheckUrls returns desktop-compatible fallback endpoints in priority order', () => {
  assert.deepEqual(buildHealthCheckUrls(8000), [
    'http://127.0.0.1:8000/api/health',
    'http://127.0.0.1:8000/api/v1/health',
    'http://127.0.0.1:8000/health',
  ]);
});

test('probeHealthUrls falls back to later endpoints when earlier one returns 404', async () => {
  const calls = [];
  const result = await probeHealthUrls(
    [
      'http://127.0.0.1:8000/api/health',
      'http://127.0.0.1:8000/api/v1/health',
    ],
    {
      requestTimeoutMs: 50,
      request(url) {
        calls.push(url);
        if (url.endsWith('/api/health')) {
          return Promise.resolve({ statusCode: 404 });
        }
        if (url.endsWith('/api/v1/health')) {
          return Promise.resolve({ statusCode: 200 });
        }
        return Promise.resolve({ statusCode: 500 });
      },
    }
  );

  assert.equal(result.ready, true);
  assert.equal(result.url, 'http://127.0.0.1:8000/api/v1/health');
  assert.deepEqual(calls, [
    'http://127.0.0.1:8000/api/health',
    'http://127.0.0.1:8000/api/v1/health',
  ]);
});
