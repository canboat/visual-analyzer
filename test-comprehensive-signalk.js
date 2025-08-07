#!/usr/bin/env node

/**
 * Comprehensive test for the SignalK transformation endpoint
 */

const http = require('http');

// Test data - various NMEA 2000 messages that should convert to SignalK
const testCases = [
  {
    name: 'Wind Data (PGN 130306)',
    data: {
      "timestamp": "2024-08-07T15:00:00.000Z",
      "prio": 2,
      "src": 42,
      "dst": 255,
      "pgn": 130306,
      "description": "Wind Data",
      "fields": {
        "windSpeed": 10.5,
        "windAngle": 45.2,
        "reference": "Apparent"
      }
    }
  },
  {
    name: 'Rate of Turn (PGN 127251)',
    data: {
      "timestamp": "2024-08-07T15:00:01.000Z",
      "prio": 2,
      "src": 17,
      "dst": 255,
      "pgn": 127251,
      "description": "Rate of Turn",
      "fields": {
        "rate": 0.05236
      }
    }
  },
  {
    name: 'Vessel Heading (PGN 127250)',
    data: {
      "timestamp": "2024-08-07T15:00:02.000Z",
      "prio": 2,
      "src": 17,
      "dst": 255,
      "pgn": 127250,
      "description": "Vessel Heading",
      "fields": {
        "heading": 1.5708,
        "reference": "Magnetic"
      }
    }
  },
  {
    name: 'Multiple messages in array',
    data: [
      {
        "timestamp": "2024-08-07T15:00:03.000Z",
        "pgn": 127488,
        "src": 35,
        "fields": {
          "engineInstance": 0,
          "engineSpeed": 1800
        }
      },
      {
        "timestamp": "2024-08-07T15:00:04.000Z",
        "pgn": 127505,
        "src": 35,
        "fields": {
          "instance": 0,
          "fluidType": "Fuel",
          "level": 75.5
        }
      }
    ]
  }
];

async function runTest(testCase, serverPort = 8081) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testCase);
    
    const options = {
      hostname: 'localhost',
      port: serverPort,
      path: '/api/transform/signalk',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            response
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            rawResponse: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  console.log('🧪 Testing SignalK Transformation Endpoint');
  console.log('==========================================\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`${i + 1}. Testing: ${testCase.name}`);
    console.log('-'.repeat(50));
    
    try {
      const result = await runTest(testCase);
      
      if (result.status === 200 && result.response.success) {
        console.log('✅ SUCCESS');
        console.log(`   Messages processed: ${result.response.messagesProcessed}`);
        console.log(`   SignalK deltas generated: ${result.response.signalKDeltas?.length || 0}`);
        
        if (result.response.signalKDeltas && result.response.signalKDeltas.length > 0) {
          const firstDelta = result.response.signalKDeltas[0];
          if (firstDelta.updates && firstDelta.updates[0] && firstDelta.updates[0].values) {
            console.log('   Sample paths generated:');
            firstDelta.updates[0].values.slice(0, 3).forEach(value => {
              console.log(`     - ${value.path}: ${value.value}`);
            });
            if (firstDelta.updates[0].values.length > 3) {
              console.log(`     - ... and ${firstDelta.updates[0].values.length - 3} more`);
            }
          }
        }
        
        if (result.response.errors && result.response.errors.length > 0) {
          console.log(`   ⚠️  Errors: ${result.response.errors.length}`);
        }
      } else {
        console.log('❌ FAILED');
        console.log(`   Status: ${result.status}`);
        console.log(`   Response: ${JSON.stringify(result.response || result.rawResponse, null, 2)}`);
      }
    } catch (error) {
      console.log('❌ ERROR');
      console.log(`   ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        console.log('   Make sure Visual Analyzer server is running on port 8081');
        console.log('   Run: npm run server');
        break;
      }
    }
    
    console.log('');
  }
  
  console.log('Testing completed! 🎉');
  console.log('');
  console.log('To start the Visual Analyzer server:');
  console.log('  npm run build:server && npm run server');
}

// Run the tests
runAllTests();
