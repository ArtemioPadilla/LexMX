import React, { useState } from 'react';
import type { LegalDocument } from '../../types/legal';
import type { DocumentContentArray } from '../../types/common';

interface DocumentExportProps {
  document: LegalDocument;
  currentView: string;
  currentSection?: string | null;
}

export function DocumentExport({ document, currentView, currentSection }: DocumentExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Export formats configuration
  const exportFormats = [
    {
      id: 'pdf',
      name: 'PDF',
      description: 'Documento completo en formato PDF',
      icon: '📄',
      mimeType: 'application/pdf'
    },
    {
      id: 'docx',
      name: 'Word (DOCX)',
      description: 'Documento editable de Microsoft Word',
      icon: '📝',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    },
    {
      id: 'txt',
      name: 'Texto plano',
      description: 'Contenido en formato de texto simple',
      icon: '📃',
      mimeType: 'text/plain'
    },
    {
      id: 'json',
      name: 'JSON estructurado',
      description: 'Datos completos en formato JSON',
      icon: '🔧',
      mimeType: 'application/json'
    },
    {
      id: 'html',
      name: 'HTML',
      description: 'Página web con formato y estilos',
      icon: '🌐',
      mimeType: 'text/html'
    },
    {
      id: 'markdown',
      name: 'Markdown',
      description: 'Formato de texto con marcado simple',
      icon: '📋',
      mimeType: 'text/markdown'
    }
  ];

  // Generate filename based on document and options
  const generateFilename = (format: string, section?: string) => {
    const baseFilename = document.id.replace(/[^a-zA-Z0-9]/g, '_');
    const sectionSuffix = section ? `_seccion_${section}` : '';
    const timestamp = new Date().toISOString().split('T')[0];
    
    return `${baseFilename}${sectionSuffix}_${timestamp}.${format}`;
  };

  // Export to different formats
  const exportDocument = async (format: string) => {
    setIsExporting(true);
    setShowDropdown(false);

    try {
      let content: string;
      let mimeType: string;
      
      // Filter content based on current section if applicable
      const contentToExport = currentSection 
        ? document.content?.filter(c => c.id === currentSection || c.parent === currentSection)
        : document.content;

      switch (format) {
        case 'txt':
          content = generateTextContent(contentToExport || []);
          mimeType = 'text/plain';
          break;
        
        case 'json':
          content = JSON.stringify({
            ...document,
            content: contentToExport,
            exportInfo: {
              exportedAt: new Date().toISOString(),
              exportedView: currentView,
              exportedSection: currentSection,
              exportedBy: 'LexMX Document Viewer'
            }
          }, null, 2);
          mimeType = 'application/json';
          break;
        
        case 'html':
          content = generateHTMLContent(document, contentToExport || []);
          mimeType = 'text/html';
          break;
        
        case 'markdown':
          content = generateMarkdownContent(document, contentToExport || []);
          mimeType = 'text/markdown';
          break;
        
        case 'pdf':
          await exportToPDF(document, contentToExport || []);
          return;
        
        case 'docx':
          await exportToDocx(document, contentToExport || []);
          return;
        
        default:
          throw new Error(`Formato no soportado: ${format}`);
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateFilename(format, currentSection || undefined);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export error:', error);
      alert('Error al exportar el documento. Por favor, intenta de nuevo.');
    } finally {
      setIsExporting(false);
    }
  };

  // Generate plain text content
  const generateTextContent = (content: DocumentContentArray): string => {
    let text = `${document.title}\n`;
    text += `${'='.repeat(document.title.length)}\n\n`;
    
    if (document.shortTitle) {
      text += `${document.shortTitle}\n\n`;
    }
    
    text += `Tipo: ${document.type}\n`;
    text += `Jerarquía: Nivel ${document.hierarchy}\n`;
    text += `Área legal: ${document.primaryArea}\n`;
    text += `Estado: ${document.status}\n`;
    
    if (document.lastReform) {
      text += `Última reforma: ${new Date(document.lastReform).toLocaleDateString('es-MX')}\n`;
    }
    
    text += `\nExportado desde LexMX el ${new Date().toLocaleDateString('es-MX')}\n`;
    text += `${'='.repeat(50)}\n\n`;

    content.forEach(item => {
      switch (item.type) {
        case 'title':
          text += `\n${item.number ? `${item.number}. ` : ''}${item.title || 'TÍTULO'}\n`;
          text += `${'-'.repeat(40)}\n`;
          if (item.content) text += `${item.content}\n`;
          break;
        
        case 'chapter':
          text += `\nCAPÍTULO ${item.number || ''} ${item.title || ''}\n`;
          text += `${'-'.repeat(30)}\n`;
          if (item.content) text += `${item.content}\n`;
          break;
        
        case 'section':
          text += `\nSección ${item.number || ''} ${item.title || ''}\n`;
          if (item.content) text += `${item.content}\n`;
          break;
        
        case 'article':
          text += `\nArtículo ${item.number || ''}${item.title ? ` - ${item.title}` : ''}\n`;
          text += `${item.content}\n`;
          break;
        
        case 'paragraph':
          text += `${item.number ? `${item.number}. ` : ''}${item.content}\n`;
          break;
        
        case 'fraction':
          text += `  ${item.number ? `${item.number}) ` : ''}${item.content}\n`;
          break;
        
        default:
          if (item.content) text += `${item.content}\n`;
      }
    });

    return text;
  };

  // Generate HTML content
  const generateHTMLContent = (doc: LegalDocument, content: DocumentContentArray): string => {
    let html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${doc.title}</title>
    <style>
        body { font-family: 'Times New Roman', serif; line-height: 1.6; margin: 2rem; }
        .header { border-bottom: 2px solid #333; padding-bottom: 1rem; margin-bottom: 2rem; }
        .title { font-size: 1.8rem; font-weight: bold; text-align: center; margin-bottom: 0.5rem; }
        .subtitle { font-size: 1.2rem; text-align: center; color: #666; margin-bottom: 1rem; }
        .metadata { font-size: 0.9rem; color: #777; }
        .article { margin: 1.5rem 0; padding: 1rem; border-left: 4px solid #007acc; }
        .article-number { font-weight: bold; color: #007acc; }
        .article-title { font-weight: bold; margin-bottom: 0.5rem; }
        .chapter { font-size: 1.3rem; font-weight: bold; margin: 2rem 0 1rem 0; }
        .section { font-size: 1.1rem; font-weight: bold; margin: 1.5rem 0 0.5rem 0; }
        .paragraph { margin: 0.5rem 0; padding-left: 1rem; }
        .fraction { margin: 0.3rem 0; padding-left: 2rem; }
        .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 0.8rem; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${doc.title}</div>
        ${doc.shortTitle ? `<div class="subtitle">${doc.shortTitle}</div>` : ''}
        <div class="metadata">
            <p><strong>Tipo:</strong> ${doc.type} | <strong>Jerarquía:</strong> Nivel ${doc.hierarchy} | <strong>Estado:</strong> ${doc.status}</p>
            ${doc.lastReform ? `<p><strong>Última reforma:</strong> ${new Date(doc.lastReform).toLocaleDateString('es-MX')}</p>` : ''}
        </div>
    </div>
    <div class="content">`;

    content.forEach(item => {
      switch (item.type) {
        case 'title':
          html += `<h1>${item.number ? `${item.number}. ` : ''}${item.title || 'TÍTULO'}</h1>`;
          if (item.content) html += `<p>${item.content}</p>`;
          break;
        
        case 'chapter':
          html += `<h2 class="chapter">CAPÍTULO ${item.number || ''} ${item.title || ''}</h2>`;
          if (item.content) html += `<p>${item.content}</p>`;
          break;
        
        case 'section':
          html += `<h3 class="section">Sección ${item.number || ''} ${item.title || ''}</h3>`;
          if (item.content) html += `<p>${item.content}</p>`;
          break;
        
        case 'article':
          html += `<div class="article">
            <div class="article-number">Artículo ${item.number || ''}</div>
            ${item.title ? `<div class="article-title">${item.title}</div>` : ''}
            <div>${item.content}</div>
          </div>`;
          break;
        
        case 'paragraph':
          html += `<div class="paragraph">${item.number ? `${item.number}. ` : ''}${item.content}</div>`;
          break;
        
        case 'fraction':
          html += `<div class="fraction">${item.number ? `${item.number}) ` : ''}${item.content}</div>`;
          break;
        
        default:
          if (item.content) html += `<p>${item.content}</p>`;
      }
    });

    html += `</div>
    <div class="footer">
        <p>Documento exportado desde LexMX - Sistema Legal Mexicano</p>
        <p>Fecha de exportación: ${new Date().toLocaleDateString('es-MX')}</p>
        ${doc.officialUrl ? `<p>Fuente oficial: <a href="${doc.officialUrl}">${doc.officialUrl}</a></p>` : ''}
    </div>
</body>
</html>`;

    return html;
  };

  // Generate Markdown content
  const generateMarkdownContent = (doc: LegalDocument, content: DocumentContentArray): string => {
    let md = `# ${doc.title}\n\n`;
    
    if (doc.shortTitle) {
      md += `*${doc.shortTitle}*\n\n`;
    }
    
    md += `**Tipo:** ${doc.type} | **Jerarquía:** Nivel ${doc.hierarchy} | **Estado:** ${doc.status}\n\n`;
    
    if (doc.lastReform) {
      md += `**Última reforma:** ${new Date(doc.lastReform).toLocaleDateString('es-MX')}\n\n`;
    }
    
    md += `---\n\n`;

    content.forEach(item => {
      switch (item.type) {
        case 'title':
          md += `# ${item.number ? `${item.number}. ` : ''}${item.title || 'TÍTULO'}\n\n`;
          if (item.content) md += `${item.content}\n\n`;
          break;
        
        case 'chapter':
          md += `## CAPÍTULO ${item.number || ''} ${item.title || ''}\n\n`;
          if (item.content) md += `${item.content}\n\n`;
          break;
        
        case 'section':
          md += `### Sección ${item.number || ''} ${item.title || ''}\n\n`;
          if (item.content) md += `${item.content}\n\n`;
          break;
        
        case 'article':
          md += `#### Artículo ${item.number || ''}\n\n`;
          if (item.title) md += `**${item.title}**\n\n`;
          md += `${item.content}\n\n`;
          break;
        
        case 'paragraph':
          md += `${item.number ? `${item.number}. ` : ''}${item.content}\n\n`;
          break;
        
        case 'fraction':
          md += `   ${item.number ? `${item.number}) ` : ''}${item.content}\n\n`;
          break;
        
        default:
          if (item.content) md += `${item.content}\n\n`;
      }
    });

    md += `---\n\n`;
    md += `*Documento exportado desde LexMX el ${new Date().toLocaleDateString('es-MX')}*\n\n`;
    if (doc.officialUrl) {
      md += `[Ver fuente oficial](${doc.officialUrl})\n`;
    }

    return md;
  };

  // Export to PDF (simplified - in production use a proper PDF library)
  const exportToPDF = async (doc: LegalDocument, content: DocumentContentArray) => {
    // This would use a proper PDF generation library like jsPDF or Puppeteer
    // For now, we'll convert to HTML and let the browser handle PDF generation
    const htmlContent = generateHTMLContent(doc, content);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Export to DOCX (would require a proper library like docx.js)
  const exportToDocx = async (_doc: LegalDocument, _content: DocumentContentArray) => {
    // Fallback to HTML for now
    alert('La exportación a DOCX estará disponible próximamente. Usa HTML o PDF como alternativa.');
  };

  // Copy citation to clipboard
  const copyCitation = async () => {
    const citation = currentSection 
      ? `${document.title}, Artículo ${currentSection}`
      : document.title;
    
    try {
      await navigator.clipboard.writeText(citation);
      alert('Cita copiada al portapapeles');
    } catch (err) {
      console.error('Failed to copy citation:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = citation;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Cita copiada al portapapeles');
    }
  };

  return (
    <div className="relative">
      {/* Main Export Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isExporting}
        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-legal-500 disabled:opacity-50"
      >
        {isExporting ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Exportando...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Exportar documento
            </h3>
            {currentSection && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Solo sección actual: {currentSection}
              </p>
            )}
          </div>
          
          <div className="p-2 max-h-64 overflow-y-auto">
            {exportFormats.map((format) => (
              <button
                key={format.id}
                onClick={() => exportDocument(format.id)}
                className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{format.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {format.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {format.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={copyCitation}
              className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-3"
            >
              <svg className="w-4 h-4 text-legal-600 dark:text-legal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Copiar cita
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Copia la cita legal al portapapeles
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}