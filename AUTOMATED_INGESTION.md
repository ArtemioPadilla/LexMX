# 🚀 Automated Document Ingestion System

This document explains LexMX's comprehensive solution for handling CORS restrictions and automating Mexican legal document ingestion.

## 🎯 Problem Solved

**Original Issue**: CORS (Cross-Origin Resource Sharing) policies blocked direct access to Mexican government documents from the browser, causing "Failed to fetch" errors.

**Root Cause**: Public CORS proxies (cors-anywhere, codetabs) are unreliable, rate-limited, and often blocked.

**Our Solution**: Multi-layered approach combining immediate user guidance, automated server-side ingestion, and optional local development tools.

## 🏗️ Architecture Overview

### 1. **Client-Side: Intelligent CORS Detection**
- **Immediate Detection**: Recognizes cross-origin Mexican government URLs instantly
- **Skip Failed Proxies**: No more waiting for unreliable proxy timeouts
- **User Guidance**: Provides step-by-step instructions for manual download/upload
- **Development Support**: Detects localhost environment and suggests local tools

### 2. **Server-Side: Automated GitHub Actions Ingestion**
- **No CORS Restrictions**: GitHub Actions can directly fetch from any URL
- **Queue-Based Processing**: Community can contribute document URLs via pull requests
- **Automatic Processing**: Weekly runs or manual triggers via GitHub UI
- **Full Pipeline**: Fetch → Parse → Store → Generate Embeddings → Deploy

### 3. **Development Tools: Local CORS Proxy**
- **Optional Dev Tool**: Simple Node.js proxy for local development
- **Secure**: Only allows Mexican government domains
- **Easy Setup**: `npm run dev:proxy` and it's ready

## 📁 File Structure

```
scripts/
├── auto-ingest-documents.js     # Server-side document fetcher
├── dev-proxy.js                 # Local development CORS proxy
└── validate-deployment.js       # Enhanced with ingestion validation

public/
└── document-requests.json       # Community document queue

.github/workflows/
└── corpus-update.yml           # Enhanced automated workflow

src/lib/utils/
└── cors-aware-fetch.ts         # Intelligent CORS handling
```

## 🔄 User Experience Flow

### **For End Users (Browser)**
1. **Enter Government URL**: `https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf`
2. **Immediate CORS Warning**: System detects cross-origin and shows helpful guidance
3. **Clear Instructions**: Step-by-step download and upload instructions
4. **File Upload**: Works perfectly without CORS issues
5. **Automatic Future Access**: Document will be available automatically via automation

### **For Contributors**
1. **Submit Document Request**: Via GitHub Issues or PR to `document-requests.json`
2. **Automated Processing**: GitHub Actions processes requests weekly
3. **Community Benefit**: Everyone gets access to the processed document

### **For Developers**
1. **Local Development**: `npm run dev:proxy` for local CORS bypass
2. **Testing**: All CORS-related functionality works in development
3. **Production Ready**: Automated deployment with full validation

## 🛠️ Setup & Usage

### **Basic Setup (No additional setup needed)**
The system works out of the box:
- ✅ Client-side CORS guidance is automatic
- ✅ GitHub Actions automation is configured
- ✅ Document queue is ready for contributions

### **Local Development Setup**
For developers who want to test URL ingestion locally:

```bash
# Terminal 1: Start the development server
npm run dev

# Terminal 2: Start the CORS proxy
npm run dev:proxy

# Now URL ingestion will work in localhost development
```

### **Contributing Documents**
Add documents to the queue via pull request:

```json
{
  "id": "new-law-2024",
  "title": "Nueva Ley Example",
  "url": "https://www.diputados.gob.mx/LeyesBiblio/pdf/example.pdf",
  "type": "law",
  "primaryArea": "civil",
  "priority": "medium",
  "status": "pending"
}
```

### **Manual Automation Trigger**
Trigger document processing manually:
1. Go to GitHub Actions tab
2. Select "📚 Legal Corpus Auto-Update"
3. Click "Run workflow"
4. Set parameters and run

## 📊 Automation Features

### **GitHub Actions Workflow**
- **Schedule**: Runs every Sunday at 2 AM UTC
- **Manual Trigger**: Can be run anytime from GitHub UI
- **Batch Processing**: Processes up to 10 documents per run (configurable)
- **Smart Commits**: Only commits if documents were successfully processed
- **Full Pipeline**: Includes embedding generation and metadata updates

### **Document Processing Pipeline**
```
📥 Fetch Document → 🔍 Validate Source → 📄 Parse Content → 
🧬 Generate Embeddings → 💾 Save to Corpus → 📤 Commit Changes
```

### **Quality Assurance**
- **Source Validation**: Only official Mexican government domains
- **Format Support**: PDF, DOC, XML, HTML, plain text
- **Size Limits**: 50MB max for server-side processing
- **Error Handling**: Detailed logging and failure recovery
- **Metadata Generation**: Automatic document categorization

## 🎨 User Interface Enhancements

### **Enhanced CORS Error Messages**
Instead of generic "Failed to fetch":

```
🔒 CORS Policy Blocked Document Access

Your browser blocked direct access to https://www.diputados.gob.mx/... 
due to CORS security policy. This is normal for external websites.

📝 Alternative Options:
🏛️ This is an official Mexican government document
📥 Download manually: Right-click the link → "Save As" → save to your computer
📤 Then upload: Use the file upload button above to select the downloaded file
⚡ Automated ingestion: This document will be processed automatically in future updates
📄 PDF detected: The file will be processed and made searchable once uploaded
💡 The upload method is often more reliable than URL fetching
📋 Submit document requests via GitHub Issues for automated processing
```

### **Development Mode Detection**
When running on localhost, additional suggestions appear:
```
🔧 For development: Install a CORS browser extension like "CORS Unblock"
⚙️ Alternative: Run "npm run dev:proxy" for local CORS proxy
```

## 🔧 Configuration Options

### **Auto-Ingest Script Options**
```bash
# Process all pending documents
npm run ingest:auto

# Process with custom limits (GitHub Actions)
node scripts/auto-ingest-documents.js --max-docs=5
```

### **Dev Proxy Configuration**
- **Port**: 3001 (configurable in script)
- **Allowed Domains**: Mexican government sites only
- **Health Check**: `http://localhost:3001/health`
- **Usage**: `http://localhost:3001/?url=TARGET_URL`

### **Document Queue Schema**
```json
{
  "id": "unique-id",
  "title": "Human-readable title",
  "url": "https://government-site.gob.mx/document.pdf",
  "type": "constitution|law|code|regulation|decree",
  "primaryArea": "constitutional|civil|criminal|labor|tax|...",
  "hierarchy": 1-7,
  "priority": "low|medium|high|urgent",
  "status": "pending|processing|completed|failed"
}
```

## 🚨 Security & Validation

### **Source Validation**
Only these Mexican government domains are allowed:
- `diputados.gob.mx` - Chamber of Deputies
- `dof.gob.mx` - Official Gazette
- `scjn.gob.mx` - Supreme Court
- `senado.gob.mx` - Senate
- `sat.gob.mx` - Tax Authority
- `imss.gob.mx` - Social Security
- `infonavit.org.mx` - Housing Institute

### **Content Security**
- **File Size Limits**: 50MB for server-side, 10MB for client-side
- **Format Validation**: Only document formats (PDF, DOC, XML, HTML, TXT)
- **URL Validation**: Strict URL parsing and domain checking
- **No Code Execution**: All processing is read-only document parsing

### **Rate Limiting**
- **GitHub Actions**: Natural rate limiting via workflow schedule
- **Dev Proxy**: No built-in limits (local development only)
- **Client-Side**: Browser's natural rate limiting

## 🔍 Monitoring & Debugging

### **GitHub Actions Monitoring**
- **Workflow Status**: Visible in GitHub Actions tab
- **Processing Logs**: Detailed logs for each document
- **Commit Messages**: Clear indication of what was processed
- **Summary Reports**: Automatic summaries in workflow results

### **Development Debugging**
```javascript
// Enhanced logging in CORS-aware fetch
console.log('[CorsAwareFetch] Analyzing https://example.gob.mx/doc.pdf:');
console.log('- Cross-origin: true');
console.log('- Mexican govt: true');
console.log('- Direct fetch failed, providing CORS guidance instead of unreliable proxies');
```

### **Queue Status Tracking**
```bash
# Check pending documents
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/document-requests.json', 'utf8'));
console.log(\`Pending: \${data.documents.filter(d => d.status === 'pending').length}\`);
"
```

## 📈 Benefits & Impact

### **For Users**
- ✅ **No More Generic Errors**: Clear, actionable guidance instead of "Failed to fetch"
- ✅ **Faster Workflow**: Upload is often faster than trying broken proxies
- ✅ **Future Automation**: Documents appear automatically without user intervention

### **For Developers**
- ✅ **Local Development**: `npm run dev:proxy` enables full URL testing
- ✅ **No Dependencies**: No reliance on unreliable external services
- ✅ **Clear Debugging**: Detailed logging shows exactly what's happening

### **For the Project**
- ✅ **Automated Growth**: Corpus expands automatically via community contributions
- ✅ **Zero Maintenance**: No managing unreliable proxy services
- ✅ **Scalable**: GitHub Actions can process hundreds of documents
- ✅ **Community Driven**: Easy for anyone to contribute document URLs

## 🚀 Future Enhancements

### **Planned Features**
- **PDF Processing**: Full PDF text extraction with `pdf-parse`
- **DOC Processing**: DOC/DOCX parsing with `mammoth.js`
- **Smart Categorization**: AI-powered document type and area detection
- **Update Monitoring**: Detect when government documents are updated
- **RSS Integration**: Automatic monitoring of government RSS feeds

### **Community Features**
- **Document Voting**: Community votes on document priority
- **Processing Dashboard**: Public dashboard showing ingestion status
- **API Endpoints**: RESTful API for document requests and status
- **Webhook Integration**: Partner organizations can submit documents via webhooks

## 🆘 Troubleshooting

### **Client-Side Issues**
**Problem**: Still seeing "Failed to fetch" errors
**Solution**: 
1. Clear browser cache
2. Check console for detailed CORS-aware fetch logs
3. Verify the URL is from a Mexican government domain

**Problem**: Upload not working
**Solution**:
1. Check file size (must be under 10MB for client upload)
2. Verify file format (PDF, DOC, TXT supported)
3. Check browser developer console for errors

### **Development Issues**
**Problem**: Local proxy not working
**Solution**:
1. Ensure `npm run dev:proxy` is running
2. Check port 3001 is available
3. Verify CORS-aware fetch detects localhost environment

**Problem**: Documents not processing in GitHub Actions
**Solution**:
1. Check document queue JSON syntax
2. Verify URLs are from allowed domains
3. Review GitHub Actions logs for specific errors

### **Automation Issues**
**Problem**: GitHub Actions not running
**Solution**:
1. Check if workflow is enabled in repository settings
2. Verify cron schedule syntax
3. Try manual trigger to test functionality

**Problem**: Documents processed but not appearing
**Solution**:
1. Check if embeddings were generated successfully
2. Verify corpus metadata was updated
3. Check if changes were committed and pushed

This comprehensive system transforms CORS limitations from technical barriers into user-guided workflows while enabling full automation on the server side. The result is a more reliable, scalable, and user-friendly document ingestion experience.