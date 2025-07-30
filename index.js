
const express = require('express');
const venom = require('venom-bot');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');
const dotenv = require('dotenv')
const app = express();

dotenv.config();

app.use(cors());
app.use(bodyParser.json());

let clientInstance = null;
let qrCodeImage = null; // store base64 QR

venom
  .create(
    'whatsapp-session',
    (base64Qrimg, asciiQR, attempts, urlCode) => {
      // Store QR code as base64 image
      qrCodeImage = base64Qrimg;
    },
    (statusSession, session) => {
      console.log('Session status:', statusSession);
    },
    {
      multidevice: true,
      headless: true,
      disableWelcome: true,
    }
  )
  .then((client) => {
    clientInstance = client;
    console.log('✅ WhatsApp client ready');
  })
  .catch((err) => {
    console.error('❌ Venom init failed:', err);
  });



  app.get('/qr', (req, res) => {
  if (qrCodeImage) {
   return res.json({ qr: qrCodeImage });
  } else {
    res.status(404).json({ message: 'QR not ready yet' });
  }
});



// Convert date and time to cron expression
function buildCronExpression(dateStr, timeStr) {
  const [hour, minute] = timeStr.split(':').map(Number);
  const [year, month, day] = dateStr.split('-').map(Number);

  // Cron: min hour day month weekday
  return {
    cronExpr: `${minute} ${hour} ${day} ${month} *`,
    fullDate: new Date(`${dateStr}T${timeStr}:00`)
  };
}

// Schedule message
app.post('/send-message', (req, res) => {
  const { msg,phone, date, time } = req.body;

  if (!msg || !phone || !date || !time) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const { cronExpr, fullDate } = buildCronExpression(date, time);

  const now = new Date();
  if (fullDate <= now) {
    return res.status(400).json({ message: 'Scheduled time must be in the future' });
  }

  const cleanPhone = phone.replace(/\D/g, '');
  const chatId = `${cleanPhone}@c.us`;
  const message = `${msg}`;

  // Schedule with node-cron
  const task = cron.schedule(cronExpr, () => {
    if (clientInstance) {
      clientInstance.sendText(chatId, message)
        .then(() => console.log(`✅ Sent to ${chatId} at ${new Date().toLocaleString()}`))
        .catch((err) => console.error('❌ Failed to send message:', err));
    } else {
      console.error('❌ WhatsApp client not ready');
    }

    task.stop(); // Stop this cron job after it runs once
  });

  res.json({ message: `✅ Message scheduled for ${fullDate.toLocaleString()}` });
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${process.env.PORT}`);
});
