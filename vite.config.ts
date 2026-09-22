import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Build metadata.
 *
 * `package.json` is the single source of truth for the version: bump it there and
 * everything (Settings → About, the release workflow, `dist/version.json`)
 * follows. The commit/branch/repository values are supplied by GitHub Actions
 * through the standard `GITHUB_*` environment variables, and stay empty when you
 * build locally — no username or repository name is ever hard-coded.
 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const buildInfo = {
  version: pkg.version,
  commit: (process.env.GITHUB_SHA ?? '').slice(0, 7),
  branch: process.env.GITHUB_REF_NAME ?? '',
  repo: process.env.GITHUB_REPOSITORY ?? '',
  builtAt: new Date().toISOString(),
};

/**
 * Writes `dist/version.json` next to the bundle. Deployed sites can be verified
 * with a single request (`curl https://…/version.json`) to confirm which build
 * is actually live.
 */
function versionManifest(): Plugin {
  return {
    name: 'devops-os:version-manifest',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';
      mkdirSync(outDir, { recursive: true });
      writeFileSync(`${outDir}/version.json`, `${JSON.stringify(buildInfo, null, 2)}\n`);
    },
  };
}

/**
 * Deployment target: GitHub Pages.
 *
 * `base: './'` (relative asset URLs) plus a hash-based router means the built
 * bundle works from any sub-path — `https://user.github.io/repo/`, a custom
 * domain, or `vite preview` — with no rebuild and no hard-coded repository name.
 * Set `VITE_BASE_PATH` if you ever need an absolute base.
 */
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? './',
  plugins: [react(), tailwindcss(), versionManifest()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(buildInfo.version),
    __BUILD_COMMIT__: JSON.stringify(buildInfo.commit),
    __BUILD_BRANCH__: JSON.stringify(buildInfo.branch),
    __BUILD_REPO__: JSON.stringify(buildInfo.repo),
    __BUILD_TIME__: JSON.stringify(buildInfo.builtAt),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
