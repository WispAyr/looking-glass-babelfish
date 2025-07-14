const fetch = require('node-fetch');

async function testAdsbFiConnector() {
  console.log('🧪 Testing ADS-B.fi Connector...');
  
  try {
    // Test the ADS-B.fi API directly
    const response = await fetch('https://opendata.adsb.fi/api/v2/lat/55.509/lon/-4.586/dist/50');
    const data = await response.json();
    
    console.log(`✅ ADS-B.fi API working - Found ${data.aircraft?.length || 0} aircraft`);
    
    if (data.aircraft && data.aircraft.length > 0) {
      console.log('📊 Sample aircraft data:');
      data.aircraft.slice(0, 3).forEach(aircraft => {
        console.log(`  - ${aircraft.flight?.trim() || 'N/A'} (${aircraft.r || 'N/A'}) at ${aircraft.alt_baro || 'N/A'}ft`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ ADS-B.fi API test failed:', error.message);
    return false;
  }
}

async function testServerConnectors() {
  console.log('\n🔍 Testing Server Connectors...');
  
  try {
    // Check if server is running
    const healthResponse = await fetch('http://localhost:3000/health');
    if (!healthResponse.ok) {
      throw new Error('Server not responding');
    }
    
    console.log('✅ Server is running');
    
    // Get all connectors
    const connectorsResponse = await fetch('http://localhost:3000/api/connectors');
    const connectorsData = await connectorsResponse.json();
    
    console.log(`📊 Found ${connectorsData.data?.length || 0} connectors`);
    
    // Check for new ADS-B connectors
    const adsbConnectors = connectorsData.data?.filter(c => 
      c.id.includes('airplaneslive') || c.id.includes('adsbfi')
    ) || [];
    
    console.log(`🎯 Found ${adsbConnectors.length} new ADS-B connectors:`);
    adsbConnectors.forEach(connector => {
      console.log(`  - ${connector.id} (${connector.type}) - Status: ${connector.status}`);
    });
    
    // Check Prestwick connector
    const prestwickConnector = connectorsData.data?.find(c => c.id.includes('prestwick'));
    if (prestwickConnector) {
      console.log(`🏢 Prestwick connector: ${prestwickConnector.id} - Status: ${prestwickConnector.status}`);
    }
    
    // Check Radar connector
    const radarConnector = connectorsData.data?.find(c => c.id.includes('radar'));
    if (radarConnector) {
      console.log(`🛩️ Radar connector: ${radarConnector.id} - Status: ${radarConnector.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Server connector test failed:', error.message);
    return false;
  }
}

async function testEventFlow() {
  console.log('\n🔄 Testing Event Flow...');
  
  try {
    // Test if aircraft events are being published
    const eventsResponse = await fetch('http://localhost:3000/api/events?type=aircraft:detected&limit=5');
    const eventsData = await eventsResponse.json();
    
    console.log(`📡 Found ${eventsData.data?.length || 0} aircraft events`);
    
    if (eventsData.data && eventsData.data.length > 0) {
      console.log('📊 Recent aircraft events:');
      eventsData.data.slice(0, 3).forEach(event => {
        console.log(`  - ${event.data?.flight || 'N/A'} at ${event.data?.altitude || 'N/A'}ft`);
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Event flow test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing New ADS-B Connectors and Event Flow\n');
  
  const results = {
    adsbFi: await testAdsbFiConnector(),
    serverConnectors: await testServerConnectors(),
    eventFlow: await testEventFlow()
  };
  
  console.log('\n📋 Test Results:');
  console.log(`  ADS-B.fi API: ${results.adsbFi ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Server Connectors: ${results.serverConnectors ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Event Flow: ${results.eventFlow ? '✅ PASS' : '❌ FAIL'}`);
  
  if (results.adsbFi && results.serverConnectors) {
    console.log('\n🎉 New ADS-B connectors are working!');
    console.log('📝 Next steps:');
    console.log('  1. Check logs for aircraft:detected events');
    console.log('  2. Verify Prestwick connector receives aircraft data');
    console.log('  3. Test radar visualization with new data');
  } else {
    console.log('\n⚠️ Some tests failed. Check the logs for details.');
  }
}

main().catch(console.error); 