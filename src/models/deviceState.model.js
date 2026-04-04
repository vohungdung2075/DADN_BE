import mongoose from "mongoose";

const deviceStateSchema = new mongoose.Schema({
    feed: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    value: {
        type: String,
        required: true,
    },
    updatedAt: {
		type: Date,
		default: Date.now,
	},
});

const DeviceStates = mongoose.model("deviceStates", deviceStateSchema);
export default DeviceStates;