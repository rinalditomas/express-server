import puppeteer from 'puppeteer';
import { join } from 'path';
declare const document: any;

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

  return `${day} ${month}, ${year}`;
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
export function getPreviousMonth(): string {
  const currentDate = new Date();
  const previousMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() - 1
  );

  const month = previousMonth.toLocaleString('default', { month: 'long' });
  const year = previousMonth.getFullYear();

  return `${month} ${year}`;
}

export async function generatePDF(hours, invoiceNumber) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    const indexPath = join(__dirname, '../src/index.html');

    await page.goto(`file://${indexPath}`);

    const issueDate = formatDate();
    const hourlyPrice = 20;
    const hoursWorked = hours;
    const totalAmountToCharge = hoursWorked * hourlyPrice;
    let previousMonth = getPreviousMonth();

    const { startDate, endDate } = getWorkingDayRange();
    const workingDayRange = `(from ${startDate} to ${endDate})`;

    await page.evaluate(
      (
        invoiceNumber,
        issueDate,
        workingDayRange,
        totalAmountToCharge,
        hoursWorked,
        hourlyPrice
      ) => {
        document.querySelector(
          '#invoice-number'
        ).innerText = `Nº ${invoiceNumber}`;
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

    await page.waitForSelector('#pdf-content');

    const pdfPath = `Invoice Pharm-it ${previousMonth}.pdf`;

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      scale: 0.5
    });

    await browser.close();

    console.log(`PDF generated successfully! PDF path: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}
