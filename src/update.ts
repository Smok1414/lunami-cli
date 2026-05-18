import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type PackageMetadata = {
  name: string;
  version: string;
};

export type UpdateCheckResult = {
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  installCommand: string;
};

const defaultTimeoutMs = 1500;

export function getCliMetadata(): PackageMetadata {
  const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const raw = readFileSync(packageJsonPath, 'utf8');
  const pkg = JSON.parse(raw) as Partial<PackageMetadata>;

  return {
    name: typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name : 'lunami-cli',
    version: typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version : '0.0.0'
  };
}

export async function checkForUpdates(timeoutMs = defaultTimeoutMs): Promise<UpdateCheckResult | null> {
  try {
    const metadata = getCliMetadata();
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(metadata.name)}/latest`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as { version?: unknown };
    if (typeof payload.version !== 'string' || !payload.version.trim()) {
      return null;
    }

    const latestVersion = normalizeVersion(payload.version);
    const currentVersion = normalizeVersion(metadata.version);

    return {
      packageName: metadata.name,
      currentVersion,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
      installCommand: `npm i -g ${metadata.name}@latest`
    };
  } catch {
    return null;
  }
}

let pendingUpdateMessage: string | null = null;

process.on('exit', () => {
  if (pendingUpdateMessage) {
    process.stderr.write(pendingUpdateMessage);
  }
});

export function startBackgroundUpdateCheck(): void {
  void checkForUpdates().then((result) => {
    if (!result?.updateAvailable) {
      return;
    }

    pendingUpdateMessage = `\n! Доступна новая версия LUNAMI: ${result.latestVersion}. Запустите: ${result.installCommand}\n`;
  }).catch(() => {
    // Ignore update check failures to keep startup fast and quiet.
  });
}

export function installLatestVersion(): number {
  const metadata = getCliMetadata();
  const npmBinary = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmBinary, ['i', '-g', `${metadata.name}@latest`], {
    stdio: 'inherit',
    windowsHide: true
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta > 0 ? 1 : -1;
    }
  }

  return 0;
}

function parseVersion(version: string): number[] {
  const core = normalizeVersion(version).split('-', 1)[0];

  return core.split('.').map((segment) => {
    const numeric = Number.parseInt(segment, 10);
    return Number.isFinite(numeric) ? numeric : 0;
  });
}
