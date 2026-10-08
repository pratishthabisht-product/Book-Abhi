import { defineConfig, loadEnv } from "vite";

/* Serves api/extract.js during `npm run dev`, so AI reading works locally too.
   Put ANTHROPIC_API_KEY=... in a .env.local file (never commit it). On Vercel the
   same file runs as a serverless function. */
function localApi() {
  return {
    name: "book-abhi-local-api",
    configureServer(server) {
      server.middlewares.use("/api/extract", async (req, res) => {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const mod = await server.ssrLoadModule("/api/extract.js");
        const out = {
          statusCode: 200,
          status(c) { this.statusCode = c; return this; },
          json(obj) { res.statusCode = this.statusCode; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); },
        };
        let body = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch { /* handled by route */ }
        await mod.default({ method: req.method, body }, out);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return { plugins: [localApi()], build: { chunkSizeWarningLimit: 1600 } };
});
