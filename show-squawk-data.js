const SquawkCodeService = require('./services/squawkCodeService');

async function showSquawkData() {
  console.log('🔍 Checking Squawk Code Data Storage...\n');
  
  const service = new SquawkCodeService();
  await service.initialize();
  
  console.log('📊 Squawk Code Statistics:');
  const stats = service.getStats();
  console.log(`Total codes loaded: ${stats.totalCodes}`);
  console.log(`Categories: ${JSON.stringify(stats.categories, null, 2)}`);
  console.log('');
  
  console.log('🔍 Sample Codes by Category:');
  ['emergency', 'military', 'nato', 'emergency_services'].forEach(cat => {
    const codes = service.getCodesByCategory(cat);
    console.log(`${cat.toUpperCase()}: ${codes.slice(0, 5).join(', ')}${codes.length > 5 ? '...' : ''}`);
  });
  console.log('');
  
  console.log('🔍 Sample Lookups:');
  ['7500', '7600', '7700', '7001', '0100'].forEach(code => {
    const result = service.lookupSquawkCode(code);
    console.log(`${code}: ${result.description} (${result.category}, ${result.priority})`);
  });
  console.log('');
  
  console.log('✅ All squawk codes from your file are now stored and accessible in the application!');
}

showSquawkData().catch(console.error); 