import { createAdmin } from './bootstrap.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- <email> <password (min 8 chars)>');
  process.exit(1);
}
await createAdmin(email, password);
console.log(`Admin ready: ${email}`);
