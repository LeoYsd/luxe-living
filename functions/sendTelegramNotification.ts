import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        try {
            await base44.auth.me();
        } catch (authError) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            request_id,
            property_title,
            property_id,
            user_name,
            user_email,
            check_in,
            check_out,
            guests,
            has_conflict
        } = body;

        const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const adminChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID');

        if (!telegramBotToken || !adminChatId) {
            console.warn('Telegram credentials not configured');
            return Response.json({ 
                success: true,
                message: 'Notification skipped - Telegram not configured'
            });
        }

        const conflictEmoji = has_conflict ? '⚠️' : '✅';
        const conflictText = has_conflict ? 'CONFLICT DETECTED' : 'NO CONFLICTS';

        const message = `${conflictEmoji} AVAILABILITY CHECK REQUEST

📍 Property: ${property_title}
🆔 Property ID: ${property_id}

👤 Guest Details:
• Name: ${user_name}
• Email: ${user_email}
• Guests: ${guests}

📅 Requested Dates:
• Check-in: ${check_in}
• Check-out: ${check_out}

${conflictText}

Request ID: ${request_id}`;

        const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
        
        const telegramResponse = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: adminChatId,
                text: message,
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '✅ Approve',
                            callback_data: `approve_${request_id}`
                        },
                        {
                            text: '❌ Reject',
                            callback_data: `reject_${request_id}`
                        }
                    ]]
                }
            })
        });

        const telegramData = await telegramResponse.json();
        
        if (telegramData.ok) {
            console.log('✅ Telegram notification sent to admin');
            return Response.json({ 
                success: true,
                message: 'Admin notified via Telegram'
            });
        } else {
            console.error('Telegram API error:', telegramData);
            return Response.json({ 
                success: false,
                error: 'Failed to send Telegram notification'
            });
        }

    } catch (error) {
        console.error('Error sending notification:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});