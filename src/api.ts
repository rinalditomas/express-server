import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import {
  sendEmailWithInvoice,
  sendMessageToWhatsApp,
  parseParameter
} from './utils/helperFunctions';
import { generatePDF } from './generate_pdf';

export const app = express();

app.use(cors({ origin: true }));

app.use(express.json());
app.use(express.raw({ type: 'application/vnd.custom-type' }));
app.use(express.text({ type: 'text/html' }));

// Healthcheck endpoint
app.get('/', (req, res) => {
  res.status(200).send({ status: 'ok' });
});
app.get('/send', async (req, res) => {
  const message = 'How many hours did you work the past month?';
  await sendMessageToWhatsApp(message);
  res.status(200).send({ status: 'ok' });
});

const api = express.Router();

app.post('/webhook', async (req, res) => {

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
    const parameter = req.body.entry[0].changes[0].value.messages[0].text.body;

    let parsedParameter = parseParameter(parameter);

    try {
      const isNumber = !isNaN(parsedParameter.hours);

      if (isNumber) {
        // The value is a number
        let messageToCreatePDF =
          'The value entered is a number, we are creating your PDF';
        sendMessageToWhatsApp(messageToCreatePDF);

        const pdfPath = await generatePDF(
          parsedParameter.hours,
          parsedParameter.invoiceNumber
        );

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

// Schedule the task to run on the 1st of every month at 10:00 am
cron.schedule('0 10 * * *', async () => {
  try {
    const message = 'How many hours did you work the past month?';
    await sendMessageToWhatsApp(message);
  } catch (error) {
    console.error(error);
  }
});

app.get('/webhook', (req, res) => {
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
