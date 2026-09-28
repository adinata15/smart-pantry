import { createWorker } from "tesseract.js";

export interface OcrEngine {
  recognize(image: Blob): Promise<string>;
}

export function createTesseractEngine(): OcrEngine {
  return {
    async recognize(image) {
      const worker = await createWorker("eng");
      try {
        const { data } = await worker.recognize(image);
        return data.text;
      } finally {
        await worker.terminate();
      }
    },
  };
}
