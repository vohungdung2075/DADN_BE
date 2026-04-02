import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer'
import "dotenv";
const generateToken = (id,email,role) =>{
  return jwt.sign(
    { id,
      email,
      role
    },
    process.env.JWT_SECRET,{
      expiresIn:
    process.env.JWT_EXPIRED_IN}
    
  )
}
const sendEmail = async (options) =>
{
  const transporter = nodemailer.createTransport(
    {
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    }
  );
  const mailOptions = 
  {
    from: 'IOT APP <no-reply@myapp.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };
  await transporter.sendMail(mailOptions);
}
export default {generateToken, sendEmail}