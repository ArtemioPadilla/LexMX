import React, { useState, useEffect } from 'react';
import { HydrationBoundary, LoadingStates } from '../components/HydrationBoundary';
import { TEST_IDS } from '../utils/test-ids';
import { useTranslation } from '../i18n/index';

interface GovernmentLevel {
  id: string;
  name: string;
  description: string;
  color: string;
  institutions: string[];
  competences: string[];
}

interface PowerBranch {
  id: string;
  name: string;
  description: string;
  color: string;
  institutions: string[];
  functions: string[];
}

const governmentLevels: GovernmentLevel[] = [
  {
    id: 'federal',
    name: 'Gobierno Federal',
    description: 'Gobierno nacional con competencias constitucionales específicas',
    color: 'red',
    institutions: [
      'Presidencia de la República',
      'Secretarías de Estado',
      'Organismos Autónomos',
      'Empresas Productivas del Estado'
    ],
    competences: [
      'Relaciones exteriores',
      'Defensa nacional',
      'Política monetaria',
      'Comercio internacional',
      'Migración',
      'Telecomunicaciones'
    ]
  },
  {
    id: 'estatal',
    name: 'Gobierno Estatal',
    description: '32 entidades federativas con autonomía en sus competencias',
    color: 'yellow',
    institutions: [
      'Gobernador',
      'Secretarías Estatales',
      'Congreso Local',
      'Tribunal Superior de Justicia'
    ],
    competences: [
      'Educación pública',
      'Salud pública',
      'Seguridad pública',
      'Desarrollo urbano',
      'Transporte local',
      'Registro civil'
    ]
  },
  {
    id: 'municipal',
    name: 'Gobierno Municipal',
    description: '2,469 municipios y alcaldías con autonomía constitucional',
    color: 'blue',
    institutions: [
      'Presidente Municipal/Alcalde',
      'Cabildo',
      'Tesorería Municipal',
      'Direcciones Municipales'
    ],
    competences: [
      'Servicios públicos',
      'Desarrollo urbano local',
      'Seguridad pública municipal',
      'Mercados y centrales de abasto',
      'Panteones',
      'Agua potable y drenaje'
    ]
  }
];

const powerBranches: PowerBranch[] = [
  {
    id: 'ejecutivo',
    name: 'Poder Ejecutivo',
    description: 'Administración pública y ejecución de las leyes',
    color: 'blue',
    institutions: [
      'Presidencia de la República',
      'Consejo de Ministros',
      'Secretarías de Estado',
      'Organismos Descentralizados'
    ],
    functions: [
      'Ejecutar las leyes',
      'Dirigir la política exterior',
      'Comandar las fuerzas armadas',
      'Nombrar funcionarios públicos',
      'Expedir reglamentos',
      'Administrar recursos públicos'
    ]
  },
  {
    id: 'legislativo',
    name: 'Poder Legislativo',
    description: 'Creación de leyes y representación popular',
    color: 'green',
    institutions: [
      'Cámara de Diputados',
      'Cámara de Senadores',
      'Comisión Permanente',
      'Auditoría Superior de la Federación'
    ],
    functions: [
      'Expedir leyes federales',
      'Aprobar el presupuesto',
      'Ratificar tratados',
      'Declarar la guerra',
      'Fiscalizar al ejecutivo',
      'Reformar la Constitución'
    ]
  },
  {
    id: 'judicial',
    name: 'Poder Judicial',
    description: 'Impartición de justicia e interpretación de leyes',
    color: 'purple',
    institutions: [
      'Suprema Corte de Justicia',
      'Consejo de la Judicatura Federal',
      'Tribunal Electoral',
      'Juzgados y Tribunales Federales'
    ],
    functions: [
      'Impartir justicia',
      'Interpretar la Constitución',
      'Resolver controversias',
      'Proteger derechos fundamentales',
      'Control constitucional',
      'Administración judicial'
    ]
  }
];

export default function GovernmentStructure() {
  const { t } = useTranslation();
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeView, setActiveView] = useState<'powers' | 'levels'>('powers');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const getColorClasses = (color: string, selected: boolean = false) => {
    const colorMap = {
      red: selected ? 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-800 dark:text-red-200' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
      yellow: selected ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 text-yellow-800 dark:text-yellow-200' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
      blue: selected ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-800 dark:text-blue-200' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
      green: selected ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-800 dark:text-green-200' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
      purple: selected ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-800 dark:text-purple-200' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };
  // Handle SSR/hydration
  if (!isHydrated) {
    return (
      <HydrationBoundary 
        fallback={<LoadingStates.GovernmentStructure />} 
        testId="government-structure"
      />
    );
  }

  return (
    <div
      data-testid="government-structure" className="government-structure">
      {/* View Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('powers')}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeView === 'powers'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            División de Poderes
          </button>
          <button
            onClick={() => setActiveView('levels')}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeView === 'levels'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Niveles de Gobierno
          </button>
        </div>
      </div>

      {/* Powers View */}
      {activeView === 'powers' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              División de Poderes
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Sistema de separación de poderes establecido en la Constitución
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {powerBranches.map((branch) => (
              <div
                key={branch.id}
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  getColorClasses(branch.color, selectedItem === branch.id)
                }`}
                onClick={() => setSelectedItem(selectedItem === branch.id ? null : branch.id)}
              >
                <h4 className="text-xl font-bold mb-3">{branch.name}</h4>
                <p className="text-sm mb-4 opacity-90">{branch.description}</p>
                
                {selectedItem === branch.id && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <h5 className="font-semibold mb-2">Instituciones:</h5>
                      <ul className="text-sm space-y-1">
                        {branch.institutions.map((institution, index) => (
                          <li key={index} className="flex items-center">
                            <span className="w-2 h-2 bg-current rounded-full mr-2 opacity-60"></span>
                            {institution}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold mb-2">Funciones principales:</h5>
                      <ul className="text-sm space-y-1">
                        {branch.functions.map((func, index) => (
                          <li key={index} className="flex items-center">
                            <span className="w-2 h-2 bg-current rounded-full mr-2 opacity-60"></span>
                            {func}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Levels View */}
      {activeView === 'levels' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Niveles de Gobierno
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Estructura federal del Estado mexicano
            </p>
          </div>

          <div className="space-y-6">
            {governmentLevels.map((level, index) => (
              <div
                key={level.id}
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  getColorClasses(level.color, selectedItem === level.id)
                }`}
                onClick={() => setSelectedItem(selectedItem === level.id ? null : level.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      level.color === 'red' ? 'bg-red-600 text-white' :
                      level.color === 'yellow' ? 'bg-yellow-600 text-white' :
                      'bg-blue-600 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold">{level.name}</h4>
                      <p className="text-sm opacity-90">{level.description}</p>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 transition-transform ${
                      selectedItem === level.id ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {selectedItem === level.id && (
                  <div className="grid md:grid-cols-2 gap-6 animate-fadeIn">
                    <div>
                      <h5 className="font-semibold mb-3">Instituciones:</h5>
                      <ul className="text-sm space-y-2">
                        {level.institutions.map((institution, index) => (
                          <li key={index} className="flex items-center">
                            <span className="w-2 h-2 bg-current rounded-full mr-3 opacity-60"></span>
                            {institution}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="font-semibold mb-3">Competencias:</h5>
                      <ul className="text-sm space-y-2">
                        {level.competences.map((competence, index) => (
                          <li key={index} className="flex items-center">
                            <span className="w-2 h-2 bg-current rounded-full mr-3 opacity-60"></span>
                            {competence}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}