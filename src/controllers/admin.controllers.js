import adminServices from "../services/admin.services.js";

const handleGetAllUsers = async (req, res) => {
	try {
		const users = await adminServices.getAllUsers();
		return res.status(200).json(users);
	} catch (err) {
		return res.status(500).json({ message: "Internal server error" });
	}
};

const handleCreateHome = async (req, res) => {
	try {
		const { name } = req.body;
		const { userId } = req.params;
		if (!name) {
			return res.status(400).json({ error: "Home name is required" });
		}

		const home = await adminServices.createHome(req.body, userId);
		return res
			.status(201)
			.json({ message: "Create home successfully", home });
	} catch (err) {
		if (err.message === "USER_NOT_FOUND") {
			return res.status(404).json({ error: "Owner user not found" });
		}
		return res.status(500).json({ error: "Internal server error" });
	}
};

const handleDeleteHome = async (req, res) => {
	try {
		const { homeId } = req.params;
		await adminServices.deleteHome(homeId);
		return res.status(200).json({ message: "Delete home successfully" });
	} catch (err) {
		if (err.message === "HOME_NOT_FOUND") {
			return res.status(404).json({ error: "Home not found" });
		}
		return res.status(500).json({ error: "Internal server error" });
	}
};

export default { handleGetAllUsers, handleCreateHome, handleDeleteHome };
