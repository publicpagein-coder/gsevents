import https from "https";
import { MOCK_OTP } from "./auth.service";

export async function sendOtpViaMSG91(phone: string, otp: string): Promise<void> {
  const authKey = process.env["MSG91_AUTH_KEY"];

  if (!authKey) {
    console.warn(
      `[MSG91] MSG91_AUTH_KEY not set — mock OTP for ${phone} is: ${MOCK_OTP} (dev only)`,
    );
    return;
  }

  const templateId = process.env["MSG91_TEMPLATE_ID"];
  if (!templateId) {
    console.warn("[MSG91] MSG91_TEMPLATE_ID not set — skipping OTP send");
    return;
  }

  // MSG91 Send OTP v5 API
  const params = new URLSearchParams({
    template_id: templateId,
    mobile: phone,
    authkey: authKey,
    otp,
  });

  await new Promise<void>((resolve, reject) => {
    const req = https.get(
      `https://api.msg91.com/api/v5/otp?${params.toString()}`,
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`MSG91 responded with status ${res.statusCode}: ${data}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("MSG91 request timed out"));
    });
  });
}
