import React, { useState } from 'react';
import type { LegalDocument } from '../../types/legal';
import { LEGAL_HIERARCHY } from '../../types/legal';

interface DocumentMetadataViewProps {
  document: LegalDocument;
}

export function DocumentMetadataView({ document }: DocumentMetadataViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible';
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'repealed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getUpdateFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'very-high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const MetadataSection = ({ 
    id, 
    title, 
    icon, 
    children 
  }: { 
    id: string; 
    title: string; 
    icon: React.ReactNode; 
    children: React.ReactNode; 
  }) => {
    const isExpanded = expandedSections.has(id);
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-3">
            {icon}
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {title}
            </h3>
          </div>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isExpanded && (
          <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
            {children}
          </div>
        )}
      </div>
    );
  };

  const MetadataField = ({ 
    label, 
    value, 
    type = 'text' 
  }: { 
    label: string; 
    value: string | string[] | Date | null | undefined; 
    type?: 'text' | 'date' | 'badge' | 'list' | 'link'; 
  }) => (
    <div className="py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </dt>
      <dd className="text-sm text-gray-900 dark:text-white">
        {type === 'date' && formatDate(value)}
        {type === 'text' && (value || 'No especificado')}
        {type === 'badge' && value && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            label.includes('Estado') ? getStatusColor(value) :
            label.includes('Importancia') ? getImportanceColor(value) :
            label.includes('Frecuencia') ? getUpdateFrequencyColor(value) :
            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {value}
          </span>
        )}
        {type === 'list' && Array.isArray(value) && (
          <ul className="space-y-1">
            {value.map((item, index) => (
              <li key={index} className="text-sm">• {item}</li>
            ))}
          </ul>
        )}
        {type === 'link' && value && (
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-legal-600 dark:text-legal-400 hover:text-legal-800 dark:hover:text-legal-200 flex items-center"
          >
            {value}
            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </dd>
    </div>
  );

  // Calculate content statistics
  const contentStats = document.content ? {
    total: document.content.length,
    byType: document.content.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    totalChars: document.content.reduce((acc, item) => acc + item.content.length, 0),
    avgChars: Math.round(document.content.reduce((acc, item) => acc + item.content.length, 0) / document.content.length)
  } : null;

  return (
    <div className="space-y-6">
      {/* Document Header */}
      <div className="bg-gradient-to-r from-legal-50 to-blue-50 dark:from-legal-900/20 dark:to-blue-900/20 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-legal-100 dark:bg-legal-800 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-legal-600 dark:text-legal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Metadatos del Documento
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Información completa y linaje del documento legal
              </p>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            <button className="px-4 py-2 bg-legal-500 text-white rounded-lg hover:bg-legal-600 transition-colors text-sm">
              Exportar metadatos
            </button>
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-legal-600 dark:text-legal-400">
              {document.hierarchy}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Nivel jerárquico</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {contentStats?.total || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Secciones</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {document.secondaryAreas?.length || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Áreas legales</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {document.relatedDependencies?.length || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">Dependencias</p>
          </div>
        </div>
      </div>

      {/* Metadata Sections */}
      <div className="space-y-4">
        {/* Basic Information */}
        <MetadataSection
          id="basic"
          title="Información Básica"
          icon={
            <svg className="w-5 h-5 text-legal-600 dark:text-legal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
            <MetadataField label="ID del documento" value={document.id} />
            <MetadataField label="Título completo" value={document.title} />
            <MetadataField label="Título corto" value={document.shortTitle} />
            <MetadataField label="Tipo de documento" value={document.type} type="badge" />
            <MetadataField label="Jerarquía legal" value={`Nivel ${document.hierarchy} - ${LEGAL_HIERARCHY[document.hierarchy]}`} />
            <MetadataField label="Estado" value={document.status} type="badge" />
          </dl>
        </MetadataSection>

        {/* Legal Classification */}
        <MetadataSection
          id="classification"
          title="Clasificación Legal"
          icon={
            <svg className="w-5 h-5 text-legal-600 dark:text-legal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        >
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
            <MetadataField label="Área legal principal" value={document.primaryArea} type="badge" />
            <MetadataField label="Áreas secundarias" value={document.secondaryAreas} type="list" />
            <MetadataField label="Ámbito territorial" value={document.territorialScope} type="badge" />
            <MetadataField label="Aplicabilidad" value={document.applicability} />
            <MetadataField label="Importancia" value={document.importance} type="badge" />
          </dl>
        </MetadataSection>

        {/* Publication and Updates */}
        <MetadataSection
          id="publication"
          title="Publicación y Actualizaciones"
          icon={
            <svg className="w-5 h-5 text-legal-600 dark:text-legal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        >
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
            <MetadataField label="Autoridad emisora" value={document.authority} />
            <MetadataField label="Fecha de publicación" value={document.publicationDate} type="date" />
            <MetadataField label="Última reforma" value={document.lastReform} type="date" />
            <MetadataField label="Frecuencia de actualización" value={document.updateFrequency} type="badge" />
          </dl>
        </MetadataSection>

        {/* Content Analysis */}
        {contentStats && (
          <MetadataSection
            id="content"
            title="Análisis de Contenido"
            icon={
              <svg className="w-5 h-5 text-legal-600 dark:text-legal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
              </svg>
            }
          >
            <dl className="divide-y divide-gray-100 dark:divide-gray-700">
              <MetadataField label="Total de secciones" value={contentStats.total} />
              <MetadataField label="Total de caracteres" value={contentStats.totalChars.toLocaleString()} />
              <MetadataField label="Promedio de caracteres por sección" value={contentStats.avgChars.toLocaleString()} />
              <div className="py-3">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Distribución por tipo
                </dt>
                <dd className="space-y-2">
                  {Object.entries(contentStats.byType).map(([type, count]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300 capitalize">{type}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                    </div>
                  ))}
                </dd>
              </div>
            </dl>
          </MetadataSection>
        )}

        {/* Relationships */}
        <MetadataSection
          id="relationships"
          title="Relaciones y Dependencias"
          icon={
            <svg className="w-5 h-5 text-legal-600 dark:text-legal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          }
        >
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
            <MetadataField label="Documentos relacionados" value={document.relatedDependencies} type="list" />
            <MetadataField label="URL oficial" value={document.officialUrl} type="link" />
          </dl>
        </MetadataSection>

        {/* Technical Information */}
        <MetadataSection
          id="technical"
          title="Información Técnica"
          icon={
            <svg className="w-5 h-5 text-legal-600 dark:text-legal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        >
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
            <MetadataField label="Formato de archivo" value="JSON estructurado" />
            <MetadataField label="Codificación" value="UTF-8" />
            <MetadataField label="Versión del esquema" value="1.0" />
            <MetadataField label="Procesado para RAG" value="Sí" type="badge" />
            <MetadataField label="Embeddings generados" value={document.content?.some(c => c.embedding) ? "Sí" : "No"} type="badge" />
          </dl>
        </MetadataSection>
      </div>
    </div>
  );
}