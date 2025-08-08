import { useState } from 'react';
import type { ProviderConfig, LLMModel } from '../../types/llm';
import type { ProviderMetadata } from '../../lib/llm/provider-registry';
import { useTranslation } from '../../i18n';

interface ProviderConfigFormProps {
  provider: ProviderMetadata;
  models?: LLMModel[];
  onSave: (config: ProviderConfig) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  error?: string | null;
  showModelSelection?: boolean;
  inline?: boolean;
}

export default function ProviderConfigForm({
  provider,
  models = [],
  onSave,
  onCancel,
  isLoading = false,
  error = null,
  showModelSelection = true,
  inline = false
}: ProviderConfigFormProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Partial<ProviderConfig>>({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    enabled: true,
    priority: 1,
    temperature: 0.1,
    costLimit: { daily: 10, monthly: 200 },
    region: 'us-east-1' // Default region for Bedrock
  });
  
  // State for Bedrock authentication method
  const [bedrockAuthMethod, setBedrockAuthMethod] = useState<'apiKey' | 'iam'>('apiKey');
  // State for Azure authentication method
  const [azureAuthMethod, setAzureAuthMethod] = useState<'apiKey' | 'azureAd'>('apiKey');
  // State for Vertex AI authentication method
  const [vertexAuthMethod, setVertexAuthMethod] = useState<'apiKey' | 'serviceAccount'>('apiKey');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Ensure all required fields are present
    const fullConfig: ProviderConfig = {
      ...config,
      id: config.id || provider.id,
      name: config.name || provider.name,
      type: config.type || provider.type,
      enabled: config.enabled !== undefined ? config.enabled : true,
      priority: config.priority || 1,
      createdAt: config.createdAt || Date.now()
    } as ProviderConfig;
    onSave(fullConfig);
  };
  
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    
    try {
      // Import and create the provider dynamically
      const { ProviderFactory } = await import('../../lib/llm/providers');
      const testProvider = ProviderFactory.createProvider(config as ProviderConfig);
      
      if ('testConnection' in testProvider && typeof testProvider.testConnection === 'function') {
        const success = await testProvider.testConnection();
        setConnectionTestResult({
          success,
          message: success ? 'Conexión exitosa' : 'No se pudo conectar al servicio'
        });
      } else {
        setConnectionTestResult({
          success: false,
          message: 'Este proveedor no soporta prueba de conexión'
        });
      }
    } catch (error) {
      setConnectionTestResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${inline ? '' : 'p-6 bg-gray-800 rounded-lg'}`}>
      {/* AWS Bedrock Configuration */}
      {provider.id === 'bedrock' && (
        <>
          {/* Authentication Method Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Método de Autenticación
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setBedrockAuthMethod('apiKey')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  bedrockAuthMethod === 'apiKey' 
                    ? 'bg-legal-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                API Key
              </button>
              <button
                type="button"
                onClick={() => setBedrockAuthMethod('iam')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  bedrockAuthMethod === 'iam' 
                    ? 'bg-legal-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Credenciales IAM
              </button>
            </div>
          </div>

          {/* API Key Method */}
          {bedrockAuthMethod === 'apiKey' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                required
                placeholder="Ingrese su API key de AWS Bedrock"
                value={config.apiKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
              />
            </div>
          )}

          {/* IAM Credentials Method */}
          {bedrockAuthMethod === 'iam' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Access Key ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={config.accessKeyId || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, accessKeyId: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Secret Access Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  value={config.secretAccessKey || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Session Token (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="Para credenciales temporales"
                  value={config.sessionToken || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, sessionToken: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
                />
              </div>
            </>
          )}

          {/* Region Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Región AWS
            </label>
            <select
              value={config.region || 'us-east-1'}
              onChange={(e) => setConfig(prev => ({ ...prev, region: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-legal-500"
            >
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">EU (Ireland)</option>
              <option value="eu-central-1">EU (Frankfurt)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
              <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
            </select>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Modelo Predeterminado
            </label>
            <select
              value={config.model || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-legal-500"
            >
              <option value="">Seleccionar modelo...</option>
              <optgroup label="Claude (Anthropic)">
                <option value="anthropic.claude-3-sonnet-20240229-v1:0">Claude 3 Sonnet</option>
                <option value="anthropic.claude-3-haiku-20240307-v1:0">Claude 3 Haiku</option>
                <option value="anthropic.claude-v2:1">Claude 2.1</option>
              </optgroup>
              <optgroup label="Llama (Meta)">
                <option value="meta.llama3-70b-instruct-v1:0">Llama 3 70B</option>
                <option value="meta.llama3-8b-instruct-v1:0">Llama 3 8B</option>
              </optgroup>
              <optgroup label="Titan (Amazon)">
                <option value="amazon.titan-text-express-v1">Titan Text Express</option>
              </optgroup>
              <optgroup label="Cohere">
                <option value="cohere.command-text-v14">Cohere Command</option>
              </optgroup>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              También puede ingresar un ID de modelo personalizado en Configuración Avanzada
            </p>
          </div>

          {/* Test Connection Button */}
          <div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testingConnection ? 'Probando conexión...' : 'Probar Conexión'}
            </button>
            {connectionTestResult && (
              <div className={`mt-2 p-2 rounded-lg text-sm ${
                connectionTestResult.success 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {connectionTestResult.message}
              </div>
            )}
          </div>
        </>
      )}

      {/* Azure OpenAI Configuration */}
      {provider.id === 'azure' && (
        <>
          {/* Authentication Method Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Authentication Method
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setAzureAuthMethod('apiKey')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  azureAuthMethod === 'apiKey' 
                    ? 'bg-legal-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                API Key
              </button>
              <button
                type="button"
                onClick={() => setAzureAuthMethod('azureAd')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  azureAuthMethod === 'azureAd' 
                    ? 'bg-legal-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Azure AD
              </button>
            </div>
          </div>

          {/* Resource Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Azure Resource Name
            </label>
            <input
              type="text"
              required
              placeholder="my-openai-resource"
              value={config.azureResourceName || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, azureResourceName: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              The name of your Azure OpenAI resource
            </p>
          </div>

          {/* Deployment Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Deployment Name
            </label>
            <input
              type="text"
              required
              placeholder="gpt-4-turbo"
              value={config.azureDeploymentName || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, azureDeploymentName: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              The name of your model deployment
            </p>
          </div>

          {/* API Key Method */}
          {azureAuthMethod === 'apiKey' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                required
                placeholder="Enter your Azure OpenAI API key"
                value={config.apiKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
              />
            </div>
          )}

          {/* Azure AD Method */}
          {azureAuthMethod === 'azureAd' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tenant ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={config.azureTenantId || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, azureTenantId: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={config.azureClientId || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, azureClientId: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Client Secret
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter your client secret"
                  value={config.azureClientSecret || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, azureClientSecret: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
                />
              </div>
            </>
          )}

          {/* API Version */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Version
            </label>
            <select
              value={config.azureApiVersion || '2024-02-01'}
              onChange={(e) => setConfig(prev => ({ ...prev, azureApiVersion: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-legal-500"
            >
              <option value="2024-02-01">2024-02-01 (Latest)</option>
              <option value="2023-12-01-preview">2023-12-01-preview</option>
              <option value="2023-05-15">2023-05-15</option>
            </select>
          </div>

          {/* Test Connection Button */}
          <div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testingConnection ? 'Testing connection...' : 'Test Connection'}
            </button>
            {connectionTestResult && (
              <div className={`mt-2 p-2 rounded-lg text-sm ${
                connectionTestResult.success 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {connectionTestResult.message}
              </div>
            )}
          </div>
        </>
      )}

      {/* Google Cloud Vertex AI Configuration */}
      {provider.id === 'vertex' && (
        <>
          {/* Authentication Method Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Authentication Method
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setVertexAuthMethod('apiKey')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  vertexAuthMethod === 'apiKey' 
                    ? 'bg-legal-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                API Key
              </button>
              <button
                type="button"
                onClick={() => setVertexAuthMethod('serviceAccount')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  vertexAuthMethod === 'serviceAccount' 
                    ? 'bg-legal-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Service Account
              </button>
            </div>
          </div>

          {/* Project ID */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project ID
            </label>
            <input
              type="text"
              required
              placeholder="my-gcp-project"
              value={config.gcpProjectId || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, gcpProjectId: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Your Google Cloud project ID
            </p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Location
            </label>
            <select
              value={config.gcpLocation || 'us-central1'}
              onChange={(e) => setConfig(prev => ({ ...prev, gcpLocation: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-legal-500"
            >
              <option value="us-central1">US Central (Iowa)</option>
              <option value="us-east1">US East (South Carolina)</option>
              <option value="us-west1">US West (Oregon)</option>
              <option value="europe-west4">Europe (Netherlands)</option>
              <option value="asia-southeast1">Asia (Singapore)</option>
              <option value="asia-northeast1">Asia (Tokyo)</option>
            </select>
          </div>

          {/* API Key Method */}
          {vertexAuthMethod === 'apiKey' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key
              </label>
              <input
                type="password"
                required
                placeholder="Enter your Google Cloud API key"
                value={config.apiKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
              />
            </div>
          )}

          {/* Service Account Method */}
          {vertexAuthMethod === 'serviceAccount' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Service Account Key (JSON)
              </label>
              <textarea
                required
                placeholder='Paste your service account JSON key here...'
                value={typeof config.gcpServiceAccountKey === 'string' ? config.gcpServiceAccountKey : JSON.stringify(config.gcpServiceAccountKey || {})}
                onChange={(e) => setConfig(prev => ({ ...prev, gcpServiceAccountKey: e.target.value }))}
                rows={6}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500 font-mono text-xs"
              />
              <p className="text-xs text-gray-500 mt-1">
                Download from GCP Console → IAM & Admin → Service Accounts
              </p>
            </div>
          )}

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Default Model
            </label>
            <select
              value={config.model || 'gemini-1.5-pro'}
              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-legal-500"
            >
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
            </select>
          </div>

          {/* Test Connection Button */}
          <div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testingConnection ? 'Testing connection...' : 'Test Connection'}
            </button>
            {connectionTestResult && (
              <div className={`mt-2 p-2 rounded-lg text-sm ${
                connectionTestResult.success 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {connectionTestResult.message}
              </div>
            )}
          </div>
        </>
      )}

      {/* API Key Input for Other Cloud Providers */}
      {provider.type === 'cloud' && provider.id !== 'bedrock' && provider.id !== 'azure' && provider.id !== 'vertex' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            API Key
          </label>
          <input
            type="password"
            required
            placeholder={`Ingrese su API key de ${provider.name}`}
            value={config.apiKey || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
          />
          {provider.documentation && (
            <p className="text-xs text-gray-500 mt-1">
              <a href={provider.documentation} target="_blank" rel="noopener noreferrer" className="text-legal-400 hover:text-legal-300">
                ¿Dónde obtener una API key?
              </a>
            </p>
          )}
        </div>
      )}

      {/* Endpoint for Local Providers (except WebLLM) */}
      {provider.type === 'local' && provider.id !== 'webllm' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Endpoint URL
            </label>
            <input
              type="url"
              required
              placeholder={provider.id === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}
              value={config.endpoint || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
            />
            {provider.id === 'openai-compatible' && (
              <p className="text-xs text-gray-500 mt-1">
                Compatible con LM Studio, vLLM, FastChat, y otros servidores OpenAI-compatible
              </p>
            )}
          </div>
          
          {/* Optional API Key for secured local instances */}
          {(provider.id === 'ollama' || provider.id === 'openai-compatible') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key (Opcional)
              </label>
              <input
                type="password"
                placeholder="Para instancias seguras con autenticación"
                value={config.apiKey || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Solo necesario si su servidor requiere autenticación Bearer token
              </p>
            </div>
          )}
        </>
      )}

      {/* Model Selection (not for Bedrock, Azure, or Vertex as they have their own) */}
      {showModelSelection && models.length > 0 && provider.id !== 'bedrock' && provider.id !== 'azure' && provider.id !== 'vertex' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Modelo Predeterminado
          </label>
          <select
            value={config.model || ''}
            onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-legal-500"
          >
            <option value="">Seleccionar modelo...</option>
            {models.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Advanced Settings */}
      <details className="group">
        <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300">
          Configuración Avanzada
        </summary>
        <div className="mt-4 space-y-4">
          {/* Custom Model ID for Bedrock */}
          {provider.id === 'bedrock' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ID de Modelo Personalizado
              </label>
              <input
                type="text"
                placeholder="Por ejemplo: anthropic.claude-3-opus-20240229-v1:0"
                value={config.model || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-legal-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ingrese un ID de modelo específico si no está en la lista predeterminada
              </p>
            </div>
          )}
          
          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Temperatura: {config.temperature?.toFixed(2) || '0.10'}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.temperature || 0.1}
              onChange={(e) => setConfig(prev => ({ ...prev, temperature: Number(e.target.value) }))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Valores más bajos = respuestas más consistentes
            </p>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Máximo de Tokens
            </label>
            <input
              type="number"
              min="100"
              max="32000"
              value={config.maxTokens || 4000}
              onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: Number(e.target.value) }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100"
            />
          </div>

          {/* Cost Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Límite Diario ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={config.costLimit?.daily || 10}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  costLimit: { 
                    daily: Number(e.target.value),
                    monthly: prev.costLimit?.monthly || 200
                  } 
                }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Límite Mensual ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={config.costLimit?.monthly || 200}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  costLimit: { 
                    daily: prev.costLimit?.daily || 10,
                    monthly: Number(e.target.value)
                  } 
                }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100"
              />
            </div>
          </div>
        </div>
      </details>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || (
            provider.type === 'cloud' && provider.id !== 'bedrock' && provider.id !== 'azure' && provider.id !== 'vertex' && !config.apiKey
          ) || (
            provider.id === 'bedrock' && (
              bedrockAuthMethod === 'apiKey' ? !config.apiKey : (!config.accessKeyId || !config.secretAccessKey)
            )
          ) || (
            provider.id === 'azure' && (
              !config.azureResourceName || !config.azureDeploymentName || 
              (azureAuthMethod === 'apiKey' ? !config.apiKey : (!config.azureTenantId || !config.azureClientId || !config.azureClientSecret))
            )
          ) || (
            provider.id === 'vertex' && (
              !config.gcpProjectId || 
              (vertexAuthMethod === 'apiKey' ? !config.apiKey : !config.gcpServiceAccountKey)
            )
          )}
          className="flex-1 px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </form>
  );
}