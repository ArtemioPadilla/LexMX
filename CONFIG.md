# LexMX Configuration Guide

This guide explains how to set up API keys and configure LLM providers for your LexMX installation.

## Quick Start

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API keys

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Visit `http://localhost:4321/setup` to configure providers via the web interface

## Environment Variables

LexMX supports multiple LLM providers. You can enable one or more providers by setting their respective API keys.

### Provider Priority

When multiple providers are configured, LexMX automatically selects the best one based on:
- Query complexity
- Cost optimization  
- Provider availability
- User preferences

Default priority (highest to lowest):
1. **Claude (Anthropic)** - Best for legal reasoning
2. **OpenAI GPT-4** - Excellent for complex analysis
3. **Google Gemini** - Cost-effective option
4. **WebLLM** - Free, runs locally in browser
5. **Mock Provider** - Fallback for demonstration

## Provider Setup

### 1. Claude (Anthropic) - **Recommended**

Best choice for legal analysis and Mexican law expertise.

```bash
# Get API key from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...
ENABLE_ANTHROPIC=true
```

**Pros:**
- Superior legal reasoning
- Excellent context understanding  
- Good Spanish language support
- Ethical AI approach

**Cons:**
- Higher cost than Gemini
- API rate limits

### 2. OpenAI - High Quality

Excellent for complex legal analysis and document processing.

```bash
# Get API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...
ENABLE_OPENAI=true
```

**Pros:**
- Very high quality responses
- Strong reasoning capabilities
- Good API reliability

**Cons:**
- Highest cost per query
- Can be verbose

### 3. Google Gemini - Budget Friendly

Cost-effective option with good multilingual support.

```bash
# Get API key from: https://makersuite.google.com/app/apikey  
GOOGLE_API_KEY=...
ENABLE_GOOGLE=true
```

**Pros:**
- Very cost-effective
- Good multilingual support
- Fast response times

**Cons:**
- Less specialized in legal content
- Sometimes less detailed responses

### 4. WebLLM - Free & Private

Runs AI models directly in your browser - completely free and private.

```bash
# No API key needed - always enabled
# WebLLM runs locally in browser
```

**Pros:**
- 100% free
- Complete privacy (no data sent to servers)
- Works offline
- No API rate limits

**Cons:**
- Requires powerful device
- Initial model download (1-3GB)
- Slower than cloud providers

### 5. Local/Self-Hosted Options

#### Ollama - Run Models Locally

```bash
# Install Ollama first: https://ollama.ai/
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
ENABLE_OLLAMA=true
```

#### OpenAI-Compatible APIs (LM Studio, vLLM, etc.)

```bash
# For LM Studio or other OpenAI-compatible local APIs
OPENAI_COMPATIBLE_BASE_URL=http://localhost:1234/v1
OPENAI_COMPATIBLE_API_KEY=not-needed
ENABLE_OPENAI_COMPATIBLE=true
```

### Enterprise Options

#### AWS Bedrock

```bash
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
ENABLE_AWS_BEDROCK=true
```

#### Azure OpenAI

```bash
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-15-preview
ENABLE_AZURE_OPENAI=true
```

#### Google Cloud Vertex AI

```bash
GOOGLE_CLOUD_PROJECT_ID=...
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_AI_MODEL_ID=gemini-1.5-pro
ENABLE_VERTEX_AI=true
```

## Configuration Options

### Cost Control

```bash
# Maximum cost per query (in USD cents)
MAX_COST_PER_QUERY=10

# Provider selection strategy
LLM_SELECTION_STRATEGY=balanced  # cost_optimized, quality_first, balanced, speed_first
```

### RAG Engine Settings

```bash
# Embedding provider for semantic search
EMBEDDING_PROVIDER=openai  # openai, transformers, mock

# Search configuration
MAX_SEARCH_RESULTS=20
SIMILARITY_THRESHOLD=0.7

# Text chunking
CHUNKING_STRATEGY=contextual  # fixed, semantic, contextual, hierarchical
CHUNK_SIZE=1024
CHUNK_OVERLAP=128
```

### Language & Localization

```bash
# Default language
DEFAULT_LANGUAGE=es  # es (Spanish) or en (English)
```

## Web Interface Setup

LexMX includes a web-based setup interface at `/setup` that allows you to:

1. **Configure providers** - Add API keys through a secure form
2. **Test connections** - Verify your API keys work
3. **Adjust settings** - Fine-tune cost limits and preferences
4. **Provider recommendations** - Get personalized setup advice

### Setup Page Features

- **Provider Cards**: Visual overview of each provider with setup instructions
- **Connection Testing**: Real-time verification of API keys
- **Cost Estimation**: Preview costs for different usage patterns
- **Security**: API keys are encrypted and stored locally
- **Import/Export**: Backup and restore your configuration

## Recommendations by Use Case

### Legal Professional - High Quality

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
LLM_SELECTION_STRATEGY=quality_first
MAX_COST_PER_QUERY=50
```

### Budget Conscious User

```bash
GOOGLE_API_KEY=...
LLM_SELECTION_STRATEGY=cost_optimized
MAX_COST_PER_QUERY=5
```

### Maximum Privacy

```bash
# Only use local providers - no API keys needed
ENABLE_OPENAI=false
ENABLE_ANTHROPIC=false
ENABLE_GOOGLE=false
# WebLLM is always available for free local inference
```

### Balanced Professional

```bash
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
LLM_SELECTION_STRATEGY=balanced
MAX_COST_PER_QUERY=15
```

## Troubleshooting

### Common Issues

**"No providers configured" error:**
- Verify your `.env` file contains valid API keys
- Check that environment variables are loaded (restart dev server)
- Visit `/setup` to configure providers through web interface

**API authentication errors:**
- Double-check API keys for typos
- Verify API keys have sufficient credits/quota
- Ensure API keys have required permissions

**WebLLM not working:**
- Ensure you're using a modern browser (Chrome, Firefox, Safari)
- Check that you have sufficient RAM (8GB+ recommended)
- Allow time for initial model download

### Testing Your Setup

1. Visit `/chat` and ask a simple legal question
2. Check browser console for any errors
3. Look for provider selection logs showing which LLM is being used
4. Verify responses include proper legal citations

### Getting Help

- Check the browser console for detailed error messages
- Ensure your `.env` file is in the root directory
- Restart the development server after changing environment variables
- Visit `/setup` for interactive configuration and testing

## Security Notes

- **API Keys**: Stored encrypted in browser localStorage
- **Queries**: Legal queries are sent to configured cloud providers
- **Privacy**: Use WebLLM or Ollama for complete privacy
- **HTTPS**: Always use HTTPS in production
- **Environment Variables**: Never commit `.env` files to version control

## Cost Management

### Estimation Guidelines

**Typical costs per query (USD):**
- Claude: $0.02 - $0.08
- OpenAI GPT-4: $0.03 - $0.12  
- Google Gemini: $0.005 - $0.02
- WebLLM/Ollama: Free

### Cost Control Features

- Set daily/monthly spending limits
- Real-time cost tracking
- Provider cost comparison
- Automatic fallback to cheaper providers when limits are reached

## Advanced Configuration

### Custom Prompts

Edit `src/i18n/locales/es.json` and `src/i18n/locales/en.json` to customize:
- System prompts for legal specializations
- Query templates
- Legal disclaimers and warnings

### Provider Priorities

Modify `src/lib/utils/env-config.ts` function `getProviderPriority()` to adjust automatic provider selection.

### Corpus Customization

Add your own legal documents to `/public/legal-corpus/` and regenerate embeddings with:

```bash
npm run build:corpus
npm run build:embeddings
```

---

Need more help? Check the [main README](./README.md) or open an issue on GitHub.