import React, { useState, useEffect } from 'react';
import { HydrationBoundary as _HydrationBoundary, LoadingStates as _LoadingStates } from '../components/HydrationBoundary';
// import { TEST_IDS } from '../utils/test-ids';
import { useTranslation } from '../i18n/index';

interface ProcessStep {
  id: string;
  title: string;
  description: string;
  details: string[];
  duration: string;
  actors: string[];
  requirements?: string[];
}

const legislativeSteps: ProcessStep[] = [
  {
    id: 'iniciativa',
    title: '1. Iniciativa',
    description: 'Presentación del proyecto de ley por parte de los sujetos facultados',
    details: [
      'El proyecto se presenta por escrito ante alguna de las cámaras',
      'Debe incluir exposición de motivos y articulado',
      'Se turna a comisiones para su análisis',
      'Se publica en la gaceta parlamentaria'
    ],
    duration: '1-7 días',
    actors: [
      'Presidente de la República',
      'Diputados y Senadores',
      'Legislaturas de los Estados',
      'Ciudadanos (iniciativa ciudadana)'
    ],
    requirements: [
      'Exposición de motivos',
      'Articulado propuesto',
      'Régimen transitorio (si aplica)'
    ]
  },
  {
    id: 'dictamen',
    title: '2. Dictamen',
    description: 'Análisis y modificación del proyecto por parte de las comisiones',
    details: [
      'Las comisiones estudian la iniciativa',
      'Se realizan audiencias públicas si es necesario',
      'Se elabora dictamen con modificaciones',
      'Puede ser aprobado, modificado o desechado'
    ],
    duration: '30-90 días',
    actors: [
      'Comisiones dictaminadoras',
      'Expertos y especialistas',
      'Organizaciones civiles',
      'Ciudadanos interesados'
    ],
    requirements: [
      'Análisis jurídico',
      'Impacto presupuestal',
      'Consulta a especialistas'
    ]
  },
  {
    id: 'discusion-camara-origen',
    title: '3. Discusión en Cámara de Origen',
    description: 'Debate y votación en la cámara donde se presentó la iniciativa',
    details: [
      'Lectura del dictamen en el pleno',
      'Debate general y particular',
      'Presentación y votación de reservas',
      'Votación final del proyecto'
    ],
    duration: '1-15 días',
    actors: [
      'Diputados o Senadores',
      'Mesa directiva',
      'Grupos parlamentarios'
    ],
    requirements: [
      'Quórum legal',
      'Mayoría simple o calificada según el caso',
      'Registro de votación'
    ]
  },
  {
    id: 'camara-revisora',
    title: '4. Cámara Revisora',
    description: 'Revisión y votación en la segunda cámara',
    details: [
      'Se envía el proyecto aprobado',
      'Nueva revisión por comisiones si hay modificaciones',
      'Debate en el pleno de la cámara revisora',
      'Votación final'
    ],
    duration: '30-60 días',
    actors: [
      'Segunda cámara (Diputados o Senadores)',
      'Comisiones de la cámara revisora'
    ],
    requirements: [
      'Mismo procedimiento que cámara de origen',
      'Si hay modificaciones, regresa a origen'
    ]
  },
  {
    id: 'ejecutivo',
    title: '5. Ejecutivo Federal',
    description: 'Promulgación o veto del proyecto de ley',
    details: [
      'El Ejecutivo tiene 30 días para revisar',
      'Puede promulgar la ley',
      'Puede ejercer el derecho de veto',
      'Si no hace nada, se promulga automáticamente'
    ],
    duration: 'Hasta 30 días',
    actors: [
      'Presidente de la República',
      'Secretarías de Estado',
      'Consejería Jurídica'
    ],
    requirements: [
      'Revisión de constitucionalidad',
      'Análisis de viabilidad',
      'Coordinación con ejecutivo local si aplica'
    ]
  },
  {
    id: 'publicacion',
    title: '6. Publicación',
    description: 'Publicación en el Diario Oficial de la Federación',
    details: [
      'La ley se publica en el DOF',
      'Entra en vigor según sus disposiciones',
      'Se notifica a autoridades competentes',
      'Inicia proceso de reglamentación si es necesario'
    ],
    duration: '1-30 días',
    actors: [
      'Secretaría de Gobernación',
      'Diario Oficial de la Federación'
    ],
    requirements: [
      'Firma del Presidente',
      'Refrendo del Secretario correspondiente',
      'Formato oficial'
    ]
  }
];

export default function LegislativeProcess() {
  const { t: _t } = useTranslation();
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const nextStep = () => {
    if (currentStepIndex < legislativeSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setActiveStep(legislativeSteps[currentStepIndex + 1].id);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setActiveStep(legislativeSteps[currentStepIndex - 1].id);
    }
  };

  const resetProcess = () => {
    setCurrentStepIndex(0);
    setActiveStep(null);
  };
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <_HydrationBoundary 
        fallback={<_LoadingStates.LegislativeProcess />} 
        testId="legislative-process"
      />
    );
  }

  return (
    <div
      data-testid="legislative-process" className="legislative-process">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Proceso Legislativo Federal
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Sigue el recorrido que hace una iniciativa hasta convertirse en ley
        </p>
        
        {/* Process Controls */}
        <div className="flex justify-center space-x-4 mb-8">
          <button
            onClick={prevStep}
            disabled={currentStepIndex === 0}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
          >
            Anterior
          </button>
          <button
            onClick={resetProcess}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Reiniciar
          </button>
          <button
            onClick={nextStep}
            disabled={currentStepIndex === legislativeSteps.length - 1}
            className="px-4 py-2 bg-green-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-600 transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progreso del proceso
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {Math.round(((currentStepIndex + 1) / legislativeSteps.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
            style={{
              width: `${((currentStepIndex + 1) / legislativeSteps.length) * 100}%`
            }}
          />
        </div>
      </div>

      {/* Process Steps */}
      <div className="space-y-4">
        {legislativeSteps.map((step, index) => {
          const isActive = activeStep === step.id;
          const isCurrent = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div
              key={step.id}
              className={`border-2 rounded-lg p-6 transition-all duration-300 cursor-pointer ${
                isCurrent
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : isCompleted
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : isPending
                  ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              } ${isActive ? 'shadow-lg' : 'hover:shadow-md'}`}
              onClick={() => setActiveStep(isActive ? null : step.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-400 text-white'
                    }`}
                  >
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <div>
                    <h4 className={`text-xl font-bold ${
                      isCurrent
                        ? 'text-blue-800 dark:text-blue-200'
                        : isCompleted
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {step.title}
                    </h4>
                    <p className={`text-sm ${
                      isCurrent
                        ? 'text-blue-600 dark:text-blue-300'
                        : isCompleted
                        ? 'text-green-600 dark:text-green-300'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                    isCurrent
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {step.duration}
                  </span>
                  <svg
                    className={`w-5 h-5 transition-transform ${
                      isActive ? 'rotate-180' : ''
                    } ${
                      isCurrent
                        ? 'text-blue-600'
                        : isCompleted
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {isActive && (
                <div className="space-y-6 border-t border-gray-200 dark:border-gray-600 pt-6 animate-fadeIn">
                  <div>
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-3">
                      Desarrollo del proceso:
                    </h5>
                    <ul className="space-y-2">
                      {step.details.map((detail, index) => (
                        <li key={index} className="flex items-start space-x-3">
                          <span className="w-2 h-2 bg-current rounded-full mt-2 opacity-60"></span>
                          <span className="text-gray-700 dark:text-gray-300">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-white mb-3">
                        Actores principales:
                      </h5>
                      <ul className="space-y-1">
                        {step.actors.map((actor, index) => (
                          <li key={index} className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{actor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {step.requirements && (
                      <div>
                        <h5 className="font-semibold text-gray-900 dark:text-white mb-3">
                          Requisitos:
                        </h5>
                        <ul className="space-y-1">
                          {step.requirements.map((req, index) => (
                            <li key={index} className="flex items-center space-x-2">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-8 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-6 rounded-lg">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Resumen del Proceso
        </h4>
        <p className="text-gray-700 dark:text-gray-300 mb-3">
          El proceso legislativo federal puede tomar de 90 días a varios años, dependiendo de la complejidad
          de la materia y el consenso político necesario.
        </p>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
            <div className="font-semibold text-blue-600 dark:text-blue-400">Tiempo promedio</div>
            <div className="text-gray-700 dark:text-gray-300">6-12 meses</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
            <div className="font-semibold text-green-600 dark:text-green-400">Iniciativas anuales</div>
            <div className="text-gray-700 dark:text-gray-300">~3,000 promedio</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
            <div className="font-semibold text-purple-600 dark:text-purple-400">Leyes aprobadas</div>
            <div className="text-gray-700 dark:text-gray-300">~200-300 anuales</div>
          </div>
        </div>
      </div>
    </div>
  );
}