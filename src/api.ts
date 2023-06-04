import express from 'express';
import cors from 'cors';
var axios = require('axios');
const generatePDF = require('./');


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

app.post('/webhook', async (req, res) => {
  const message = req.body.entry[0].changes[0].value.messages[0];
  console.log(typeof message);

  if (message.type === 'text') {
    const hoursWorked = parseFloat(message.text.body);

    if (!isNaN(hoursWorked)) {
      // Call the function to generate the PDF
      const pdfPath = await generatePDF(hoursWorked);

      // Send the generated PDF to the user
      const messageData = {
        recipient_type: 'individual',
        to: process.env.PHONE_TO,
        type: 'document',
        document: {
          id: 'your-media-id',
          filename: pdfPath
        }
      };

      const config = {
        method: 'post',
        url: `https://graph.facebook.com/v16.0/${process.env.APP_ID}/messages`,
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(messageData)
      };

      await axios(config);

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
