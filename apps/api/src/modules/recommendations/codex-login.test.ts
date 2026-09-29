import { describe, expect, it } from "vitest";
import { parseDeviceAuthOutput } from "./codex-login";

describe("parseDeviceAuthOutput", () => {
  it("extracts the verification URL and user code", () => {
    const text = `
To sign in, visit https://auth.openai.com/codex/device
and enter code: ABCD-EFGH
`;
    expect(parseDeviceAuthOutput(text)).toEqual({
      verificationUrl: "https://auth.openai.com/codex/device",
      userCode: "ABCD-EFGH",
    });
  });

  it("strips ANSI color and does not treat authorization as a device code", () => {
    const text =
      "\u001B[32mhttps://auth.openai.com/codex/device\u001B[0m device authorization code: WXYZ-1234";
    expect(parseDeviceAuthOutput(text)).toEqual({
      verificationUrl: "https://auth.openai.com/codex/device",
      userCode: "WXYZ-1234",
    });
  });

  it("prefers the ChatGPT OAuth authorize URL", () => {
    const authorize =
      "https://auth.openai.com/oauth/authorize?response_type=code&client_id=app_EMoamEEZ73f0CkXaXp7hrann&redirect_uri=http%3A%2F%2F127.0.0.1%3A1455%2Fauth%2Fcallback&scope=openid+profile";
    const text = `Open ${authorize}\nalso https://auth.openai.com/codex/device`;
    expect(parseDeviceAuthOutput(text)).toEqual({
      verificationUrl: authorize,
      userCode: null,
    });
  });
});
