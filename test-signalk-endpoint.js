#!/usr/bin/env node

/**
 * Test script for the SignalK transformation endpoint
 */

const http = require('http');

const testData = {
  // Test with a simple NMEA 2000 wind data message
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
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/transform/signalk',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing SignalK transformation endpoint...');
console.log('Sending test data:', JSON.stringify(testData, null, 2));

const req = http.request(options, (res) => {
  console.log(`\nResponse status: ${res.statusCode}`);
  console.log(`Response headers:`, res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\nResponse body:');
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.log('\nRaw response body:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
  console.log('Make sure the Visual Analyzer server is running on port 8080');
});

req.write(postData);
req.end();
