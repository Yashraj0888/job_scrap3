import { NextRequest } from 'next/server';
import { createTransporter, buildBody } from '@/lib/mailer';
import { getDB } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get('mb_session');
  if (!sessionCookie) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let userEmail = '';
  try {
    const user = JSON.parse(sessionCookie.value);
    userEmail = user.email;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  const { campaignId } = await req.json();
  if (!campaignId) {
    return new Response(JSON.stringify({ error: 'campaignId is required' }), { status: 400 });
  }

  const db = await getDB();
  // Get campaign details
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ? AND user_email = ?', [campaignId, userEmail]);
  if (!campaign) {
    return new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 404 });
  }

  // Get failed or pending contacts for this campaign
  const nonSentContacts = await db.all(
    "SELECT * FROM contacts WHERE campaign_id = ? AND status IN ('failed', 'pending')", 
    [campaignId]
  );
  if (nonSentContacts.length === 0) {
    return new Response(JSON.stringify({ error: 'No failed or pending contacts found for this campaign' }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const sendStatus = (phase: string, message: string, extra?: object) => {
        send({ type: 'status', phase, message, ...extra });
      };

      // Set status back to pending in DB for retried contacts
      for (const contact of nonSentContacts) {
        await db.run("UPDATE contacts SET status = 'pending', error_message = NULL WHERE id = ?", [contact.id]);
      }
      // Reset campaign status to active
      await db.run("UPDATE campaigns SET status = 'active' WHERE id = ?", [campaignId]);

      let transporter;
      try {
        console.log('🔐 Auth: Verifying Gmail credentials for retry…');
        sendStatus('auth', 'Verifying Gmail credentials…');
        transporter = createTransporter(campaign.sender_email, campaign.sender_password);
        await transporter.verify();
        console.log('✅ Auth: Credentials verified successfully.');
        sendStatus('auth_ok', 'Gmail authenticated successfully ✓');
      } catch {
        send({ error: 'Authentication failed. Check your App Password.', done: true });
        // Set contacts back to failed status if auth fails
        for (const contact of nonSentContacts) {
          await db.run("UPDATE contacts SET status = 'failed', error_message = 'Auth failed during retry' WHERE id = ?", [contact.id]);
        }
        await db.run("UPDATE campaigns SET status = 'failed' WHERE id = ?", [campaignId]);
        controller.close();
        return;
      }

      let sentCount = campaign.sent_count || 0;
      // Recalculate failed count (subtract the number of contacts we are retrying)
      let failedCount = (campaign.failed_count || 0) - nonSentContacts.filter(c => c.status === 'failed').length;
      if (failedCount < 0) failedCount = 0;
      const total = nonSentContacts.length;

      console.log(`🚀 Campaign retry started: ${total} contacts queued. Campaign ID: ${campaignId}`);
      sendStatus('campaign_start', `Retrying campaign — ${total} unsent/failed contacts queued`, { campaignId, total });

      for (let i = 0; i < total; i++) {
        const contact = nonSentContacts[i];

        // Check if user requested to stop the campaign
        try {
          const currentCampaign = await db.get('SELECT status FROM campaigns WHERE id = ?', [campaignId]);
          if (currentCampaign && currentCampaign.status === 'stopped') {
            console.log(`Campaign ${campaignId} was stopped by user request during retry.`);
            send({ status: 'stopped', error: 'Campaign stopped by user.', done: true });
            controller.close();
            return;
          }
        } catch (dbErr) {
          console.error('Error checking campaign stop status:', dbErr);
        }

        // Send template build
        const body = buildBody(campaign.body, contact.name);
        const emailSubject = buildBody(campaign.subject, contact.name);

        try {
          console.log(`📤 [Retry ${i + 1}/${total}] Dispatching to ${contact.email}…`);
          sendStatus('sending', `Retrying email ${i + 1} of ${total} → ${contact.email}`, { email: contact.email, index: i });
          
          await transporter.sendMail({
            from: campaign.sender_email,
            to: contact.email,
            subject: emailSubject,
            text: body,
          });
          console.log(`✅ [Retry ${i + 1}/${total}] Delivered to ${contact.email}`);

          sentCount++;
          
          try {
            await db.run(`
              UPDATE contacts
              SET status = 'sent', sent_subject = ?, sent_body = ?, sent_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [emailSubject, body, contact.id]);

            await db.run(`
              UPDATE campaigns
              SET sent_count = ?, failed_count = ?
              WHERE id = ?
            `, [sentCount, failedCount, campaignId]);
          } catch (dbErr) {
            console.error('DB update sent success error:', dbErr);
          }

          send({
            index: i,
            total,
            email: contact.email,
            name: contact.name,
            status: 'sent',
            subject: emailSubject,
            body: body,
            sentCount,
            failedCount,
          });
        } catch (err: any) {
          failedCount++;
          const errMsg = err.message || String(err);

          try {
            await db.run(`
              UPDATE contacts
              SET status = 'failed', error_message = ?, sent_subject = ?, sent_body = ?, sent_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [errMsg, emailSubject, body, contact.id]);

            await db.run(`
              UPDATE campaigns
              SET sent_count = ?, failed_count = ?
              WHERE id = ?
            `, [sentCount, failedCount, campaignId]);
          } catch (dbErr) {
            console.error('DB update failed error:', dbErr);
          }

          send({
            index: i,
            total,
            email: contact.email,
            name: contact.name,
            status: 'failed',
            subject: emailSubject,
            body: body,
            error: errMsg,
            sentCount,
            failedCount,
          });
        }

        // Wait 1 second between retries to keep it fast
        if (i < total - 1) {
          console.log(`⚡ Retry wait 1s before next dispatch.`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // Mark Campaign Completed in SQLite
      try {
        const currentCampaign = await db.get('SELECT status FROM campaigns WHERE id = ?', [campaignId]);
        if (currentCampaign && currentCampaign.status !== 'stopped') {
          await db.run(`
            UPDATE campaigns
            SET status = 'completed'
            WHERE id = ?
          `, [campaignId]);
        }
      } catch (dbErr) {
        console.error('DB update completed error:', dbErr);
      }

      send({ done: true, total, sentCount, failedCount });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
