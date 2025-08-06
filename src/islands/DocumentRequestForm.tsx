import { useState, useEffect, useCallback } from 'react';
import type { 
  DocumentRequest, 
  DocumentSource, 
  DocumentType, 
  LegalArea, 
  LegalHierarchy,
  SmartFormState,
  DocumentSuggestion,
  DuplicateDetectionResult,
  OfficialSourceValidation,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE 
} from '../types/legal';
import { 
  REQUEST_VOTE_THRESHOLDS, 
  OFFICIAL_SOURCES, 
  LEGAL_HIERARCHY 
} from '../types/legal';

interface DocumentRequestFormProps {
  onSubmit: (request: Partial<DocumentRequest>) => Promise<void>;
  onSuggestionsUpdate?: (suggestions: DocumentSuggestion[]) => void;
}

export default function DocumentRequestForm({ onSubmit, onSuggestionsUpdate }: DocumentRequestFormProps) {
  const [formState, setFormState] = useState<SmartFormState>({
    title: '',
    description: '',
    suggestions: [],
    duplicateCheck: null,
    validationResults: [],
    isValidating: false
  });

  const [sources, setSources] = useState<Partial<DocumentSource>[]>([{
    type: 'url',
    verified: false,
    isOfficial: false
  }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Debounced search for suggestions and duplicate detection
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const debouncedSearch = useCallback((title: string, description: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(async () => {
      if (title.length < 3) return;

      setFormState(prev => ({ ...prev, isValidating: true }));

      try {
        // Simulate API calls for suggestions and duplicate detection
        const [suggestions, duplicateCheck] = await Promise.all([
          searchDocumentSuggestions(title, description),
          checkForDuplicates(title, description)
        ]);

        setFormState(prev => ({
          ...prev,
          suggestions,
          duplicateCheck,
          isValidating: false
        }));

        if (onSuggestionsUpdate) {
          onSuggestionsUpdate(suggestions);
        }
      } catch (error) {
        console.error('Error during smart search:', error);
        setFormState(prev => ({ ...prev, isValidating: false }));
      }
    }, 500);

    setSearchTimeout(timeout);
  }, [searchTimeout, onSuggestionsUpdate]);

  // Handle form field changes
  const handleFieldChange = (field: keyof SmartFormState, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    
    if (field === 'title' || field === 'description') {
      debouncedSearch(
        field === 'title' ? value : formState.title,
        field === 'description' ? value : formState.description
      );
    }
  };

  // Handle source changes
  const handleSourceChange = (index: number, field: keyof DocumentSource, value: any) => {
    setSources(prev => {
      const newSources = [...prev];
      newSources[index] = { ...newSources[index], [field]: value };

      // Auto-validate URLs
      if (field === 'url' && value) {
        validateSourceUrl(value, index);
      }

      return newSources;
    });
  };

  const addSource = () => {
    setSources(prev => [...prev, {
      type: 'url',
      verified: false,
      isOfficial: false
    }]);
  };

  const removeSource = (index: number) => {
    setSources(prev => prev.filter((_, i) => i !== index));
  };

  // File upload handler
  const handleFileUpload = async (index: number, file: File) => {
    if (!validateFile(file)) return;

    const source: Partial<DocumentSource> = {
      type: 'pdf_upload',
      filename: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: new Date().toISOString(),
      verified: false,
      isOfficial: false
    };

    setSources(prev => {
      const newSources = [...prev];
      newSources[index] = source;
      return newSources;
    });
  };

  const validateFile = (file: File): boolean => {
    const fileType = file.name.split('.').pop()?.toLowerCase();
    
    if (!fileType || !ALLOWED_FILE_TYPES.includes(fileType as any)) {
      setErrors(prev => ({ ...prev, file: `Tipo de archivo no permitido. Tipos válidos: ${ALLOWED_FILE_TYPES.join(', ')}` }));
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors(prev => ({ ...prev, file: 'El archivo es demasiado grande. Máximo 50MB.' }));
      return false;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.file;
      return newErrors;
    });

    return true;
  };

  const validateSourceUrl = async (url: string, index: number) => {
    try {
      const validation = await validateOfficialSource(url);
      
      setSources(prev => {
        const newSources = [...prev];
        newSources[index] = {
          ...newSources[index],
          verified: validation.isValid,
          isOfficial: validation.isValid && validation.confidence > 0.8,
          metadata: validation.metadata
        };
        return newSources;
      });

      setFormState(prev => ({
        ...prev,
        validationResults: [...prev.validationResults.filter((_, i) => i !== index), validation]
      }));
    } catch (error) {
      console.error('Error validating source:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const request: Partial<DocumentRequest> = {
        title: formState.title,
        description: formState.description,
        type: formState.type,
        hierarchy: inferHierarchy(formState.type),
        primaryArea: formState.area,
        secondaryAreas: [],
        territorialScope: inferTerritorialScope(formState.authority),
        authority: formState.authority,
        sources: sources as DocumentSource[],
        votes: 0,
        voters: [],
        comments: [],
        priority: 'medium',
        status: 'pending',
        verified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSubmit(request);
      
      // Reset form
      setFormState({
        title: '',
        description: '',
        suggestions: [],
        duplicateCheck: null,
        validationResults: [],
        isValidating: false
      });
      setSources([{ type: 'url', verified: false, isOfficial: false }]);
      
    } catch (error) {
      console.error('Error submitting request:', error);
      setErrors({ submit: 'Error al enviar la solicitud. Inténtalo de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formState.title.trim()) {
      newErrors.title = 'El título es requerido';
    } else if (formState.title.length < 10) {
      newErrors.title = 'El título debe tener al menos 10 caracteres';
    }

    if (!formState.description.trim()) {
      newErrors.description = 'La descripción es requerida';
    } else if (formState.description.length < 50) {
      newErrors.description = 'La descripción debe tener al menos 50 caracteres';
    }

    if (!formState.type) {
      newErrors.type = 'El tipo de documento es requerido';
    }

    if (!formState.area) {
      newErrors.area = 'El área legal es requerida';
    }

    if (sources.length === 0 || !sources.some(s => s.url || s.filename)) {
      newErrors.sources = 'Debe proporcionar al menos una fuente';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const inferHierarchy = (type?: DocumentType): LegalHierarchy => {
    switch (type) {
      case 'constitution': return 1;
      case 'treaty': return 2;
      case 'law':
      case 'code': return 3;
      case 'regulation': return 4;
      case 'norm': return 5;
      case 'format': return 7;
      default: return 3;
    }
  };

  const inferTerritorialScope = (authority?: string): 'national' | 'federal' | 'state' | 'municipal' => {
    if (!authority) return 'federal';
    
    const lowerAuthority = authority.toLowerCase();
    if (lowerAuthority.includes('municipal')) return 'municipal';
    if (lowerAuthority.includes('estado') || lowerAuthority.includes('estatal')) return 'state';
    if (lowerAuthority.includes('nacional')) return 'national';
    return 'federal';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Solicitar Nuevo Documento Legal
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Ayúdanos a expandir el corpus legal de LexMX solicitando documentos importantes que falten.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Field with Smart Suggestions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Título del Documento *
          </label>
          <div className="relative">
            <input
              type="text"
              value={formState.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
              placeholder="Ej: Ley Federal de Protección de Datos Personales"
            />
            {formState.isValidating && (
              <div className="absolute right-3 top-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-legal-500"></div>
              </div>
            )}
          </div>
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          
          {/* Smart Suggestions */}
          {formState.suggestions.length > 0 && (
            <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-md p-3">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Documentos similares encontrados:
              </p>
              <ul className="space-y-1">
                {formState.suggestions.slice(0, 3).map((suggestion, index) => (
                  <li key={index} className="text-sm text-blue-700 dark:text-blue-300">
                    <span className="font-medium">{suggestion.title}</span>
                    <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                      ({suggestion.authority})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Duplicate Warning */}
          {formState.duplicateCheck?.isDuplicate && (
            <div className="mt-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-3">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ Posible duplicado detectado
              </p>
              <ul className="space-y-1">
                {formState.duplicateCheck.matchingDocuments.slice(0, 2).map((match, index) => (
                  <li key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                    <span className="font-medium">{match.title}</span>
                    <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-2">
                      ({Math.round(match.similarity * 100)}% similar)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Descripción *
          </label>
          <textarea
            value={formState.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
            placeholder="Describe por qué es importante este documento y cómo beneficiaría a la comunidad legal..."
          />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
          <p className="mt-1 text-xs text-gray-500">
            {formState.description.length}/500 caracteres mínimos: 50
          </p>
        </div>

        {/* Document Classification */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Documento *
            </label>
            <select
              value={formState.type || ''}
              onChange={(e) => handleFieldChange('type', e.target.value as DocumentType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Seleccionar tipo</option>
              <option value="constitution">Constitución</option>
              <option value="law">Ley</option>
              <option value="code">Código</option>
              <option value="regulation">Reglamento</option>
              <option value="norm">Norma Oficial (NOM)</option>
              <option value="jurisprudence">Jurisprudencia</option>
              <option value="treaty">Tratado Internacional</option>
              <option value="format">Formato Administrativo</option>
            </select>
            {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Área Legal *
            </label>
            <select
              value={formState.area || ''}
              onChange={(e) => handleFieldChange('area', e.target.value as LegalArea)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Seleccionar área</option>
              <option value="constitutional">Constitucional</option>
              <option value="civil">Civil</option>
              <option value="criminal">Penal</option>
              <option value="labor">Laboral</option>
              <option value="tax">Fiscal</option>
              <option value="commercial">Mercantil</option>
              <option value="administrative">Administrativo</option>
              <option value="environmental">Ambiental</option>
              <option value="family">Familiar</option>
              <option value="property">Inmobiliario</option>
              <option value="migration">Migratorio</option>
              <option value="human-rights">Derechos Humanos</option>
            </select>
            {errors.area && <p className="mt-1 text-sm text-red-600">{errors.area}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Autoridad Emisora
            </label>
            <input
              type="text"
              value={formState.authority || ''}
              onChange={(e) => handleFieldChange('authority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
              placeholder="Ej: Congreso de la Unión"
            />
          </div>
        </div>

        {/* Sources Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Fuentes del Documento *
            </label>
            <button
              type="button"
              onClick={addSource}
              className="text-sm text-legal-600 hover:text-legal-700 dark:text-legal-400"
            >
              + Agregar Fuente
            </button>
          </div>

          {sources.map((source, index) => (
            <div key={index} className="mb-4 p-4 border border-gray-200 dark:border-gray-600 rounded-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`source-type-${index}`}
                      checked={source.type === 'url'}
                      onChange={() => handleSourceChange(index, 'type', 'url')}
                      className="mr-2"
                    />
                    URL Oficial
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`source-type-${index}`}
                      checked={source.type === 'pdf_upload'}
                      onChange={() => handleSourceChange(index, 'type', 'pdf_upload')}
                      className="mr-2"
                    />
                    Subir Archivo
                  </label>
                </div>
                {sources.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSource(index)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Eliminar
                  </button>
                )}
              </div>

              {source.type === 'url' ? (
                <div>
                  <input
                    type="url"
                    value={source.url || ''}
                    onChange={(e) => handleSourceChange(index, 'url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
                    placeholder="https://ejemplo.gob.mx/documento.pdf"
                  />
                  {source.verified && (
                    <div className="mt-2 flex items-center text-sm">
                      {source.isOfficial ? (
                        <span className="text-green-600 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Fuente oficial verificada
                        </span>
                      ) : (
                        <span className="text-yellow-600">⚠️ Fuente no oficial</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(index, file);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-legal-500 dark:bg-gray-700 dark:text-white"
                  />
                  {source.filename && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Archivo: {source.filename} ({Math.round((source.fileSize || 0) / 1024)} KB)
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {errors.sources && <p className="mt-1 text-sm text-red-600">{errors.sources}</p>}
          {errors.file && <p className="mt-1 text-sm text-red-600">{errors.file}</p>}
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-600">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>Tu solicitud será revisada por la comunidad y moderadores.</p>
            <p>Las solicitudes con más votos tienen mayor prioridad.</p>
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting || formState.duplicateCheck?.isDuplicate}
            className="px-6 py-3 bg-legal-600 text-white rounded-md hover:bg-legal-700 focus:outline-none focus:ring-2 focus:ring-legal-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </div>
        
        {errors.submit && (
          <p className="text-sm text-red-600 text-center">{errors.submit}</p>
        )}
      </form>
    </div>
  );
}

// Mock API functions (to be replaced with real implementations)
async function searchDocumentSuggestions(title: string, description: string): Promise<DocumentSuggestion[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Mock suggestions based on title keywords
  const mockSuggestions: DocumentSuggestion[] = [];
  
  if (title.toLowerCase().includes('datos')) {
    mockSuggestions.push({
      title: 'Ley Federal de Protección de Datos Personales en Posesión de los Particulares',
      type: 'law',
      authority: 'Congreso de la Unión',
      relevance: 0.95,
      source: 'existing_corpus'
    });
  }
  
  if (title.toLowerCase().includes('trabajo')) {
    mockSuggestions.push({
      title: 'Ley Federal del Trabajo',
      type: 'law',
      authority: 'Congreso de la Unión',
      relevance: 0.88,
      source: 'existing_corpus'
    });
  }
  
  return mockSuggestions;
}

async function checkForDuplicates(title: string, description: string): Promise<DuplicateDetectionResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 400));
  
  // Mock duplicate detection
  const titleLower = title.toLowerCase();
  const isDuplicate = titleLower.includes('constitución política') || titleLower.includes('código civil');
  
  return {
    isDuplicate,
    confidence: isDuplicate ? 0.92 : 0.12,
    matchingDocuments: isDuplicate ? [{
      id: 'existing-doc-1',
      title: 'Constitución Política de los Estados Unidos Mexicanos',
      similarity: 0.92,
      type: 'existing_document'
    }] : [],
    suggestions: isDuplicate ? ['Considera ser más específico sobre qué artículos o reformas te interesan'] : []
  };
}

async function validateOfficialSource(url: string): Promise<OfficialSourceValidation> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    const isOfficial = OFFICIAL_SOURCES.some(officialDomain => 
      domain.includes(officialDomain)
    );
    
    return {
      isValid: true,
      authority: isOfficial ? 'Autoridad Federal' : undefined,
      confidence: isOfficial ? 0.95 : 0.3,
      warnings: isOfficial ? [] : ['La fuente no parece ser oficial'],
      metadata: {
        publicationDate: '2024-01-01',
        documentNumber: 'DOF-2024-001'
      }
    };
  } catch {
    return {
      isValid: false,
      confidence: 0,
      warnings: ['URL inválida'],
    };
  }
}