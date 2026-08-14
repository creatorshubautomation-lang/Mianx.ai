// Mianx.ai — Email Service (Resend)
// Free tier: 3000 emails/month
// Get API key: https://resend.com/api-keys

import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─────────────────────────────────────────────
//  Send email (best-effort — doesn't throw)
// ─────────────────────────────────────────────

export async function sendEmail(params: EmailParams): Promise<EmailResult> {
  try {
    const resend = getResend();
    const from = process.env.EMAIL_FROM || "Mianx.ai <noreply@mianx.ai>";

    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      console.error("[email] send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (e) {
    console.error("[email] exception:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─────────────────────────────────────────────
//  Email templates
// ─────────────────────────────────────────────

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: "Welcome to Mianx.ai — Your AI Software House 🚀",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Mianx.ai</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e5e5e5; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 28px; font-weight: 700; margin: 0;">
        <span style="background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">Mianx.ai</span>
      </h1>
      <p style="color: #888; font-size: 14px; margin: 4px 0 0;">Agentic Software House</p>
    </div>

    <!-- Content -->
    <div style="background: #13131a; border: 1px solid #2a2a35; border-radius: 12px; padding: 32px;">
      <h2 style="margin: 0 0 16px; font-size: 22px;">Welcome, ${name}! 👋</h2>

      <p style="line-height: 1.6; color: #b0b0b0; margin: 0 0 16px;">
        You're now part of the world's first agentic software house. Your dedicated team of 24 AI agents is ready to design, build, write, market, test, and support your projects — 24/7.
      </p>

      <div style="background: #1a1a24; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 12px; font-size: 16px; color: #a855f7;">🚀 Quick Start</h3>
        <ol style="margin: 0; padding-left: 20px; color: #b0b0b0; line-height: 1.8;">
          <li>Create your first project</li>
          <li>AI agents will be auto-assigned based on your brief</li>
          <li>Chat with your agent team in real-time</li>
          <li>Download AI-generated deliverables</li>
        </ol>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${process.env.NEXTAUTH_URL || "https://mianx-ai.vercel.app"}" 
           style="display: inline-block; background: linear-gradient(135deg, #a855f7, #06b6d4); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Go to Dashboard →
        </a>
      </div>

      <p style="line-height: 1.6; color: #888; font-size: 14px; margin: 24px 0 0;">
        Questions? Reply to this email or chat with our support agents in the dashboard.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; color: #666; font-size: 12px;">
      <p>© 2026 Mianx.ai — The agentic software house.</p>
      <p>You're receiving this because you signed up at mianx.ai</p>
    </div>
  </div>
</body>
</html>
    `,
  };
}

export function projectCreatedEmail(
  userName: string,
  projectTitle: string,
  agentCount: number,
): { subject: string; html: string } {
  return {
    subject: `🚀 Project "${projectTitle}" — ${agentCount} agents assigned`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0a0a0f; color: #e5e5e5; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="font-size: 24px;">
      <span style="background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Mianx.ai</span>
    </h1>

    <div style="background: #13131a; border: 1px solid #2a2a35; border-radius: 12px; padding: 32px; margin-top: 24px;">
      <h2 style="margin: 0 0 16px;">Hi ${userName},</h2>

      <p style="line-height: 1.6; color: #b0b0b0;">
        Your project <strong style="color: #a855f7;">"${projectTitle}"</strong> is now live! 
        We've assigned <strong>${agentCount} AI agents</strong> to work on it.
      </p>

      <div style="background: #1a1a24; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #06b6d4; font-size: 14px;">✅ Project created</p>
        <p style="margin: 8px 0 0; color: #06b6d4; font-size: 14px;">✅ ${agentCount} agents assigned</p>
        <p style="margin: 8px 0 0; color: #06b6d4; font-size: 14px;">✅ Initial tasks generated</p>
      </div>

      <p style="line-height: 1.6; color: #b0b0b0;">
        Your agent team is ready to chat. Visit your project to start the conversation.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXTAUTH_URL || "https://mianx-ai.vercel.app"}" 
           style="display: inline-block; background: linear-gradient(135deg, #a855f7, #06b6d4); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          View Project →
        </a>
      </div>
    </div>

    <p style="text-align: center; color: #666; font-size: 12px; margin-top: 32px;">
      © 2026 Mianx.ai
    </p>
  </div>
</body>
</html>
    `,
  };
}

export function agentResponseEmail(
  userName: string,
  projectTitle: string,
  agentName: string,
  agentRole: string,
  messagePreview: string,
): { subject: string; html: string } {
  // Truncate preview
  const preview =
    messagePreview.length > 200
      ? messagePreview.slice(0, 200) + "..."
      : messagePreview;

  return {
    subject: `💬 ${agentName} (${agentRole}) responded on "${projectTitle}"`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0a0a0f; color: #e5e5e5; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="font-size: 24px;">
      <span style="background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Mianx.ai</span>
    </h1>

    <div style="background: #13131a; border: 1px solid #2a2a35; border-radius: 12px; padding: 32px; margin-top: 24px;">
      <h2 style="margin: 0 0 16px;">Hi ${userName},</h2>

      <p style="line-height: 1.6; color: #b0b0b0;">
        <strong style="color: #a855f7;">${agentName}</strong> (${agentRole}) has responded to your message on project <strong>"${projectTitle}"</strong>.
      </p>

      <div style="background: #1a1a24; border-left: 3px solid #a855f7; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #b0b0b0; line-height: 1.6; font-style: italic;">
          "${preview}"
        </p>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXTAUTH_URL || "https://mianx-ai.vercel.app"}" 
           style="display: inline-block; background: linear-gradient(135deg, #a855f7, #06b6d4); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Reply to ${agentName} →
        </a>
      </div>
    </div>

    <p style="text-align: center; color: #666; font-size: 12px; margin-top: 32px;">
      © 2026 Mianx.ai — You can manage email notifications in settings.
    </p>
  </div>
</body>
</html>
    `,
  };
}

export function deliverableReadyEmail(
  userName: string,
  projectTitle: string,
  deliverableTitle: string,
  agentName: string,
): { subject: string; html: string } {
  return {
    subject: `📦 Deliverable ready — ${deliverableTitle}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0a0a0f; color: #e5e5e5; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="font-size: 24px;">
      <span style="background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Mianx.ai</span>
    </h1>

    <div style="background: #13131a; border: 1px solid #2a2a35; border-radius: 12px; padding: 32px; margin-top: 24px;">
      <h2 style="margin: 0 0 16px;">Hi ${userName},</h2>

      <p style="line-height: 1.6; color: #b0b0b0;">
        <strong style="color: #a855f7;">${agentName}</strong> has generated a new deliverable for your project <strong>"${projectTitle}"</strong>.
      </p>

      <div style="background: #1a1a24; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
        <h3 style="margin: 0; color: #06b6d4;">${deliverableTitle}</h3>
        <p style="margin: 8px 0 0; color: #888; font-size: 14px;">Ready for download</p>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXTAUTH_URL || "https://mianx-ai.vercel.app"}" 
           style="display: inline-block; background: linear-gradient(135deg, #a855f7, #06b6d4); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Download Deliverable →
        </a>
      </div>
    </div>

    <p style="text-align: center; color: #666; font-size: 12px; margin-top: 32px;">
      © 2026 Mianx.ai
    </p>
  </div>
</body>
</html>
    `,
  };
}

export function passwordResetEmail(
  name: string,
  resetUrl: string,
): { subject: string; html: string } {
  return {
    subject: "🔐 Reset your Mianx.ai password",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0a0a0f; color: #e5e5e5; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="font-size: 24px;">
      <span style="background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Mianx.ai</span>
    </h1>

    <div style="background: #13131a; border: 1px solid #2a2a35; border-radius: 12px; padding: 32px; margin-top: 24px;">
      <h2 style="margin: 0 0 16px;">Hi ${name},</h2>

      <p style="line-height: 1.6; color: #b0b0b0;">
        We received a request to reset your password. Click the button below to set a new password.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #a855f7, #06b6d4); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Reset Password →
        </a>
      </div>

      <p style="line-height: 1.6; color: #888; font-size: 14px;">
        ⚠️ This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>

      <p style="line-height: 1.6; color: #888; font-size: 14px; margin-top: 16px;">
        Or copy this link: <br>
        <span style="color: #a855f7; word-break: break-all;">${resetUrl}</span>
      </p>
    </div>

    <p style="text-align: center; color: #666; font-size: 12px; margin-top: 32px;">
      © 2026 Mianx.ai — Security team
    </p>
  </div>
</body>
</html>
    `,
  };
}

export function subscriptionActivatedEmail(
  name: string,
  planName: string,
  amount: number,
): { subject: string; html: string } {
  return {
    subject: `🎉 Welcome to ${planName} Plan!`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0a0a0f; color: #e5e5e5; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <h1 style="font-size: 24px;">
      <span style="background: linear-gradient(135deg, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Mianx.ai</span>
    </h1>

    <div style="background: #13131a; border: 1px solid #2a2a35; border-radius: 12px; padding: 32px; margin-top: 24px;">
      <h2 style="margin: 0 0 16px;">🎉 Payment successful!</h2>

      <p style="line-height: 1.6; color: #b0b0b0;">
        Hi ${name}, your <strong style="color: #a855f7;">${planName}</strong> plan is now active.
      </p>

      <div style="background: #1a1a24; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0; color: #06b6d4;">✅ Subscription active</p>
        <p style="margin: 8px 0 0; color: #06b6d4;">💰 $${amount}/month</p>
        <p style="margin: 8px 0 0; color: #06b6d4;">🚀 Full access unlocked</p>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXTAUTH_URL || "https://mianx-ai.vercel.app"}" 
           style="display: inline-block; background: linear-gradient(135deg, #a855f7, #06b6d4); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Start Building →
        </a>
      </div>
    </div>

    <p style="text-align: center; color: #666; font-size: 12px; margin-top: 32px;">
      © 2026 Mianx.ai — Thank you for your business!
    </p>
  </div>
</body>
</html>
    `,
  };
}
