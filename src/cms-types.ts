/** Opaque CMS JSON (DAST trees, structured text values) — serializable. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
