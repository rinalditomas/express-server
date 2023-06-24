import puppeteer from 'puppeteer';
import path = require('path');
declare const document: any; // Add this line to resolve the error

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function formatDate() {
  const currentDate = new Date();
  const day = currentDate.getDate();
  const month = months[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  const formattedDate = `${day} ${month}, ${year}`;
  return formattedDate;
}

function getWorkingDayRange() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate the previous month
  const previousMonth = month === 0 ? 11 : month - 1;
  const previousYear = month === 0 ? year - 1 : year;

  // Get the first day of the previous month
  const firstDay = new Date(previousYear, previousMonth, 1);

  // Move to the first working day of the previous month
  while (firstDay.getDay() === 0 || firstDay.getDay() === 6) {
    firstDay.setDate(firstDay.getDate() + 1);
  }

  // Get the last day of the previous month
  const lastDay = new Date(year, month, 0);

  // Move to the last working day of the previous month
  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    lastDay.setDate(lastDay.getDate() - 1);
  }

  // Format the dates as "day month year"
  const formattedFirstDay = `${firstDay.getDate()} ${
    months[firstDay.getMonth()]
  } ${previousYear}`;
  const formattedLastDay = `${lastDay.getDate()} ${
    months[lastDay.getMonth()]
  } ${previousYear}`;

  return {
    startDate: formattedFirstDay,
    endDate: formattedLastDay
  };
}

async function generatePDF(hours) {
  console.log('The hours entered in the function to generate PDF', hours);
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    const indexPath = path.resolve(__dirname, '../src/index.html');

    // Navigate to the HTML file or URL
    await page.goto('file://' + indexPath);

    // Variables to be passed to the HTML
    const invoiceNumber = 'Nº 0017';
    const issueDate = formatDate();
    let hourlyPrice = 20;
    let hoursWorked = hours;
    let totalAmountToCharge = hoursWorked * hourlyPrice;

    const { startDate, endDate } = getWorkingDayRange();
    let workingDayRange = `(from ${startDate} to ${endDate})`;

    console.log('Changing values in PDF');
    // Inject variables into the HTML page
    await page.evaluate(
      (
        invoiceNumber,
        issueDate,
        workingDayRange,
        totalAmountToCharge,
        hoursWorked,
        hourlyPrice
      ) => {
        // Access the DOM elements and set their innerText or value based on the variables
        document.querySelector('#invoice-number').innerText = invoiceNumber;
        document.querySelector('#issue-date').innerText = issueDate;
        document.querySelector('#working-range').innerText = workingDayRange;
        document.querySelector('#hourly-price').innerText = hourlyPrice;
        document.querySelector('#hours-worked').innerText = hoursWorked;
        document.querySelector('#total-hours').innerText = totalAmountToCharge;
        document.querySelector('#total-before-tax').innerText =
          totalAmountToCharge;
        document.querySelector('#base-to-tax').innerText = totalAmountToCharge;
        document.querySelector('#total-after-tax').innerText =
          totalAmountToCharge;
      },
      invoiceNumber,
      issueDate,
      workingDayRange,
      totalAmountToCharge,
      hoursWorked,
      hourlyPrice
    );

    // Wait for any necessary content to load
    await page.waitForSelector('#pdf-content');

    const pdfPath = 'invoice.pdf';
    console.log('Generating the PDF...');

    // Generate the PDF
    await page.pdf({
      path: 'invoice.pdf',
      format: 'A4',
      printBackground: true,
      scale: 0.5
    });

    await browser.close();

    console.log(`PDF generated successfully! PDF path: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    console.log('There was an error generating the pdf', error);
    return error;
  }
}

// generatePDF().catch((error) => {
//   console.error("Error generating PDF:", error);
// });

module.exports = generatePDF;
