const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory rate limiting (per Vercel serverless instance)
const rateMap = new Map();
const RATE_LIMIT = 3; // max submissions
const RATE_WINDOW = 60 * 60 * 1000; // per hour

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many messages. Please try again later.' });
  }

  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    await resend.emails.send({
      from: 'Matt Hasson Portfolio <contact@matthasson.com>',
      to: 'matthew.hasson93@gmail.com',
      replyTo: email,
      subject: subject ? `[matthasson.com] ${subject}` : `[matthasson.com] New message from ${name}`,
      text: `New contact form submission from matthasson.com\n\nFrom: ${name} (${email})\nSubject: ${subject || '(none)'}\n\n${message}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%); padding: 24px 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.5px;">matthasson.com</h1>
            <p style="color: #8888aa; margin: 4px 0 0; font-size: 13px;">New contact form submission</p>
          </div>
          <div style="padding: 28px 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 80px; vertical-align: top;">From</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500;">${escapeHtml(name)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; vertical-align: top;">Email</td>
                <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #4f46e5; text-decoration: none; font-size: 14px;">${escapeHtml(email)}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; vertical-align: top;">Subject</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px;">${escapeHtml(subject || '(none)')}</td>
              </tr>
            </table>
            <div style="border-top: 1px solid #f3f4f6; padding-top: 20px;">
              <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">Message</p>
              <div style="background: #f9fafb; border-radius: 6px; padding: 16px; white-space: pre-wrap; color: #374151; font-size: 14px; line-height: 1.6;">${escapeHtml(message)}</div>
            </div>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 16px;">Sent via contact form on matthasson.com</p>
        </div>
      `
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
