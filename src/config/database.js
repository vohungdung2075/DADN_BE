import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const connect = async () =>
{
  if (!process.env.MONGO_URL) {
    throw new Error('MONGO_URL is required in environment variables');
  }

  try {
    await mongoose.connect(process.env.MONGO_URL, {
      autoIndex: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });
    console.log("Database connected successfully!");
  } catch (err) {
    console.error("Connection Failed", err.message);
    throw err;
  }
};