import mongoose from "mongoose";

const deviceStateSchema = new mongoose.Schema({
    homeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'homes',
        required: true,
    },
    feed: {
        type: String,
        required: true,
        trim: true,
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

deviceStateSchema.index({ homeId: 1, feed: 1 }, { unique: true });

const DeviceStates = mongoose.model("deviceStates", deviceStateSchema);
export default DeviceStates;