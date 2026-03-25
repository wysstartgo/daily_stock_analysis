const http = require('http');

function buildHealthCheckUrls(port) {
  return [
    `http://127.0.0.1:${port}/api/health`,
    `http://127.0.0.1:${port}/api/v1/health`,
    `http://127.0.0.1:${port}/health`,
  ];
}

function requestHealthUrl(url, { requestTimeoutMs = 1500, request = null } = {}) {
  const requestImpl = request || ((targetUrl, options = {}) => new Promise((resolve, reject) => {
    const req = http.get(targetUrl, (res) => {
      res.resume();
      resolve({ statusCode: res.statusCode });
    });

    req.setTimeout(options.requestTimeoutMs ?? requestTimeoutMs, () => {
      req.destroy(new Error(`Health probe request timeout after ${options.requestTimeoutMs ?? requestTimeoutMs}ms`));
    });
    req.on('error', reject);
  }));

  return requestImpl(url, { requestTimeoutMs });
}

async function probeHealthUrls(urls, options = {}) {
  const normalizedUrls = Array.from(new Set((Array.isArray(urls) ? urls : [urls]).filter(Boolean)));
  const statuses = [];

  for (const url of normalizedUrls) {
    try {
      const result = await requestHealthUrl(url, options);
      const statusCode = Number(result?.statusCode ?? 0);
      statuses.push({ url, statusCode });
      if (statusCode === 200) {
        return {
          ready: true,
          url,
          statusCode,
          statuses,
        };
      }
    } catch (error) {
      statuses.push({
        url,
        statusCode: null,
        errorCode: error.code || 'unknown',
        errorMessage: error.message,
      });
    }
  }

  return {
    ready: false,
    url: null,
    statusCode: null,
    statuses,
  };
}

module.exports = {
  buildHealthCheckUrls,
  probeHealthUrls,
};
