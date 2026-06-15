import dotenv from 'dotenv';
dotenv.config();

const KIE_API_KEY = process.env.KIE_API_KEY as string;

async function testHailuoImage() {
  console.log('🧪 Testing Hailuo 2.3 image-to-video...');

  const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
  model: 'hailuo/2-3-image-to-video-standard',
  input: {
    image_url: 'https://tempfile.redpandaai.co/kieai/11293919/images/sanads/1781324014264-igba0kif49t.jpg',
    prompt: 'Cinematic slow motion, luxury car detail shot, professional lighting',
    duration: "6",
    resolution: "768P"
  }cd
})
  });

  const data = await response.json() as any;
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

testHailuoImage().catch(console.error);
