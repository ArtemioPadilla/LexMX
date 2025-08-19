#!/usr/bin/env node

/**
 * Generates PWA icons from the favicon.svg
 * Uses Sharp to convert SVG to PNG in various sizes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes for PWA
const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 }
];

const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'favicon.svg');

// Check if favicon.svg exists
if (!fs.existsSync(svgPath)) {
  console.error('❌ favicon.svg not found in public directory');
  console.error('Please ensure favicon.svg exists at:', svgPath);
  process.exit(1);
}

// Read the SVG file
const svgBuffer = fs.readFileSync(svgPath);

// Generate icons
async function generateIcons() {
  for (const { name, size } of sizes) {
    const filePath = path.join(publicDir, name);
    
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(filePath);
      
      console.log(`✅ Created ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Failed to create ${name}:`, error.message);
    }
  }
  
  console.log('\n✨ PWA icons generated successfully!');
  console.log('Icons are ready for use in manifest.json and notifications.');
}

// Run the generation
generateIcons().catch(error => {
  console.error('Failed to generate icons:', error);
  process.exit(1);
});