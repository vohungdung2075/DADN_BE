import Users from "../models/user.models.js";
import Homes from "../models/home.model.js";
import HomeMembers from "../models/homeMember.model.js";
import Devices from "../models/device.model.js";
import DeviceLogs from "../models/deviceLog.model.js";
import DeviceStates from "../models/deviceState.model.js";
import { registerHomeMqttClient } from "../mqtt/mqttClient.js";

const getAllUsers = async () => {
	return await Users.find()
		.select("-password -passwordResetToken -passwordResetExpires")
		.sort({ createdAt: -1 });
};

const createHome = async (homeData, ownerId) => {
	const owner = await Users.findById(ownerId);
	if (!owner) throw new Error("USER_NOT_FOUND");

	const newHome = await Homes.create(homeData);

	await HomeMembers.create({
		userId: owner._id,
		homeId: newHome._id,
		role: "owner",
	});

	try {
		await registerHomeMqttClient(newHome);
	} catch (err) {
		if (err.message !== "MQTT_NOT_INITIALIZED" && err.message !== "HOME_MQTT_NOT_CONFIGURED") {
			console.error(
				`Register MQTT client failed for home ${newHome._id}:`,
				err,
			);
		}
	}

	return newHome;
};

const deleteHome = async (homeId) => {
	const deletedHome = await Homes.findByIdAndDelete(homeId);
	if (!deletedHome) throw new Error("HOME_NOT_FOUND");

	await Promise.all([
		HomeMembers.deleteMany({ homeId }),
		Devices.deleteMany({ homeId }),
		DeviceLogs.deleteMany({ homeId }),
		DeviceStates.deleteMany({ homeId }),
	]);

	return deletedHome;
};

export default { getAllUsers, createHome, deleteHome };
