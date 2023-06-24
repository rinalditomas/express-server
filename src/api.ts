import express from 'express';
import cors from 'cors';

const generatePDF = require('./generate_pdf');
const {
  sendEmailWithInvoice,
  sendMessageToWhatsApp
} = require('./utils/helperFunctions');

// const fs = require('fs');

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

app.post('/webhook', async (req, res) => {
  console.log('Received webhook request:', JSON.stringify(req.body, null, 2));

  if (
    req.body &&
    req.body.entry &&
    req.body.entry[0] &&
    req.body.entry[0].changes &&
    req.body.entry[0].changes[0] &&
    req.body.entry[0].changes[0].value &&
    req.body.entry[0].changes[0].value.messages &&
    req.body.entry[0].changes[0].value.messages[0]
  ) {
    console.log('Message event detected');

    try {
      const hoursWorked =
        req.body.entry[0].changes[0].value.messages[0].text.body;
      const isNumber = !isNaN(hoursWorked);

      if (isNumber) {
        // The value is a number
        let messageToCreatePDF =
          'The value entered is a number, we are creating your PDF';
        sendMessageToWhatsApp(messageToCreatePDF);

        const pdfPath = await generatePDF(hoursWorked);

        console.log('This is the PDF Path', pdfPath);

        let messagePDFCreated =
          'PDF generated successfully, you will shortly receive it in your email.';
        await sendMessageToWhatsApp(messagePDFCreated);

        await sendEmailWithInvoice(pdfPath);

        res.status(200).send({ message: messagePDFCreated });
      } else {
        // The value is not a number
        let message =
          'The value entered is not a number, please enter a number to generate an invoice';
        sendMessageToWhatsApp(message);
        res.status(404).send({ message: message });
      }
    } catch (error) {
      console.error(error);
      res.status(500).send({ message: error });
    }
  } else {
    console.log('Invalid webhook request');
    res.status(500).send({ message: 'Invalid request' });
  }
});


app.get('/ask', async (req, res) => {
  let message = 'How many hours did you work the past month?';
  await sendMessageToWhatsApp(message);
  res.status(200).send({ message: message });
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
