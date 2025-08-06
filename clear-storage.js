// Clear storage script - run this in browser console to clear all storage
console.log('Clearing all browser storage...');

// Clear localStorage
try {
  localStorage.clear();
  console.log('✓ localStorage cleared');
} catch (e) {
  console.error('Failed to clear localStorage:', e);
}

// Clear sessionStorage
try {
  sessionStorage.clear();
  console.log('✓ sessionStorage cleared');
} catch (e) {
  console.error('Failed to clear sessionStorage:', e);
}

// Clear IndexedDB
try {
  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name) {
      indexedDB.deleteDatabase(db.name);
      console.log(`✓ Deleted IndexedDB: ${db.name}`);
    }
  }
} catch (e) {
  console.error('Failed to clear IndexedDB:', e);
}

// Clear cookies
try {
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  console.log('✓ Cookies cleared');
} catch (e) {
  console.error('Failed to clear cookies:', e);
}

console.log('Storage clearing complete! Please refresh the page.');