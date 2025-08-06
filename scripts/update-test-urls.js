#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Find all test files
const testFiles = glob.sync('tests/**/*.test.ts');

console.log(`Found ${testFiles.length} test files to update`);

let totalReplacements = 0;

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  
  // Replace all hardcoded URLs with relative URLs
  const patterns = [
    { from: /http:\/\/localhost:4321\//g, to: '/' },
    { from: /http:\/\/localhost:4322\//g, to: '/' },
    { from: /http:\/\/localhost:4323\//g, to: '/' },
    { from: /https:\/\/localhost:4321\//g, to: '/' },
    { from: /https:\/\/localhost:4322\//g, to: '/' },
    { from: /https:\/\/localhost:4323\//g, to: '/' },
  ];
  
  patterns.forEach(pattern => {
    const matches = content.match(pattern.from);
    if (matches) {
      content = content.replace(pattern.from, pattern.to);
      totalReplacements += matches.length;
      console.log(`  ${path.basename(file)}: Replaced ${matches.length} occurrences of ${pattern.from.source}`);
    }
  });
  
  // Write back if changed
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log(`\nTotal replacements: ${totalReplacements}`);
console.log('Done! Test files now use relative URLs.');