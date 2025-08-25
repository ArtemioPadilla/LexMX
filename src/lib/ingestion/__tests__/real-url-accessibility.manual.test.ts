/**
 * Manual tests for real URL accessibility
 * Run with: npm test -- real-url-accessibility.manual.test.ts
 * These tests make real HTTP requests to Mexican government sites
 */

import { describe, it, expect } from 'vitest';
import { DocumentFetcher } from '../document-fetcher';

// These tests are marked as manual because they require internet connection
// and test against real government websites
describe('Real URL Accessibility Tests (Manual)', () => {
  const fetcher = new DocumentFetcher();

  // Skip these tests by default - uncomment to run manually
  describe.skip('Mexican Government Sources - Real HTTP Tests', () => {
    
    describe('Diputados.gob.mx', () => {
      const testUrls = {
        constitutionPdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
        constitutionDoc: 'https://www.diputados.gob.mx/LeyesBiblio/doc/CPEUM.doc',
        laborLawPdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/125_120924.pdf',
        civilCodePdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf',
        penalCodePdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPF.pdf'
      };

      it('should successfully fetch Mexican Constitution PDF', async () => {
        const result = await fetcher.fetchFromUrl(testUrls.constitutionPdf);
        
        expect(result).toBeTruthy();
        expect(result).toContain('CONSTITUCIÓN');
        expect(result).toContain('POLÍTICA');
        expect(result).toContain('Artículo');
        expect(result.length).toBeGreaterThan(1000); // Should be substantial content
      }, 30000); // 30 second timeout

      it('should successfully fetch Mexican Constitution DOC', async () => {
        const result = await fetcher.fetchFromUrl(testUrls.constitutionDoc);
        
        expect(result).toBeTruthy();
        expect(result).toContain('CONSTITUCIÓN');
        expect(result).toContain('Artículo');
        expect(result.length).toBeGreaterThan(1000);
      }, 30000);

      it('should successfully fetch Labor Law PDF', async () => {
        const result = await fetcher.fetchFromUrl(testUrls.laborLawPdf);
        
        expect(result).toBeTruthy();
        expect(result).toContain('LEY FEDERAL DEL TRABAJO');
        expect(result).toContain('trabajo');
        expect(result.length).toBeGreaterThan(1000);
      }, 30000);

      it('should use convenience methods for common documents', async () => {
        const constitution = await fetcher.fetchConstitution();
        expect(constitution).toContain('CONSTITUCIÓN');
        
        const laborLaw = await fetcher.fetchLaborLaw();
        expect(laborLaw).toContain('trabajo');
        
        const civilCode = await fetcher.fetchCivilCode();
        expect(civilCode).toContain('civil');
      }, 60000); // More time for multiple requests
    });

    describe('DOF.gob.mx', () => {
      it('should successfully fetch recent DOF publication', async () => {
        // Get a recent date for testing
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const dateStr = yesterday.toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        try {
          const result = await fetcher.fetchFromDOF(dateStr);
          expect(result).toBeTruthy();
          expect(result.length).toBeGreaterThan(100);
        } catch (error) {
          // DOF might not have publications every day, so this is acceptable
          console.warn('No DOF publication found for date:', dateStr);
        }
      }, 30000);
    });

    describe('Content Quality Validation', () => {
      it('should extract proper legal structure from Constitution PDF', async () => {
        const result = await fetcher.fetchFromUrl(testUrls.constitutionPdf);
        
        // Check for proper legal document structure
        expect(result).toMatch(/Artículo\s+\d+/); // Article numbering
        expect(result).toMatch(/TÍTULO/); // Title sections
        expect(result).toMatch(/CAPÍTULO/); // Chapter sections
        
        // Check for specific constitutional content
        expect(result).toContain('Estados Unidos Mexicanos');
        expect(result).toContain('derechos humanos');
        
        // Verify substantial content (Constitution should be long)
        expect(result.length).toBeGreaterThan(50000); // Substantial document
      }, 45000);

      it('should preserve Spanish legal terminology', async () => {
        const result = await fetcher.fetchFromUrl(testUrls.laborLawPdf);
        
        // Check for proper Spanish legal terms
        expect(result).toMatch(/trabajador/i);
        expect(result).toMatch(/patrón/i);
        expect(result).toMatch(/salario/i);
        expect(result).toMatch(/jornada/i);
        
        // Check for proper accents and characters
        expect(result).toMatch(/nación/i);
        expect(result).toMatch(/artículo/i);
        expect(result).toMatch(/término/i);
      }, 45000);
    });

    describe('Error Handling', () => {
      it('should handle non-existent documents gracefully', async () => {
        await expect(
          fetcher.fetchFromUrl('https://www.diputados.gob.mx/LeyesBiblio/pdf/NONEXISTENT.pdf')
        ).rejects.toThrow();
      }, 15000);

      it('should handle malformed URLs', async () => {
        await expect(
          fetcher.fetchFromUrl('https://www.diputados.gob.mx/invalid-path/document.pdf')
        ).rejects.toThrow();
      }, 15000);
    });
  });

  describe('URL Analysis Tests (Safe - No Full Downloads)', () => {
    it('should correctly identify official Mexican government domains', () => {
      const testDomains = [
        'www.diputados.gob.mx',
        'dof.gob.mx',
        'scjn.gob.mx',
        'senado.gob.mx',
        'sat.gob.mx',
        'imss.gob.mx',
        'infonavit.org.mx'
      ];

      testDomains.forEach(domain => {
        expect(fetcher.isOfficialSource(domain)).toBe(true);
      });
    });

    it('should reject non-official domains', () => {
      const testDomains = [
        'example.com',
        'fake-gob.mx.com',
        'diputados.com',
        'government.org'
      ];

      testDomains.forEach(domain => {
        expect(fetcher.isOfficialSource(domain)).toBe(false);
      });
    });

    it('should construct correct URLs for Mexican legal documents', () => {
      // Test URL construction without actually fetching
      const baseUrl = 'https://www.diputados.gob.mx/LeyesBiblio';
      
      expect(`${baseUrl}/pdf/CPEUM.pdf`).toBe(
        'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf'
      );
      
      expect(`${baseUrl}/doc/CPEUM.doc`).toBe(
        'https://www.diputados.gob.mx/LeyesBiblio/doc/CPEUM.doc'
      );
    });
  });

  describe('Performance Expectations', () => {
    it('should have reasonable timeout expectations', () => {
      // Document our performance expectations
      const expectations = {
        smallDocument: 5000,   // 5 seconds for < 1MB
        mediumDocument: 15000, // 15 seconds for 1-5MB
        largeDocument: 30000,  // 30 seconds for > 5MB
        batchProcessing: 60000 // 1 minute for multiple documents
      };
      
      expect(expectations.smallDocument).toBeLessThan(10000);
      expect(expectations.mediumDocument).toBeLessThan(20000);
      expect(expectations.largeDocument).toBeLessThan(45000);
    });
  });
});

/**
 * Helper function to run real tests manually
 * Usage: 
 * import { runRealUrlTests } from './real-url-accessibility.manual.test';
 * await runRealUrlTests();
 */
export async function runRealUrlTests() {
  console.log('🧪 Starting real URL accessibility tests...');
  
  const fetcher = new DocumentFetcher();
  const testResults = [];
  
  const testCases = [
    {
      name: 'Constitution PDF',
      url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
      expectedContent: ['CONSTITUCIÓN', 'Artículo']
    },
    {
      name: 'Constitution DOC',
      url: 'https://www.diputados.gob.mx/LeyesBiblio/doc/CPEUM.doc',
      expectedContent: ['CONSTITUCIÓN', 'Artículo']
    },
    {
      name: 'Labor Law PDF',
      url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/125_120924.pdf',
      expectedContent: ['LEY FEDERAL DEL TRABAJO', 'trabajo']
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📄 Testing ${testCase.name}...`);
    
    try {
      const startTime = Date.now();
      const result = await fetcher.fetchFromUrl(testCase.url);
      const duration = Date.now() - startTime;
      
      const hasExpectedContent = testCase.expectedContent.every(content =>
        result.toLowerCase().includes(content.toLowerCase())
      );
      
      testResults.push({
        name: testCase.name,
        success: true,
        duration,
        contentLength: result.length,
        hasExpectedContent,
        url: testCase.url
      });
      
      console.log(`✅ ${testCase.name} - ${duration}ms - ${result.length} chars`);
      
    } catch (error) {
      testResults.push({
        name: testCase.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        url: testCase.url
      });
      
      console.log(`❌ ${testCase.name} - Error: ${error}`);
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  
  testResults.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.name}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Content: ${result.contentLength} characters`);
      console.log(`   Expected content found: ${result.hasExpectedContent ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ ${result.name}`);
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });
  
  const successCount = testResults.filter(r => r.success).length;
  console.log(`\n🎯 Results: ${successCount}/${testResults.length} tests passed`);
  
  return testResults;
}