/**
 * Firebase Authentication Setup Script
 * Run this once to create the admin user
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const fileContent = fs.readFileSync(configPath, 'utf-8');
const firebaseConfig = JSON.parse(fileContent);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function setupAuth() {
  try {
    console.log('🔧 Setting up Firebase Authentication...\n');

    // Create admin user with a generic admin email
    const email = 'admin@company-internal.local';
    const password = 'admin';

    console.log(`📧 Creating user: ${email}`);
    console.log(`🔐 Password: ${password}\n`);

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    console.log('✅ User created successfully!');
    console.log(`👤 UID: ${userCredential.user.uid}`);
    console.log(`📧 Email: ${userCredential.user.email}`);
    
    console.log('\n✨ Setup complete! You can now login with:');
    console.log(`   Username: tirawat`);
    console.log(`   Password: admin`);
    console.log('\nOn any Admin/Accounting tab');
    
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('✅ User already exists!');
      console.log('   You can now login with:');
      console.log(`   Username: tirawat`);
      console.log(`   Password: admin`);
      process.exit(0);
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

setupAuth();
