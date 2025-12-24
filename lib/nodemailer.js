import nodemailer from "nodemailer"

//*In nodemailer we need smtp server , but in "resend" we don't need any smtp info , and it is a modern way to send mails 
//*This is just for example

const testAccount = await nodemailer.createTestAccount();  //!createTestAccount is the inbuilt method in nodemailer that feteches and gives the mail of the etheral account , and we can access that as testAccount.user 

// Create a test account or replace with real credentials.
const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: testAccount.user, //"pearlie60@ethereal.email"
    pass: testAccount.pass, //"46KXYQ5p3H2mc8Sbwu"
  }, 
});

export const sendEmail = async ({to , subject , html}) => {  //!getting to,subject,html from sendEmail function as parameter
    const info = await transporter.sendMail({
        from : `'URL SHORTENER' < ${testAccount.user} >`,
        to,
        subject,
        html,
    });

    const testEmailURL = nodemailer.getTestMessageUrl(info); //! getTestMessageUrl is the inbuilt function and we are printing this on the console/terminal
    console.log("Verify Email : " , testEmailURL);
};
