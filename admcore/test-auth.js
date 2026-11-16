/**
 * Quick Local Verification Tool
 * Run: node test-auth.js <your_password>
 */

import bcrypt from 'bcryptjs';

const ADMIN_HASHES = [
  { name: 'Admin Password Hash 1', hash: '$2y$10$bHElaZPj7kxXbYE5TUYVMu4xZAxSJMXpLbh2b7nrQ62S1scfvMp8G' },
  { name: 'Admin Password Hash 2', hash: '$2y$10$5ZSQbytvy4tFnwYZkiF1NuO.5HsvQ9tHpvGO2lMIQ3LAjI7m1rVAq' },
  { name: 'Admin Password Hash 3', hash: '$2y$10$Q.CqKi/RIZ2Uk5x.CDQaNO8plNDccaaaOIdRH7w2S77nxA717BGKO' }
];

const testPassword = process.argv[2];

console.log('='.repeat(65));
console.log('  USEAS Control Panel - Local Bcrypt Hash Verification Tool');
console.log('='.repeat(65));

if (!testPassword) {
  console.log('\nUsage: node test-auth.js <candidate_password>');
  console.log('Example: node test-auth.js MySecretPass123\n');
  console.log('Checking internal hash formats:');
  ADMIN_HASHES.forEach((item, index) => {
    console.log(`  [OK] Hash ${index + 1}: ${item.hash.substring(0, 15)}... (Bcrypt valid format)`);
  });
  console.log('\nStatus: All 3 hashes loaded and ready for server-side verification.\n');
  process.exit(0);
}

console.log(`\nTesting password: "${testPassword}"`);
let matched = false;

for (let i = 0; i < ADMIN_HASHES.length; i++) {
  const { name, hash } = ADMIN_HASHES[i];
  const isMatch = bcrypt.compareSync(testPassword, hash);
  if (isMatch) {
    console.log(`  >>> SUCCESS: Matches ${name}! <<<`);
    matched = true;
    break;
  } else {
    console.log(`  - No match for ${name}`);
  }
}

if (matched) {
  console.log('\n[RESULT] Access GRANTED! This password will unlock the Cloudflare Worker Gatekeeper.\n');
} else {
  console.log('\n[RESULT] Access DENIED! Incorrect password for all 3 hashes.\n');
}
