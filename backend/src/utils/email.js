const nodemailer = require('nodemailer');
require('dotenv').config();

// Configure Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD, // Use App Password for Gmail
  },
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error('Email service error:', error);
  } else if (success && process.env.NODE_ENV !== 'test') {
    console.log('✓ Email service ready');
  }
});

/**
 * Send invitation email to a new user
 */
async function sendInvitationEmail(toEmail, invitationToken, invitedByName) {
  try {
    const signupUrl = `${process.env.FRONTEND_URL}/signup?token=${invitationToken}`;
    
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: toEmail,
      subject: `You're invited to join IssueTrack CRM`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">IssueTrack CRM</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">Customer Service Intelligence</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
            <h2 style="color: #333; margin-top: 0;">Welcome!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              <strong>${invitedByName}</strong> has invited you to join <strong>IssueTrack CRM</strong>.
            </p>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Click the button below to create your account and get started:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signupUrl}" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 6px;
                display: inline-block;
                font-weight: bold;
                font-size: 16px;
              ">
                Accept Invitation & Sign Up
              </a>
            </div>
            
            <p style="color: #999; font-size: 13px; line-height: 1.6;">
              Or copy and paste this link in your browser:<br/>
              <span style="word-break: break-all; color: #667eea;">${signupUrl}</span>
            </p>
            
            <p style="color: #999; font-size: 13px; line-height: 1.6; border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 30px;">
              This invitation expires in 7 days. If you did not expect this invitation, you can ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `
You've been invited to join IssueTrack CRM!

${invitedByName} has invited you to join our platform.

Click the link below to sign up:
${signupUrl}

This invitation expires in 7 days.
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✓ Invitation email sent to ${toEmail}`);
    return result;
  } catch (error) {
    console.error('Error sending invitation email:', error);
    throw error;
  }
}

module.exports = { sendInvitationEmail };
