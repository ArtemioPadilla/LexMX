# 🛠️ LexMX Scripts

This directory contains utility scripts for building, testing, and validating the LexMX project.

## 🚀 Deployment Validation Scripts

### `validate-deployment.js`
Comprehensive validation script that checks if the built static site is ready for GitHub Pages deployment.

**Usage:**
```bash
# After running npm run build
npm run validate:deployment

# Or directly
node scripts/validate-deployment.js
```

**What it checks:**
- ✅ Core HTML pages exist and are valid
- ✅ Static assets (favicon, manifest, service worker)
- ✅ Legal corpus and embeddings metadata
- ✅ Service worker registration
- ✅ PWA manifest configuration
- ✅ Base URL construction (GitHub Pages compatibility)
- ✅ JavaScript bundles
- ⚠️ Hardcoded URLs that might break in production

**Exit codes:**
- `0` - All validations passed
- `1` - Critical failures that prevent deployment
- Warnings don't cause failure but should be addressed

### `test-local-dev.js`
Development testing script that validates the local development environment.

**Usage:**
```bash
# Test the local development server
npm run test:dev

# Or directly
node scripts/test-local-dev.js
```

**What it tests:**
- 🧪 Starts development server automatically
- 🧪 Tests core pages accessibility
- 🧪 Tests static assets loading
- 🧪 Tests API routes (dev mode only)
- 🧪 Checks critical dependencies
- 🧪 Validates document processing libraries

**Features:**
- Automatic dev server startup/shutdown
- Timeout handling for all requests
- Detailed error reporting
- Clean shutdown on SIGINT/SIGTERM

## 🔧 NPM Scripts

### Testing & Validation
```bash
# Test local development environment
npm run test:dev

# Validate deployment readiness
npm run validate:deployment

# Run all validations (lint + typecheck + deployment)
npm run validate:all

# Run unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all
```

### Building & Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Code quality
npm run lint
npm run type-check
```

## 🚀 CI/CD Integration

The project includes a GitHub Actions workflow (`.github/workflows/validate-deployment.yml`) that automatically runs these validation scripts on every push and pull request.

### Workflow stages:
1. **🔍 Code Quality** - ESLint and TypeScript checking
2. **🧪 Development Tests** - Run `test-local-dev.js`
3. **🏗️ Build & Validate** - Build and run `validate-deployment.js`
4. **🔍 Test Build Output** - Additional build validation
5. **🚀 Deploy** - Deploy to GitHub Pages (main branch only)
6. **✅ Post-Deploy** - Validate live site accessibility

## 📊 Validation Outputs

### Success Example:
```
🚀 LexMX Deployment Validation

[12:34:56] INFO Starting deployment validation...
[12:34:56] PASS Home page is valid HTML (15.2 KB)
[12:34:56] PASS Chat page is valid HTML (18.4 KB)
[12:34:56] PASS Favicon exists (favicon.svg, 2.1 KB)
[12:34:56] PASS Service worker exists and appears valid (5.8 KB)
[12:34:56] PASS Corpus metadata is valid JSON (3 keys)
[12:34:56] PASS PWA manifest has correct relative start_url

📊 Validation Summary
✅ Passed: 15
❌ Failed: 0
⚠️  Warnings: 2

✅ Deployment validation passed!
Your site is ready for GitHub Pages deployment.
```

### Failure Example:
```
🚀 LexMX Deployment Validation

[12:34:56] INFO Starting deployment validation...
[12:34:56] FAIL Service worker missing (sw.js not found in dist/)
[12:34:56] FAIL Corpus metadata missing (Expected: legal-corpus/metadata.json)
[12:34:56] WARN Documents admin page contains hardcoded URLs (2 instances found)

📊 Validation Summary
✅ Passed: 8
❌ Failed: 2
⚠️  Warnings: 1

❌ Deployment validation failed
Fix the above issues before deploying to GitHub Pages.
```

## 🐛 Troubleshooting

### Common Issues

**1. Service Worker 404 Errors**
```
Error: Service worker registration failed
```
**Solution:** Ensure `sw.js` is in the `public/` directory and service worker registration uses proper base paths.

**2. Hardcoded URL Issues**
```
WARN: Contains hardcoded URLs
```
**Solution:** Replace hardcoded paths like `/api/...` with `getUrl('api/...')` or dynamic base path construction.

**3. Missing Metadata Files**
```
FAIL: Corpus metadata missing
```
**Solution:** Run `npm run build:corpus` or ensure empty metadata files exist.

**4. Development Server Won't Start**
```
Error: Dev server startup timeout
```
**Solution:** Check if port 4321 is in use, or try `npx kill-port 4321`.

### Environment Variables

The scripts respect these environment variables:

- `NODE_ENV` - Controls logging verbosity
- `CI` - Adjusts behavior for CI environments
- `PUBLIC_BASE_URL` - Sets the base URL for builds (automatically set in CI)

### Manual Validation Steps

If automated scripts fail, you can manually check:

1. **Build exists:** `ls -la dist/`
2. **Core files:** `ls -la dist/index.html dist/manifest.json dist/sw.js`
3. **Metadata files:** `ls -la dist/legal-corpus/metadata.json dist/embeddings/embeddings-metadata.json`
4. **JSON validity:** `python -m json.tool dist/manifest.json`
5. **File sizes:** `du -sh dist/`

## 🔍 Adding New Validations

To add new validation checks:

1. **For deployment validation:** Edit `validate-deployment.js` and add your check to the appropriate section
2. **For development testing:** Edit `test-local-dev.js` and add your test
3. **For CI/CD:** Update `.github/workflows/validate-deployment.yml` if needed

Example validation function:
```javascript
function validateCustomFeature() {
  const featureFile = join(distPath, 'custom-feature.json');
  if (existsSync(featureFile)) {
    log('PASS', 'Custom feature configuration exists');
    return true;
  } else {
    log('FAIL', 'Custom feature configuration missing');
    return false;
  }
}
```

## 📚 Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Development guidelines and architecture
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Astro Build Docs](https://docs.astro.build/en/reference/cli-reference/#astro-build)
- [GitHub Pages Docs](https://docs.github.com/en/pages)