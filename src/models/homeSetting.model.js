import mongoose from "mongoose";

const homeSettingSchema = new mongoose.Schema({
	homeId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "homes",
		required: true,
	},
	tempMax: {
		type: Number,
		default: null,
	},
	tempMin: {
		type: Number,
		default: null,
	},
	humidMax: {
		type: Number,
		default: null,
	},
	humidMin: {
		type: Number,
		default: null,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

homeSettingSchema.index({ homeId: 1 }, { unique: true });

const HomeSettings = mongoose.model("homeSettings", homeSettingSchema);
export default HomeSettings;
