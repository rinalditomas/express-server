var axios = require('axios');
const nodemailer = require('nodemailer');

let sendMessageToWhatsApp = async (message) => {
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

  return await axios(config);
};

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

module.exports = {
  sendEmailWithInvoice,
  sendMessageToWhatsApp
};
