const fs = require('fs');
const path = require('path');

// List of components that need hydration boundary
const componentsToUpdate = [
  'DocumentViewer',
  'DocumentRequestList',
  'MobileMenu',
  'ProviderRecommendation',
  'WikiNavigation',
  'DocumentViewerWrapper',
  'NotificationCenter',
  'LegislativeProcess',
  'LegalGlossary',
  'GovernmentStructure',
  'ModerationPanel'
];

function addHydrationBoundary(componentName) {
  const filePath = path.join(__dirname, '..', 'src', 'islands', `${componentName}.tsx`);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if already has hydration
  if (content.includes('HydrationBoundary') || content.includes('setIsHydrated')) {
    console.log(`✓ ${componentName} already has hydration`);
    return true;
  }
  
  // Add imports
  if (!content.includes("import { HydrationBoundary")) {
    const importRegex = /(import .* from 'react';?)/;
    content = content.replace(importRegex, 
      `$1\nimport { HydrationBoundary, LoadingStates } from '../components/HydrationBoundary';\nimport { TEST_IDS } from '../utils/test-ids';`);
  }
  
  // Add isHydrated state
  const functionRegex = new RegExp(`export default function ${componentName}\\([^)]*\\)\\s*{`);
  content = content.replace(functionRegex, (match) => {
    return match + '\n  const [isHydrated, setIsHydrated] = useState(false);';
  });
  
  // Add useEffect for hydration
  const stateRegex = /const \[.*?\] = useState.*?;/g;
  const stateMatches = content.match(stateRegex);
  if (stateMatches && stateMatches.length > 0) {
    const lastStateMatch = stateMatches[stateMatches.length - 1];
    const lastStateIndex = content.lastIndexOf(lastStateMatch);
    content = content.slice(0, lastStateIndex + lastStateMatch.length) + 
      '\n\n  // Handle hydration\n  useEffect(() => {\n    setIsHydrated(true);\n  }, []);' +
      content.slice(lastStateIndex + lastStateMatch.length);
  }
  
  // Add hydration check before return
  const returnRegex = /(\s+return \()/;
  const testId = componentName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  
  content = content.replace(returnRegex, 
    `\n  // Handle SSR/hydration\n  if (!isHydrated) {\n    return (\n      <HydrationBoundary \n        fallback={<LoadingStates.${componentName} />} \n        testId="${testId}"\n      />\n    );\n  }\n\n  return (`);
  
  // Add data-testid to root element
  const rootDivRegex = /return \(\s*<div(\s+className=)/;
  content = content.replace(rootDivRegex, 
    `return (\n    <div\n      data-testid="${testId}"$1`);
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated ${componentName}`);
  return true;
}

console.log('Adding HydrationBoundary to island components...\n');

componentsToUpdate.forEach(component => {
  try {
    addHydrationBoundary(component);
  } catch (error) {
    console.error(`❌ Error updating ${component}:`, error.message);
  }
});

console.log('\n✨ Hydration boundaries added successfully!');