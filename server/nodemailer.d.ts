declare module "nodemailer" {
  export interface Transporter {
    sendMail(mail: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }): Promise<unknown>;
  }

  export function createTransport(options: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  }): Transporter;
}
