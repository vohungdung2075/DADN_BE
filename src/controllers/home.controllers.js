import homeServices from "../services/home.services.js";

const handleGetMyHomes = async (req, res) => {
	try {
		const homes = await homeServices.getListHomesByUser(req.user.id);
		res.status(200).json(homes);
	} catch (err) {
		res.status(500).json({ error: "Internal server error" });
	}
};

const handleAddMember = async (req, res) => {
	const { email, role } = req.body;
	const { homeId } = req.params;

	if (!role) {
		return res.status(400).json({ error: "Role is required" });
	}
	if (!email) {
		return res.status(400).json({ error: "Email is required" });
	}

	try {
		await homeServices.addMemberToHome(homeId, email, role);
		res.status(200).json({ message: "Add member successfully" });
	} catch (err) {
		if (err.message === "INVALID_ROLE")
			return res
				.status(400)
				.json({ error: "Role must be member or guest" });
		if (err.message === "USER_NOT_FOUND")
			return res.status(404).json({ error: "User not found" });
		if (err.message === "MEMBER_ALREADY_EXISTS")
			return res.status(400).json({ error: "Member already exists" });
		res.status(500).json({ error: "Internal server error" });
	}
};

const handleGetHomeMembers = async (req, res) => {
	const { homeId } = req.params;

	try {
		const members = await homeServices.getMembersByHome(homeId);
		res.status(200).json(members);
	} catch (err) {
		res.status(500).json({ error: "Internal server error" });
	}
};

const handleUpdateMemberRole = async (req, res) => {
	const { homeId, userId } = req.params;
	const { role } = req.body;

	if (!role) {
		return res.status(400).json({ error: "Role is required" });
	}

	try {
		const member = await homeServices.updateMemberRoleInHome(
			homeId,
			userId,
			role,
		);
		res.status(200).json({
			message: "Update member role successfully",
			member,
		});
	} catch (err) {
		if (err.message === "INVALID_ROLE")
			return res
				.status(400)
				.json({ error: "Role must be member or guest" });
		if (err.message === "MEMBER_NOT_FOUND")
			return res
				.status(404)
				.json({ error: "Member not found in this home" });
		if (err.message === "CANNOT_UPDATE_OWNER")
			return res.status(400).json({ error: "Cannot change owner role" });
		res.status(500).json({ error: "Internal server error" });
	}
};

const handleRemoveMember = async (req, res) => {
	const { homeId, userId } = req.params;

	try {
		await homeServices.removeMemberFromHome(homeId, userId);
		res.status(200).json({ message: "Remove member successfully" });
	} catch (err) {
		if (err.message === "MEMBER_NOT_FOUND")
			return res
				.status(404)
				.json({ error: "Member not found in this home" });
		if (err.message === "CANNOT_REMOVE_OWNER")
			return res.status(400).json({ error: "Cannot remove owner" });
		res.status(500).json({ error: "Internal server error" });
	}
};

export default {
	handleGetMyHomes,
	handleAddMember,
	handleGetHomeMembers,
	handleUpdateMemberRole,
	handleRemoveMember,
};
