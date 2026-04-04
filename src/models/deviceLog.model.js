import mongoose from "mongoose";

const deviceLogSchema = new mongoose.Schema({
    feed: {
        type: String,
        required: true,
        trim: true,
    },
    value: {
        type: String,
        required: true,
    },
    createdAt: {
		type: Date,
		default: Date.now,
	},
});

const DeviceLogs = mongoose.model("deviceLogs", deviceLogSchema);
export default DeviceLogs;