import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const defaultTimeoutMs = 1500;
export function getCliMetadata() {
    const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const raw = readFileSync(packageJsonPath, 'utf8');
    const pkg = JSON.parse(raw);
    return {
        name: typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name : 'lunami-cli',
        version: typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version : '0.0.0'
    };
}
export async function checkForUpdates(timeoutMs = defaultTimeoutMs) {
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
        const payload = await response.json();
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
    }
    catch {
        return null;
    }
}
let pendingUpdateMessage = null;
process.on('exit', () => {
    if (pendingUpdateMessage) {
        process.stderr.write(pendingUpdateMessage);
    }
});
export function startBackgroundUpdateCheck() {
    void checkForUpdates().then((result) => {
        if (!result?.updateAvailable) {
            return;
        }
        pendingUpdateMessage = `\n! Доступна новая версия LUNAMI: ${result.latestVersion}. Запустите: ${result.installCommand}\n`;
    }).catch(() => {
        // Ignore update check failures to keep startup fast and quiet.
    });
}
export function installLatestVersion() {
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
function normalizeVersion(version) {
    return version.trim().replace(/^v/i, '');
}
function compareVersions(left, right) {
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
function parseVersion(version) {
    const core = normalizeVersion(version).split('-', 1)[0];
    return core.split('.').map((segment) => {
        const numeric = Number.parseInt(segment, 10);
        return Number.isFinite(numeric) ? numeric : 0;
    });
}
