import authServices from "../services/auth.services.js";

const makeLogin = async (req, res) => {
	const { email, password } = req.body;
	if (!email || !password) {
		return res.status(400).json({ message: "Missing Essential Fields" });
	}

	try {
		const result = await authServices.login(email, password);
		return res.status(200).json(result);
	} catch (err) {
		if (
			err.message === "USER_NOT_FOUND" ||
			err.message === "INCORRECT_PASSWORD"
		) {
			return res.status(401).json({ message: "Invalid credentials" });
		}
		return res.status(500).json({ message: "Internal server error" });
	}
};

const signUp = async (req, res) => {
	const { username, email, password } = req.body;
	if (!username || !email || !password) {
		return res.status(400).json({ message: "Missing Essential Fields" });
	}

	try {
		const result = await authServices.signUp(username, email, password);
		return res.status(201).json(result);
	} catch (err) {
		return res.status(400).json({ message: err.message });
	}
};
const forgotPassword = async (req, res) => {
	try {
		const { email } = req.body;
		if (!email)
			return res
				.status(400)
				.json({ message: "Please provide your email" });
		const result = await authServices.forgotPassword(email);
		return res.status(201).json(result);
	} catch (err) {
		console.error("Forgot Password Error:", err);
		return res.status(400).json({ message: err.message });
	}
};
const resetPassword = async (req, res) => {
	try {
		const { token } = req.params;
		const { newPassword } = req.body;
		if (!newPassword)
			return res.status(401).json({ message: "Please enter a password" });
		const result = await authServices.resetPassword(token, newPassword);
		return res.status(200).json(result);
	} catch (err) {
		console.error("Reset password failed:", err);
		return res.status(400).json({ message: err.message });
	}
};

const handleGetMe = async (req, res) => {
	try {
		const user = await authServices.getMe(req.user.id);
		return res.status(200).json(user);
	} catch (err) {
		if (err.message === "USER_NOT_FOUND")
			return res.status(404).json({ error: "User not found" });
		return res.status(500).json({ message: "Internal server error" });
	}
};
export default {
	makeLogin,
	signUp,
	forgotPassword,
	resetPassword,
	handleGetMe,
};
