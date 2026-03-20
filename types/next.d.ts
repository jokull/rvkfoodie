/**
 * Type declarations for bare "next" imports.
 * vinext provides shims at next/* but not for the bare module specifier.
 */
declare module "next" {
  export type {
    Metadata,
    Viewport,
  } from "vinext/dist/shims/metadata";

  export interface NextConfig {
    reactStrictMode?: boolean;
    poweredByHeader?: boolean;
    images?: Record<string, unknown>;
    rewrites?: () => Promise<
      Array<{ source: string; destination: string }>
    >;
    redirects?: () => Promise<
      Array<{ source: string; destination: string; permanent: boolean }>
    >;
    headers?: () => Promise<
      Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    >;
    [key: string]: unknown;
  }
}
