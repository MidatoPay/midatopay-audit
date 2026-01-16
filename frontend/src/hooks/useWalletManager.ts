// Hook para gestionar wallets persistentes de comercios
import { useState, useEffect } from 'react';
import { WalletManager, MerchantWallet } from '@/lib/walletManager';
import { Account } from 'starknet';

export interface UseWalletManagerReturn {
  // Estado
  wallet: MerchantWallet | null;
  account: Account | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Acciones
  generateWallet: (email: string, password: string) => MerchantWallet;
  saveWallet: (wallet: MerchantWallet) => void;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  clearError: () => void;
  exportWallet: () => string | null;
  importWallet: (jsonData: string) => boolean;
  clearCorruptedWallets: () => void;
}

export function useWalletManager(): UseWalletManagerReturn {
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar wallet al inicializar
  useEffect(() => {
    const loadWallet = () => {
      try {
        setIsLoading(true);
        const savedWallet = WalletManager.loadWallet();
        
        if (savedWallet) {
          setWallet(savedWallet);
          const starknetAccount = WalletManager.getStarknetAccount();
          setAccount(starknetAccount);
          setIsConnected(true);
          console.log('✅ Wallet cargada automáticamente:', savedWallet.email);
        } else {
          setIsConnected(false);
        }
      } catch (err) {
        console.error('❌ Error cargando wallet:', err);
        setError('Error cargando wallet guardada');
      } finally {
        setIsLoading(false);
      }
    };

    loadWallet();
  }, []);

  // Generar nueva wallet
  const generateWallet = (email: string, password: string): MerchantWallet => {
    try {
      setError(null);
      const newWallet = WalletManager.generateWallet(email, password);
      console.log('✅ Nueva wallet generada para:', email);
      return newWallet;
    } catch (err) {
      const errorMsg = 'Error generando wallet';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  // Guardar wallet
  const saveWallet = async (walletToSave: MerchantWallet) => {
    try {
      setError(null);
      
      // Primero verificar si el usuario existe en la BD
      let user = await WalletManager.getUserByEmail(walletToSave.email);
      
      if (!user) {
        // Crear usuario con wallet en la BD
        const userData = {
          email: walletToSave.email,
          password: walletToSave.password,
          name: walletToSave.email.split('@')[0], // Usar parte antes del @ como nombre
          phone: null
        };
        
        user = await WalletManager.createUserWithWallet(userData, walletToSave);
        console.log('✅ Usuario creado en BD:', user.email);
      } else {
        // Usuario existe, actualizar con wallet
        await WalletManager.saveWallet(walletToSave, user.id);
        console.log('✅ Wallet actualizada en BD para:', user.email);
      }
      
      // Guardar también en localStorage como fallback
      WalletManager.saveWallet(walletToSave);
      setWallet(walletToSave);
      
      const starknetAccount = WalletManager.getStarknetAccount();
      setAccount(starknetAccount);
      setIsConnected(true);
      
      console.log('✅ Wallet guardada y conectada:', walletToSave.email);
    } catch (err) {
      const errorMsg = 'Error guardando wallet';
      setError(errorMsg);
      console.error('❌ Error en saveWallet:', err);
      throw new Error(errorMsg);
    }
  };

  // Login con credenciales
  const login = (email: string, password: string): boolean => {
    try {
      setError(null);
      const isValid = WalletManager.verifyCredentials(email, password);
      
      if (isValid) {
        const savedWallet = WalletManager.loadWallet();
        if (savedWallet) {
          setWallet(savedWallet);
          const starknetAccount = WalletManager.getStarknetAccount();
          setAccount(starknetAccount);
          setIsConnected(true);
          console.log('✅ Login exitoso:', email);
          return true;
        }
      }
      
      setError('Credenciales inválidas');
      return false;
    } catch (err) {
      const errorMsg = 'Error en login';
      setError(errorMsg);
      return false;
    }
  };

  // Logout
  const logout = () => {
    try {
      WalletManager.clearWallet();
      setWallet(null);
      setAccount(null);
      setIsConnected(false);
      setError(null);
      console.log('✅ Logout exitoso');
    } catch (err) {
      console.error('❌ Error en logout:', err);
      setError('Error en logout');
    }
  };

  // Limpiar wallets corruptas
  const clearCorruptedWallets = () => {
    try {
      WalletManager.clearCorruptedWallets();
      setWallet(null);
      setAccount(null);
      setIsConnected(false);
      setError(null);
      console.log('🧹 Wallets corruptas limpiadas');
    } catch (err) {
      console.error('❌ Error limpiando wallets:', err);
      setError('Error limpiando wallets');
    }
  };

  // Limpiar error
  const clearError = () => {
    setError(null);
  };

  // Exportar wallet
  const exportWallet = (): string | null => {
    try {
      return WalletManager.exportWallet();
    } catch (err) {
      setError('Error exportando wallet');
      return null;
    }
  };

  // Importar wallet
  const importWallet = (jsonData: string): boolean => {
    try {
      setError(null);
      const success = WalletManager.importWallet(jsonData);
      
      if (success) {
        const savedWallet = WalletManager.loadWallet();
        if (savedWallet) {
          setWallet(savedWallet);
          const starknetAccount = WalletManager.getStarknetAccount();
          setAccount(starknetAccount);
          setIsConnected(true);
          console.log('✅ Wallet importada exitosamente');
        }
      }
      
      return success;
    } catch (err) {
      setError('Error importando wallet');
      return false;
    }
  };

  return {
    // Estado
    wallet,
    account,
    isConnected,
    isLoading,
    error,

    // Acciones
    generateWallet,
    saveWallet,
    login,
    logout,
    clearCorruptedWallets,
    clearError,
    exportWallet,
    importWallet
  };
}
