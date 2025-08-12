import { chromium } from 'playwright';

async function captureScreenshot() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--window-size=1280,800']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  try {
    console.log('📸 Capturing screenshots...');

    // Homepage screenshot
    await page.goto('http://localhost:4321');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'docs/demo/homepage.png',
      fullPage: false
    });
    console.log('✅ Homepage captured');

    // Setup page screenshot
    await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'docs/demo/setup.png',
      fullPage: false
    });
    console.log('✅ Setup page captured');

    // Chat page screenshot
    await page.goto('http://localhost:4321/chat');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: 'docs/demo/chat.png',
      fullPage: false
    });
    console.log('✅ Chat page captured');

    console.log('🎉 All screenshots captured successfully!');

  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

// Run the screenshot capture
captureScreenshot().catch(console.error);