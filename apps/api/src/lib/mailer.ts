import { createTransport } from 'nodemailer';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
}

export interface SmtpMailerOptions {
  host: string;
  port: number;
  from: string;
}

export function createSmtpMailer({ host, port, from }: SmtpMailerOptions): Mailer {
  const transport = createTransport({
    host,
    port,
    // Mailpit in development and, in production, a relay reached over an
    // internal network or on 465. Neither wants STARTTLS forced here.
    secure: false,
    ignoreTLS: true,
  });

  return {
    async send(mail: OutgoingMail): Promise<void> {
      await transport.sendMail({ from, ...mail });
    },
  };
}

export interface MemoryMailer extends Mailer {
  readonly sent: readonly OutgoingMail[];
  clear(): void;
}

/** Used by tests and by any environment that must not talk to a real relay. */
export function createMemoryMailer(): MemoryMailer {
  const sent: OutgoingMail[] = [];

  return {
    sent,
    async send(mail: OutgoingMail): Promise<void> {
      sent.push(mail);
    },
    clear(): void {
      sent.length = 0;
    },
  };
}
