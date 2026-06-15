import dotenv from 'dotenv';
dotenv.config();

const KIE_API_KEY = process.env.KIE_API_KEY as string;
const TASK_ID = 'ed289a136c7352684218da918187d71a';

async function pollTask() {
  console.log('🔄 Polling task:', TASK_ID);
  
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    const response = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${TASK_ID}`, {
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`
      }
    });

    const data = await response.json() as any;
    const state = data.data?.state as string;
    const progress = data.data?.progress as number;

    console.log(`Attempt ${attempts + 1} — State: ${state} | Progress: ${progress}%`);

    if (state === 'success') {
      const resultJson = JSON.parse(data.data.resultJson as string) as any;
      console.log('✅ Video listo!');
      console.log('URL:', resultJson.resultUrls?.[0]);
      break;
    }

    if (state === 'fail') {
      console.log('❌ Falló:', data.data.failMsg);
      break;
    }

    attempts++;
    await new Promise(r => setTimeout(r, 5000));
  }
}

pollTask().catch(console.error);