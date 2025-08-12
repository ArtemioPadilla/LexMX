import { chromium } from 'playwright';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function recordSimpleDemo() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1280,800']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: 'docs/demo/',
      size: { width: 1280, height: 800 }
    }
  });

  const page = await context.newPage();

  try {
    console.log('🎬 Starting simplified demo recording...');

    // 1. Show homepage
    await page.goto('http://localhost:4321');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 2. Navigate to setup page
    await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Show provider options by hovering
    const providers = ['webllm', 'openai', 'claude', 'gemini'];
    for (const provider of providers) {
      const selector = `[data-provider="${provider}"], button:has-text("${provider}"), div:has-text("${provider}")`;
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        await element.hover();
        await page.waitForTimeout(500);
      }
    }

    // 3. Navigate to chat page
    await page.goto('http://localhost:4321/chat');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 4. Try to interact with chat interface
    const chatInput = page.locator('textarea, input[type="text"]').first();
    if (await chatInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chatInput.click();
      await chatInput.type('¿Cuáles son los requisitos para un contrato laboral válido?', { delay: 40 });
      await page.waitForTimeout(1500);
    }

    // 5. Navigate to documents page
    await page.goto('http://localhost:4321/documents');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 6. Navigate to wiki page
    await page.goto('http://localhost:4321/wiki');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 7. Return to homepage for final shot
    await page.goto('http://localhost:4321');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    console.log('✅ Demo recording completed!');

  } catch (error) {
    console.error('⚠️ Recording completed with some errors:', error);
  } finally {
    await context.close();
    await browser.close();

    // Get the video file
    const videoPath = await getLatestVideo();
    if (videoPath) {
      console.log(`📹 Video saved to: ${videoPath}`);
      await convertToOptimizedGif(videoPath);
    }
  }
}

async function getLatestVideo(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('ls -t docs/demo/*.webm 2>/dev/null | head -1');
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function convertToOptimizedGif(videoPath: string) {
  console.log('🎨 Converting video to optimized GIF...');

  try {
    // Create high quality GIF with better settings
    const commands = [
      // Generate optimized palette
      `ffmpeg -i "${videoPath}" -vf "fps=10,scale=800:-1:flags=lanczos,palettegen=stats_mode=diff" -y /tmp/palette.png`,
      
      // Convert with optimized settings
      `ffmpeg -i "${videoPath}" -i /tmp/palette.png -lavfi "fps=10,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -y docs/demo/lexmx-demo-new.gif`,
      
      // Clean up
      `rm -f /tmp/palette.png "${videoPath}"`
    ];

    for (const cmd of commands) {
      await execAsync(cmd);
    }

    console.log('✨ Optimized GIF saved to: docs/demo/lexmx-demo-new.gif');

    // Check file size
    const { stdout: sizeOutput } = await execAsync('ls -lh docs/demo/lexmx-demo-new.gif | awk \'{print $5}\'');
    console.log(`📦 Final GIF size: ${sizeOutput.trim()}`);

  } catch (error) {
    console.error('❌ Error converting to GIF:', error);
    console.log('💡 Make sure ffmpeg is installed: brew install ffmpeg');
  }
}

// Run the demo recording
recordSimpleDemo().catch(console.error);