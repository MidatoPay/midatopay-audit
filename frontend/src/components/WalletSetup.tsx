// Componente para configurar wallet persistente del comercio
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWalletManager } from '@/hooks/useWalletManager';
import { Wallet, Download, Upload, Eye, EyeOff, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export function WalletSetup() {
  const { generateWallet, saveWallet, login, logout, isConnected, wallet, exportWallet, importWallet, clearCorruptedWallets } = useWalletManager();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');

  // Registrar nueva wallet
  const handleRegister = async () => {
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }

    try {
      setIsRegistering(true);
      const newWallet = generateWallet(email, password);
      await saveWallet(newWallet);
      toast.success('✅ Wallet created successfully!');
      console.log('Nueva wallet:', newWallet);
    } catch (error) {
      toast.error('Error creating wallet');
      console.error('Error:', error);
    } finally {
      setIsRegistering(false);
    }
  };

  // Login con wallet existente
  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }

    try {
      setIsLoggingIn(true);
      const success = login(email, password);
      if (success) {
        toast.success('✅ Login successful!');
      } else {
        toast.error('Invalid credentials');
      }
    } catch (error) {
      toast.error('Login error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Exportar wallet
  const handleExport = () => {
    const walletJson = exportWallet();
    if (walletJson) {
      const blob = new Blob([walletJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `midatopay-wallet-${wallet?.email || 'backup'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('✅ Wallet exported');
    } else {
      toast.error('Error exporting wallet');
    }
  };

  // Importar wallet
  const handleImport = () => {
    if (!importData.trim()) {
      toast.error('Import data required');
      return;
    }

    try {
      const success = importWallet(importData);
      if (success) {
        toast.success('✅ Wallet imported successfully!');
        setShowImport(false);
        setImportData('');
      } else {
        toast.error('Error importing wallet');
      }
    } catch (error) {
      toast.error('Invalid wallet format');
    }
  };

  // Logout
  const handleLogout = () => {
    logout();
    toast.success('✅ Logout successful');
  };

  if (isConnected && wallet) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="w-5 h-5" />
            <span>Wallet Connected</span>
          </CardTitle>
          <CardDescription>
            Merchant: {wallet.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Address:</Label>
            <p className="text-sm font-mono bg-gray-100 p-2 rounded break-all">
              {wallet.address}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>Created:</Label>
            <p className="text-sm text-gray-600">
              {new Date(wallet.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex space-x-2">
            <Button onClick={handleExport} variant="outline" size="sm" className="flex-1">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button onClick={handleLogout} variant="destructive" size="sm" className="flex-1">
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Wallet className="w-5 h-5" />
          <span>Setup Wallet</span>
        </CardTitle>
        <CardDescription>
          Generate or import your persistent wallet for commerce
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showImport ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Merchant Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="merchant@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={handleRegister} 
                disabled={isRegistering}
                className="flex-1"
              >
                {isRegistering ? 'Creating...' : 'Create Wallet'}
              </Button>
              <Button 
                onClick={handleLogin} 
                variant="outline"
                disabled={isLoggingIn}
                className="flex-1"
              >
                {isLoggingIn ? 'Connecting...' : 'Connect'}
              </Button>
            </div>

            <div className="text-center space-y-2">
              <Button 
                onClick={() => setShowImport(true)} 
                variant="ghost" 
                size="sm"
              >
                <Upload className="w-4 h-4 mr-1" />
                Import Wallet
              </Button>
              <div>
                <Button 
                  onClick={clearCorruptedWallets} 
                  variant="destructive" 
                  size="sm"
                >
                  🧹 Clear Corrupted Wallets
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Wallet Data (JSON)</Label>
              <textarea
                className="w-full h-32 p-2 border rounded text-sm font-mono"
                placeholder="Paste your wallet JSON here..."
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
              />
            </div>

            <div className="flex space-x-2">
              <Button onClick={handleImport} className="flex-1">
                Import
              </Button>
              <Button 
                onClick={() => setShowImport(false)} 
                variant="outline" 
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
