import { useState, useEffect } from 'react';
import { DevData } from '../lib/dev/dev-data-generator';
import { checkLocalProxyStatus } from '../lib/utils/cors-aware-fetch';

interface ProxyStatus {
  running: boolean;
  url?: string;
  error?: string;
  allowedDomains?: string[];
}

/**
 * Development Dashboard Component
 * Only renders in development environment
 * Provides controls for development features and mock data
 */
export default function DevDashboard() {
  const [isOpen, setIsOpen] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [isCheckingProxy, setIsCheckingProxy] = useState(false);

  // Only render in development
  if (!DevData.isDev()) {
    return null;
  }

  useEffect(() => {
    // Load initial feature states
    setFeatures(DevData.getAllFeatures());

    // Listen for feature toggle events
    const handleFeatureToggle = (event: CustomEvent) => {
      setFeatures(prev => ({
        ...prev,
        [event.detail.feature]: event.detail.enabled
      }));
    };

    const handleFeaturesReset = () => {
      setFeatures(DevData.getAllFeatures());
    };

    window.addEventListener('devFeatureToggled', handleFeatureToggle as EventListener);
    window.addEventListener('devFeaturesReset', handleFeaturesReset as EventListener);

    return () => {
      window.removeEventListener('devFeatureToggled', handleFeatureToggle as EventListener);
      window.removeEventListener('devFeaturesReset', handleFeaturesReset as EventListener);
    };
  }, []);

  const checkProxy = async () => {
    setIsCheckingProxy(true);
    try {
      const status = await checkLocalProxyStatus();
      setProxyStatus(status);
    } catch (error) {
      setProxyStatus({
        running: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    setIsCheckingProxy(false);
  };

  useEffect(() => {
    // Check proxy status on mount
    checkProxy();
  }, []);

  const toggleFeature = (feature: string) => {
    DevData.toggleFeature(feature as any);
  };

  const resetAllFeatures = () => {
    if (confirm('¿Restablecer todas las funciones de desarrollo a sus valores por defecto?')) {
      DevData.resetFeatures();
    }
  };

  const generateMockData = async (type: string) => {
    switch (type) {
      case 'corpus':
        const corpusData = DevData.generateCorpusDocuments(10);
        console.log('Generated mock corpus data:', corpusData);
        alert('Datos de corpus generados. Revisa la consola para ver los detalles.');
        break;
      case 'quality':
        const qualityData = DevData.generateQualityMetrics();
        console.log('Generated mock quality data:', qualityData);
        alert('Métricas de calidad generadas. Revisa la consola para ver los detalles.');
        break;
      case 'cases':
        const casesData = DevData.generateCases(5);
        console.log('Generated mock cases data:', casesData);
        alert('Casos de ejemplo generados. Revisa la consola para ver los detalles.');
        break;
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-colors"
          title="Abrir Dashboard de Desarrollo"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-96 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50">
        <h3 className="text-lg font-semibold text-blue-900">🛠️ Dev Dashboard</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Proxy Status */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">CORS Proxy Status</h4>
            <button
              onClick={checkProxy}
              disabled={isCheckingProxy}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {isCheckingProxy ? '🔄' : '🔍'}
            </button>
          </div>
          
          {proxyStatus && (
            <div className={`text-sm p-2 rounded ${
              proxyStatus.running 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {proxyStatus.running ? (
                <div>
                  ✅ Proxy ejecutándose en {proxyStatus.url}
                  {proxyStatus.allowedDomains && (
                    <div className="mt-1 text-xs">
                      Dominios: {proxyStatus.allowedDomains.join(', ')}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  ❌ Proxy no disponible
                  <div className="text-xs mt-1">
                    Ejecuta: <code>npm run dev:proxy</code>
                  </div>
                  {proxyStatus.error && (
                    <div className="text-xs mt-1">Error: {proxyStatus.error}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mock Data Generators */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Mock Data Generators</h4>
          <div className="space-y-2">
            <button
              onClick={() => generateMockData('corpus')}
              className="w-full text-left px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded border text-sm"
            >
              📚 Generate Corpus Data (10 docs)
            </button>
            <button
              onClick={() => generateMockData('quality')}
              className="w-full text-left px-3 py-2 bg-green-50 hover:bg-green-100 rounded border text-sm"
            >
              📊 Generate Quality Metrics
            </button>
            <button
              onClick={() => generateMockData('cases')}
              className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border text-sm"
            >
              ⚖️ Generate Case Data (5 cases)
            </button>
          </div>
        </div>

        {/* Feature Toggles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Development Features</h4>
            <button
              onClick={resetAllFeatures}
              className="text-red-600 hover:text-red-800 text-xs"
            >
              Reset All
            </button>
          </div>
          
          <div className="space-y-2">
            {Object.entries(features).map(([feature, enabled]) => (
              <label key={feature} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleFeature(feature)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={enabled ? 'text-green-700' : 'text-gray-600'}>
                  {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Environment Info */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Environment Info</h4>
          <div className="text-xs space-y-1 text-gray-600">
            <div>Host: {window.location.hostname}</div>
            <div>Port: {window.location.port || '80'}</div>
            <div>Protocol: {window.location.protocol}</div>
            <div>Dev Mode: {import.meta.env.DEV ? '✅' : '❌'}</div>
            <div>Prod Mode: {import.meta.env.PROD ? '✅' : '❌'}</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
          <div className="space-y-2">
            <button
              onClick={() => {
                console.clear();
                console.log('🧹 Console cleared');
              }}
              className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded border text-sm"
            >
              🧹 Clear Console
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                alert('Storage cleared');
              }}
              className="w-full text-left px-3 py-2 bg-orange-50 hover:bg-orange-100 rounded border text-sm"
            >
              🗑️ Clear Storage
            </button>
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded border text-sm"
            >
              🔄 Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}