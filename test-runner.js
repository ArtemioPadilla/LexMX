/* global console */
import { chromium } from '@playwright/test';

async function runTests() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('🧪 Testing LexMX website...\n');
  
  try {
    // Test 1: Homepage loads
    console.log('1. Testing homepage load...');
    await page.goto('http://localhost:4321/');
    console.log('✅ Homepage loaded successfully');
    
    // Test 2: Check navbar components are visible
    console.log('\n2. Testing navbar components...');
    const langSelector = page.locator('.language-selector').first();
    const themeToggle = page.locator('.theme-toggle').first();
    
    if (await langSelector.isVisible() && await themeToggle.isVisible()) {
      console.log('✅ Navbar components are visible');
    } else {
      console.log('❌ Navbar components are NOT visible');
    }
    
    // Test 3: Language toggle functionality
    console.log('\n3. Testing language toggle...');
    await page.locator('.language-selector button').first().click();
    await page.waitForTimeout(500);
    
    const langDropdown = page.locator('.language-selector div').filter({ hasText: 'English' });
    if (await langDropdown.isVisible()) {
      console.log('✅ Language dropdown opens');
      
      // Click English
      await page.locator('button:has-text("English")').click();
      await page.waitForTimeout(1000);
      
      // Check if components are still visible
      if (await langSelector.isVisible() && await themeToggle.isVisible()) {
        console.log('✅ Components still visible after language change');
      } else {
        console.log('❌ CRITICAL: Components disappeared after language change!');
      }
    } else {
      console.log('❌ Language dropdown did not open');
    }
    
    // Test 4: Multiple language toggles
    console.log('\n4. Testing multiple language toggles...');
    for (let i = 0; i < 5; i++) {
      await page.locator('.language-selector button').first().click();
      await page.waitForTimeout(200);
      
      if (i % 2 === 0) {
        await page.locator('button:has-text("Español")').click();
      } else {
        await page.locator('button:has-text("English")').click();
      }
      await page.waitForTimeout(500);
    }
    
    // Final check
    if (await langSelector.isVisible() && await themeToggle.isVisible()) {
      console.log('✅ Components survived multiple toggles');
    } else {
      console.log('❌ CRITICAL: Components disappeared after multiple toggles!');
    }
    
    // Test 5: Theme toggle
    console.log('\n5. Testing theme toggle...');
    await page.locator('.theme-toggle button').first().click();
    await page.waitForTimeout(500);
    
    const themeDropdown = page.locator('.theme-toggle div').filter({ hasText: 'Oscuro' });
    if (await themeDropdown.isVisible()) {
      console.log('✅ Theme dropdown opens');
      
      await page.locator('button:has-text("Oscuro")').click();
      const htmlClass = await page.locator('html').getAttribute('class');
      if (htmlClass?.includes('dark')) {
        console.log('✅ Dark mode applied');
      } else {
        console.log('❌ Dark mode not applied');
      }
    }
    
    // Test 6: Navigation
    console.log('\n6. Testing navigation...');
    await page.click('a[href="/chat"]');
    await page.waitForTimeout(1000);
    
    if (page.url().includes('/chat')) {
      console.log('✅ Navigation to /chat works');
      
      // Check if navbar is still there
      if (await langSelector.isVisible() && await themeToggle.isVisible()) {
        console.log('✅ Navbar persists across navigation');
      } else {
        console.log('❌ Navbar lost during navigation');
      }
    }
    
    // Test 7: Check for console errors
    console.log('\n7. Checking for console errors...');
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:4321/');
    await page.waitForTimeout(2000);
    
    if (errors.length === 0) {
      console.log('✅ No console errors');
    } else {
      console.log('❌ Console errors found:');
      errors.forEach(err => console.log('  - ' + err));
    }
    
    console.log('\n🎉 Tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
  }
  
  // Keep browser open for manual inspection
  console.log('\n👀 Browser will remain open for manual inspection. Close it when done.');
  console.log('Press Ctrl+C to exit.');
}

runTests();