import { NextRequest } from 'next/server';
import { createTransporter, buildBody } from '@/lib/mailer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

import { getDB } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 120;

const STATE_FILE_PATH = path.join(process.cwd(), 'outreach_state.json');

// Helper to check and update persistent daily limit
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
    console.error('Error reading daily sent state:', err);
  }
  return { date: todayStr, count: 0 };
}

function incrementDailySentCount(currentCount: number) {
  const todayStr = new Date().toLocaleDateString('en-US');
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify({ date: todayStr, count: currentCount + 1 }), 'utf-8');
  } catch (err) {
    console.error('Error saving daily sent state:', err);
  }
}

// Helper to extract email domain
function getEmailDomain(email: string): string {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase().trim() : '';
}

export async function POST(req: NextRequest) {
  const {
    contacts,
    senderEmail,
    senderPassword,
    subject,
    messageBody,
    attachments,
    enableSafeMode = true,
    enableAISpintax = false,
    geminiApiKey,
  } = await req.json();

  if (!contacts || !senderEmail || !senderPassword || !subject) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
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

      const sessionCookie = req.cookies.get('mb_session');
      let userEmail = 'default@gmail.com';
      if (sessionCookie) {
        try {
          const user = JSON.parse(sessionCookie.value);
          userEmail = user.email;
        } catch {}
      }

      const db = await getDB();

      // Save credentials for the logged-in user in db
      try {
        if (userEmail && userEmail !== 'default@gmail.com') {
          const updateParams = [senderEmail, senderPassword];
          let query = 'UPDATE users SET sender_email = ?, sender_password = ?';
          if (geminiApiKey) {
            query += ', gemini_api_key = ?';
            updateParams.push(geminiApiKey);
          }
          query += ' WHERE email = ?';
          updateParams.push(userEmail);
          await db.run(query, updateParams);
        }
      } catch (dbErr) {
        console.error('Error saving user credentials to DB:', dbErr);
      }

      // 1. Generate AI Spintax variations if enabled
      let campaignTemplates = [{ subject, body: messageBody }];
      let apiKey = geminiApiKey || process.env.GEMINI_API_KEY;

      if (enableAISpintax && !apiKey && userEmail) {
        try {
          const u = await db.get('SELECT gemini_api_key FROM users WHERE email = ?', [userEmail]);
          if (u?.gemini_api_key) {
            apiKey = u.gemini_api_key;
          }
        } catch {}
      }

      if (enableAISpintax) {
        if (!apiKey) {
          console.log('✦ AI Spintax: Missing API Key.');
          sendStatus('ai_error', 'AI Spintax enabled but Gemini API Key is missing. Using original template.');
        } else {
          console.log('✦ AI Spintax: Generating message variations with Gemini…');
          sendStatus('ai_start', 'AI is crafting unique message variations…');
          try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
            const prompt = `Generate 3 unique, professional, and natural-sounding variations of both the email subject line and body text below. Keep all variables like {{Name}} exactly as they are. Output ONLY a valid JSON array of objects, where each object has a "subject" string and a "body" string (do not include any explanation or markdown wraps).

            Subject:
            ${subject}

            Body:
            ${messageBody}`;

            const response = await model.generateContent(prompt);
            const responseText = response.response.text().trim();
            // Clean up potential markdown code block wrapping
            const cleanJson = responseText.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].subject && parsed[0].body) {
              campaignTemplates = parsed;
              console.log(`✅ AI Spintax: ${campaignTemplates.length} variations generated.`);
              sendStatus('ai_done', `AI ready — ${campaignTemplates.length} message variations generated`);
            }
          } catch (err) {
            console.error('Failed to generate AI variations, falling back to original template:', err);
            sendStatus('ai_error', 'AI generation failed — using original message');
          }
        }
      }

      console.log('🔐 Auth: Verifying Gmail credentials…');
      sendStatus('auth', 'Verifying Gmail credentials…');
      let transporter;
      try {
        transporter = createTransporter(senderEmail, senderPassword);
        await transporter.verify();
        console.log('✅ Auth: Credentials verified successfully.');
        sendStatus('auth_ok', 'Gmail authenticated successfully ✓');
      } catch {
        send({ error: 'Authentication failed. Check your email and App Password.', done: true });
        controller.close();
        return;
      }

      let sentCount = 0;
      let failedCount = 0;
      const total = contacts.length;

      const campaignId = 'camp_' + Date.now();
      try {
        await db.run(`
          INSERT INTO campaigns (id, user_email, subject, body, sender_email, sender_password, total_contacts, sent_count, failed_count, status, enable_safe_mode, enable_ai_spintax)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          campaignId,
          userEmail,
          subject,
          messageBody,
          senderEmail,
          senderPassword,
          contacts.length,
          0,
          0,
          'active',
          enableSafeMode ? 1 : 0,
          enableAISpintax ? 1 : 0
        ]);

        for (let j = 0; j < contacts.length; j++) {
          const c = contacts[j];
          const contactId = `cnt_${campaignId}_${j}`;
          await db.run(`
            INSERT INTO contacts (id, campaign_id, name, email, company, status)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [contactId, campaignId, c.name || '', c.email, c.company || '', 'pending']);
        }
      } catch (dbErr) {
        console.error('Error saving campaign to DB:', dbErr);
      }

      // Track domain sends to enforce Recruiter Domain Grouping & Cool-off Guard
      const domainSentMap = new Map<string, number>();
      const lastDomainSentTime = new Map<string, number>();

      console.log(`🚀 Campaign started: ${total} contacts queued. Campaign ID: ${campaignId}`);
      sendStatus('campaign_start', `Campaign started — ${total} contacts queued for dispatch`, { campaignId });

      for (let i = 0; i < total; i++) {
        const contact = contacts[i];
        const domain = getEmailDomain(contact.email);

        // Check if user requested to stop the campaign
        try {
          const currentCampaign = await db.get('SELECT status FROM campaigns WHERE id = ?', [campaignId]);
          if (currentCampaign && currentCampaign.status === 'stopped') {
            console.log(`Campaign ${campaignId} was stopped by user request.`);
            send({ status: 'stopped', error: 'Campaign stopped by user.', done: true });
            controller.close();
            return;
          }
        } catch (dbErr) {
          console.error('Error checking campaign stop status:', dbErr);
        }

        // A. Google Rate Limit Guard: check 380 emails limit today
        const dailyState = getDailySentCount();
        if (enableSafeMode && dailyState.count >= 380) {
          try {
            await db.run('UPDATE campaigns SET status = ? WHERE id = ?', ['held_rate_limit', campaignId]);
          } catch (dbErr) {
            console.error('DB update held_rate_limit error:', dbErr);
          }
          send({
            error: 'Google Safe Guard: Daily limit of 380 emails reached. Halting outreach to protect your account.',
            done: true,
          });
          controller.close();
          return;
        }

        // B. Domain Limit check (Max 2 per domain per day)
        if (enableSafeMode && domain) {
          const sentToDomain = domainSentMap.get(domain) || 0;
          if (sentToDomain >= 2) {
            failedCount++;
            try {
              const contactId = `cnt_${campaignId}_${i}`;
              await db.run(`
                UPDATE contacts
                SET status = 'failed', error_message = ?, sent_subject = ?, sent_body = ?, sent_at = CURRENT_TIMESTAMP
                WHERE campaign_id = ? AND email = ?
              `, ['Domain limit exceeded: Max 2 recruiters per company domain per day.', subject, messageBody, campaignId, contact.email]);

              await db.run('UPDATE campaigns SET failed_count = ? WHERE id = ?', [failedCount, campaignId]);
            } catch (dbErr) {
              console.error('DB update domain limit failed error:', dbErr);
            }
            send({
              index: i,
              total,
              email: contact.email,
              name: contact.name,
              status: 'failed',
              error: 'Domain limit exceeded: Max 2 recruiters per company domain per day.',
              sentCount,
              failedCount,
            });
            continue;
          }
        }

        // C. Domain Cool-off delay check
        if (enableSafeMode && domain) {
          const lastTime = lastDomainSentTime.get(domain);
          if (lastTime) {
            const timeElapsed = Date.now() - lastTime;
            // 2 second cool-off period for the same company domain
            if (timeElapsed < 2000) {
              await new Promise((r) => setTimeout(r, 2000 - timeElapsed));
            }
          }
        }

        // Select a dynamic variation of the message (Spintax rotation)
        const selectedTemplate = campaignTemplates[i % campaignTemplates.length];
        const body = buildBody(selectedTemplate.body, contact.name);
        const emailSubject = buildBody(selectedTemplate.subject, contact.name);

        try {
          console.log(`📤 [${i + 1}/${total}] Dispatching to ${contact.name ? contact.name + ' <' + contact.email + '>' : contact.email}…`);
          sendStatus('sending', `Dispatching email ${i + 1} of ${total} → ${contact.email}`, { email: contact.email, index: i });
          await transporter.sendMail({
            from: senderEmail,
            to: contact.email,
            subject: emailSubject,
            text: body,
            attachments: attachments ? attachments.map((att: any) => ({
              filename: att.filename || att.name,
              content: Buffer.from(att.content, 'base64'),
            })) : undefined,
          });
          console.log(`✅ [${i + 1}/${total}] Delivered to ${contact.email}`);

          sentCount++;
          
          // Update persistent daily count
          const updatedState = getDailySentCount();
          incrementDailySentCount(updatedState.count);

          // Update SQLite Database Contact Status
          try {
            await db.run(`
              UPDATE contacts
              SET status = 'sent', sent_subject = ?, sent_body = ?, sent_at = CURRENT_TIMESTAMP
              WHERE campaign_id = ? AND email = ?
            `, [emailSubject, body, campaignId, contact.email]);

            await db.run(`
              UPDATE campaigns
              SET sent_count = ?, failed_count = ?
              WHERE id = ?
            `, [sentCount, failedCount, campaignId]);
          } catch (dbErr) {
            console.error('DB update sent success error:', dbErr);
          }

          // Update domain maps
          if (domain) {
            domainSentMap.set(domain, (domainSentMap.get(domain) || 0) + 1);
            lastDomainSentTime.set(domain, Date.now());
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
        } catch (err: unknown) {
          failedCount++;
          const errMsg = err instanceof Error ? err.message : String(err);

          // Update SQLite Database Contact Status
          try {
            await db.run(`
              UPDATE contacts
              SET status = 'failed', error_message = ?, sent_subject = ?, sent_body = ?, sent_at = CURRENT_TIMESTAMP
              WHERE campaign_id = ? AND email = ?
            `, [errMsg, emailSubject, body, campaignId, contact.email]);

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

        // D. Per-second countdown jitter: 1–15 seconds between each email if safe mode is enabled, else 1 second
        if (i < total - 1) {
          if (enableSafeMode) {
            const delaySec = Math.floor(Math.random() * 15) + 1; // 1 to 15 seconds
            for (let s = delaySec; s >= 1; s--) {
              // Double check stop status during countdown
              try {
                const currentCampaign = await db.get('SELECT status FROM campaigns WHERE id = ?', [campaignId]);
                if (currentCampaign && currentCampaign.status === 'stopped') {
                  console.log(`Campaign ${campaignId} was stopped during countdown.`);
                  send({ status: 'stopped', error: 'Campaign stopped by user.', done: true });
                  controller.close();
                  return;
                }
              } catch {}
              console.log(`⏳ [${i + 1}/${total}] Next email dispatching in ${s}s…`);
              sendStatus('countdown', `Next email in ${s}s`, { seconds: s });
              await new Promise((r) => setTimeout(r, 1000));
            }
          } else {
            console.log(`⚡ Safe mode disabled: wait 1s before next dispatch.`);
            await new Promise((r) => setTimeout(r, 1000));
          }
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
