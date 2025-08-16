import React, { useState, useEffect } from 'react';
import { HydrationBoundary as _HydrationBoundary, LoadingStates as _LoadingStates } from '../components/HydrationBoundary';
import { TEST_IDS as _TEST_IDS } from '../utils/test-ids';
import DocumentViewer from './DocumentViewer';
import { DocumentLoader } from '../lib/legal/document-loader';
import type { LegalDocument } from '../types/legal';
import { useTranslation } from '../i18n';

interface DocumentViewerWrapperProps {
  documentId: string;
  documentTitle: string;
}

export default function DocumentViewerWrapper({ documentId, documentTitle }: DocumentViewerWrapperProps) {
  const { t } = useTranslation();
  const [isHydrated, setIsHydrated] = useState(false);
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true);
        const doc = await DocumentLoader.loadDocument(documentId);
        if (doc) {
          setDocument(doc);
        } else {
          setError(t('documentViewer.messages.notFound'));
        }
      } catch (err) {
        setError(t('documentViewer.messages.error'));
        console.error('Error loading document:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId]);

  if (loading) {
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <_HydrationBoundary 
        fallback={<_LoadingStates.DocumentViewerWrapper />} 
        testId="document-viewer-wrapper"
      />
    );
  }

  return (
    <div
      data-testid="document-viewer-wrapper" className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-legal-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('documentViewer.messages.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {error || t('documentViewer.messages.notFound')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('documentViewer.messages.documentNotAvailable', { title: documentTitle })}
          </p>
          <a href="/legal" className="text-legal-600 hover:text-legal-700 dark:text-legal-400 dark:hover:text-legal-300">
            {t('documentViewer.messages.viewAllDocuments')}
          </a>
        </div>
      </div>
    );
  }

  return <DocumentViewer document={document} />;
}