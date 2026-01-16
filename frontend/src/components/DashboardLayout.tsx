'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth, useAuthActions, useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { 
  LogOut,
  Wallet,
  Home,
  Menu,
  X,
  History,
  Copy,
  User,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useLanguage } from '@/contexts/LanguageContext'
import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs'
import { useClerkSafe } from '@/hooks/useClerkSafe'
import { useUserProfile } from '@/hooks/useUserProfile'
import Image from 'next/image'

// Selector de idiomas adaptado para el dashboard
function DashboardLanguageSelector() {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const languages = [
    { code: 'en', name: 'English', flag: '/lenguajes/eeuu.svg' },
    { code: 'es', name: 'Español', flag: '/lenguajes/ar.svg' },
    { code: 'it', name: 'Italiano', flag: '/lenguajes/it.svg' },
    { code: 'pt', name: 'Português', flag: '/lenguajes/br.svg' },
    { code: 'cn', name: '中文', flag: '/lenguajes/cn.svg' },
  ]

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLanguageChange = (langCode: 'es' | 'en' | 'it' | 'pt' | 'cn') => {
    setLanguage(langCode)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 hover:bg-orange-50"
        style={{
          backgroundColor: isOpen ? 'rgba(255,106,0,0.1)' : 'transparent',
          fontFamily: 'Kufam, sans-serif',
          color: '#2C2C2C',
        }}
      >
        <Image
          src={currentLanguage.flag}
          alt={currentLanguage.name}
          width={20}
          height={15}
          className="object-contain rounded-sm"
        />
        <span className="text-sm font-medium uppercase hidden sm:inline" style={{ color: '#2C2C2C' }}>
          {currentLanguage.code}
        </span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: '#2C2C2C' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-48 rounded-lg shadow-lg overflow-hidden z-[70]"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(44,44,44,0.1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code as 'es' | 'en' | 'it' | 'pt' | 'cn')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 ${
                language === lang.code ? 'bg-orange-50' : 'hover:bg-gray-50'
              }`}
              style={{ fontFamily: 'Kufam, sans-serif' }}
            >
              <Image
                src={lang.flag}
                alt={lang.name}
                width={20}
                height={15}
                className="object-contain rounded-sm flex-shrink-0"
              />
              <span className={`text-sm font-medium flex-1 ${language === lang.code ? 'text-orange-600' : 'text-gray-700'}`}>
                {lang.name}
              </span>
              <span className="text-xs text-gray-400 uppercase">{lang.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface DashboardLayoutProps {
  children: React.ReactNode
  pageTitle: string
}

export default function DashboardLayout({ children, pageTitle }: DashboardLayoutProps) {
  const { user, token, isAuthenticated, isLoading, hasHydrated } = useAuth()
  const { logout } = useAuthActions()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useLanguage()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user: profileUser } = useUserProfile() // Obtener wallet desde la base de datos
  
  // Verificar autenticación con Clerk también (solo si está configurado)
  const { isConfigured: isClerkConfigured } = useClerkSafe()
  const clerkUserHook = useUser() // Siempre llamar useUser (regla de React hooks)
  const clerkAuthHook = useClerkAuth() // useAuth() tiene isSignedIn que es más confiable
  
  // Detectar si venimos de un callback de OAuth (declarar ANTES de usarlo en useEffect)
  const [isOAuthCallback, setIsOAuthCallback] = useState(false)
  const [hasCheckedOAuth, setHasCheckedOAuth] = useState(false)
  const [oauthCallbackDetected, setOAuthCallbackDetected] = useState(false)
  
  // Intentar forzar la obtención del token si hay cookies pero no está autenticado
  // NO hacer esto si venimos de un callback de OAuth (dejamos que el callback se procese primero)
  // Esperar más tiempo para darle oportunidad a Clerk de establecer la sesión
  useEffect(() => {
    // Esperar al menos 5 segundos antes de verificar si las cookies son inválidas
    // Esto da tiempo a Clerk para establecer la sesión después de OAuth
    const checkTimer = setTimeout(() => {
      if (isClerkConfigured && clerkAuthHook.isLoaded && !clerkAuthHook.isSignedIn && !isOAuthCallback) {
        const hasClerkCookies = typeof document !== 'undefined' 
          ? document.cookie.includes('__clerk')
          : false
        
        // Si hay cookies pero no está autenticado, y useUser() tampoco tiene usuario,
        // y NO venimos de un callback de OAuth, las cookies podrían ser inválidas
        if (hasClerkCookies && !clerkUserHook.user && clerkUserHook.isLoaded) {
          // Intentar obtener el token para forzar que Clerk establezca la sesión
          clerkAuthHook.getToken().then(token => {
            if (token) {
              // Si obtenemos el token, forzar recarga para que Clerk actualice el estado
              setTimeout(() => {
                window.location.reload()
              }, 1000)
            } else {
              // Si no podemos obtener el token, las cookies son inválidas
              // Limpiar cookies de Clerk y redirigir a login
              if (typeof document !== 'undefined') {
                document.cookie.split(";").forEach(cookie => {
                  if (cookie.includes('__clerk')) {
                    const eqPos = cookie.indexOf("=")
                    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
                    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`
                  }
                })
              }
              setTimeout(() => {
                router.push('/auth/login')
              }, 500)
            }
          }).catch(() => {
            // Si hay error y NO venimos de OAuth, limpiar cookies y redirigir
            if (!isOAuthCallback && typeof document !== 'undefined') {
              document.cookie.split(";").forEach(cookie => {
                if (cookie.includes('__clerk')) {
                  const eqPos = cookie.indexOf("=")
                  const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
                  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
                }
              })
              setTimeout(() => {
                router.push('/auth/login')
              }, 500)
            }
          })
        }
      }
    }, 5000) // Esperar 5 segundos antes de verificar

    return () => clearTimeout(checkTimer)
  }, [isClerkConfigured, clerkAuthHook.isLoaded, clerkAuthHook.isSignedIn, clerkUserHook.user, clerkUserHook.isLoaded, router, isOAuthCallback])
  
  // Debug: Log del estado de Clerk y verificar cookies
  useEffect(() => {
    if (isClerkConfigured) {
      // Verificar cookies de Clerk (sin logs)
    }
  }, [isClerkConfigured, clerkUserHook.isLoaded, clerkUserHook.user, clerkAuthHook.isSignedIn, clerkAuthHook.isLoaded])
  
  // Usar isSignedIn de useAuth() que es más confiable que verificar user !== null
  // También considerar autenticado si useUser() tiene un usuario (por si isSignedIn tiene un bug)
  const isClerkSignedIn = isClerkConfigured 
    ? (clerkAuthHook.isSignedIn === true && clerkAuthHook.isLoaded) || 
      (clerkUserHook.user !== null && clerkUserHook.isLoaded)
    : false
  // Si Clerk no está configurado, considerar como "cargado" (no hay nada que cargar)
  // Si está configurado pero no ha cargado después de 5 segundos, asumir que está cargado pero no autenticado
  const [clerkLoadTimeout, setClerkLoadTimeout] = useState(false)
  
  useEffect(() => {
    if (isClerkConfigured && (!clerkUserHook.isLoaded || !clerkAuthHook.isLoaded)) {
      const timer = setTimeout(() => {
        setClerkLoadTimeout(true)
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      setClerkLoadTimeout(false)
    }
  }, [isClerkConfigured, clerkUserHook.isLoaded, clerkAuthHook.isLoaded])
  
  // Considerar cargado si tanto useUser como useAuth están cargados
  const isClerkLoaded = isClerkConfigured ? (clerkUserHook.isLoaded && clerkAuthHook.isLoaded) || clerkLoadTimeout : true
  
  const [merchantWallet, setMerchantWallet] = useState({
    isConnected: false,
    address: null as string | null,
    balance: null as string | null,
    isLoading: false
  })

  // Inicializar estado de wallet desde el perfil del usuario (base de datos)
  useEffect(() => {
    if (profileUser?.walletAddress) {
      const walletAddress = profileUser.walletAddress
      
      // Validar que sea una dirección de Polygon (42 caracteres)
      if (walletAddress.length === 42) {
        setMerchantWallet({
          isConnected: true,
          address: walletAddress,
          balance: null,
          isLoading: false
        })
      } else {
        // Si no es una dirección válida de Polygon, no establecer como conectada
        setMerchantWallet(prev => ({
          ...prev,
          isConnected: false,
          address: null,
          isLoading: false
        }))
      }
    } else {
      setMerchantWallet(prev => ({
        ...prev,
        isConnected: false,
        address: null,
        isLoading: false
      }))
    }
  }, [profileUser?.walletAddress])

  // Marcar como rehidratado cuando el componente se monte
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasHydrated) {
      const checkHydration = () => {
        try {
          const authData = localStorage.getItem('auth-storage')
          if (authData) {
            const parsed = JSON.parse(authData)
            setTimeout(() => {
              useAuthStore.setState({ hasHydrated: true })
            }, 100)
          } else {
            useAuthStore.setState({ hasHydrated: true })
          }
        } catch (error) {
          useAuthStore.setState({ hasHydrated: true })
        }
      }
      checkHydration()
    }
  }, [])

  // Detectar callback de OAuth y forzar establecimiento de sesión
  // Este useEffect debe ejecutarse PRIMERO para establecer isOAuthCallback antes de otros checks
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hasCheckedOAuth) return // Solo verificar una vez

    // Verificar si hay parámetros de callback de OAuth en la URL o hash
    const urlParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const hasOAuthParams = urlParams.has('__clerk_redirect_url') || 
                          urlParams.has('__session') ||
                          urlParams.has('__clerk_handshake') ||
                          urlParams.has('__clerk_redirect_state') ||
                          hashParams.has('__clerk_redirect_url') ||
                          hashParams.has('__session')
    
    const hasClerkCookies = document.cookie.includes('__clerk')
    
    // Si hay parámetros de OAuth o cookies pero no está autenticado, es un callback
    // Marcar como callback INMEDIATAMENTE para que otros useEffects lo respeten
    // Nota: Verificamos isSignedIn pero no lo incluimos en dependencias para evitar loops
    if (hasOAuthParams || (hasClerkCookies && !clerkAuthHook.isSignedIn)) {
      // Establecer flags INMEDIATAMENTE
      setIsOAuthCallback(true)
      setOAuthCallbackDetected(true)
      setHasCheckedOAuth(true)
      
      // Limpiar parámetros de la URL después de detectarlos
      if (hasOAuthParams) {
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    } else {
      setHasCheckedOAuth(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Ejecutar solo una vez al montar - intencionalmente sin dependencias para establecer flag rápidamente

  // Si hay callback de OAuth, permitir acceso temporalmente
  // El hook useUserProfile intentará obtener el token en segundo plano
  // NO redirigir automáticamente - permitir que el usuario permanezca en el dashboard
  // ChipiPay eliminado
  useEffect(() => {
    if (!isOAuthCallback || !clerkAuthHook.isLoaded) return

    // Si ya está autenticado, no hacer nada
    if (clerkAuthHook.isSignedIn) {
      return
    }

    const hasClerkCookies = typeof document !== 'undefined' 
      ? document.cookie.split(';').some(c => c.includes('__clerk'))
      : false

    // Si hay cookies, permitir acceso indefinidamente
    // useUserProfile seguirá intentando obtener el token en segundo plano
    // No redirigir automáticamente
    if (hasClerkCookies) {
      // No hacer nada más - permitir que el usuario permanezca en el dashboard
      return
    } else {
      // Si no hay cookies, redirigir después de 5 segundos
      const timeout = setTimeout(() => {
        router.push('/auth/login?oauth_error=true')
      }, 5000)

      return () => clearTimeout(timeout)
    }
  }, [isOAuthCallback, clerkAuthHook.isLoaded, clerkAuthHook.isSignedIn, clerkAuthHook, router])

  // Esperar a que termine la rehidratación antes de verificar autenticación
  // Verificar tanto autenticación JWT tradicional como Clerk
  useEffect(() => {
    // Verificar autenticación: JWT tradicional O Clerk O callback de OAuth con cookies
    const hasClerkCookies = typeof document !== 'undefined' 
      ? document.cookie.split(';').some(c => c.includes('__clerk'))
      : false
    
    // Si Clerk está configurado pero no ha cargado Y hay cookies, NO retornar inmediatamente
    // Esto permite que la sesión persista al recargar la página
    // (sin logs)
    
    // Si hay callback de OAuth con cookies, permitir acceso temporalmente
    // El webhook creará el usuario y luego podremos obtener el token
    const isAuthenticatedAny = isAuthenticated || isClerkSignedIn || (isOAuthCallback && hasClerkCookies)
    
    // Verificar si hay token JWT en localStorage (login manual)
    const hasJwtToken = token && isAuthenticated
    
    // Si hay cookies de Clerk pero aún no está cargado, esperar más tiempo
    // Si hay token JWT, también esperar un poco más para que useUserProfile cargue el perfil
    const waitTime = (isClerkConfigured && hasClerkCookies && !isClerkLoaded) 
      ? 5000  // 5 segundos si hay cookies pero Clerk aún no ha cargado
      : (isOAuthCallback && hasClerkCookies) 
        ? 30000  // 30 segundos para OAuth callback
        : hasJwtToken
          ? 2000  // 2 segundos si hay token JWT (dar tiempo a useUserProfile)
          : 3000   // 3 segundos para casos normales
    
    // Solo redirigir si definitivamente no está autenticado y no hay cookies de OAuth
    // Si hay token JWT, esperar a que useUserProfile termine de cargar
    if (hasHydrated && !isLoading) {
      const timer = setTimeout(() => {
        // Verificar nuevamente el estado después del delay
        const currentIsSignedIn = isClerkConfigured ? (clerkAuthHook.isSignedIn === true && clerkAuthHook.isLoaded) : false
        const currentHasClerkCookies = typeof document !== 'undefined' 
          ? document.cookie.split(';').some(c => c.includes('__clerk'))
          : false
        const currentIsAuthenticatedAny = isAuthenticated || currentIsSignedIn || (isOAuthCallback && currentHasClerkCookies)
        
        // Si hay cookies de Clerk pero aún no está cargado, esperar un poco más
        if (isClerkConfigured && currentHasClerkCookies && !clerkAuthHook.isLoaded) {
          return
        }
        
        // Si venimos de OAuth con cookies pero aún no hay sesión, NO redirigir
        // Permitir que el usuario permanezca en el dashboard mientras useUserProfile intenta obtener el token
        if (isOAuthCallback && currentHasClerkCookies && !currentIsSignedIn) {
          // NO redirigir
          return
        }
        
        // Verificar si hay token JWT (login manual)
        const currentHasJwtToken = token && isAuthenticated
        
        // Solo redirigir si:
        // 1. NO está autenticado (ni JWT ni Clerk)
        // 2. NO hay cookies de Clerk
        // 3. NO hay token JWT
        // 4. Clerk ya cargó (si está configurado)
        if (!currentIsAuthenticatedAny && !currentHasClerkCookies && !currentHasJwtToken && (isClerkConfigured ? clerkAuthHook.isLoaded : true)) {
          router.push('/auth/login')
        } else if (currentIsAuthenticatedAny || currentHasClerkCookies || currentHasJwtToken) {
          // Si está autenticado y veníamos de OAuth, limpiar el flag
          if (isOAuthCallback && currentIsSignedIn) {
            setIsOAuthCallback(false)
          }
        }
      }, waitTime)
      
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, isClerkSignedIn, isLoading, hasHydrated, isClerkLoaded, router, isOAuthCallback, clerkAuthHook.isSignedIn, clerkAuthHook.isLoaded, token])

  const handleLogout = () => {
    logout()
    toast.success(t.dashboard.toasts.sessionClosed)
    router.push('/')
  }

  // Early returns después de todos los hooks
  // Esperar a que termine la rehidratación y carga inicial
  if (!hasHydrated || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t.dashboard.loading}</p>
        </div>
      </div>
    )
  }

  // Si Clerk no está cargado, mostrar loading pero no bloquear completamente
  // Esto permite que la página se renderice mientras Clerk termina de cargar después de OAuth
  // Verificar si hay cookies de Clerk (posible callback de OAuth)
  const hasClerkCookies = typeof document !== 'undefined' 
    ? document.cookie.split(';').some(c => c.includes('__clerk'))
    : false
  
  if (!isClerkLoaded) {
    // Si hay cookies de Clerk pero no está cargado, podría ser que estemos después de OAuth
    // Mostrar mensaje diferente
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {hasClerkCookies ? 'Estableciendo sesión...' : 'Verificando autenticación...'}
          </p>
        </div>
      </div>
    )
  }

  // Verificar autenticación: JWT tradicional O Clerk O callback de OAuth con cookies
  // (hasClerkCookies ya está declarado arriba en el useEffect)
  const isAuthenticatedAny = isAuthenticated || isClerkSignedIn || (isOAuthCallback && hasClerkCookies)
  
  // Si no está autenticado y no hay cookies de OAuth, mostrar loading mientras el useEffect redirige
  // Si hay callback de OAuth con cookies, permitir acceso temporalmente
  if (!isAuthenticatedAny && !(isOAuthCallback && hasClerkCookies)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirigiendo...</p>
        </div>
      </div>
    )
  }
  
  // Si hay callback de OAuth pero aún no hay sesión, permitir acceso temporal
  // useUserProfile intentará obtener el token en segundo plano
  // No bloquear la UI - permitir que el usuario vea el dashboard mientras se procesa
  const hasClerkCookiesForRender = typeof document !== 'undefined' 
    ? document.cookie.split(';').some(c => c.includes('__clerk'))
    : false
  
  // Si hay cookies de Clerk, permitir acceso temporalmente
  // useUserProfile intentará obtener el token y crear el usuario automáticamente

  // Determinar qué item del sidebar está activo
  const isActive = (path: string) => pathname === path

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FFF4EC' }}>
      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ 
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid rgba(44,44,44,0.1)',
          boxShadow: '2px 0 10px rgba(0,0,0,0.05)'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Logo y título del sidebar */}
          <div className="p-6 border-b" style={{ borderColor: 'rgba(44,44,44,0.1)' }}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                <Image 
                  src="/midatopay.svg" 
                  alt="MidatoPay Logo" 
                  width={40} 
                  height={40}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold" style={{ fontFamily: 'Kufam, sans-serif', color: '#2C2C2C', fontWeight: 700 }}>MidatoPay</h1>
                <p className="text-xs" style={{ color: '#B4B4B4', fontFamily: 'Kufam, sans-serif', fontWeight: 400 }}>Dashboard</p>
              </div>
            </div>
          </div>

          {/* Menú de navegación */}
          <nav className="flex-1 p-4 space-y-2">
            <Link 
              href="/dashboard" 
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive('/dashboard') ? 'bg-orange-50' : 'hover:bg-orange-50'
              }`}
              style={{ 
                backgroundColor: isActive('/dashboard') ? 'rgba(255,106,0,0.1)' : 'transparent',
                fontFamily: 'Kufam, sans-serif'
              }}
            >
              <Home className="w-5 h-5" style={{ color: isActive('/dashboard') ? '#FF6A00' : '#8B8B8B' }} />
              <span className="font-medium" style={{ color: isActive('/dashboard') ? '#FF6A00' : '#2C2C2C', fontWeight: isActive('/dashboard') ? 600 : 500 }}>
                {t.dashboard.sidebar.start}
              </span>
            </Link>

            <Link
              href="/dashboard/billetera"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive('/dashboard/billetera') ? 'bg-orange-50' : 'hover:bg-orange-50'
              }`}
              style={{ 
                backgroundColor: isActive('/dashboard/billetera') ? 'rgba(255,106,0,0.1)' : 'transparent',
                fontFamily: 'Kufam, sans-serif'
              }}
            >
              <Wallet className="w-5 h-5" style={{ color: isActive('/dashboard/billetera') ? '#FF6A00' : '#8B8B8B' }} />
              <span className="font-medium" style={{ color: isActive('/dashboard/billetera') ? '#FF6A00' : '#2C2C2C', fontWeight: isActive('/dashboard/billetera') ? 600 : 500 }}>
                {t.dashboard.sidebar.wallet}
              </span>
            </Link>

            <Link
              href="/dashboard/movimientos"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive('/dashboard/movimientos') ? 'bg-orange-50' : 'hover:bg-orange-50'
              }`}
              style={{ 
                backgroundColor: isActive('/dashboard/movimientos') ? 'rgba(255,106,0,0.1)' : 'transparent',
                fontFamily: 'Kufam, sans-serif'
              }}
            >
              <History className="w-5 h-5" style={{ color: isActive('/dashboard/movimientos') ? '#FF6A00' : '#8B8B8B' }} />
              <span className="font-medium" style={{ color: isActive('/dashboard/movimientos') ? '#FF6A00' : '#2C2C2C', fontWeight: isActive('/dashboard/movimientos') ? 600 : 500 }}>
                {t.dashboard.sidebar.movements}
              </span>
            </Link>

            <Link
              href="/dashboard/profile"
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive('/dashboard/profile') ? 'bg-orange-50' : 'hover:bg-orange-50'
              }`}
              style={{ 
                backgroundColor: isActive('/dashboard/profile') ? 'rgba(255,106,0,0.1)' : 'transparent',
                fontFamily: 'Kufam, sans-serif'
              }}
            >
              <User className="w-5 h-5" style={{ color: isActive('/dashboard/profile') ? '#FF6A00' : '#8B8B8B' }} />
              <span className="font-medium" style={{ color: isActive('/dashboard/profile') ? '#FF6A00' : '#2C2C2C', fontWeight: isActive('/dashboard/profile') ? 600 : 500 }}>
                {t.dashboard.sidebar.profile}
              </span>
            </Link>
          </nav>

          {/* Botón de cerrar sesión */}
          <div className="p-4 border-t" style={{ borderColor: 'rgba(44,44,44,0.1)' }}>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout} 
              className="w-full justify-start"
              style={{ color: '#1a1a1a', fontFamily: 'Kufam, sans-serif' }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t.dashboard.sidebar.logout}
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay para mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header superior */}
        <header className="sticky top-0 z-30 shadow-sm border-b" style={{ backgroundColor: '#FFF4EC', borderColor: 'rgba(44,44,44,0.1)' }}>
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              {/* Botón de menú móvil */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-white transition-colors"
                style={{ color: '#2C2C2C' }}
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              {/* Título del header */}
              <div className={`flex-1 ${sidebarOpen ? 'lg:block hidden' : 'block'}`}>
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Kufam, sans-serif', color: '#2C2C2C', fontWeight: 700 }}>
                  {pageTitle}
                </h2>
              </div>

              {/* Controles del header */}
              <div className="flex items-center space-x-4">
                {/* Wallet Address con copiar */}
                {merchantWallet.isConnected && merchantWallet.address && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(merchantWallet.address || '')
                      toast.success(t.dashboard.addressCopied || 'Dirección copiada')
                    }}
                    className="hidden sm:flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-white"
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(44,44,44,0.1)',
                      fontFamily: 'Kufam, sans-serif'
                    }}
                  >
                    <span 
                      className="text-sm font-medium font-mono"
                      style={{ color: '#2C2C2C' }}
                    >
                      {merchantWallet.address.slice(0, 8)}...{merchantWallet.address.slice(-8)}
                    </span>
                    <Copy className="w-4 h-4" style={{ color: '#8B8B8B' }} />
                  </button>
                )}

                {/* Selector de idiomas */}
                <DashboardLanguageSelector />
              </div>
            </div>
          </div>
        </header>

        {/* Contenido del dashboard */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

