import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { HydrationBoundary, LoadingStates } from '../components/HydrationBoundary';

export default function AboutContent() {
  const { t, language } = useTranslation();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto mb-16"></div>
          <div className="space-y-4">
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const lang = language || 'es';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {lang === 'es' ? 'Acerca de LexMX' : 'About LexMX'}
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          {lang === 'es' 
            ? 'Tu asistente legal mexicano impulsado por inteligencia artificial, diseñado para democratizar el acceso a la información legal.'
            : 'Your Mexican legal assistant powered by artificial intelligence, designed to democratize access to legal information.'}
        </p>
      </div>

      {/* Mission Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {lang === 'es' ? 'Nuestra Misión' : 'Our Mission'}
        </h2>
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-300">
            {lang === 'es'
              ? 'LexMX nace con la visión de hacer el derecho mexicano accesible para todos. Combinamos la inteligencia artificial más avanzada con el corpus legal mexicano completo para ofrecer respuestas precisas, contextualizadas y siempre actualizadas.'
              : 'LexMX was born with the vision of making Mexican law accessible to everyone. We combine the most advanced artificial intelligence with the complete Mexican legal corpus to offer precise, contextualized, and always up-to-date answers.'}
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            {lang === 'es'
              ? 'Creemos que el acceso a la información legal es un derecho fundamental, y trabajamos para eliminar las barreras técnicas y económicas que impiden a las personas entender y ejercer sus derechos.'
              : 'We believe that access to legal information is a fundamental right, and we work to eliminate the technical and economic barriers that prevent people from understanding and exercising their rights.'}
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {lang === 'es' ? '¿Qué hace único a LexMX?' : 'What makes LexMX unique?'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {lang === 'es' ? '100% Privado' : '100% Private'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {lang === 'es'
                ? 'Todo el procesamiento ocurre en tu navegador. No almacenamos consultas, no rastreamos usuarios, y no enviamos datos a servidores externos.'
                : 'All processing happens in your browser. We don\'t store queries, track users, or send data to external servers.'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {lang === 'es' ? 'Código Abierto' : 'Open Source'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {lang === 'es'
                ? 'LexMX es software libre bajo licencia MIT. Puedes revisar, modificar y contribuir al código en nuestro repositorio de GitHub.'
                : 'LexMX is free software under MIT license. You can review, modify, and contribute to the code in our GitHub repository.'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {lang === 'es' ? 'Sin Costos Ocultos' : 'No Hidden Costs'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {lang === 'es'
                ? 'Usa tu propia clave API de OpenAI, Claude o Gemini. Solo pagas por lo que usas directamente al proveedor, sin intermediarios ni comisiones.'
                : 'Use your own API key from OpenAI, Claude, or Gemini. You only pay for what you use directly to the provider, without intermediaries or commissions.'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {lang === 'es' ? 'Siempre Actualizado' : 'Always Updated'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {lang === 'es'
                ? 'Nuestro corpus legal se actualiza constantemente con las últimas reformas y jurisprudencias del sistema legal mexicano.'
                : 'Our legal corpus is constantly updated with the latest reforms and jurisprudence from the Mexican legal system.'}
            </p>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {lang === 'es' ? 'Tecnología de Vanguardia' : 'Cutting-Edge Technology'}
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              RAG (Retrieval Augmented Generation)
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {lang === 'es'
                ? 'Utilizamos búsqueda híbrida que combina vectores semánticos con búsqueda por palabras clave para encontrar la información legal más relevante en cada consulta.'
                : 'We use hybrid search that combines semantic vectors with keyword search to find the most relevant legal information for each query.'}
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Multi-LLM Support
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {lang === 'es'
                ? 'Compatible con múltiples proveedores de IA: OpenAI (GPT-4), Anthropic (Claude), Google (Gemini) y AWS Bedrock. El sistema selecciona automáticamente el mejor modelo para cada consulta.'
                : 'Compatible with multiple AI providers: OpenAI (GPT-4), Anthropic (Claude), Google (Gemini), and AWS Bedrock. The system automatically selects the best model for each query.'}
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Islands Architecture
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {lang === 'es'
                ? 'Construido con Astro y React, optimizado para cargas ultrarrápidas. Solo carga JavaScript donde es necesario, manteniendo el sitio ligero y eficiente.'
                : 'Built with Astro and React, optimized for ultra-fast loads. Only loads JavaScript where necessary, keeping the site lightweight and efficient.'}
            </p>
          </div>
        </div>
      </section>

      {/* Legal Notice */}
      <section className="mb-16 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {lang === 'es' ? 'Aviso Legal Importante' : 'Important Legal Notice'}
        </h2>
        <p className="text-gray-700 dark:text-gray-300">
          {lang === 'es'
            ? 'LexMX proporciona información legal general con fines educativos y de orientación. '
            : 'LexMX provides general legal information for educational and guidance purposes. '}
          <strong>{lang === 'es' ? 'No constituye asesoría legal profesional' : 'It does not constitute professional legal advice'}</strong>. 
          {lang === 'es'
            ? ' Las respuestas generadas por IA pueden contener errores o imprecisiones. Siempre consulte con un abogado certificado para casos específicos o decisiones legales importantes.'
            : ' AI-generated responses may contain errors or inaccuracies. Always consult with a certified lawyer for specific cases or important legal decisions.'}
        </p>
      </section>

      {/* Team Section */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {lang === 'es' ? 'Proyecto de Código Abierto' : 'Open Source Project'}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {lang === 'es'
            ? 'LexMX es un proyecto comunitario de código abierto. Agradecemos a todos los contribuidores que han ayudado a hacer realidad esta herramienta.'
            : 'LexMX is a community open source project. We thank all contributors who have helped make this tool a reality.'}
        </p>
        <div className="flex flex-wrap gap-4">
          <a 
            href="https://github.com/artemiopadilla/LexMX" 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            {lang === 'es' ? 'Ver en GitHub' : 'View on GitHub'}
          </a>
          <a 
            href="https://github.com/artemiopadilla/LexMX/issues" 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {lang === 'es' ? 'Reportar un problema' : 'Report an issue'}
          </a>
          <a 
            href="https://github.com/artemiopadilla/LexMX/blob/main/CONTRIBUTING.md" 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            {lang === 'es' ? 'Contribuir al proyecto' : 'Contribute to the project'}
          </a>
        </div>
      </section>

      {/* Contact Section */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {lang === 'es' ? 'Contacto' : 'Contact'}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {lang === 'es'
            ? 'Para preguntas, sugerencias o colaboraciones, puedes contactarnos a través de:'
            : 'For questions, suggestions, or collaborations, you can contact us through:'}
        </p>
        <ul className="mt-4 space-y-2 text-gray-600 dark:text-gray-300">
          <li>• GitHub Issues: {lang === 'es' ? 'Para reportar errores o solicitar funciones' : 'To report bugs or request features'}</li>
          <li>• GitHub Discussions: {lang === 'es' ? 'Para preguntas y discusiones generales' : 'For questions and general discussions'}</li>
          <li>• Pull Requests: {lang === 'es' ? 'Para contribuir directamente al código' : 'To contribute directly to the code'}</li>
        </ul>
      </section>
    </div>
  );
}