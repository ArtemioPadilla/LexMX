#!/usr/bin/env node

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Load configuration
const configPath = join(projectRoot, 'demo.config.json');
const config = JSON.parse(readFileSync(configPath, 'utf-8'));

interface DemoOptions {
  type?: 'full' | 'quick' | 'chat';
  headless?: boolean;
  outputDir?: string;
  keepVideo?: boolean;
}

interface DemoAction {
  type: 'scroll' | 'hover' | 'type' | 'wait' | 'click';
  target?: string;
  to?: number;
  delay?: number;
  selector?: string;
  text?: string;
  duration?: number;
}

interface DemoScene {
  page: string;
  duration: number;
  waitFor?: 'networkidle' | 'domcontentloaded' | 'load';
  actions: DemoAction[];
}

class DemoRecorder {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private videoPath: string | null = null;

  constructor(private options: DemoOptions = {}) {
    this.options = {
      type: 'full',
      headless: config.browser.headless,
      outputDir: config.output.dir,
      keepVideo: false,
      ...options
    };
  }

  async record(): Promise<void> {
    try {
      console.log(`🎬 Starting ${this.options.type} demo recording...`);
      
      await this.setup();
      await this.recordScenes();
      await this.cleanup();
      
      if (this.videoPath) {
        await this.processVideo();
      }
      
      console.log('✅ Demo recording completed successfully!');
    } catch (error) {
      console.error('❌ Error during recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  private async setup(): Promise<void> {
    // Ensure output directory exists
    const outputPath = join(projectRoot, this.options.outputDir!);
    if (!existsSync(outputPath)) {
      mkdirSync(outputPath, { recursive: true });
    }

    // Launch browser
    this.browser = await chromium.launch({
      headless: this.options.headless,
      args: config.browser.args
    });

    // Create context with video recording
    this.context = await this.browser.newContext({
      viewport: config.viewport,
      recordVideo: {
        dir: outputPath,
        size: config.viewport
      }
    });

    this.page = await this.context.newPage();

    // Add console logging for debugging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Page error:', msg.text());
      }
    });
  }

  private async recordScenes(): Promise<void> {
    const demoConfig = config.demos[this.options.type!];
    if (!demoConfig) {
      throw new Error(`Demo type '${this.options.type}' not found in configuration`);
    }

    console.log(`📹 Recording ${demoConfig.scenes.length} scenes...`);

    for (let i = 0; i < demoConfig.scenes.length; i++) {
      const scene = demoConfig.scenes[i];
      console.log(`  Scene ${i + 1}/${demoConfig.scenes.length}: ${scene.page}`);
      
      await this.recordScene(scene);
    }
  }

  private async recordScene(scene: DemoScene): Promise<void> {
    const url = `${config.server.url}${scene.page}`;
    
    // Navigate to page
    await this.page!.goto(url, {
      waitUntil: scene.waitFor || 'networkidle'
    });

    // Execute actions
    for (const action of scene.actions || []) {
      await this.executeAction(action);
    }

    // Wait for scene duration
    if (scene.duration) {
      await this.page!.waitForTimeout(scene.duration);
    }
  }

  private async executeAction(action: DemoAction): Promise<void> {
    const page = this.page!;

    switch (action.type) {
      case 'click': {
        const clickElement = page.locator(action.selector).first();
        if (await clickElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          await clickElement.click();
        }
        break;
      }

      case 'hover': {
        const hoverElement = page.locator(action.selector).first();
        if (await hoverElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          await hoverElement.hover();
        }
        break;
      }

      case 'type': {
        const typeElement = page.locator(action.selector).first();
        if (await typeElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          await typeElement.click();
          await typeElement.type(action.text, { delay: action.delay || 50 });
        }
        break;
      }

      case 'scroll':
        if (action.target === 'smooth') {
          await page.evaluate((to) => {
            window.scrollTo({ top: to, behavior: 'smooth' });
          }, action.to);
        } else {
          await page.evaluate((to) => {
            window.scrollTo(0, to);
          }, action.to);
        }
        break;

      case 'wait':
        await page.waitForTimeout(action.duration);
        break;

      case 'screenshot':
        await page.screenshot({
          path: join(projectRoot, this.options.outputDir!, action.filename),
          fullPage: action.fullPage || false
        });
        break;
    }

    // Wait after action if specified
    if (action.delay) {
      await page.waitForTimeout(action.delay);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.page) {
      // Get video path before closing
      const video = this.page.video();
      if (video) {
        this.videoPath = await video.path();
      }
    }

    if (this.context) {
      await this.context.close();
    }

    if (this.browser) {
      await this.browser.close();
    }
  }

  private async processVideo(): Promise<void> {
    if (!this.videoPath || !existsSync(this.videoPath)) {
      console.warn('No video file found to process');
      return;
    }

    const demoConfig = config.demos[this.options.type!];
    const outputDir = join(projectRoot, this.options.outputDir!);

    // Generate GIF if enabled
    if (config.output.formats.gif.enabled) {
      await this.generateGif(this.videoPath, outputDir, demoConfig.name);
    }

    // Convert to MP4 if enabled
    if (config.output.formats.mp4.enabled) {
      await this.generateMp4(this.videoPath, outputDir, demoConfig.name);
    }

    // Clean up original video if not keeping
    if (!this.options.keepVideo && existsSync(this.videoPath)) {
      unlinkSync(this.videoPath);
    }
  }

  private async generateGif(videoPath: string, outputDir: string, baseName: string): Promise<void> {
    const gifPath = join(outputDir, `${baseName}.gif`);
    const palettePath = '/tmp/palette.png';
    const fps = config.output.formats.gif.fps;

    console.log('🎨 Generating GIF...');

    try {
      // Generate palette for better colors
      await execAsync(
        `ffmpeg -i "${videoPath}" -vf "fps=${fps},scale=800:-1:flags=lanczos,palettegen=stats_mode=diff" -y "${palettePath}"`
      );

      // Convert to GIF with palette
      await execAsync(
        `ffmpeg -i "${videoPath}" -i "${palettePath}" -lavfi "fps=${fps},scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -y "${gifPath}"`
      );

      // Optimize with gifsicle if available
      if (config.output.formats.gif.optimization === 'gifsicle') {
        try {
          const optimizedPath = gifPath.replace('.gif', '-optimized.gif');
          await execAsync(`gifsicle -O3 --lossy=30 -o "${optimizedPath}" "${gifPath}"`);
          await execAsync(`mv "${optimizedPath}" "${gifPath}"`);
          console.log('  ✨ GIF optimized with gifsicle');
        } catch {
          console.log('  ⚠️ gifsicle not available, using unoptimized GIF');
        }
      }

      // Check file size
      const { stdout } = await execAsync(`ls -lh "${gifPath}" | awk '{print $5}'`);
      console.log(`  📦 GIF size: ${stdout.trim()}`);

      // Clean up palette
      if (existsSync(palettePath)) {
        unlinkSync(palettePath);
      }

    } catch (error) {
      console.error('❌ Error generating GIF:', error);
      console.log('💡 Make sure ffmpeg is installed: brew install ffmpeg');
      console.log('💡 For optimization, install gifsicle: brew install gifsicle');
    }
  }

  private async generateMp4(videoPath: string, outputDir: string, baseName: string): Promise<void> {
    const mp4Path = join(outputDir, `${baseName}.mp4`);
    const fps = config.output.formats.mp4.fps;

    console.log('🎥 Generating MP4...');

    try {
      await execAsync(
        `ffmpeg -i "${videoPath}" -vcodec h264 -acodec aac -strict -2 -r ${fps} -y "${mp4Path}"`
      );

      const { stdout } = await execAsync(`ls -lh "${mp4Path}" | awk '{print $5}'`);
      console.log(`  📦 MP4 size: ${stdout.trim()}`);

    } catch (error) {
      console.error('❌ Error generating MP4:', error);
    }
  }

  async captureScreenshots(): Promise<void> {
    if (!config.output.formats.screenshots.enabled) {
      return;
    }

    console.log('📸 Capturing screenshots...');

    await this.setup();

    const pages = ['/', '/setup', '/chat', '/casos', '/wiki'];
    const outputDir = join(projectRoot, this.options.outputDir!);

    for (const pagePath of pages) {
      const url = `${config.server.url}${pagePath}`;
      const filename = `screenshot-${pagePath.replace('/', '') || 'home'}.png`;
      
      await this.page!.goto(url, { waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(1000);
      
      await this.page!.screenshot({
        path: join(outputDir, filename),
        fullPage: false
      });
      
      console.log(`  ✅ ${filename}`);
    }

    await this.cleanup();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const inputType = args[0] || 'full';
  const type: 'full' | 'quick' | 'chat' = ['full', 'quick', 'chat'].includes(inputType) 
    ? inputType as 'full' | 'quick' | 'chat' 
    : 'full';
  const headless = !args.includes('--headed');
  const screenshots = args.includes('--screenshots');
  const keepVideo = args.includes('--keep-video');

  const recorder = new DemoRecorder({
    type,
    headless,
    keepVideo
  });

  if (screenshots) {
    await recorder.captureScreenshots();
  } else {
    await recorder.record();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DemoRecorder };