import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { existsSync } from "fs";

dotenv.config({ override: true });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const distPath = path.resolve(process.cwd(), 'dist');

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      distExists: existsSync(distPath)
    });
  });

  console.log(`Current NODE_ENV: ${process.env.NODE_ENV}`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    console.log("Starting in DEVELOPMENT mode with Vite middleware");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error("FAILED to start Vite middleware:", err);
      // Fallback to static if vite fails but dist exists
      if (existsSync(distPath)) {
        console.log("Fallback: Serving static files from dist because Vite failed");
        app.use(express.static(distPath));
      }
    }
  } else {
    console.log("Starting in PRODUCTION mode, serving from:", distPath);
    if (existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn("WARNING: dist directory does not exist. Production mode might fail.");
      // If production but dist missing, maybe we are in a weird hybrid state, 
      // try to serve from root if files are there, but this is risky
      app.get('*', (req, res) => {
        res.status(500).send("Production build missing. Please run 'npm run build'.");
      });
    }
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer().catch(err => {
  console.error("Major server startup error:", err);
});

export default app;
