/**
 * AWS-backed NotificationService for the password-reset flow.
 *
 * Concrete implementation of the auth service's `NotificationService` port
 * (see forgot-password.ts). Delivers the OTP over whichever channels the
 * recipient has:
 *
 *   email present -> SES SendEmailCommand  (@aws-sdk/client-ses)
 *   phone present -> SNS PublishCommand    (@aws-sdk/client-sns)
 *
 * Both SDK clients are injectable (test seam), matching the constructor style
 * of AwsCognitoClient / AwsSecretsManagerClient. The From address and region
 * come from the constructor or, when omitted, the SES_FROM_ADDRESS and
 * AWS_REGION environment variables (wired by the auth CDK stack).
 *
 * A learner has no email/phone (empty strings from NeonUserRepository); those
 * channels are simply skipped, so a learner reset request is a no-op send. The
 * forgot-password handler already returns a generic message regardless.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import type { NotificationService } from '../handlers/forgot-password';

/** Options for constructing the AWS notification service. */
export interface AwsNotificationServiceOptions {
  /** Verified SES From address. Defaults to the SES_FROM_ADDRESS env var. */
  fromAddress?: string;
  /** Injectable SES client (defaults to a new client for AWS_REGION). */
  sesClient?: SESClient;
  /** Injectable SNS client (defaults to a new client for AWS_REGION). */
  snsClient?: SNSClient;
}

/** Email subject/body copy for the OTP message. */
const EMAIL_SUBJECT = 'Your ChikuMiku password reset code';
const buildBody = (otp: string): string =>
  `Your password reset code is ${otp}. It expires in 5 minutes. ` +
  `If you did not request this, you can safely ignore this message.`;

/**
 * Notification service that fans an OTP out to SES (email) and/or SNS (SMS).
 */
export class AwsNotificationService implements NotificationService {
  private readonly fromAddress?: string;
  private readonly sesClient: SESClient;
  private readonly snsClient: SNSClient;

  constructor(options: AwsNotificationServiceOptions = {}) {
    const region = process.env.AWS_REGION;
    this.fromAddress = options.fromAddress ?? process.env.SES_FROM_ADDRESS;
    this.sesClient = options.sesClient ?? new SESClient({ region });
    this.snsClient = options.snsClient ?? new SNSClient({ region });
  }

  /**
   * Sends the OTP over every channel the recipient has. Empty email/phone
   * channels are skipped. Runs the sends concurrently.
   */
  async sendOTP(
    recipient: { email: string; phone: string },
    otp: string
  ): Promise<void> {
    const sends: Promise<unknown>[] = [];

    if (recipient.email && recipient.email.trim().length > 0) {
      sends.push(this.sendEmail(recipient.email.trim(), otp));
    }

    if (recipient.phone && recipient.phone.trim().length > 0) {
      sends.push(this.sendSms(recipient.phone.trim(), otp));
    }

    await Promise.all(sends);
  }

  /** Sends the OTP email via SES. Requires a configured From address. */
  private async sendEmail(email: string, otp: string): Promise<void> {
    const source = this.requireFromAddress();
    await this.sesClient.send(
      new SendEmailCommand({
        Source: source,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: EMAIL_SUBJECT, Charset: 'UTF-8' },
          Body: { Text: { Data: buildBody(otp), Charset: 'UTF-8' } },
        },
      })
    );
  }

  /** Sends the OTP as an SMS via SNS. */
  private async sendSms(phone: string, otp: string): Promise<void> {
    await this.snsClient.send(
      new PublishCommand({
        PhoneNumber: phone,
        Message: buildBody(otp),
      })
    );
  }

  private requireFromAddress(): string {
    if (!this.fromAddress) {
      throw new Error(
        'SES From address is not configured (set SES_FROM_ADDRESS or pass fromAddress)'
      );
    }
    return this.fromAddress;
  }
}
