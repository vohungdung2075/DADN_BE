
# IoT Application with MQTT & WebSocket

## Overview
This IoT application uses MQTT and WebSocket protocols to receive real-time messages, with Adafruit integration and MongoDB for data persistence.

## Features
- **MQTT Protocol**: Subscribe to topics and handle IoT device messages
- **WebSocket**: Real-time bidirectional communication between client and server
- **Adafruit Integration**: Connect and manage Adafruit IoT service
- **MongoDB**: Store and query collected sensor data
- **Real-time Updates**: Push notifications to connected clients

## Tech Stack
- **Broker**: Adafruit IO (MQTT)
- **Communication**: WebSocket, MQTT
- **Database**: MongoDB
- **Runtime**: Node.js / Python (specify your choice)

## Installation

```bash
# Clone repository
git clone <repo-url>
cd project

# Install dependencies
npm install  # or pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Configure MQTT_USERNAME, MQTT_PASSWORD, MONGODB_URI, etc.
```

## Configuration

Create `.env` file:
```
ADAFRUIT_USERNAME=your_username
ADAFRUIT_KEY=your_key
MQTT_BROKER=io.adafruit.com
MONGODB_URI=mongodb://localhost:27017/iot_app
WEBSOCKET_PORT=8080
```

## Usage

```bash
npm start  # or python app.py
```

## Project Structure
```
.
├── src/
├── config/
├── routes/
├── models/
└── README.md
```

## License
MIT
