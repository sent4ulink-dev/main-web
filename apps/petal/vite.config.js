import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// In development the share links' server (server/api.js, a Cloudflare Pages
// Function in production) answers /api/* right here, with a bucket kept in
// node_modules/.petal-isle/shares.json; its studio is open (set
// STUDIO_PASSWORD to try the lock). The handler is loaded through Vite, so
// editing it needs no restart.
function shareApi() {
  const file = fileURLToPath(new URL("./node_modules/.petal-isle/shares.json", import.meta.url));
  let bucket = null;
  const middleware = (load) => async (req, res, next) => {
    if (!req.url.startsWith("/api/")) return next();
    try {
      const [{ handleApi }, { createLocalBucket }] = await Promise.all([load("/server/api.js"), load("/server/local-bucket.js")]);
      bucket ??= createLocalBucket(file);
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const hasBody = !["GET", "HEAD"].includes(req.method);
      const request = new Request(new URL(req.url, "http://localhost"), {
        method: req.method,
        headers: {
          "content-type": req.headers["content-type"] || "application/json",
          "x-image-size": req.headers["x-image-size"] || "",
          "cf-connecting-ip": req.socket.remoteAddress || "local",
        },
        body: hasBody ? Buffer.concat(chunks) : undefined,
      });
      const response = await handleApi(request, { SHARES: bucket, STUDIO_PASSWORD: process.env.STUDIO_PASSWORD || "", OPEN_STUDIO: "1" });
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };
  return {
    name: "petal-isle-share-api",
    configureServer(server) {
      server.middlewares.use(middleware((path) => server.ssrLoadModule(path)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware((path) => import(new URL(`.${path}`, import.meta.url).href)));
    },
  };
}

export default defineConfig({
  plugins: [shareApi()],
});
