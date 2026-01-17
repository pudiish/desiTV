/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly MODE: string;
  readonly PROD: boolean;
  readonly VITE_SERVER_PORT?: string;
  readonly VITE_GOOGLE_AI_KEY?: string;
  readonly VITE_CLIENT_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
