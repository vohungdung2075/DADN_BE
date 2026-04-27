import jwt from 'jsonwebtoken'

const authMiddleware = (req, res, next) =>
{
  const authHeader = req.headers.authorization;
  if(!authHeader || !authHeader.startsWith("Bearer "))
  {
    return res.status(401).json({message: 'Unauthorized - Missing or invalid token format'})
  }
  const token = authHeader.split(" ")[1];
  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  }
  catch(err)
  {
    return res.status(403).json({message: 'Invalid or Expired Token'})
  }

} 
export default {authMiddleware}