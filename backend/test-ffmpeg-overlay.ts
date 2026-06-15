import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
dotenv.config({ path: "../.env" });
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const videoPath = "uploads/videos/7554092e-7615-48db-ac76-414874d4997f/kling3_1781325555499.mp4";
const outputPath = "uploads/videos/test_overlay_output.mp4";
const copyText = "Tu auto merece el mejor cuidado. Ceramic coating profesional desde $299.";
const fontFile = "C:/Windows/Fonts/arialbd.ttf";

async function testOverlay() {
  console.log("Testing FFmpeg overlay...");
  
  const escapedText = copyText.replace(/'/g, "\\'").replace(/:/g, "\\:");
  const filterComplex = `format=yuv420p,drawtext=fontfile='${fontFile}':text='Tu auto merece el mejor cuidado':fontsize=42:fontcolor=white:shadowcolor=black:shadowx=3:shadowy=3:box=1:boxcolor=black@0.6:boxborderw=15:x=(w-text_w)/2:y=h-th-80:fix_bounds=1`;

  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilter(filterComplex)
      .outputOptions(["-map 0:1", "-map 0:0?", "-c:a copy"])
      .output(outputPath)
      .on("start", (cmd: string) => console.log("FFmpeg cmd:", cmd.slice(0, 200)))
      .on("end", () => { console.log("✅ Overlay aplicado!"); console.log("Output:", outputPath); resolve(); })
      .on("error", (e: Error) => { console.log("❌ Error:", e.message); reject(e); })
      .run();
  });
}

testOverlay().catch(console.error);
