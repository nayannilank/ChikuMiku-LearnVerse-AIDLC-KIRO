/**
 * Unit tests for AwsNotificationService.
 * Verifies channel selection (SES email / SNS SMS), command shapes, and the
 * From-address requirement, using injected fake SDK clients (no real AWS).
 */

import { SendEmailCommand, type SESClient } from '@aws-sdk/client-ses';
import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import { AwsNotificationService } from './aws-notification-service';

function makeSes() {
  const send = jest.fn().mockResolvedValue({});
  return { send } as unknown as SESClient & { send: jest.Mock };
}

function makeSns() {
  const send = jest.fn().mockResolvedValue({});
  return { send } as unknown as SNSClient & { send: jest.Mock };
}

describe('AwsNotificationService.sendOTP', () => {
  it('sends an SES email when email is present', async () => {
    const ses = makeSes();
    const sns = makeSns();
    const svc = new AwsNotificationService({
      fromAddress: 'noreply@chikumiku.com',
      sesClient: ses,
      snsClient: sns,
    });

    await svc.sendOTP({ email: 'a@example.com', phone: '' }, '123456');

    expect(ses.send).toHaveBeenCalledTimes(1);
    expect(sns.send).not.toHaveBeenCalled();
    const command = ses.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input.Source).toBe('noreply@chikumiku.com');
    expect(command.input.Destination.ToAddresses).toEqual(['a@example.com']);
    expect(command.input.Message.Body.Text.Data).toContain('123456');
  });

  it('sends an SNS SMS when phone is present', async () => {
    const ses = makeSes();
    const sns = makeSns();
    const svc = new AwsNotificationService({
      fromAddress: 'noreply@chikumiku.com',
      sesClient: ses,
      snsClient: sns,
    });

    await svc.sendOTP({ email: '', phone: '9990001111' }, '654321');

    expect(sns.send).toHaveBeenCalledTimes(1);
    expect(ses.send).not.toHaveBeenCalled();
    const command = sns.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PublishCommand);
    expect(command.input.PhoneNumber).toBe('9990001111');
    expect(command.input.Message).toContain('654321');
  });

  it('sends over both channels when email and phone are present', async () => {
    const ses = makeSes();
    const sns = makeSns();
    const svc = new AwsNotificationService({
      fromAddress: 'noreply@chikumiku.com',
      sesClient: ses,
      snsClient: sns,
    });

    await svc.sendOTP({ email: 'a@example.com', phone: '9990001111' }, '111222');

    expect(ses.send).toHaveBeenCalledTimes(1);
    expect(sns.send).toHaveBeenCalledTimes(1);
  });

  it('skips both channels when email and phone are empty (learner)', async () => {
    const ses = makeSes();
    const sns = makeSns();
    const svc = new AwsNotificationService({
      fromAddress: 'noreply@chikumiku.com',
      sesClient: ses,
      snsClient: sns,
    });

    await svc.sendOTP({ email: '', phone: '' }, '000000');

    expect(ses.send).not.toHaveBeenCalled();
    expect(sns.send).not.toHaveBeenCalled();
  });

  it('throws when an email must be sent but no From address is configured', async () => {
    const ses = makeSes();
    const sns = makeSns();
    const prev = process.env.SES_FROM_ADDRESS;
    delete process.env.SES_FROM_ADDRESS;
    try {
      const svc = new AwsNotificationService({ sesClient: ses, snsClient: sns });
      await expect(svc.sendOTP({ email: 'a@example.com', phone: '' }, '123456')).rejects.toThrow(
        /SES From address is not configured/
      );
      expect(ses.send).not.toHaveBeenCalled();
    } finally {
      if (prev !== undefined) process.env.SES_FROM_ADDRESS = prev;
    }
  });
});
