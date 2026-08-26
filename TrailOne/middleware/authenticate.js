import jwt from "jsonwebtoken";


export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) 
    return res.status(401).json({ success: false, 
                                  message: "Authentication token is required." });

  try { 
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET); 
    return next(); 
  } catch { 
    return res.status(401).json({ success: false, 
                                  message: "Your session is invalid or has expired." 
                                }); 
  }
}
