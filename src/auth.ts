/**
 * SERVER-ONLY: the better-auth instance — module-scope (one instance per
 * isolate; per-request construction rebuilds the endpoint router, ~478ms).
 *
 * Email OTP is the primary sign-in (single access tier, two founders);
 * email + password is optional. OTP delivery goes through the EMAIL binding
 * — the plugin has no built-in sender.
 *
 * Mounted at /api/auth/* by src/routes/api.auth.$.ts; session reads in SSR
 * loaders go through auth.api.getSession({ headers }).
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'
import { env } from 'cloudflare:workers'
import { EmailMessage } from 'cloudflare:email'
import * as authSchema from './auth-schema.js'
import { db } from './db.js'

const sendEmail = async (to: string, subject: string, text: string) => {
  const raw = [
    'From: Reykjavík Foodie <guides@rvkfoodie.is>',
    `To: <${to}>`,
    `Subject: ${subject}`,
    `Message-ID: <${crypto.randomUUID()}@rvkfoodie.is>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
  ].join('\r\n')
  await env.EMAIL.send(new EmailMessage('guides@rvkfoodie.is', to, raw))
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    // Long-lived cookie: 30 days, sliding refresh daily.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    useSecureCookies: env.BETTER_AUTH_URL.startsWith('https'),
    cookiePrefix: 'rvk',
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      disableSignUp: false,
      async sendVerificationOTP({ email, otp }) {
        await sendEmail(email, 'Your Reykjavík Foodie code', `Your sign-in code is ${otp}. It expires in 5 minutes.`)
      },
    }),
  ],
})
