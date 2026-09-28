import { HttpError } from "../../infra/errors";

export interface OcrEngine {
  recognize(image: Uint8Array): Promise<string>;
}

export function createServerOcrEngine(env: NodeJS.ProcessEnv = process.env): OcrEngine {
  if (env.OCR_PROVIDER === "cloud") {
    return {
      async recognize() {
        throw new HttpError(501, "ocr_unconfigured", "Cloud OCR is not configured.");
      },
    };
  }
  return {
    async recognize() {
      throw new HttpError(400, "ocr_text_required", "Send recognized text. The browser reads the image.");
    },
  };
}
