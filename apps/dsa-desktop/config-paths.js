const path = require('path');

function resolveRuntimeAppDir({ isPackaged, userDataPath, exePath }) {
  if (isPackaged) {
    return userDataPath;
  }

  return userDataPath;
}

function resolveLegacyPortableAppDir({ isPackaged, exePath }) {
  if (!isPackaged || !exePath) {
    return null;
  }

  return path.dirname(exePath);
}

function buildRuntimePaths({ isPackaged, userDataPath, exePath }) {
  const appDir = resolveRuntimeAppDir({ isPackaged, userDataPath, exePath });
  return {
    appDir,
    envPath: path.join(appDir, '.env'),
    dataDir: path.join(appDir, 'data'),
    dbPath: path.join(appDir, 'data', 'stock_analysis.db'),
    logDir: path.join(appDir, 'logs'),
    logFilePath: path.join(appDir, 'logs', 'desktop.log'),
    legacyPortableAppDir: resolveLegacyPortableAppDir({ isPackaged, exePath }),
  };
}

function migrateLegacyPortableData({
  fs,
  paths,
  log = () => {},
}) {
  const { appDir, legacyPortableAppDir, envPath, dataDir, logDir } = paths;
  if (!legacyPortableAppDir || legacyPortableAppDir === appDir || !fs.existsSync(legacyPortableAppDir)) {
    return { migrated: false, migratedItems: [] };
  }

  const candidates = [
    { type: 'file', from: path.join(legacyPortableAppDir, '.env'), to: envPath, label: '.env' },
    { type: 'dir', from: path.join(legacyPortableAppDir, 'data'), to: dataDir, label: 'data/' },
    { type: 'dir', from: path.join(legacyPortableAppDir, 'logs'), to: logDir, label: 'logs/' },
  ];

  const migratedItems = [];

  for (const item of candidates) {
    if (!fs.existsSync(item.from) || fs.existsSync(item.to)) {
      continue;
    }

    fs.mkdirSync(path.dirname(item.to), { recursive: true });
    fs.cpSync(item.from, item.to, { recursive: item.type === 'dir' });
    migratedItems.push(item.label);
    log(`Migrated desktop runtime asset from legacy portable dir: ${item.label}`);
  }

  return {
    migrated: migratedItems.length > 0,
    migratedItems,
  };
}

module.exports = {
  buildRuntimePaths,
  migrateLegacyPortableData,
  resolveLegacyPortableAppDir,
  resolveRuntimeAppDir,
};
