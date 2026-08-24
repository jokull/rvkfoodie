import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// hangar hands the dev server its port as $PORT so several worktrees of this
// repo can run at once; fall back to 3000 when running outside hangar.
const port = process.env.PORT ? Number(process.env.PORT) : 3000

export default defineConfig({
  server: {
    // IPv4 loopback explicitly: Node 17+ resolves "localhost" to ::1 first,
    // and hangar's proxy dials the service over 127.0.0.1.
    host: '127.0.0.1',
    port,
  },
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'ssr' }, inspectorPort: false }),
    tanstackStart(),
    viteReact(),
  ],
})
