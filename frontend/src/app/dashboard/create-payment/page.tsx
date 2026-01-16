'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/store/auth'
import { ArrowLeft, QrCode, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

// Importar nuestros nuevos componentes y hooks
import { midatoPayAPI } from '@/lib/midatopay-api'
import { QRModal } from '@/components/QRModal'
import { useOracleConversion } from '@/hooks/useOracleConversion'
import { useUserProfile } from '@/hooks/useUserProfile'

export default function CreatePaymentPage() {
  const { user, isAuthenticated } = useAuth()
  const { user: profileUser } = useUserProfile()
  const router = useRouter()
  
  // Obtener nombre del comercio para el QR
  const merchantName = profileUser?.name || user?.name || 'Comercio'
  const { t, language } = useLanguage()
  const [isCreating, setIsCreating] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrData, setQrData] = useState<any>(null)
  const [refreshingQR, setRefreshingQR] = useState(false)

  // Schema de validación - se crea dentro del componente para acceder a las traducciones
  const createPaymentSchema = z.object({
    amount: z.number().min(1, t.dashboard.createPayment.errors.amountMustBeGreater),
  })

  type CreatePaymentForm = z.infer<typeof createPaymentSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CreatePaymentForm>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      amount: undefined,
    },
  })

  const watchedAmount = watch('amount')
  
  // Hooks del sistema actual (USDC)
  const { convertARSToCrypto, loading: oracleLoading } = useOracleConversion()
  const useChipiPay = false
  const chipiPayConverting = false
  
  const [cryptoAmount, setCryptoAmount] = useState<number | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [percentage, setPercentage] = useState<number>(100) // Porcentaje predeterminado 100%
  const [selectedNetwork, setSelectedNetwork] = useState<'avalanche'>('avalanche')

  // Calcular montos según el porcentaje seleccionado
  const adjustedCryptoAmount = cryptoAmount !== null && watchedAmount 
    ? (cryptoAmount * percentage) / 100 
    : null

  const remainingARSAmount = watchedAmount && percentage < 100
    ? (watchedAmount * (100 - percentage)) / 100
    : null

  // Calcular el monto en USDC cuando cambia el monto en ARS
  // Deshabilitar conversión automática mientras el oracle está en desarrollo
  // useEffect(() => {
  //   if (!watchedAmount || watchedAmount <= 0) {
  //     setCryptoAmount(null)
  //     return
  //   }

  //   const timeoutId = setTimeout(async () => {
  //     try {
  //       // Usar sistema actual para conversión ARS → USDC usando Oracle según la red seleccionada
  //       const result = await convertARSToCrypto(watchedAmount, 'USDC', selectedNetwork)
  //       if (result) {
  //         setCryptoAmount(result.cryptoAmount)
  //         setExchangeRate(result.exchangeRate)
  //       } else {
  //         setCryptoAmount(null)
  //         setExchangeRate(null)
  //       }
  //     } catch (error) {
  //       console.error('Error calculating conversion:', error)
  //       setCryptoAmount(null)
  //       setExchangeRate(null)
  //     }
  //   }, 1000) // Debounce de 1 segundo

  //   return () => clearTimeout(timeoutId)
  // }, [watchedAmount, convertARSToCrypto, selectedNetwork])


  const onSubmit = async (data: CreatePaymentForm) => {
    if (!isAuthenticated) {
      toast.error(t.dashboard.createPayment.errors.mustBeAuthenticated)
      return
    }

    setIsCreating(true)
    try {
      // Usar sistema actual para generar QR
      const result = await midatoPayAPI.generatePaymentQR({
        amountARS: data.amount,
        targetCrypto: 'USDC',
        network: selectedNetwork
      })

      // Si la funcionalidad está deshabilitada, mostrar el modal con datos simulados
      if (result.code === 'FEATURE_DISABLED' || !result.success) {
        // Calcular crypto amount usando tasa fija (1000 ARS = 1 USDC)
        const cryptoAmount = data.amount / 1000
        const exchangeRate = 1000
        
        // Crear datos simulados para mostrar el modal del QR
        // Generar un QR placeholder (data URL de un SVG simple)
        const svgContent = encodeURIComponent(`
          <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
            <rect width="256" height="256" fill="#f3f4f6"/>
            <rect x="20" y="20" width="216" height="216" fill="white" stroke="#d1d5db" stroke-width="2"/>
            <text x="128" y="110" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#6b7280" font-weight="600">
              QR en desarrollo
            </text>
            <text x="128" y="140" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#9ca3af">
              Pagos360
            </text>
            <circle cx="128" cy="180" r="20" fill="#fe6c1c" opacity="0.2"/>
            <path d="M 118 175 L 128 185 L 138 175" stroke="#fe6c1c" stroke-width="2" fill="none" stroke-linecap="round"/>
          </svg>
        `)
        const qrPlaceholder = `data:image/svg+xml,${svgContent}`
        
        const mockQrData = {
          success: false,
          code: 'FEATURE_DISABLED',
          message: result.message || 'La generación de QR está temporalmente deshabilitada.',
          qrCodeImage: qrPlaceholder,
          paymentData: {
            amountARS: data.amount,
            targetCrypto: 'USDC',
            cryptoAmount: cryptoAmount,
            exchangeRate: exchangeRate,
            sessionId: `dev-${Date.now()}`,
            merchantName: merchantName,
            network: selectedNetwork
          }
        }
        setQrData(mockQrData)
        setShowQRModal(true)
        return
      }

      if (result.success) {
        setQrData(result)
        setShowQRModal(true)
        toast.success(t.dashboard.createPayment.success.qrGenerated)
      } else {
        throw new Error(result.error || t.dashboard.createPayment.errors.errorGeneratingQR)
      }
    } catch (error) {
      // Si es un error de funcionalidad deshabilitada, mostrar mensaje claro
      const errorMessage = error instanceof Error ? error.message : t.dashboard.createPayment.errors.errorGeneratingQR
      if (errorMessage.includes('deshabilitada') || errorMessage.includes('desarrollo')) {
        toast.error(errorMessage)
      } else {
        toast.error('La generación de QR está temporalmente deshabilitada. Esta funcionalidad será reemplazada con la integración de Pagos360.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  // Redirigir a login si no está autenticado (usando useEffect para evitar warning de React)
  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, router])

  // Evitar render en servidor si no está autenticado
  if (typeof window === 'undefined' || !isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen"
      style={{ 
        background: 'linear-gradient(135deg, #fff5f0 0%, #f7f7f6 100%)',
        fontFamily: 'Kufam, sans-serif'
      }}
    >
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="flex items-center space-x-2 text-gray-600 hover:text-orange-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">{t.dashboard.createPayment.backToDashboard}</span>
              </Link>
            </div>
            <div className="flex items-center space-x-2">
              <QrCode className="w-6 h-6" style={{ color: '#fe6c1c' }} />
              <h1 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>{t.dashboard.createPayment.title}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center">
          
          {/* Formulario */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-2xl"
          >
            <Card className="shadow-lg border-0"
              style={{ 
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(254, 108, 28, 0.1)'
              }}
            >
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>
                  {t.dashboard.createPayment.paymentDetails}
                </CardTitle>
                <CardDescription className="text-base" style={{ color: '#5d5d5d' }}>
                  {t.dashboard.createPayment.completeDetails}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  
                  
                  {/* Monto */}
                  <div className="space-y-2">
                    <Label htmlFor="amount" style={{ color: '#1a1a1a', fontWeight: '500' }}>{t.dashboard.createPayment.amountInARS}</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#fe6c1c' }} />
                      <img 
                        src="/logo-arg.png" 
                        alt="ARS" 
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6"
                      />
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register('amount', { valueAsNumber: true })}
                        className={`pl-12 pr-12 h-12 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-offset-2 ${errors.amount ? 'border-red-500' : ''}`}
                        style={{ 
                          backgroundColor: 'rgba(247, 247, 246, 0.8)', 
                          border: '1px solid rgba(254,108,28,0.2)',
                          color: '#1a1a1a'
                        }}
                      />
                    </div>
                    {errors.amount && (
                      <p className="text-sm text-red-500">{errors.amount.message}</p>
                    )}
                  </div>

                  {/* Barra de Porcentajes */}
                  {watchedAmount && watchedAmount > 0 && (
                    <div className="space-y-3">
                      <Label style={{ color: '#1a1a1a', fontWeight: '500' }}>{t.dashboard.createPayment.conversionPercentage}</Label>
                      <div className="flex flex-wrap gap-2">
                        {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setPercentage(pct)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                              percentage === pct
                                ? 'scale-105 shadow-md'
                                : 'hover:scale-105'
                            }`}
                            style={{
                              backgroundColor: percentage === pct ? '#fe6c1c' : 'rgba(247, 247, 246, 0.8)',
                              color: percentage === pct ? '#ffffff' : '#1a1a1a',
                              border: percentage === pct ? '2px solid #fe6c1c' : '1px solid rgba(254,108,28,0.2)',
                              fontFamily: 'Kufam, sans-serif',
                              fontWeight: percentage === pct ? 600 : 500
                            }}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cripto a Recibir */}
                  <div className="space-y-2">
                    <Label htmlFor="receiveCurrency" style={{ color: '#1a1a1a', fontWeight: '500' }}>{t.dashboard.createPayment.cryptoToReceive}</Label>
                    <div className="relative">
                      <div className="w-full h-12 px-4 py-3 rounded-xl flex items-center justify-between"
                        style={{ 
                          backgroundColor: 'rgba(247, 247, 246, 0.8)', 
                          border: '1px solid rgba(254,108,28,0.2)',
                          color: '#1a1a1a'
                        }}
                      >
                        <div className="flex items-center">
                          <img 
                            src="/usdc.png" 
                            alt="USDC" 
                            className="w-6 h-6 rounded-full mr-3"
                          />
                          <span className="font-medium">USDC (USD Coin)</span>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: oracleLoading ? '#8B8B8B' : '#2775CA' }}>
                          {oracleLoading ? '...' : adjustedCryptoAmount !== null ? `${adjustedCryptoAmount.toFixed(6)} USDC` : '--'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs" style={{ color: '#5d5d5d' }}>
                        {t.dashboard.createPayment.oracleDescription}
                      </p>
                      <div className="flex items-center space-x-2 px-3 py-2 rounded-lg" style={{ 
                        backgroundColor: 'rgba(254, 108, 28, 0.05)', 
                        border: '1px solid rgba(254,108,28,0.15)' 
                      }}>
                        <svg className="w-4 h-4" style={{ color: '#fe6c1c' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs font-medium" style={{ color: '#fe6c1c', fontFamily: 'Kufam, sans-serif' }}>
                          {oracleLoading || !exchangeRate 
                            ? t.dashboard.createPayment.loadingRate || 'Obteniendo tipo de cambio...' 
                            : `${t.dashboard.createPayment.exchangeRateLabel || 'Tipo de cambio'}: $${exchangeRate.toLocaleString(language === 'es' ? 'es-AR' : language === 'en' ? 'en-US' : language === 'it' ? 'it-IT' : language === 'pt' ? 'pt-BR' : 'zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS = 1 USDC`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Información del porcentaje restante en ARS */}
                  {percentage < 100 && remainingARSAmount !== null && watchedAmount && (
                    <div className="p-4 rounded-xl" style={{ 
                      backgroundColor: 'rgba(254, 108, 28, 0.05)', 
                      border: '1px solid rgba(254,108,28,0.2)' 
                    }}>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold" style={{ color: '#1a1a1a', fontFamily: 'Kufam, sans-serif' }}>
                          {t.dashboard.createPayment.remainingAmountARS}
                        </p>
                        <div className="flex items-center space-x-2">
                          <img 
                            src="/logo-arg.png" 
                            alt="ARS" 
                            className="w-5 h-5"
                          />
                          <span className="text-lg font-bold" style={{ color: '#fe6c1c', fontFamily: 'Kufam, sans-serif' }}>
                            ${remainingARSAmount.toLocaleString(language === 'es' ? 'es-AR' : language === 'en' ? 'en-US' : language === 'it' ? 'it-IT' : language === 'pt' ? 'pt-BR' : 'zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: '#5d5d5d', fontFamily: 'Kufam, sans-serif' }}>
                          {t.dashboard.createPayment.remainingAmountDescription
                            .replace('{percentage}', String(100 - percentage))
                            .replace('{amount}', remainingARSAmount.toLocaleString(language === 'es' ? 'es-AR' : language === 'en' ? 'en-US' : language === 'it' ? 'it-IT' : language === 'pt' ? 'pt-BR' : 'zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Botón Generar QR */}
                  <Button
                    type="submit"
                    disabled={isCreating || !watchedAmount}
                    className="w-full h-14 rounded-xl font-semibold text-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{ 
                      backgroundColor: '#fe6c1c', 
                      color: '#ffffff',
                      fontFamily: 'Kufam, sans-serif'
                    }}
                  >
                    {isCreating ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>{t.dashboard.createPayment.generatingQR}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <QrCode className="w-5 h-5" />
                        <span>{t.dashboard.createPayment.generateQR}</span>
                      </div>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* QR Modal */}
      <QRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        qrData={qrData}
        onRefreshQR={async () => {
          if (!qrData?.paymentData?.amountARS) return
          
          setRefreshingQR(true)
          try {
            const result = await midatoPayAPI.generatePaymentQR({
              amountARS: qrData.paymentData.amountARS,
              targetCrypto: 'USDC',
              network: selectedNetwork
            })
            
            if (result.success) {
              setQrData(result)
              toast.success(t.dashboard.createPayment.success.qrUpdated)
            }
          } catch (error) {
            toast.error(t.dashboard.createPayment.errors.errorUpdatingQR)
          } finally {
            setRefreshingQR(false)
          }
        }}
        refreshing={refreshingQR}
      />
    </div>
  )
}