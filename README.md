ZeroMissCall Bot v2.0
AI-powered missed call text-back for plumbing businesses. When a call goes unanswered, the bot texts the caller within 60 seconds, holds a full AI conversation, detects emergencies, and logs everything to MongoDB.

What it does

✅ Plays a voice greeting when a call comes in
✅ Detects missed/unanswered calls and texts back within 60 seconds
✅ AI-powered back-and-forth conversation (GPT-4o-mini)
✅ Emergency keyword detection — alerts owner instantly via SMS
✅ Full conversation history stored in MongoDB
✅ Multi-tenant — one server handles unlimited plumber clients
✅ Fallback message if OpenAI is unavailable


Setup
1. Clone and install
bashgit clone https://github.com/yourusername/zeromisscall-bot
cd zeromisscall-bot
npm install
2. Set environment variables
Copy .env.example to .env and fill in your values:
bashcp .env.example .env
VariableWhere to get itTWILIO_ACCOUNT_SIDTwilio Console > Account InfoTWILIO_AUTH_TOKENTwilio Console > Account InfoOPENAI_API_KEYplatform.openai.com > API KeysMONGODB_URIMongoDB Atlas > Connect > Drivers
3. Deploy to Railway

Push your code to GitHub
Go to railway.app > New Project > Deploy from GitHub
Add all environment variables in Railway's Variables tab
Railway gives you a public URL like https://zeromisscall-bot.up.railway.app

4. Configure Twilio webhooks
In your Twilio Console, for each plumber's number:
Voice settings:

A call comes in → Webhook → POST → https://your-railway-url.up.railway.app/voice
Call Status Callback → https://your-railway-url.up.railway.app/missed-call

Messaging settings:

A message comes in → Webhook → POST → https://your-railway-url.up.railway.app/incoming-sms

5. Add a plumber to MongoDB
Insert a document into the plumbers collection:
json{
  "twilioNumber": "+15551234567",
  "businessName": "Dave's Plumbing Co.",
  "ownerName": "Dave",
  "ownerPhone": "+15559876543",
  "serviceArea": "Austin, TX and surrounding areas",
  "hours": "Mon-Fri 8am-6pm, Sat 9am-2pm",
  "emergencyAvailable": true,
  "active": true,
  "customFaqs": [
    {
      "question": "Are you licensed and insured?",
      "answer": "Yes, fully licensed and insured in Texas. Certificate available on request."
    },
    {
      "question": "Do you offer free quotes?",
      "answer": "Yes, we always give a clear quote before any work starts. No surprises."
    }
  ]
}

How the conversation flow works
Customer calls plumber number
        ↓
/voice — plays greeting, hangs up
        ↓
/missed-call — fires when call ends
        ↓
Bot texts: "Hey! Sorry we missed you..."
        ↓
Customer replies
        ↓
/incoming-sms — receives reply
  → Emergency? → Alert owner NOW via SMS
  → Load conversation history from MongoDB
  → Send to OpenAI with business context
  → Save AI reply to MongoDB
  → Send reply to customer
        ↓
Continue until job is captured

MongoDB collections
plumbers
One document per plumber client. Contains all business config.
conversations
One document per (twilioNumber + callerNumber) pair per day.
Stores full message history with timestamps and emergency flag.

Emergency detection
The following keywords trigger an immediate SMS alert to the plumber:
burst, flooding, flooded, flood, leak, leaking, pipe burst, broken pipe, no hot water, no water, gas leak, gas smell, sewage, overflow, overflowing, emergency, urgent, asap, immediately, help, water everywhere, ceiling leaking, ceiling dripping
The AI also shifts to emergency mode — advising the customer to shut off their water valve and letting them know the owner is on the way.

Coming next

 Web dashboard for plumbers to view conversations
 Stripe subscription + onboarding flow
 Per-plumber analytics (calls handled, jobs captured)
 Webhook to notify plumber via email as well as SMS
