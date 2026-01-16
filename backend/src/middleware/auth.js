const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Token requerido',
      message: 'Debes proporcionar un token de autenticación',
      code: 'MISSING_TOKEN'
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET no configurado');
      return res.status(500).json({
        error: 'Error de configuración',
        message: 'JWT_SECRET no está configurado en el servidor',
        code: 'CONFIG_ERROR'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el usuario aún existe y está activo
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Usuario no válido',
        message: 'El usuario no existe o está inactivo',
        code: 'INVALID_USER'
      });
    }

    req.user = user;
    next();
  } catch (error) {

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Token inválido',
        message: 'El token proporcionado no es válido',
        code: 'INVALID_TOKEN',
        details: error.message
      });
    }

    return res.status(403).json({
      error: 'Token inválido',
      message: 'El token proporcionado no es válido',
      code: 'INVALID_TOKEN',
      details: error.message
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Debes estar autenticado para acceder a este recurso',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tienes permisos para acceder a este recurso',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole
};
