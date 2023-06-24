import express from 'express';
import cors from 'cors';
const nodemailer = require('nodemailer');

var axios = require('axios');
const generatePDF = require('./generate_pdf');
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

api.get('/hello', (req, res) => {
  res.status(200).send({ message: 'hello world' });
});

function sendMessageToWhatsApp(message) {
  const data = {
    messaging_product: 'whatsapp',
    to: `${process.env.PHONE_TO}`,
    type: 'text',
    text: {
      preview_url: false,
      body: message
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

let sendEmailWithInvoice = async (pdfPath) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'tomas.invoices@gmail.com', // Your Gmail email address
      pass: process.env.EMAIL_PASSWORD // Your Gmail password or an application-specific password if you have enabled 2-step verification
    }
  });

  // Define the email options
  const mailOptions = {
    from: 'tomas.invoices@gmail.com', // Sender email address
    to: 'rinalditomas@gmail.com', // Recipient email address
    subject: 'Invoice',
    text: 'Please find attached the invoice PDF.',
    attachments: [
      {
        filename: 'invoice.pdf', // The name to display for the attached file
        path: pdfPath // The path to the PDF file you want to attach
      }
    ]
  };

  // Send the email
  await transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
};

app.get('/ask', async (req, res) => {
  let message = 'How many hours did you work the past month?';
  await sendMessageToWhatsApp(message);
  res.status(200).send({ message: message });
});
app.get('/media', async (req, res) => {
  // Create a transporter using the default SMTP transport

  let pdfPath = await generatePDF('120');
  console.log('PDF PATH', pdfPath);
});

app.post('/webhook', async (req, res) => {
  const hoursWorked = req.body.entry[0].changes[0].value.messages[0].text.body;
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
    let message = 'The value entered is not a number, please enter a number to generate an invoice';
    sendMessageToWhatsApp(message);
    res.status(404).send({ message: message });
  }

  // // info on WhatsApp text message payload: https://developers.facebook.com/docs/w
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
