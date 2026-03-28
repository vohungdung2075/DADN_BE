import mqtt from 'mqtt';
import express from 'express';
import {Server} from 'socket.io';
import http from 'http';
import cors from 'cors';
import 'dotenv/config';
import {connect} from './config/database.js'
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {cors : {origin: '*'}});
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT;
httpServer.listen(PORT, async ()=>{
  await connect();
  console.log(`Server is running on ${PORT}`)
})


