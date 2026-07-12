import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { createTransporter, buildBody } from '@/lib/mailer';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const STATE_FILE_PATH = path.join(process.cwd(), 'outreach_state.json');

function getDailySentCount(): { date: string; count: number } {
  const todayStr = new Date().toLocaleDateString('en-US');
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf-8'));
      if (data.date === todayStr) {
        return { date: todayStr, count: data.count || 0 };
      }
    }
  } catch (err) {
    console.error('Error reading state:', err);
  }
  return { date: todayStr, count: 0 };
}

function incrementDailySentCount(currentCount: number) {
  const todayStr = new Date().toLocaleDateString('en-US');
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify({ date: todayStr, count: currentCount + 1 }), 'utf-8');
  } catch (err) {
    console.error('Error saving state:', err);
  }
}

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get('mb_session');
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userEmail = '';
  try {
    const user = JSON.parse(sessionCookie.value);
    userEmail = user.email;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const db = await getDB();

  // Find all campaigns that were paused due to daily rate limit
  const heldCampaigns = await db.all(
    `SELECT * FROM campaigns WHERE user_email = ? AND status = 'held_rate_limit'`,
    [userEmail]
  );

  if (heldCampaigns.length === 0) {
    return NextResponse.json({ message: 'No held campaigns to resume.' });
  }

  // Trigger background resume dispatches without blocking the request
  (async () => {
    for (const campaign of heldCampaigns) {
      const dailyState = getDailySentCount();
      if (dailyState.count >= 380) {
        console.log('Daily safe sending cap of 380 already reached. Deferring resume.');
        break;
      }

      // Get remaining pending contacts
      const pendingContacts = await db.all(
        `SELECT * FROM contacts WHERE campaign_id = ? AND status = 'pending'`,
        [campaign.id]
      );

      if (pendingContacts.length === 0) {
        // Mark as completed if no contacts are left
        await db.run(`UPDATE campaigns SET status = 'completed' WHERE id = ?`, [campaign.id]);
        continue;
      }

      let transporter;
      try {
        transporter = createTransporter(campaign.sender_email, campaign.sender_password);
        await transporter.verify();
      } catch (err) {
        console.error(`Failed to verify credentials for campaign ${campaign.id}:`, err);
        await db.run(
          `UPDATE campaigns SET status = 'failed' WHERE id = ?`,
          [campaign.id]
        );
        continue;
      }

      // Mark campaign back as active
      await db.run(`UPDATE campaigns SET status = 'active' WHERE id = ?`, [campaign.id]);

      let sentCount = campaign.sent_count || 0;
      let failedCount = campaign.failed_count || 0;

      for (let i = 0; i < pendingContacts.length; i++) {
        const contact = pendingContacts[i];

        // Double check daily cap limit inside the loop
        const currentDailyState = getDailySentCount();
        if (campaign.enable_safe_mode && currentDailyState.count >= 380) {
          console.log(`Campaign ${campaign.id} hit daily cap again. Pausing.`);
          await db.run(`UPDATE campaigns SET status = 'held_rate_limit' WHERE id = ?`, [campaign.id]);
          return;
        }

        // Selected variation template
        const body = buildBody(campaign.body, contact.name);
        const emailSubject = buildBody(campaign.subject, contact.name);

        try {
          await transporter.sendMail({
            from: campaign.sender_email,
            to: contact.email,
            subject: emailSubject,
            text: body,
          });

          sentCount++;
          const updatedState = getDailySentCount();
          incrementDailySentCount(updatedState.count);

          await db.run(`
            UPDATE contacts
            SET status = 'sent', sent_subject = ?, sent_body = ?, sent_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [emailSubject, body, contact.id]);
        } catch (sendErr: any) {
          failedCount++;
          await db.run(`
            UPDATE contacts
            SET status = 'failed', error_message = ?, sent_subject = ?, sent_body = ?, sent_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [sendErr.message || String(sendErr), emailSubject, body, contact.id]);
        }

        // Update campaign counters in DB
        await db.run(`
          UPDATE campaigns
          SET sent_count = ?, failed_count = ?
          WHERE id = ?
        `, [sentCount, failedCount, campaign.id]);

        // Jitter delay: 1-15 seconds in safe mode, else 1 second
        if (i < pendingContacts.length - 1) {
          const delay = campaign.enable_safe_mode
            ? Math.floor(Math.random() * (15000 - 1000 + 1)) + 1000
            : 1000;
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      // Mark Campaign Completed
      await db.run(`UPDATE campaigns SET status = 'completed' WHERE id = ?`, [campaign.id]);
    }
  })().catch((err) => console.error('Background resume worker error:', err));

  return NextResponse.json({ success: true, message: `Resuming ${heldCampaigns.length} campaigns in the background.` });
}
