require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');

async function fixAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Delete existing admin
    await Admin.deleteMany({ username: 'admin' });
    console.log('🗑️  Deleted old admin');

    // Create new admin with hashed password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await Admin.create({
      username: 'admin',
      password: hashedPassword,
      role: 'admin'
    });

    console.log('✅ Admin created successfully');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   Password is now properly hashed!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixAdmin();
