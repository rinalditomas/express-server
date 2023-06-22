import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';

var axios = require('axios');
const generatePDF = require('./generate_pdf');
const fs = require('fs');

export const app = express();

app.use(cors({ origin: true }));

app.use(express.json());
app.use(express.raw({ type: 'application/vnd.custom-type' }));
app.use(express.text({ type: 'text/html' }));

// Healthcheck endpoint
app.get('/', (req, res) => {
  res.status(200).send({ status: 'ok' });
});

const api = express.Router();

api.get('/hello', (req, res) => {
  res.status(200).send({ message: 'hello world' });
});

async function uploadMedia(mediaData, contentType, authToken) {
  try {
    const response = await axios.post(
      'https://express-server-production-ebc4.up.railway.app/webhook/v1/media',
      mediaData,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': contentType
        }
      }
    );

    const mediaId = response.data.id;
    console.log(`Media uploaded successfully. Media ID: ${mediaId}`);
    return mediaId;
  } catch (error) {
    console.error('Failed to upload media:', error);
    throw error;
  }
}

function sendMessage() {
  const data = {
    messaging_product: 'whatsapp',
    to: `${process.env.PHONE_TO}`,
    type: 'text',
    text: {
      preview_url: false,
      body: 'How many hours did you work the past month?'
    }
  };

  const config = {
    method: 'post',
    url: `https://graph.facebook.com/v16.0/${process.env.APP_ID}/messages`,
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(data)
  };

  return axios(config);
}

app.get('/ask', (req, res) => {
  sendMessage();
});
app.get('/media', async (req, res) => {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    resend.emails.send({
      from: 'rinalditomas@gmail.com',
      to: 'rinalditomas@gmail.com',
      subject: 'Hello World',
      html: '<p>Congrats on sending your <strong>SECOND email</strong>!</p>'
    });
  } catch (error) {
    console.log(error);
  }

  // const pdfPath = await generatePDF('176');

  // console.log(pdfPath);
  // try {
  //   const mediaData = fs.readFileSync(pdfPath);
  //   const contentType = 'document';
  //   const authToken = process.env.ACCESS_TOKEN;

  //   await uploadMedia(mediaData, contentType, authToken);
  // } catch (error) {
  //   console.error('Failed to read media file:', error);
  // }
});

app.post('/webhook', async (req, res) => {
  console.log(
    'HERE IS THE CONSOLE.LOG IN WEBHOOK POST',
    JSON.stringify(req.body, null, 2)
  );
  const message = req.body.entry[0].changes[0].value;

  // // info on WhatsApp text message payload: https://developers.facebook.com/docs/w
  if (message.type === 'text') {
    const hoursWorked = parseFloat(message.text.body);

    console.log(hoursWorked);
    console.log(typeof hoursWorked);

    if (!isNaN(hoursWorked)) {
      // Call the function to generate the PDF
      const pdfPath = await generatePDF(hoursWorked);

      console.log(pdfPath);
      // Send the generated PDF to the user
      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: process.env.PHONE_TO,
        type: 'document',
        document: {
          id: 'your-media-id',
          filename: pdfPath
        }
      };

      console.log('THIS IS MESSAGE DATA', messageData);
      const config = {
        method: 'post',
        url: `https://graph.facebook.com/v16.0/${process.env.APP_ID}/messages`,
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(messageData)
      };

      try {
        let responseFromChat = await axios(config);

        console.log(responseFromChat);
      } catch (error) {
        console.log(error);
      }

      // ... continue with the remaining steps of your workflow ...

      res.sendStatus(200);
    } else {
      console.log(
        'Invalid input. Please enter a valid number of hours worked.'
      );
      // Handle the case when the user enters an invalid number
      res.sendStatus(400);
    }
  }
});

// Accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get('/webhook', (req, res) => {
  /**
   * UPDATE YOUR VERIFY TOKEN
   *This will be the Verify Token value when you set up webhook
   **/
  const verify_token = process.env.VERIFY_TOKEN;

  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === verify_token) {
      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Version the api
app.use('/api/v1', api);
