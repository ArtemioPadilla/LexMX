import { useState, useEffect } from 'react';
import { pwaManager, type PWAInstallationState } from '../lib/pwa/pwa-manager';
import { useTranslation } from '../i18n/index';

/**
 * PWA Installation Prompt Component
 * Shows installation prompts and handles PWA lifecycle
 */
export default function PWAInstallPrompt() {
  const [pwaState, setPwaState] = useState<PWAInstallationState | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Subscribe to PWA state changes
    const unsubscribe = pwaManager.onChange((state) => {
      setPwaState(state);
      setShowPrompt(pwaManager.shouldShowInstallPrompt());
    });

    // Listen for update available
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true);
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    return () => {
      unsubscribe();
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleInstall = async () => {
    if (!pwaState?.canInstall) {
      setShowInstructions(true);
      return;
    }

    setInstalling(true);
    try {
      const result = await pwaManager.promptInstall();
      if (result?.outcome === 'accepted') {
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Dismissed state is automatically tracked by PWAManager
  };

  const handleUpdate = async () => {
    try {
      await pwaManager.applyUpdate();
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const getInstallInstructions = () => {
    return pwaManager.getInstallInstructions();
  };

  // Don't render if no PWA state or already installed
  if (!pwaState || pwaState.isInstalled || pwaState.isStandalone) {
    return null;
  }

  // Update available notification
  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
        <div className="bg-blue-600 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {t('pwa.updateAvailable') || 'Actualización disponible'}
              </p>
              <p className="text-xs text-blue-100 mt-1">
                {t('pwa.updateDescription') || 'Nueva versión de LexMX disponible con mejoras y correcciones'}
              </p>
            </div>
          </div>
          <div className="flex space-x-2 mt-3">
            <button
              onClick={handleUpdate}
              className="flex-1 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium py-2 px-3 rounded"
            >
              {t('pwa.updateNow') || 'Actualizar'}
            </button>
            <button
              onClick={() => setUpdateAvailable(false)}
              className="text-blue-200 hover:text-white text-sm font-medium py-2 px-3"
            >
              {t('common.later') || 'Después'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Installation instructions modal
  if (showInstructions) {
    const instructions = getInstallInstructions();
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              ⚖️
            </div>
            <h3 className="text-lg font-semibold ml-3 text-gray-900 dark:text-white">
              {t('pwa.installInstructions') || 'Instalar LexMX'}
            </h3>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {t('pwa.installBenefits') || 'Instala LexMX como aplicación para acceso rápido y funcionalidad sin conexión.'}
          </p>
          
          <div className="space-y-2 mb-6">
            {instructions.instructions.map((instruction, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-legal-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {instruction}
                </p>
              </div>
            ))}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setShowInstructions(false)}
              className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white py-2 px-4 rounded-lg font-medium text-sm"
            >
              {t('common.close') || 'Cerrar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Installation prompt
  if (showPrompt) {
    const capabilities = pwaManager.getCapabilities();
    
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg shadow-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 text-2xl">
              ⚖️
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('pwa.installTitle') || 'Instalar LexMX'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {t('pwa.installSubtitle') || 'Acceso rápido y funcionalidad sin conexión'}
              </p>
              
              <div className="flex flex-wrap gap-2 mt-2">
                {capabilities.offline && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                    📴 {t('pwa.offline') || 'Sin conexión'}
                  </span>
                )}
                {capabilities.notifications && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                    🔔 {t('pwa.notifications') || 'Notificaciones'}
                  </span>
                )}
                {capabilities.shortcuts && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100">
                    🚀 {t('pwa.shortcuts') || 'Atajos'}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2 mt-4">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex-1 bg-legal-500 hover:bg-legal-600 disabled:bg-legal-300 text-white text-sm font-medium py-2 px-3 rounded flex items-center justify-center"
            >
              {installing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('pwa.installing') || 'Instalando...'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('pwa.install') || 'Instalar'}
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium py-2 px-3"
            >
              {t('common.dismiss') || 'Omitir'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}