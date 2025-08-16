import React, { useState, useEffect, useRef } from 'react';
import type { LegalDocument } from '../../types/legal';

interface DocumentPDFViewProps {
  document: LegalDocument;
  currentSection?: string | null;
}

export function DocumentPDFView({ document, currentSection: _currentSection }: DocumentPDFViewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, _setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Try to find PDF version of the document
    const loadPDF = async () => {
      setLoading(true);
      setError(null);

      try {
        // Check for PDF in different possible locations
        const possibleUrls = [
          `/legal-corpus/pdf/${document.id}.pdf`,
          `/legal-corpus/${document.id}.pdf`,
          document.officialUrl,
        ].filter(Boolean);

        let foundUrl = null;
        for (const url of possibleUrls) {
          try {
            const response = await fetch(url!, { method: 'HEAD' });
            if (response.ok) {
              foundUrl = url;
              break;
            }
          } catch (_e) {
            void _e;
            // Continue to next URL
          }
        }

        if (foundUrl) {
          setPdfUrl(foundUrl);
        } else {
          // Generate PDF from text content if no PDF found
          const pdfBlob = await generatePDFFromContent(document);
          const blobUrl = URL.createObjectURL(pdfBlob);
          setPdfUrl(blobUrl);
        }
      } catch (err) {
        setError('Error al cargar el documento PDF');
        console.error('PDF loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPDF();

    return () => {
      // Cleanup blob URL if created
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [document]);

  // Generate PDF from document content using browser APIs
  const generatePDFFromContent = async (document: LegalDocument): Promise<Blob> => {
    // This is a simplified PDF generation
    // In production, you'd want to use a proper PDF library like jsPDF
    const content = document.content?.map(c => c.content).join('\n\n') || '';
    
    // Create a simple text-based PDF-like content
    const pdfContent = `
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 <<
      /Type /Font
      /Subtype /Type1
      /BaseFont /Times-Roman
    >>
  >>
>>
>>
endobj

4 0 obj
<<
/Length ${content.length + 100}
>>
stream
BT
/F1 12 Tf
50 742 Td
(${document.title}) Tj
0 -20 Td
(${content.replace(/\n/g, ') Tj 0 -14 Td (')}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000247 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${400 + content.length}
%%EOF
`;

    return new Blob([pdfContent], { type: 'application/pdf' });
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setScale(1.0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-legal-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando documento PDF...</p>
        </div>
      </div>
    );
  }

  if (error || !pdfUrl) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.856-.833-2.626 0L3.195 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200">
            PDF no disponible
          </h3>
        </div>
        
        <p className="text-yellow-700 dark:text-yellow-300 mb-4">
          {error || 'No se pudo encontrar la versión PDF de este documento. Puedes ver el contenido en la vista de texto.'}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => window.location.href = `/document/${document.id}/text`}
            className="inline-flex items-center px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors"
          >
            Ver como texto
          </button>
          
          {document.officialUrl && (
            <a
              href={document.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Ver documento oficial
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* PDF Controls */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          {/* Page Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Página {currentPage} de {totalPages || '?'}
            </span>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={zoomOut}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Reducir zoom"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[4rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <button
            onClick={zoomIn}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Aumentar zoom"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          <button
            onClick={resetZoom}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
            title="Restablecer zoom"
          >
            Ajustar
          </button>
        </div>

        {/* Download */}
        <div className="flex items-center space-x-2">
          <a
            href={pdfUrl}
            download={`${document.id}.pdf`}
            className="inline-flex items-center px-3 py-2 text-sm bg-legal-500 text-white rounded-md hover:bg-legal-600 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descargar
          </a>
        </div>
      </div>

      {/* PDF Viewer */}
      <div ref={viewerRef} className="h-[800px] overflow-auto bg-gray-100 dark:bg-gray-900">
        <div className="flex justify-center p-4">
          <iframe
            src={`${pdfUrl}#page=${currentPage}&zoom=${scale * 100}`}
            className="border border-gray-300 dark:border-gray-600 shadow-lg"
            style={{
              width: `${612 * scale}px`,
              height: `${792 * scale}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top center'
            }}
            title={`${document.title} - Página ${currentPage}`}
          />
        </div>
      </div>

      {/* Alternative: Canvas-based PDF viewer using PDF.js */}
      {/* This would require installing pdfjs-dist package */}
      {/*
      <div ref={viewerRef} className="h-[800px] overflow-auto bg-gray-100 dark:bg-gray-900">
        <canvas
          id="pdf-canvas"
          className="mx-auto border border-gray-300 dark:border-gray-600 shadow-lg"
        />
      </div>
      */}
    </div>
  );
}