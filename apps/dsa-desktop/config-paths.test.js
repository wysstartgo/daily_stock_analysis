const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildRuntimePaths, migrateLegacyPortableData } = require('./config-paths');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('buildRuntimePaths uses userData in packaged desktop runtime', () => {
  const paths = buildRuntimePaths({
    isPackaged: true,
    userDataPath: '/Users/example/Library/Application Support/daily-stock-analysis-desktop',
    exePath: '/Applications/绣虎.app/Contents/MacOS/绣虎',
  });

  assert.equal(paths.appDir, '/Users/example/Library/Application Support/daily-stock-analysis-desktop');
  assert.equal(paths.envPath, '/Users/example/Library/Application Support/daily-stock-analysis-desktop/.env');
  assert.equal(
    paths.legacyPortableAppDir,
    '/Applications/绣虎.app/Contents/MacOS'
  );
});

test('migrateLegacyPortableData copies legacy .env/data/logs into runtime dir only when target missing', () => {
  const legacyDir = makeTempDir('dsa-legacy-');
  const runtimeDir = makeTempDir('dsa-runtime-');
  const paths = buildRuntimePaths({
    isPackaged: true,
    userDataPath: runtimeDir,
    exePath: path.join(legacyDir, '绣虎.exe'),
  });

  fs.writeFileSync(path.join(legacyDir, '.env'), 'STOCK_LIST=600519\n', 'utf-8');
  fs.mkdirSync(path.join(legacyDir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(legacyDir, 'data', 'stock_analysis.db'), 'db', 'utf-8');
  fs.mkdirSync(path.join(legacyDir, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(legacyDir, 'logs', 'desktop.log'), 'log', 'utf-8');
  fs.writeFileSync(paths.envPath, 'STOCK_LIST=AAPL\n', 'utf-8');

  const result = migrateLegacyPortableData({ fs, paths });

  assert.equal(result.migrated, true);
  assert.deepEqual(result.migratedItems, ['data/', 'logs/']);
  assert.equal(fs.readFileSync(paths.envPath, 'utf-8'), 'STOCK_LIST=AAPL\n');
  assert.equal(fs.readFileSync(path.join(paths.dataDir, 'stock_analysis.db'), 'utf-8'), 'db');
  assert.equal(fs.readFileSync(path.join(paths.logDir, 'desktop.log'), 'utf-8'), 'log');
});

test('migrateLegacyPortableData skips when packaged legacy dir is unavailable', () => {
  const runtimeDir = makeTempDir('dsa-runtime-');
  const paths = buildRuntimePaths({
    isPackaged: false,
    userDataPath: runtimeDir,
    exePath: '',
  });

  const result = migrateLegacyPortableData({ fs, paths });

  assert.deepEqual(result, { migrated: false, migratedItems: [] });
});
