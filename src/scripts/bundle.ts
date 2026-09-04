import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/* ────────────────────────────────────────────────────────────
 * Build a deployment bundle — `npm run bundle`
 *
 * Produces `deploy/` (and `deploy.zip`) containing everything a host needs to
 * run the bot, and nothing else:
 *
 *   dist/               compiled JavaScript
 *   index.js            entry shim, for eggs that hard-code that name
 *   package.json        runtime dependencies only, versions pinned
 *   .env.example        a template to fill in ON THE HOST
 *   DEPLOY.md           instructions
 *
 * Deliberately absent: `.env`, `node_modules`, `src`, and `data/state.json`.
 *
 * `.env` is excluded on purpose. A bundle is a file that gets uploaded,
 * emailed, and left in a downloads folder; a bot token should not travel that
 * way. Create it on the host instead.
 *
 * Shipping `dist/` rather than sources means the host never needs TypeScript,
 * which matters on panels that only run `npm install` and a start command.
 * ──────────────────────────────────────────────────────────── */

const root = process.cwd();
const out = resolve(root, 'deploy');

const INCLUDE = ['dist', '.env.example'];

interface PackageJson {
  name: string;
  version: string;
  description?: string;
  dependencies?: Record<string, string>;
}

/**
 * A runtime-only package.json.
 *
 * devDependencies are stripped because the bundle ships compiled JavaScript —
 * TypeScript, ESLint and tsx would be ~70 MB of dead weight on a host with a
 * 1 GB disk that runs a bare `npm install`.
 *
 * Versions are pinned to what is actually installed here, so the host resolves
 * the exact tree that was tested. That also removes the need to ship a
 * lockfile, which would otherwise disagree with the trimmed dependency list.
 */
function productionPackageJson(): string {
  const source = JSON.parse(
    readFileSync(resolve(root, 'package.json'), 'utf8'),
  ) as PackageJson;

  const dependencies: Record<string, string> = {};
  for (const name of Object.keys(source.dependencies ?? {})) {
    const installed = JSON.parse(
      readFileSync(resolve(root, 'node_modules', name, 'package.json'), 'utf8'),
    ) as { version: string };
    dependencies[name] = installed.version;
  }

  return `${JSON.stringify(
    {
      name: source.name,
      version: source.version,
      private: true,
      description: source.description,
      main: 'index.js',
      engines: { node: '>=20.18.0' },
      scripts: { start: 'node dist/index.js' },
      dependencies,
    },
    null,
    2,
  )}\n`;
}

/**
 * A root entry point that simply loads the real one.
 *
 * Several Pterodactyl-style Node eggs hard-code `/home/container/index.js` in
 * their start command regardless of the configured main file. Rather than
 * fight the panel, the bundle satisfies it: this file exists purely so that
 * `node index.js` works on a host that insists on that name.
 */
const ENTRY_SHIM = `// Entry point for hosts that hard-code index.js.
// The real bot lives in dist/index.js — see DEPLOY.md.
//
// Dynamic import() rather than require(): this file has to survive being run
// EITHER as CommonJS (\`node index.js\`) or as ESM (\`ts-node --esm index.js\`),
// because panel eggs pick between those two on their own. require() would
// throw under ESM; import() is valid in both.
import('./dist/index.js').catch((error) => {
  console.error('Failed to start THE DESK bot:');
  console.error(error);
  process.exit(1);
});
`;

/**
 * `--offline` produces a bundle with `node_modules` already installed and
 * **no package.json**.
 *
 * Why remove the manifest: panel eggs typically run
 * `if [ -f package.json ]; then npm install; fi`. On a host with no disk
 * headroom that install fails with ENOSPC before the bot ever starts — npm
 * needs room for its cache even when every dependency is already present.
 * No manifest, no install attempt, no cache.
 *
 * Node resolves `node_modules` perfectly well without an application
 * package.json, so nothing is lost but the install step.
 */
const offline = process.argv.includes('--offline');

function main(): void {
  console.log(offline ? 'Building (offline bundle)…' : 'Building…');
  // Invoke the compiler through Node directly rather than shelling out to npm:
  // no shell means no quoting problems on a path with spaces, and no
  // DEP0190 warning about unescaped arguments.
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], {
    stdio: 'inherit',
  });

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  for (const entry of INCLUDE) {
    const source = resolve(root, entry);
    if (!existsSync(source)) {
      console.warn(`  skipped (missing): ${entry}`);
      continue;
    }
    cpSync(source, resolve(out, entry), { recursive: true });
    console.log(`  added: ${entry}`);
  }

  writeFileSync(resolve(out, 'package.json'), productionPackageJson(), 'utf8');
  console.log('  added: package.json (runtime dependencies only)');

  writeFileSync(resolve(out, 'index.js'), ENTRY_SHIM, 'utf8');
  console.log('  added: index.js (entry shim)');

  if (offline) installDependencies();

  writeFileSync(resolve(out, 'DEPLOY.md'), instructions(), 'utf8');
  console.log('  added: DEPLOY.md');

  zip();

  console.log('\nBundle ready:');
  console.log(`  ${out}`);
  console.log(`  ${resolve(root, 'deploy.zip')}`);
  console.log('\nThe bundle contains NO token. Create .env on the host.');
}

/**
 * Install the runtime dependencies into the bundle, then delete the manifest
 * so the host's egg never attempts an install of its own.
 */
function installDependencies(): void {
  console.log('  installing runtime dependencies into the bundle…');

  // Run npm's own CLI through Node rather than spawning `npm`/`npm.cmd`:
  // on Windows those are shell wrappers that execFile cannot launch directly.
  const args = ['install', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts'];
  const cli = npmCliPath();
  if (!cli) {
    throw new Error('Could not locate npm-cli.js. Run `npm install --omit=dev` inside deploy/ by hand.');
  }

  execFileSync(process.execPath, [cli, ...args], { cwd: out, stdio: 'inherit' });

  rmSync(resolve(out, 'package.json'), { force: true });
  rmSync(resolve(out, 'package-lock.json'), { force: true });
  console.log('  removed: package.json (so the host skips npm install)');
}

/** npm ships alongside Node; the layout differs between Windows and Unix. */
function npmCliPath(): string | null {
  const nodeDir = dirname(process.execPath);
  const candidates = [
    resolve(root, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    resolve(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    resolve(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/** `tar` ships with Windows 10+, macOS and Linux, so no dependency is needed. */
function zip(): void {
  try {
    execFileSync('tar', ['-a', '-c', '-f', resolve(root, 'deploy.zip'), '-C', out, '.'], {
      stdio: 'ignore',
    });
    console.log('  zipped: deploy.zip');
  } catch {
    console.warn('  could not create deploy.zip — upload the deploy/ folder instead');
  }
}

function instructions(): string {
  return `# THE DESK — deployment bundle

Compiled and ready to run. Contains no secrets.

## What the host needs

- Node.js **20 or newer** (22 recommended)
- ~250 MB RAM
- A persistent disk for \`data/state.json\`
- No inbound ports. The bot opens an outbound WebSocket to Discord.

## Steps

1. Upload the contents of this bundle to the server's working directory
   (\`/home/container\` on a Pterodactyl-style panel). The layout must be:

   \`\`\`
   index.js          <- entry shim
   package.json
   dist/
   \`\`\`

2. Create a file named \`.env\` **on the host** with:

   \`\`\`
   DISCORD_TOKEN=your-token
   CLIENT_ID=your-application-id
   GUILD_ID=your-server-id
   \`\`\`

   Never put the token in the uploaded archive, in a repository, or in a chat.

3. Start the server. The panel's own \`npm install\` step will pull the two
   runtime dependencies. To do it by hand instead:

   \`\`\`
   npm install
   node index.js
   \`\`\`

## Panel eggs that hard-code index.js

Several Node eggs ship a start command like:

\`\`\`
if [[ "\${MAIN_FILE}" == "*.js" ]]; then node "/home/container/index.js";
else ts-node --esm "/home/container/index.js"; fi
\`\`\`

Two quirks worth knowing, because they produce baffling errors:

- Both branches run \`index.js\` regardless of what \`MAIN_FILE\` is set to.
  That is why this bundle ships an \`index.js\` shim at the root.
- The pattern is **quoted**, so bash compares it literally rather than
  globbing. The condition is true only when \`MAIN_FILE\` is set to the exact
  string \`*.js\`. Any other value falls through to \`ts-node\`, which then
  fails on compiled JavaScript.

So on that kind of egg: set **MAIN_FILE** to \`*.js\` — literally those four
characters. If your panel lets you edit the start command directly, the
cleaner fix is \`node /home/container/dist/index.js\`.

## Memory

On a 512 MB container it is worth capping the heap. If the egg exposes a
\`NODE_ARGS\` variable, set it to:

\`\`\`
--max-old-space-size=400
\`\`\`

## If the host requires a listening port

Some platforms kill a process that does not bind a port. Add to \`.env\`:

\`\`\`
HEALTH_PORT=8080
\`\`\`

A Discord bot needs no inbound connection; this exists only to satisfy that
kind of health check.

## Keeping state

\`data/state.json\` records which Discord channels and roles belong to which
blueprint key. Keep it on a persistent volume. Losing it is not fatal — setup
falls back to matching by name and rebuilds it — but keeping it is cleaner.

## Updating

Re-run \`npm run bundle\` locally, upload the new \`dist/\`, restart.
\`.env\` and \`data/\` stay where they are.
`;
}

main();
