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
      MONGODB_URI: "mongodb+srv://abhiback14_db_user:CREATIVE@creative-era.kjruuxs.mongodb.net/event-registration?appName=creative-era",
      JWT_SECRET: "34f9eb65bb03a6862b13a6d3c4eb46965f55e7c8b17e68dce9de7bdb9904c84b027b5a581d0b3fb4287dd80377e6a0443aeeaa9a9f90c9d79ccea0522eec9341",
      CLIENT_URL: "https://creativeeraevents.in",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "admin123",

      EMAIL_USER: "kathanjain312@gmail.com",
      EMAIL_PASS: "hjur xhna qoct nabh"
      
    }
  }]
};