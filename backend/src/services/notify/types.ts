export type SendResult =
  | { status: "SENT"; providerRef?: string }
  | { status: "SKIPPED"; reason: string }
  | { status: "FAILED"; error: string };

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface WhatsAppProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SendResult>;
}
