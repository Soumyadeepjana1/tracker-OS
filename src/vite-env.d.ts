/// <reference types="vite/client" />

/**
 * Build-time constants injected by `vite.config.ts` (`define`).
 *
 * The version is read from `package.json` during the build, so the running app
 * can never disagree with the source of truth.
 */
declare const __APP_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_BRANCH__: string;
declare const __BUILD_REPO__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  /** Optional absolute base path override (defaults to a relative `./`). */
  readonly VITE_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
