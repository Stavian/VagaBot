module.exports = {
  apps: [{
    name: 'VagaBot',
    script: './src/index.js',

    // Instances
    instances: 1,
    exec_mode: 'fork',

    // Auto-restart policies
    watch: false, // Set to true if you want PM2 to restart on file changes
    max_memory_restart: '500M', // Restart if memory exceeds 500MB

    // Restart behavior
    autorestart: true,
    max_restarts: 10, // Max restarts within min_uptime
    min_uptime: '10s', // Min uptime before considering it stable
    restart_delay: 4000, // Delay between restarts (4 seconds)

    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Environment variables
    env: {
      NODE_ENV: 'production'
    },

    // Advanced features
    kill_timeout: 5000, // Time to wait for graceful shutdown
    listen_timeout: 3000,
    shutdown_with_message: true
  }]
};
