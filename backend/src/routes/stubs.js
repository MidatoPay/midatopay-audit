const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { authenticateHybrid } = require('../middleware/clerkAuth');
const router = express.Router();

// Endpoints temporales para mantener compatibilidad con el frontend
// Estos endpoints serán reemplazados cuando se integre Pagos360 y Manteca
// Nota: /api/auth/create-wallet se maneja directamente en auth.js

// ============================================
// /api/midatopay/* (usado en create-payment y scan)
// ============================================
router.post('/midatopay/generate-qr', async (req, res) => {
  // Verificar si hay token, pero no requerirlo obligatoriamente
  // Esto permite que el frontend muestre el modal incluso sin autenticación completa
  const authHeader = req.headers['authorization'];
  const hasToken = authHeader && authHeader.split(' ')[1];
  
  // Si no hay token, aún así responder (para desarrollo/demo)
  // En producción, esto debería requerir autenticación
  
  // Devolver formato que el frontend espera, pero indicando que está deshabilitado
  res.status(200).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La generación de QR está temporalmente deshabilitada. Esta funcionalidad será reemplazada con la integración de Pagos360.',
    code: 'FEATURE_DISABLED'
  });
});

router.post('/midatopay/scan-qr', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El escaneo de QR está temporalmente deshabilitado. Esta funcionalidad será reemplazada con la integración de Pagos360.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/midatopay/payment-history', authenticateToken, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El historial de pagos está temporalmente deshabilitado.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/midatopay/stats', authenticateToken, async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'Las estadísticas están temporalmente deshabilitadas.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/midatopay/session/:sessionId', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'Las sesiones de pago están temporalmente deshabilitadas.',
    code: 'FEATURE_DISABLED'
  });
});

// ============================================
// /api/oracle/* (usado en conversiones)
// ============================================
router.get('/oracle/quote/:amount', async (req, res) => {
  // Devolver formato que el frontend espera, pero indicando que está deshabilitado
  res.status(200).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El oráculo de precios está temporalmente deshabilitado. Esta funcionalidad será reemplazada con la integración de Manteca.',
    code: 'FEATURE_DISABLED',
    data: null
  });
});

router.get('/oracle/rate', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El oráculo de precios está temporalmente deshabilitado.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/oracle/status', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El oráculo de precios está temporalmente deshabilitado.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/oracle/balance/:address', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de balances está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/oracle/test', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El oráculo de precios está temporalmente deshabilitado.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/oracle/price/:currency', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El oráculo de precios está temporalmente deshabilitado.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/oracle/prices', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El oráculo de precios está temporalmente deshabilitado.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/oracle/average/:currency', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El oráculo de precios está temporalmente deshabilitado.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/oracle/history/:currency', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'El oráculo de precios está temporalmente deshabilitado.',
    code: 'FEATURE_DISABLED'
  });
});

router.post('/oracle/convert', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La conversión de monedas está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

// ============================================
// /api/payments/* (usado en api.ts)
// ============================================
router.post('/payments/create', authenticateToken, async (req, res) => {
  res.status(501).json({
    error: 'Funcionalidad en desarrollo',
    message: 'La creación de pagos está temporalmente deshabilitada. Esta funcionalidad será reemplazada con la integración de Pagos360.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/payments/qr/:qrId', async (req, res) => {
  res.status(501).json({
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de pagos está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/payments/my-payments', authenticateToken, async (req, res) => {
  res.status(501).json({
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de pagos está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/payments/:paymentId', authenticateToken, async (req, res) => {
  res.status(501).json({
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de pagos está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.put('/payments/:paymentId/cancel', authenticateToken, async (req, res) => {
  res.status(501).json({
    error: 'Funcionalidad en desarrollo',
    message: 'La cancelación de pagos está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

// ============================================
// /api/transactions/* (usado en api.ts y useTransactions)
// ============================================
router.post('/transactions/create', async (req, res) => {
  res.status(501).json({
    error: 'Funcionalidad en desarrollo',
    message: 'La creación de transacciones está temporalmente deshabilitada. Esta funcionalidad será reemplazada con la integración de Pagos360 y Manteca.',
    code: 'FEATURE_DISABLED'
  });
});

router.post('/transactions/:transactionId/confirm', async (req, res) => {
  res.status(501).json({
    error: 'Funcionalidad en desarrollo',
    message: 'La confirmación de transacciones está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/transactions/:transactionId/status', async (req, res) => {
  res.status(501).json({
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de transacciones está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/transactions/my-transactions', authenticateToken, async (req, res) => {
  res.status(501).json({
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de transacciones está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/transactions/:transactionId', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de transacciones está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

// ============================================
// /api/wallet/* (usado en walletManager y OnboardingFlow)
// ============================================
router.post('/wallet/save', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La gestión de wallets está temporalmente deshabilitada. Esta funcionalidad será reemplazada con la integración de Pagos360 y Manteca.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/wallet/get', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de wallets está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/wallet/has-wallet', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de wallets está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.delete('/wallet/clear', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La gestión de wallets está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.get('/wallet/user/:email', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La consulta de wallets está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

router.post('/wallet/create-user', async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'Funcionalidad en desarrollo',
    message: 'La creación de usuarios con wallet está temporalmente deshabilitada.',
    code: 'FEATURE_DISABLED'
  });
});

module.exports = router;
