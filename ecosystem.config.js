module.exports = {
  apps: [{
    name: 'creativeeraevents-api',
    script: './index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};

// Note: All sensitive environment variables should be set in .env file
// PM2 will automatically load variables from .env file