/**
 * Publish the package under BOTH names — @stewarthaines/seed-html (canonical)
 * and the unscoped alias seed-html — with the identical payload and version.
 *
 * npm has no name-override flag, so the unscoped publish temporarily rewrites
 * package.json's name and restores it afterwards (guaranteed by try/finally).
 * A name+version already on the registry is skipped, so the script is safe to
 * rerun after a partial release (e.g. the scoped name shipped, the alias
 * didn't). Pass --dry-run to stage and pack without uploading.
 *
 * Run as `npm run release` from npm-package/ after the repo build
 * (build:i18n + build:plugins). Publishing prompts for the npm 2FA OTP.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(pkgDir, 'package.json');
const dryRun = process.argv.includes('--dry-run');
// Everything else (e.g. --otp=123456 for non-interactive shells) is handed
// through to npm publish.
const extraArgs = process.argv.slice(2).filter(a => a !== '--dry-run');

const NAMES = ['@stewarthaines/seed-html', 'seed-html'];

const readPkg = () => JSON.parse(readFileSync(pkgPath, 'utf8'));
const writeName = name => {
  const pkg = readPkg();
  pkg.name = name;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
};

function alreadyPublished(name, version) {
  const r = spawnSync('npm', ['view', `${name}@${version}`, 'version'], {
    cwd: pkgDir,
    encoding: 'utf8',
  });
  return r.status === 0 && r.stdout.trim() === version;
}

// Stage assets + sync the version first, so the version we check against the
// registry is the one that will be published.
const staged = spawnSync('node', [join(pkgDir, 'sync-assets.mjs')], {
  cwd: pkgDir,
  stdio: 'inherit',
});
if (staged.status !== 0) process.exit(staged.status ?? 1);
const version = readPkg().version;

const canonical = readPkg().name;
let failed = false;
try {
  for (const name of NAMES) {
    if (!dryRun && alreadyPublished(name, version)) {
      console.log(`publish: ${name}@${version} already on the registry — skipping`);
      continue;
    }
    writeName(name);
    console.log(`publish: ${name}@${version}${dryRun ? ' (dry run)' : ''}`);
    // stdio inherit so the 2FA OTP prompt reaches the terminal.
    const r = spawnSync('npm', ['publish', ...(dryRun ? ['--dry-run'] : []), ...extraArgs], {
      cwd: pkgDir,
      stdio: 'inherit',
    });
    if (r.status !== 0) {
      failed = true;
      console.error(
        `publish: ${name} failed — fix and rerun (already-published names are skipped)`
      );
      break;
    }
  }
} finally {
  writeName(canonical);
}
process.exit(failed ? 1 : 0);
