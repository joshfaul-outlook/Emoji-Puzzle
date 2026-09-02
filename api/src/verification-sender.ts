import { EmailClient } from "@azure/communication-email";

export interface VerificationSender {
  sendPlayerVerificationCode(destination: string, code: string): Promise<void>;
}

class ConsoleVerificationSender implements VerificationSender {
  async sendPlayerVerificationCode(destination: string, code: string) {
    console.info(`[local verification] ${destination}: ${code}`);
  }
}

class AzureVerificationSender implements VerificationSender {
  private readonly client: EmailClient;
  private readonly senderAddress: string;

  constructor(connectionString: string, senderAddress: string) {
    this.client = new EmailClient(connectionString);
    this.senderAddress = senderAddress;
  }

  async sendPlayerVerificationCode(destination: string, code: string) {
    try {
      const poller = await this.client.beginSend({
        senderAddress: this.senderAddress,
        recipients: { to: [{ address: destination }] },
        content: {
          subject: `${code} is your Emojizzle verification code`,
          plainText: `Your Emojizzle verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
          html: `<p>Your Emojizzle verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>It expires in 10 minutes. If you did not request this code, you can ignore this email.</p>`,
        },
      });
      const result = await poller.pollUntilDone();
      if (result.status !== "Succeeded") throw new Error("unsuccessful status");
    } catch {
      throw new Error("Verification email delivery failed");
    }
  }
}

let cachedSender: VerificationSender | null = null;

export function verificationSender() {
  if (cachedSender) return cachedSender;
  if (process.env.VERIFICATION_SENDER === "console") {
    if (process.env.NODE_ENV === "production") throw new Error("Console verification sender is disabled in production");
    cachedSender = new ConsoleVerificationSender();
    return cachedSender;
  }
  const connectionString = process.env.ACS_EMAIL_CONNECTION_STRING;
  const senderAddress = process.env.ACS_EMAIL_SENDER_ADDRESS;
  if (!connectionString || !senderAddress) throw new Error("Azure verification email is not configured");
  cachedSender = new AzureVerificationSender(connectionString, senderAddress);
  return cachedSender;
}
