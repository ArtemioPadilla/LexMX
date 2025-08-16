import { chromium } from 'playwright';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function recordDemo() {
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
    console.log('🎬 Starting demo recording...');

    // 1. Navigate to homepage
    await page.goto('http://localhost:4321');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Scroll to show hero section
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1500);

    // 2. Click "Iniciar Consulta Gratis"
    await page.click('text="Iniciar Consulta Gratis"');
    await page.waitForURL('**/setup');
    await page.waitForTimeout(1500);

    // 3. Show provider options
    await page.hover('[data-provider="webllm"]');
    await page.waitForTimeout(500);
    await page.hover('[data-provider="openai"]');
    await page.waitForTimeout(500);
    await page.hover('[data-provider="claude"]');
    await page.waitForTimeout(500);

    // 4. Select WebLLM
    await page.click('button:has-text("Usar WebLLM")');
    await page.waitForTimeout(1000);

    // Wait for WebLLM configuration modal
    const webllmModal = page.locator('h2:has-text("Configurar WebLLM")');
    if (await webllmModal.isVisible({ timeout: 5000 })) {
      // Select a model
      const modelButton = page.locator('button:has-text("Seleccionar Modelo")').first();
      if (await modelButton.isVisible()) {
        await modelButton.click();
        await page.waitForTimeout(500);
        
        // Select Llama model
        const llamaOption = page.locator('button:has-text("Llama")').first();
        if (await llamaOption.isVisible()) {
          await llamaOption.click();
          await page.waitForTimeout(500);
        }
      }

      // Click save
      await page.click('button:has-text("Guardar")');
      await page.waitForTimeout(1500);
    }

    // 5. Navigate to chat
    const startButton = page.locator('button:has-text("Comenzar a Usar LexMX")');
    if (await startButton.isVisible({ timeout: 5000 })) {
      await startButton.click();
      await page.waitForURL('**/chat');
      await page.waitForTimeout(2000);
    } else {
      // Fallback: direct navigation
      await page.goto('http://localhost:4321/chat');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // 6. Show corpus selector
    const corpusButton = page.locator('.corpus-selector button').first();
    if (await corpusButton.isVisible()) {
      await corpusButton.click();
      await page.waitForTimeout(1000);

      // Show document selection
      const docTab = page.locator('button:has-text("Por Documento")');
      if (await docTab.isVisible()) {
        await docTab.click();
        await page.waitForTimeout(500);

        // Select some documents
        await page.click('text="CPEUM"');
        await page.waitForTimeout(300);
        await page.click('text="LFT"');
        await page.waitForTimeout(300);
      }

      // Close selector
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 7. Type a legal query
    const chatInput = page.locator('textarea[placeholder*="consulta legal"], textarea[placeholder*="Escribe tu consulta"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.click();
      await page.waitForTimeout(500);
      
      // Type with realistic speed
      await chatInput.type('¿Cuáles son los derechos laborales básicos según la Constitución Mexicana?', { delay: 50 });
      await page.waitForTimeout(1000);

      // Send message
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000); // Wait for response to start appearing
    }

    // 8. Show dark mode toggle
    const darkModeButton = page.locator('[aria-label*="dark"], [aria-label*="oscuro"], button:has-text("🌙"), button:has-text("☀️")').first();
    if (await darkModeButton.isVisible()) {
      await darkModeButton.click();
      await page.waitForTimeout(1500);
      await darkModeButton.click(); // Toggle back
      await page.waitForTimeout(1000);
    }

    // Final pause to show the complete interface
    await page.waitForTimeout(2000);

    console.log('✅ Demo recording completed!');

  } catch (error) {
    console.error('❌ Error during recording:', error);
  } finally {
    await context.close();
    await browser.close();

    // Get the video file
    const videoPath = await getLatestVideo();
    if (videoPath) {
      console.log(`📹 Video saved to: ${videoPath}`);
      await convertToGif(videoPath);
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

async function convertToGif(videoPath: string) {
  const gifPath = videoPath.replace('.webm', '.gif');
  const optimizedGifPath = videoPath.replace('.webm', '-optimized.gif');

  console.log('🎨 Converting video to GIF...');

  try {
    // Generate palette for better colors
    await execAsync(`ffmpeg -i "${videoPath}" -vf "fps=15,scale=800:-1:flags=lanczos,palettegen" -y /tmp/palette.png`);
    
    // Convert to GIF with palette
    await execAsync(`ffmpeg -i "${videoPath}" -i /tmp/palette.png -lavfi "fps=15,scale=800:-1:flags=lanczos [x]; [x][1:v] paletteuse" -y "${gifPath}"`);
    
    // Optimize with gifsicle if available
    try {
      await execAsync(`gifsicle -O3 --lossy=30 -o "${optimizedGifPath}" "${gifPath}"`);
      console.log(`✨ Optimized GIF saved to: ${optimizedGifPath}`);
      
      // Rename optimized to main
      await execAsync(`mv "${optimizedGifPath}" "docs/demo/lexmx-demo.gif"`);
      console.log('📦 Final demo GIF: docs/demo/lexmx-demo.gif');
    } catch {
      // If gifsicle not available, just rename the original
      await execAsync(`mv "${gifPath}" "docs/demo/lexmx-demo.gif"`);
      console.log('📦 Demo GIF saved to: docs/demo/lexmx-demo.gif (not optimized)');
    }

    // Clean up temporary files
    await execAsync(`rm -f /tmp/palette.png "${videoPath}" "${gifPath}" 2>/dev/null || true`);

  } catch (error) {
    console.error('❌ Error converting to GIF:', error);
    console.log('💡 Make sure ffmpeg is installed: brew install ffmpeg');
    console.log('💡 For optimization, install gifsicle: brew install gifsicle');
  }
}

// Run the demo recording
recordDemo().catch(console.error);