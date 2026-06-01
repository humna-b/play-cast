import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();  

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: "weathersportifyteam@gmail.com",
    pass: "stnyiaraqnatomgs",
  },
});

export async function sendWelcomeEmail(toEmail, userName) {
  const mailOptions = {
    from: `"WEATHER SPORTIFY" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Welcome to Our App!',
    html: `<h1>Hello ${userName} 👋</h1>
           <p>Thank you for registering with us. We're excited to have you!</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
} 
export async function sendFriendRequestEmail(toEmail, toName, fromName) {
  const mailOptions = {
    from: `"WEATHER SPORTIFY" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${fromName} sent you a friend request!`,
    html: `
      <h2>Hey ${toName} 👋</h2>
      <p><strong>${fromName}</strong> just sent you a friend request!</p>
      <p>Check all your friend requests <a href="https://your-domain.com/dashboard/find-friends">here</a>.</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Friend request email sent:', toEmail);
  } catch (error) {
    console.error('❌ Error sending friend request email:', error);
    // Don't throw error, as friend request is already saved
  }
}
/**
 * Send email
 * @param {string|string[]} to - Email address(es)
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML content
 */
export async function sendEmail(to, subject, html) {
  const mailOptions = {
    from: `"Weather Sportify" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
  }
}
 
 export async function sendSessionInviteToCoach(coach, sessionDetails, creatorName) {
  const { sessionName, sessionStartTime, sessionEndTime } = sessionDetails;

  const emailHTML = `
    <h2>Hello Coach ${coach.firstName} ${coach.lastName},</h2>
    <p>You have been invited to conduct a session by <strong>${creatorName}</strong>.</p>
    <ul>
      <li><strong>Session:</strong> ${sessionName}</li>
      <li><strong>Start:</strong> ${new Date(sessionStartTime).toLocaleString()}</li>
      <li><strong>End:</strong> ${new Date(sessionEndTime).toLocaleString()}</li>
    </ul>
    <p>Please log in and confirm or decline this invitation:</p>
    <a href="https://your-domain.com/dashboard/sessions" style="background:#28a745;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;">Respond to Session</a>
    <br/><br/>
    <p>Best regards,<br/>Weather Sportify Team</p>
  `;

  try {
    await sendEmail(coach.email, `You're invited to coach a session: ${sessionName}`, emailHTML);
  } catch (err) {
    console.error(`Failed to send session email to coach ${coach.email}:`, err.message);
  }
}
