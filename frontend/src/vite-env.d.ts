/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional API key sent as X-API-Key when the backend sets API_KEYS. */
  readonly VITE_API_KEY?: string;
  /** Backend port for the dev proxy (consumed in vite.config.ts). */
  readonly VITE_BACKEND_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
