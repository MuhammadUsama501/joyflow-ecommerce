// ============================================================================
// PM2 ecosystem file for the JoyFlow Express API.
//
// Manage with:   pm2 start ecosystem.config.cjs
//                pm2 status / pm2 logs / pm2 restart joyflow-api
//                pm2 startup && pm2 save   (once, on first deploy)
//
// Runs on 127.0.0.1:5000 behind Nginx. Port 5000 must NOT be public; Nginx
// proxies /api/ -> here Persian.
// ============================================================================
module.exports = {
  apps: [
    {
      name: "joyflow-api",
      cwd: __dirname,
      script: "src/server.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,                 // JSON store is single-process; never scale >1
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      min_uptime: "10s",
      kill_timeout: 8000,
      time: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
        PORT: "5000",
      },
      // Sensible, git-ignored logs. View with: pm2 logs joyflow-api
      out_file: "./pm2-logs/out.log",
      error_file: "./pm2-logs/error.log",
      merge_logs: true,
    },
  ],
};
