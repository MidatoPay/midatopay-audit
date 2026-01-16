const express = require('express');
const { Webhook } = require('svix');
const prisma = require('../config/database');

const router = express.Router();

// Webhook de Clerk para sincronizar usuarios
router.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('⚠️ CLERK_WEBHOOK_SECRET no está configurado');
    return res.status(500).json({ error: 'Webhook secret no configurado' });
  }

  // Obtener headers necesarios
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Headers de Svix faltantes' });
  }

  // Verificar firma del webhook
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt;

  try {
    evt = wh.verify(req.body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('❌ Error verificando webhook de Clerk:', err.message);
    return res.status(400).json({ error: 'Firma inválida' });
  }

  const { type, data } = evt;

  try {
    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      default:
        // Tipo no manejado, continuar sin error
        break;
    }

    res.json({ received: true, type });
  } catch (error) {
    console.error('❌ Error procesando webhook:', error.message);
    res.status(500).json({ error: 'Error procesando webhook', message: error.message });
  }
});

// Manejar creación de usuario
async function handleUserCreated(clerkUser) {
  const userId = clerkUser.id;
  const email = clerkUser.email_addresses?.[0]?.email_address;
  const firstName = clerkUser.first_name;
  const lastName = clerkUser.last_name;
  const username = clerkUser.username;

  if (!email) {
    return;
  }

  // Verificar si el usuario ya existe
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { clerkId: userId },
        { email: email }
      ]
    }
  });

  if (existingUser) {
    // Si existe pero no tiene clerkId, actualizarlo
    if (!existingUser.clerkId) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { clerkId: userId }
      });
    }
    return;
  }

  // Crear nombre del usuario
  const userName = firstName && lastName
    ? `${firstName} ${lastName}`
    : username || email.split('@')[0];

  // Crear usuario en la base de datos
  const user = await prisma.user.create({
    data: {
      email: email,
      name: userName,
      password: '', // No necesitamos password con Clerk
      clerkId: userId,
      isActive: true,
      role: 'MERCHANT',
      walletAddress: null,
      privateKey: null,
      publicKey: null,
    }
  });
}

// Manejar actualización de usuario
async function handleUserUpdated(clerkUser) {
  const userId = clerkUser.id;
  const email = clerkUser.email_addresses?.[0]?.email_address;
  const firstName = clerkUser.first_name;
  const lastName = clerkUser.last_name;
  const username = clerkUser.username;

  // Buscar usuario por clerkId
  const user = await prisma.user.findFirst({
    where: { clerkId: userId }
  });

  if (!user) {
    await handleUserCreated(clerkUser);
    return;
  }

  // Actualizar nombre si cambió
  const newName = firstName && lastName
    ? `${firstName} ${lastName}`
    : username || email?.split('@')[0] || user.name;

  if (newName !== user.name) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: newName }
    });
  }

  // Actualizar email si cambió
  if (email && email !== user.email) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: email }
    });
  }
}

// Manejar eliminación de usuario
async function handleUserDeleted(clerkUser) {
  const userId = clerkUser.id;

  const user = await prisma.user.findFirst({
    where: { clerkId: userId }
  });

  if (user) {
    // Marcar como inactivo en lugar de eliminar (soft delete)
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false }
    });
  }
}

module.exports = router;

