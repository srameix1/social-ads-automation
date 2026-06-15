import dotenv from 'dotenv';
dotenv.config();

const KIE_API_KEY = process.env.KIE_API_KEY;

async function testHailuo() {
  console.log('🧪 Testing Hailuo 2.3 via KIE.ai...');
  console.log('API Key found:', KIE_API_KEY ? '✅' : '❌ NOT FOUND');

  const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
  model: 'hailuo/02-text-to-video-standard',
  input: {
    prompt: 'A luxury car being washed with foam, cinematic close-up shot',
    duration: "6",
    prompt_optimizer: true
  }
})
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

testHailuo().catch(console.error);