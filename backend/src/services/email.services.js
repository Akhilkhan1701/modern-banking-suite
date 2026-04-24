/**
 * Email Service
 * Handles outbound email notifications using Nodemailer and Gmail OAuth2.
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Check if all required environment variables for email are present.
 */
const isEmailConfigured =
  !!process.env.EMAIL_USER &&
  !!process.env.CLIENT_ID &&
  !!process.env.CLIENT_SECRET &&
  !!process.env.REFRESH_TOKEN;

/**
 * Initialize the transporter if configuration is valid.
 */
const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
      },
    })
  : null;

/**
 * Verify email connection on startup.
 */
if (transporter) {
  transporter.verify((error) => {
    if (error) {
      console.error('Error connecting to email server:', error);
    } else {
      console.log('Email server is ready to send messages');
    }
  });
}

/**
 * Internal helper to send emails.
 */
const sendEmail = async (to, subject, text, html) => {
  try {
    if (!transporter) {
      return;
    }
    const info = await transporter.sendMail({
      from: `"Banking" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

/**
 * Sends a welcome email to newly registered users.
 */
async function sendRegistrationEmail(userEmail,name){
    const subject="Welcome to Banking App"
    const text=`Hi ${name},\n\nThank you for registering with our banking app! We're excited to have you on board.\n\nBest regards,\nBanking App Team`
    const html=`<p>Hi ${name},</p><p>Thank you for registering with our banking app! We're excited to have you on board.</p><p>Best regards,<br>Banking App Team</p>`
   
    await sendEmail(userEmail,subject,text,html)    
}

/**
 * Sends a notification for successful transactions.
 */
async function sendTransactionEmail(userEmail,name,amount,type){
    const subject="Transaction Alert"
    const text=`Hi ${name},\n\nA ${type} transaction of $${amount} has been made on your account. If you did not authorize this, please contact support.\n\nBest regards,\nBanking App Team`
    const html=`<p>Hi ${name},</p><p>A ${type} transaction of $${amount} has been made on your account. If you did not authorize this, please contact support.</p><p>Best regards,<br>Banking App Team</p>`

    await sendEmail(userEmail,subject,text,html)
}

/**
 * Sends a notification when a transaction fails.
 */
async function sendFailureEmail(userEmail,name,amount,type){
    const subject="Transaction Failed"
    const text=`Hi ${name},\n\nA ${type} transaction of $${amount} has failed. Please check your balance and try again.\n\nBest regards,\nBanking App Team`
    const html=`<p>Hi ${name},</p><p>A ${type} transaction of $${amount} has failed. Please check your balance and try again.</p><p>Best regards,<br>Banking App Team</p>`

    await sendEmail(userEmail,subject,text,html)
}



if (process.env.NODE_ENV === "test") {
  module.exports = {
    sendRegistrationEmail: async () => {},
    sendTransactionEmail: async () => {},
    sendFailureEmail: async () => {},
  };
} else {
  module.exports = {
    sendRegistrationEmail,
    sendTransactionEmail,
    sendFailureEmail,
  };
}