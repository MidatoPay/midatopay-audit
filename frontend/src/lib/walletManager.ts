// Wallet Manager - Genera y gestiona wallets persistentes para comercios
import { Account, RpcProvider, ec, json, constants } from 'starknet';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface MerchantWallet {
  id?: string;
  email: string;
  password: string; // Hash de la contraseña
  privateKey: string;
  publicKey: string;
  address: string;
  createdAt: string;
}

export class WalletManager {
  private static readonly STORAGE_KEY = 'midatopay_merchant_wallet';
  private static readonly SEPOLIA_RPC = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_9/b6oJemkCmlgEGq1lXC5uTXwOHZA14WNP';

  // Generar nueva wallet para comercio
  static generateWallet(email: string, password: string): MerchantWallet {
    // Generar clave privada aleatoria
    const privateKey = ec.starkCurve.utils.randomPrivateKey();
    
    // Generar dirección usando el método correcto de Starknet
    const provider = new RpcProvider({ 
      nodeUrl: this.SEPOLIA_RPC,
      chainId: constants.StarknetChainId.SN_SEPOLIA
    });
    
    // Generar publicKey desde la clave privada
    const publicKey = ec.starkCurve.getPublicKey(privateKey);
    
    // Generar dirección usando el método correcto de Starknet
    const address = ec.starkCurve.getStarkKey(privateKey);
    
    // Crear Account con la dirección correcta
    const account = new Account(provider, address, privateKey);

    const wallet: MerchantWallet = {
      email,
      password: this.hashPassword(password), // Hash de la contraseña
      privateKey: `0x${Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('')}`,
      publicKey: `0x${Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('')}`,
      address,
      createdAt: new Date().toISOString()
    };

    return wallet;
  }

  // Guardar wallet en localStorage y base de datos
  static async saveWallet(wallet: MerchantWallet, userId?: string): Promise<void> {
    try {
      // Guardar en localStorage (fallback)
      const encryptedWallet = this.encryptWallet(wallet);
      localStorage.setItem(this.STORAGE_KEY, encryptedWallet);
      
      // Guardar en base de datos si hay userId
      if (userId) {
        await this.saveWalletToDatabase(wallet, userId);
      }
      
      console.log('✅ Wallet guardada para:', wallet.email);
    } catch (error) {
      console.error('❌ Error guardando wallet:', error);
      throw new Error('No se pudo guardar la wallet');
    }
  }

  // Guardar wallet en base de datos
  private static async saveWalletToDatabase(wallet: MerchantWallet, userId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/wallet/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': userId
        },
        body: JSON.stringify({ walletData: wallet })
      });

      if (!response.ok) {
        throw new Error('Error guardando wallet en BD');
      }

      console.log('✅ Wallet guardada en base de datos');
    } catch (error) {
      console.error('❌ Error guardando wallet en BD:', error);
      // No lanzar error para no interrumpir el flujo
    }
  }

  // Cargar wallet desde localStorage
  static loadWallet(): MerchantWallet | null {
    try {
      const encryptedWallet = localStorage.getItem(this.STORAGE_KEY);
      if (!encryptedWallet) return null;

      const wallet = this.decryptWallet(encryptedWallet);
      
      // Verificar si la wallet tiene direcciones corruptas (con comas)
      if (wallet.address && wallet.address.includes(',')) {
        console.warn('⚠️ Wallet corrupta detectada, eliminando...');
        this.clearCorruptedWallets();
        return null;
      }
      
      console.log('✅ Wallet cargada para:', wallet.email);
      return wallet;
    } catch (error) {
      console.error('❌ Error cargando wallet:', error);
      // Si hay error, limpiar wallet corrupta
      this.clearCorruptedWallets();
      return null;
    }
  }

  // Verificar credenciales
  static verifyCredentials(email: string, password: string): boolean {
    const wallet = this.loadWallet();
    if (!wallet) return false;

    const hashedPassword = this.hashPassword(password);
    return wallet.email === email && wallet.password === hashedPassword;
  }

  // Obtener Account de Starknet
  static getStarknetAccount(): Account | null {
    const wallet = this.loadWallet();
    if (!wallet) return null;

    try {
      const provider = new RpcProvider({ 
        nodeUrl: this.SEPOLIA_RPC,
        chainId: constants.StarknetChainId.SN_SEPOLIA
      });

      return new Account(provider, wallet.address, wallet.privateKey);
    } catch (error) {
      console.error('❌ Error creando Account:', error);
      return null;
    }
  }

  // Eliminar wallet (logout)
  static clearWallet(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('✅ Wallet eliminada');
  }

  // Limpiar wallets corruptas (para debugging)
  static clearCorruptedWallets(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🧹 Wallets corruptas eliminadas');
  }

  // Verificar si existe wallet
  static hasWallet(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }

  // Hash simple de contraseña (en producción usar bcrypt)
  private static hashPassword(password: string): string {
    // Hash simple - en producción usar bcrypt o similar
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  // Encriptación simple (en producción usar crypto más seguro)
  private static encryptWallet(wallet: MerchantWallet): string {
    const walletJson = JSON.stringify(wallet);
    // Encriptación simple - en producción usar AES
    return btoa(walletJson);
  }

  private static decryptWallet(encryptedWallet: string): MerchantWallet {
    // Desencriptación simple - en producción usar AES
    const walletJson = atob(encryptedWallet);
    return JSON.parse(walletJson);
  }

  // Exportar wallet como JSON (para backup)
  static exportWallet(): string | null {
    const wallet = this.loadWallet();
    if (!wallet) return null;

    const exportData = {
      ...wallet,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Importar wallet desde JSON
  static importWallet(jsonData: string): boolean {
    try {
      const wallet = JSON.parse(jsonData);
      
      // Validar estructura
      if (!wallet.email || !wallet.privateKey || !wallet.address) {
        throw new Error('Formato de wallet inválido');
      }

      this.saveWallet(wallet);
      return true;
    } catch (error) {
      console.error('❌ Error importando wallet:', error);
      return false;
    }
  }

  // Obtener usuario por email desde la base de datos
  static async getUserByEmail(email: string): Promise<any> {
    try {
      const url = `${API_BASE_URL}/api/wallet/user/${email}`;
      console.log('🔍 Consultando usuario en:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log('❌ Usuario no encontrado:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('✅ Usuario encontrado:', data.user);
      return data.user;
    } catch (error) {
      console.error('❌ Error obteniendo usuario por email:', error);
      return null;
    }
  }

  // Crear usuario con wallet en la base de datos
  static async createUserWithWallet(userData: any, walletData: MerchantWallet): Promise<any> {
    try {
      const url = `${API_BASE_URL}/api/wallet/create-user`;
      console.log('🔍 Creando usuario en:', url);
      console.log('📝 Datos usuario:', userData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userData, walletData })
      });

      console.log('📊 Respuesta status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error('Error creando usuario');
      }

      const data = await response.json();
      console.log('✅ Usuario creado:', data.user);
      return data.user;
    } catch (error) {
      console.error('❌ Error creando usuario con wallet:', error);
      throw error;
    }
  }

  // Obtener wallet desde la base de datos
  static async getWalletFromDatabase(userId: string): Promise<MerchantWallet | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/wallet/get`, {
        headers: {
          'user-id': userId
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.wallet;
    } catch (error) {
      console.error('❌ Error obteniendo wallet de BD:', error);
      return null;
    }
  }
}
