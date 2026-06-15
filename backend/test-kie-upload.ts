import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config({ path: "../.env" });

const KIE_API_KEY = process.env.KIE_API_KEY as string;
const UPLOAD_ENDPOINT = "https://kieai.redpandaai.co/api/file-stream-upload";

async function testUpload() {
  console.log("Testing KIE.ai file upload...");
  console.log("API Key:", KIE_API_KEY ? "OK" : "NOT FOUND");

  const variationsDir = path.join(__dirname, "uploads/variations");
  const allFiles = fs.readdirSync(variationsDir, { recursive: true }) as string[];
  const imageFile = allFiles.find(f => f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".webp"));

  if (!imageFile) { console.log("No image found"); return; }
  console.log("Using image:", imageFile);

  const fileBuffer = fs.readFileSync(path.join(variationsDir, imageFile));
  const blob = new Blob([fileBuffer], { type: "image/jpeg" });
  const formData = new FormData();
  formData.append("file", blob, imageFile);
  formData.append("uploadPath", "images/sanads");

  const response = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
    body: formData
  });

  const data = await response.json() as any;
  console.log("Status:", response.status);
  console.log("Response:", JSON.stringify(data, null, 2));
}

testUpload().catch(console.error);
