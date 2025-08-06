#!/usr/bin/env node

/**
 * Script to clear browser storage and restart the dev server
 * This helps fix encryption/decryption errors caused by corrupted data
 */

console.log('🧹 Clearing browser storage and restarting...\n');

console.log('To clear browser storage:');
console.log('1. Open http://localhost:4321 in your browser');
console.log('2. Open Developer Tools (F12)');
console.log('3. Go to Application tab');
console.log('4. Clear Site Data or run in console:');
console.log('   localStorage.clear();');
console.log('   sessionStorage.clear();');
console.log('');
console.log('Or open a new incognito/private window.');
console.log('');
console.log('Then restart the dev server with: npm run dev');