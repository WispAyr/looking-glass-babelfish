const AlarmManagerService = require('./services/alarmManagerService');

async function cleanupTestRules() {
  console.log('🧹 Cleaning up test rules...');
  
  try {
    // Initialize service
    const alarmService = new AlarmManagerService();
    await alarmService.initialize();
    
    // Get all rules
    const allRules = await alarmService.getAllRules();
    console.log(`Found ${allRules.length} total rules`);
    
    // Find test rules
    const testRules = allRules.filter(rule => 
      rule.name.toLowerCase().includes('test') || 
      rule.id.includes('test')
    );
    
    console.log(`Found ${testRules.length} test rules:`);
    testRules.forEach(rule => {
      console.log(`  - ${rule.name} (${rule.id})`);
    });
    
    // Delete test rules
    for (const rule of testRules) {
      console.log(`Deleting test rule: ${rule.name}`);
      await alarmService.deleteRule(rule.id);
    }
    
    // Get remaining rules
    const remainingRules = await alarmService.getAllRules();
    console.log(`Remaining rules: ${remainingRules.length}`);
    
    await alarmService.close();
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run the cleanup
cleanupTestRules(); 