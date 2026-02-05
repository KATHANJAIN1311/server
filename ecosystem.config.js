module.exports = {
  apps: [{
    name: 'creativeeraevents-api',
    script: './index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5002,
      MONGODB_URI: "mongodb+srv://username:password@cluster.mongodb.net/database?appName=cluster",
      JWT_SECRET: "your_jwt_secret_key_here",
      CLIENT_URL: "https://yourdomain.com",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "your_secure_password",
      EMAIL_USER: "your_email@gmail.com",
      EMAIL_PASS: "your_app_password"
    }
  }]
};