const jwt = require('jsonwebtoken');

// Authentication middleware
const auth = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Add user info to request
        req.user = decoded;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Token verification failed'
            });
        }
    }
};

// Role-based authorization middleware
const authorize = (roles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. Authentication required.'
            });
        }

        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.'
            });
        }

        next();
    };
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
        
        next();
    } catch (error) {
        // Don't fail, just continue without user info
        next();
    }
};

module.exports = {
    auth,
    authorize,
    optionalAuth
};

// Default export for backward compatibility
module.exports = auth;