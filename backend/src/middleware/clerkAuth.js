const { createClerkClient, verifyToken } = require('@clerk/backend');
const prisma = require('../config/database');

// Inicializar Clerk client
let clerkClientInstance = null;

const getClerkClient = () => {
  if (!clerkClientInstance) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY no está configurado en las variables de entorno');
    }
    clerkClientInstance = createClerkClient({ secretKey });
  }
  return clerkClientInstance;
};

/**
 * Middleware para autenticar usando Clerk
 * Verifica el token JWT de Clerk y obtiene la información del usuario
 */
const authenticateClerk = async (req, res, next) => {
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
    const clerk = getClerkClient();
    
    // Verificar el token de sesión con Clerk
    // En @clerk/backend v2.x, verifyToken es una función exportada, no un método del cliente
    let sessionToken;
    try {
      // Usar la función verifyToken exportada directamente
      sessionToken = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY
      });
    } catch (e) {
      // Si falla, el token es inválido
      throw new Error(`Token inválido: ${e.message || 'No se pudo verificar el token'}`);
    }
    
    if (!sessionToken || !sessionToken.sub) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token proporcionado no es válido',
        code: 'INVALID_TOKEN'
      });
    }

    // Obtener información del usuario de Clerk
    const userId = sessionToken.sub;
    const clerkUser = await clerk.users.getUser(userId);

    if (!clerkUser) {
      return res.status(401).json({
        error: 'Usuario no encontrado',
        message: 'El usuario no existe en Clerk',
        code: 'USER_NOT_FOUND'
      });
    }

    // Buscar o crear el usuario en nuestra base de datos
    // Buscar por clerkId primero, luego por email
    const userEmail = clerkUser.emailAddresses[0]?.emailAddress || `user-${userId}@clerk.local`
    
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { clerkId: userId },
          { email: userEmail }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        clerkId: true,
        walletAddress: true,
        walletCreatedAt: true
      }
    });

    // Si el usuario no existe, crearlo limpio (sin datos por defecto)
    if (!user) {
      const userName = clerkUser.firstName && clerkUser.lastName 
        ? `${clerkUser.firstName} ${clerkUser.lastName}` 
        : clerkUser.username || userEmail.split('@')[0] // Usar parte del email si no hay nombre
      
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: userName, // Nombre temporal, se actualizará en onboarding
          password: '', // No necesitamos password con Clerk
          clerkId: userId,
          isActive: true,
          role: 'MERCHANT', // Usar el enum correcto
          // NO crear wallet aquí - se creará en el onboarding
          walletAddress: null,
          privateKey: null,
          publicKey: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          clerkId: true,
          walletAddress: true,
          walletCreatedAt: true
        }
      });
    } else if (!user.clerkId) {
      // Si el usuario existe pero no tiene clerkId, actualizarlo
      user = await prisma.user.update({
        where: { id: user.id },
        data: { clerkId: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          clerkId: true,
          walletAddress: true,
          walletCreatedAt: true
        }
      });
    }

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Usuario no válido',
        message: 'El usuario no existe o está inactivo',
        code: 'INVALID_USER'
      });
    }

    // Agregar información del usuario a la request
    req.user = user;
    req.clerkUser = clerkUser;
    next();
  } catch (error) {
    console.error('❌ Error en autenticación Clerk:', error.message);
    
    // Si el error tiene un status, usarlo
    if (error.status === 401 || error.message?.includes('invalid') || error.message?.includes('expired')) {
      return res.status(401).json({
        error: 'Token inválido o expirado',
        message: 'Tu sesión ha expirado o el token no es válido. Por favor, inicia sesión nuevamente.',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Si el error es sobre verificación de token, devolver 401
    if (error.message?.includes('Token inválido') || error.message?.includes('verifyToken')) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token proporcionado no es válido o no se pudo verificar.',
        code: 'INVALID_TOKEN',
        details: error.message
      });
    }

    // Para otros errores, devolver 403
    return res.status(403).json({
      error: 'Error de autenticación',
      message: 'Error al verificar el token de autenticación',
      code: 'AUTH_ERROR',
      details: error.message
    });
  }
};

/**
 * Middleware híbrido que intenta autenticar con Clerk primero, 
 * y si falla, intenta con JWT tradicional
 */
const authenticateHybrid = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Token requerido',
      message: 'Debes proporcionar un token de autenticación',
      code: 'MISSING_TOKEN'
    });
  }

  // Intentar primero con Clerk si está configurado
  if (process.env.CLERK_SECRET_KEY) {
    try {
      // Verificar si el token parece ser de Clerk (típicamente más largo y con formato específico)
      // Los tokens de Clerk suelen ser más largos que los JWT tradicionales
      // Si el token es muy corto (< 100 caracteres), probablemente es JWT
      const isLikelyJWT = token.length < 100;
      
      if (!isLikelyJWT) {
        // Intentar con Clerk primero usando la función verifyToken exportada
        try {
          // Usar la función verifyToken exportada directamente
          const sessionToken = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY
          });
          
          if (sessionToken && sessionToken.sub) {
            // Token de Clerk válido, continuar con autenticación Clerk completa
            return authenticateClerk(req, res, next);
          }
        } catch (clerkError) {
          // Token no es de Clerk o falló la verificación, continuar con JWT
          // Silenciosamente continuar con JWT
        }
      }
      
      // Si llegamos aquí, el token probablemente es JWT
      const jwtAuth = require('./auth').authenticateToken;
      return jwtAuth(req, res, next);
    } catch (error) {
      // Si hay un error, intentar con JWT como fallback
      const jwtAuth = require('./auth').authenticateToken;
      return jwtAuth(req, res, next);
    }
  } else {
    // Si Clerk no está configurado, usar JWT tradicional
    const jwtAuth = require('./auth').authenticateToken;
    return jwtAuth(req, res, next);
  }
};

module.exports = {
  authenticateClerk,
  authenticateHybrid,
  getClerkClient
};

