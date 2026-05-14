const authorizeHomeRole = (...allowedRoles) => {
	return (req, res, next) => {
		const tenantRole = req.tenantRole || (req.user && req.user.tenantRole);
		if (!tenantRole || !allowedRoles.includes(tenantRole)) {
			return res
				.status(403)
				.json({
					message: "You do not have right to access this function",
				});
		}
		next();
	};
};

const authorizeSystemRole = (...allowedRoles) => {
	return (req, res, next) => {
		if (!req.user || !allowedRoles.includes(req.user.role)) {
			return res
				.status(403)
				.json({
					message: "Just system admin can access this function",
				});
		}
		next();
	};
};

export default { authorizeHomeRole, authorizeSystemRole };
