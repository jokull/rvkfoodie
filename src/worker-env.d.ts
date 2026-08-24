/**
 * Types for env bindings that are real secrets (set via `wrangler secret put`
 * in prod, `.dev.vars` locally) and therefore can't be declared in
 * `wrangler.jsonc`'s `vars` block — a var with the same name blocks the
 * secret API ("Binding name already in use"). `wrangler types` only types
 * vars/bindings, so these are augmented here; keep in sync with the
 * `wrangler secret put` names.
 */
declare namespace Cloudflare {
  interface Env {
    R2_ACCESS_KEY_ID: string
    R2_SECRET_ACCESS_KEY: string
    CMS_WRITE_KEY: string
  }
}
