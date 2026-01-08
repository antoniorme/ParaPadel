/// <reference types="vite/client" />

declare module '*.svg' {
  import * as React from 'react';
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;
  const content: string;
  export default content;
}

// Interface merging to add custom env vars without conflicting with existing Vite types
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_HCAPTCHA_SITE_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}