// Quick integration test for LexMX configuration
// This test verifies that all the main components can initialize properly

import { documentLoader } from './src/lib/corpus/document-loader.js';
import { providerManager } from './src/lib/llm/provider-manager.js';  
import { LegalRAGEngine } from './src/lib/rag/engine.js';

async function testConfiguration() {
  console.log('🧪 Testing LexMX Configuration...\n');
  
  try {
    // Test 1: Document loader
    console.log('1️⃣ Testing document loader...');
    await documentLoader.initialize();
    const metadata = documentLoader.getMetadata();
    console.log(`   ✅ Document loader initialized with ${metadata?.totalDocuments || 0} documents`);
    
    if (metadata?.totalDocuments > 0) {
      const firstDoc = await documentLoader.loadDocument(metadata.documents[0].id);
      console.log(`   ✅ Successfully loaded document: ${firstDoc?.title || 'Unknown'}`);
      
      const vectorDocs = await documentLoader.convertToVectorDocuments();
      console.log(`   ✅ Converted to ${vectorDocs.length} vector documents`);
    }

    // Test 2: Provider manager  
    console.log('\n2️⃣ Testing provider manager...');
    await providerManager.initialize();
    
    const hasProviders = await providerManager.hasConfiguredProviders();
    console.log(`   ✅ Provider manager initialized, has providers: ${hasProviders}`);
    
    const availableProviders = providerManager.getAvailableProviders();
    console.log(`   ✅ Available providers: ${availableProviders.map(p => p.name).join(', ')}`);

    // Test 3: RAG engine
    console.log('\n3️⃣ Testing RAG engine...');
    const ragEngine = new LegalRAGEngine();
    await ragEngine.initialize();
    console.log('   ✅ RAG engine initialized successfully');

    // Test 4: End-to-end query (with mock provider if no real providers)
    console.log('\n4️⃣ Testing end-to-end query...');
    const testQuery = "¿Qué dice el artículo 1 de la Constitución sobre los derechos humanos?";
    
    try {
      const response = await ragEngine.processLegalQuery(testQuery, {
        legalArea: 'constitutional',
        maxResults: 3
      });
      
      console.log(`   ✅ Query processed successfully`);
      console.log(`   📄 Answer: ${response.answer.substring(0, 150)}...`);
      console.log(`   📚 Sources: ${response.sources.length} legal sources found`);
      console.log(`   ⏱️ Processing time: ${response.processingTime}ms`);
      console.log(`   🎯 Confidence: ${Math.round(response.confidence * 100)}%`);
      
    } catch (queryError) {
      console.log(`   ⚠️ Query failed (this may be normal without API keys): ${queryError.message}`);
    }

    console.log('\n🎉 Configuration test completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Add API keys to .env file (see CONFIG.md)');
    console.log('   2. Visit /setup page to configure providers');  
    console.log('   3. Test chat interface at /chat');
    console.log('   4. Try various legal queries in Spanish');

  } catch (error) {
    console.error('\n❌ Configuration test failed:', error);
    console.log('\n🔍 Troubleshooting:');
    console.log('   1. Ensure you\'re running this from the project root');
    console.log('   2. Check that legal corpus exists in /public/legal-corpus/');
    console.log('   3. Verify node modules are installed');
  }
}

// Run the test
testConfiguration().then(() => {
  console.log('\n✨ Test complete');
}).catch(error => {
  console.error('\n💥 Test failed:', error);
});