import mqtt from "mqtt";

const client = mqtt.connect("mqtt://io.adafruit.com", {
	username: process.env.AIO_USERNAME,
	password: process.env.AIO_KEY,
});

client.on("connect", () => {
	console.log("MQTT connected");
});

client.on("error", (err) => {
	console.error("MQTT error:", err);
});

export default client;
