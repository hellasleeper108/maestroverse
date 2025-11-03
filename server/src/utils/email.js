/**
 * Email Utility - Nodemailer Abstraction
 *
 * Supports multiple transport methods based on environment:
 * - Production: SMTP (SendGrid, Amazon SES, etc.)
 * - Development: Ethereal (test email service)
 * - Testing: Mock transport (no actual emails sent)
 */

import nodemailer from 'nodemailer';

let transporter = null;

/**
 * Initialize email transporter based on environment
 */
async function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const env = process.env.NODE_ENV || 'development';

  if (env === 'test') {
    // Mock transporter for testing
    transporter = {
      sendMail: async (options) => {
        console.log('[TEST EMAIL]', options);
        return { messageId: 'test-' + Date.now() };
      },
    };
    return transporter;
  }

  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    // Production SMTP configuration
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development: Use Ethereal fake SMTP service
    console.log('[EMAIL] Using Ethereal test account (dev mode)');
    const testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return transporter;
}

/**
 * Send email verification link
 */
export async function sendVerificationEmail(userEmail, verificationToken) {
  const transport = await getTransporter();

  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Maestroverse" <noreply@maestroverse.edu>',
    to: userEmail,
    subject: 'Verify Your Maestroverse Account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #14b8a6;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Welcome to Maestroverse!</h2>
          <p>Thank you for registering. Please verify your email address to activate your account.</p>

          <a href="${verificationUrl}" class="button">Verify Email Address</a>

          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>

          <p><strong>This link will expire in 24 hours.</strong></p>

          <div class="footer">
            <p>If you didn't create a Maestroverse account, please ignore this email.</p>
            <p>&copy; 2025 Maestro University. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Welcome to Maestroverse!

      Thank you for registering. Please verify your email address to activate your account.

      Verification link: ${verificationUrl}

      This link will expire in 24 hours.

      If you didn't create a Maestroverse account, please ignore this email.

      © 2025 Maestro University. All rights reserved.
    `,
  };

  try {
    const info = await transport.sendMail(mailOptions);

    // In development with Ethereal, log the preview URL
    if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
      console.log('[EMAIL] Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Failed to send verification email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset link
 */
export async function sendPasswordResetEmail(userEmail, resetToken) {
  const transport = await getTransporter();

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Maestroverse" <noreply@maestroverse.edu>',
    to: userEmail,
    subject: 'Reset Your Maestroverse Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #14b8a6;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid: #f59e0b;
            padding: 12px;
            margin: 20px 0;
          }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your Maestroverse password.</p>

          <a href="${resetUrl}" class="button">Reset Password</a>

          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>

          <p><strong>This link will expire in 1 hour.</strong></p>

          <div class="warning">
            <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
          </div>

          <div class="footer">
            <p>For security reasons, we never send your password via email.</p>
            <p>&copy; 2025 Maestro University. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Password Reset Request

      We received a request to reset your Maestroverse password.

      Reset link: ${resetUrl}

      This link will expire in 1 hour.

      SECURITY NOTICE: If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

      For security reasons, we never send your password via email.

      © 2025 Maestro University. All rights reserved.
    `,
  };

  try {
    const info = await transport.sendMail(mailOptions);

    // In development with Ethereal, log the preview URL
    if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) {
      console.log('[EMAIL] Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send security alert email (login from new device, etc.)
 */
export async function sendSecurityAlert(userEmail, alertType, details) {
  const transport = await getTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Maestroverse Security" <security@maestroverse.edu>',
    to: userEmail,
    subject: `Security Alert: ${alertType}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert {
            background-color: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 12px;
            margin: 20px 0;
          }
          .details { background-color: #f3f4f6; padding: 12px; margin: 20px 0; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Security Alert</h2>

          <div class="alert">
            <strong>${alertType}</strong>
          </div>

          <p>We detected unusual activity on your Maestroverse account.</p>

          <div class="details">
            <p><strong>Details:</strong></p>
            <pre>${JSON.stringify(details, null, 2)}</pre>
          </div>

          <p>If this was you, no action is needed. If you don't recognize this activity, please:</p>
          <ol>
            <li>Change your password immediately</li>
            <li>Review your recent account activity</li>
            <li>Contact support if needed</li>
          </ol>

          <div class="footer">
            <p>&copy; 2025 Maestro University. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Failed to send security alert:', error);
    return { success: false, error: error.message };
  }
}
