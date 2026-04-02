import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true, 
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'user'
  },

  passwordResetToken: String,
  passwordResetExpires: Date,
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Users = mongoose.model('users', userSchema);
export default Users;