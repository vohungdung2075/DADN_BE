import jwt from 'jsonwebtoken'
import Users from '../models/user.models.js';
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import utils from '../utils/utils.js';
import 'dotenv';

const login = async (email, password) =>
{
    
    const user = await Users.findOne({email: email });
    if(!user) throw new Error("USER_NOT_FOUND");
     const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch) throw new Error("INCORRECT_PASSWORD");
    const token = utils.generateToken(user._id,user.email,user.role)
  return {
    token,
    user: {
      id: user._id,
      email: user.email,
      role: user.role
    }
  };
};
const signUp = async (username, email, password, role) =>
{
  const existUsername = await Users.findOne({username: username})
  if (existUsername) throw new Error("USERNAME_EXISTED");
  const existEmail = await Users.findOne({email:email})
 if (existEmail) throw new Error("EMAIL_EXISTED");
   const hashedpassword = await bcrypt.hash(password, 10);
  const user = await Users.create({
    username,
    email,
    password:hashedpassword,
    role,
})
  const token = utils.generateToken(user)
  return {
    token,
    user : {
      id: user._id,
      username,
      email,
      role
    }
    
  }
}
const forgotPassword = async(email) =>
{
  const user = await Users.findOne({email})
  if(!user) throw new Error("The email doest not exist")
    // Create a random token 
  const resetToken = crypto.randomBytes(32).toString('hex');
  // Save Token to DB
  user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.passwordResetExpires = Date.now() + 10*60*1000;
  await user.save();
  const resetURL = `http://localhost:3000/reset-password/${resetToken}`
  const message = `You have just received this email as you had asked for reset your password. Click on this link  \n\n ${resetURL} \n\n It will expire within 10 minutes.`;
  try {
    await utils.sendEmail(
      {
        email: user.email,
        subject: '[IOT APP] Password reset request',
        message: message,
      }
    )
    return { status: 'success', message: 'Token đã được gửi tới email!' };
  }
  catch(err)
  {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    console.error('Email sent Error:', err);
    throw new Error('Please Retry later')
  }

}
const resetPassword = async (token, newPassword) =>
{
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = Users.find(
    {
      passwordResetToken: hashedToken,
      passwordResetExpires: {$gt:Date.now()} // still valid token
    }
  )
  if(!user) throw new Error('Invalid Token or Expired Token')
  user.password = await bcrypt.hash(newPassword, 10);
  //disable token
  user.passwordResetExpires = undefined;
  user.passwordResetToken = undefined;
  user.save();
  return {message: "Password changed successfully!"};
}
  
export default {login, signUp, forgotPassword, resetPassword}