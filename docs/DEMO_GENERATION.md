# Demo Generation Guide

## Overview

LexMX includes an automated demo generation system that creates GIFs, videos, and screenshots of the application. These demos are automatically updated when UI changes are detected, ensuring the README always shows the current state of the application.

## Quick Start

### Generate a Demo Locally

```bash
# Generate full demo (GIF + MP4)
npm run demo:record

# Generate quick homepage demo
npm run demo:quick

# Generate chat-focused demo
npm run demo:chat

# Generate screenshots only
npm run demo:screenshots

# Full update (demo + screenshots)
npm run demo:update

# Generate with visible browser (for debugging)
npm run demo:headed
```

## Configuration

All demo settings are defined in `demo.config.json`:

```json
{
  "viewport": {
    "width": 1280,
    "height": 800
  },
  "output": {
    "dir": "docs/demo",
    "formats": {
      "gif": { "enabled": true, "fps": 10 },
      "mp4": { "enabled": true, "fps": 30 },
      "screenshots": { "enabled": true }
    }
  },
  "demos": {
    "full": { /* Full app showcase */ },
    "quick": { /* Quick homepage demo */ },
    "chat": { /* Chat interface demo */ }
  }
}
```

### Demo Types

1. **Full Demo** (`npm run demo:record`)
   - Complete app walkthrough
   - Shows: Homepage → Setup → Chat → Cases → Dark mode
   - Duration: ~15 seconds
   - Output: ~2-3MB GIF

2. **Quick Demo** (`npm run demo:quick`)
   - Homepage only with scrolling
   - Duration: ~3 seconds
   - Output: ~1-2MB GIF

3. **Chat Demo** (`npm run demo:chat`)
   - Chat interface with typing animation
   - Duration: ~5 seconds
   - Output: ~1-2MB GIF

## Automated Updates

### GitHub Actions

The demo is automatically updated via GitHub Actions when:

1. **On Push to Main**: When UI files change (`.tsx`, `.astro`, `.css`)
2. **Weekly Schedule**: Every Sunday at 2 AM UTC
3. **Manual Trigger**: Via GitHub Actions UI

The workflow:
- Checks for UI changes
- Starts dev server
- Records demo
- Optimizes files
- Commits changes if different
- Archives old demos (keeps last 3)

### Trigger Manual Update

1. Go to Actions tab in GitHub
2. Select "🎬 Update Demo" workflow
3. Click "Run workflow"
4. Choose options:
   - `force_update`: Update even without changes
   - `demo_type`: full/quick/chat

## Adding New Scenes

To add a new scene to the demo:

1. Edit `demo.config.json`:

```json
{
  "demos": {
    "your-demo": {
      "name": "lexmx-demo-custom",
      "scenes": [
        {
          "page": "/your-page",
          "duration": 3000,
          "actions": [
            {
              "type": "click",
              "selector": "button.your-button",
              "delay": 500
            }
          ]
        }
      ]
    }
  }
}
```

2. Add npm script in `package.json`:

```json
"demo:custom": "npx tsx scripts/generate-demo.ts your-demo"
```

## Action Types

Available actions for scenes:

### Click
```json
{
  "type": "click",
  "selector": "button.primary",
  "delay": 500
}
```

### Hover
```json
{
  "type": "hover",
  "selector": ".card",
  "delay": 300
}
```

### Type
```json
{
  "type": "type",
  "selector": "textarea",
  "text": "Your text here",
  "delay": 50
}
```

### Scroll
```json
{
  "type": "scroll",
  "target": "smooth",
  "to": 400,
  "delay": 500
}
```

### Wait
```json
{
  "type": "wait",
  "duration": 1000
}
```

### Screenshot
```json
{
  "type": "screenshot",
  "filename": "custom-screenshot.png",
  "fullPage": false
}
```

## Prerequisites

### Local Development

Install required tools:

```bash
# macOS
brew install ffmpeg gifsicle

# Ubuntu/Debian
sudo apt-get install ffmpeg gifsicle imagemagick

# Windows (via Chocolatey)
choco install ffmpeg gifsicle
```

### Playwright Browsers

```bash
# Install Playwright browsers
npx playwright install chromium
npx playwright install-deps chromium
```

## Troubleshooting

### Demo Not Generating

1. **Check server is running**:
```bash
npm run dev
# In another terminal:
npm run demo:record
```

2. **Check ffmpeg installation**:
```bash
ffmpeg -version
```

3. **Run with visible browser**:
```bash
npm run demo:headed
```

### GIF Too Large

1. **Reduce FPS** in `demo.config.json`:
```json
"gif": { "fps": 8 }
```

2. **Shorten scenes**:
```json
"duration": 2000  // Instead of 3000
```

3. **Install gifsicle** for optimization:
```bash
brew install gifsicle
```

### Page Not Loading

Check selectors in `demo.config.json` match current UI:

```bash
# Test selectors in browser console
document.querySelector('your-selector')
```

## File Organization

```
docs/demo/
├── lexmx-demo.gif           # Main demo
├── lexmx-demo.mp4           # Video version
├── lexmx-demo-quick.gif    # Quick demo
├── screenshot-*.png         # Page screenshots
└── archive/                 # Old demos (auto-managed)
    └── 20240108_120000_lexmx-demo.gif
```

## Best Practices

1. **Keep demos short**: 10-15 seconds max for GIFs
2. **Optimize file size**: Target <3MB for GIFs
3. **Test locally first**: Use `npm run demo:headed` to debug
4. **Update config**: Keep selectors in sync with UI changes
5. **Archive old demos**: Automatic in CI, manual locally

## CI/CD Integration

The GitHub Action workflow (`.github/workflows/update-demo.yml`):

1. **Triggers**: Push, schedule, manual
2. **Checks**: UI file changes
3. **Records**: Using Playwright
4. **Optimizes**: With ffmpeg/gifsicle
5. **Commits**: Only if changed
6. **Archives**: Keeps last 3 versions

## Manual Commands

```bash
# Record specific demo type
npx tsx scripts/generate-demo.ts full

# Keep video file for debugging
npx tsx scripts/generate-demo.ts full --keep-video

# Generate screenshots only
npx tsx scripts/generate-demo.ts --screenshots

# Run with custom config
DEMO_CONFIG=custom.json npx tsx scripts/generate-demo.ts
```

## Contributing

When adding new UI features:

1. Update `demo.config.json` with new scenes
2. Test locally: `npm run demo:headed`
3. Commit changes
4. CI will auto-generate new demo

## Support

For issues with demo generation:

1. Check [GitHub Actions logs](https://github.com/ArtemioPadilla/LexMX/actions)
2. Run locally with `--headed` flag
3. Check ffmpeg/gifsicle installation
4. Open an issue with error logs