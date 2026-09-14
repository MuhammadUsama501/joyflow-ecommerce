// PM2 ecosystem file — run with:  pm2 start ecosystem.config.cjs
//
// Manages ONLY the JoyFlow Express API (server/). The React build is static
// and served by Nginx; Nginx proxies /api to this process on 127.0.0.1:5000.
//
// Secrets live in server/.env (never here, never in git). Use production.json
// name from the template by replacing the domain/root in deployment/nginx.conf.
module.exports = {
  apps: [
    {
      name: "joyflow-api",
      cwd: "./server",
      script: "src/server.js",
      interpreter: "node",
      instances: 1,             // JSON store is single-process; NEVER scale to >1
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,      // ms between crash-restarts (backoff)
      min_uptime: "10s",        // only count as "healthy" if up this long
      kill_timeout: 8000,       // graceful shutdown window (server releases lock)
      time: true,               // timestamps in PM2 logs
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: "5000",
        // CLIENT_URL must be set in server/.env to the production frontend origin.
        // PayRam keys, wallet secret, etc. also come from server/.env.
      },
      // Log rotation-friendly paths (in server/pm2-logs, git-ignored).
      out_file: "./pm2-logs/out.log",
      error_file: "./pm2-logs/error.log",
      merge_logs: true,
    },
  ],
};
