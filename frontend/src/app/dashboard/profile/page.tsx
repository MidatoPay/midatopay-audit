'use client'

import { useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import DashboardLayout from '@/components/DashboardLayout'
import { Copy, Edit, Share2, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'

export default function ProfilePage() {
  const { t } = useLanguage()
  const { user: profileUser, isLoading } = useUserProfile()
  const [selectedCurrency, setSelectedCurrency] = useState<'pesos'>('pesos')
  const [expandedSections, setExpandedSections] = useState({
    personalData: true,
    accountData: false
  })

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado`)
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Datos de cuenta',
        text: `CVU: ${profileUser?.walletAddress || 'N/A'}\nAlias: ${profileUser?.name || 'N/A'}`,
      }).catch(() => {})
    } else {
      handleCopy(`${profileUser?.walletAddress || ''}\n${profileUser?.name || ''}`, 'Datos')
    }
  }


  if (isLoading) {
    return (
      <DashboardLayout pageTitle={t.dashboard.profile.title}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </DashboardLayout>
    )
  }

  const toggleSection = (section: 'personalData' | 'accountData') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  return (
    <DashboardLayout pageTitle={t.dashboard.profile.title}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Mi Cuenta */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'Kufam, sans-serif', color: '#2C2C2C' }}>
          {t.dashboard.profile.myAccount}
        </h2>

        {/* Datos Personales - Acordeón */}
        <div className="bg-white rounded-lg mb-4 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('personalData')}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'Kufam, sans-serif' }}
          >
            <h3 className="text-lg font-semibold" style={{ color: '#2C2C2C' }}>
              {t.dashboard.profile.personalData.title}
            </h3>
            {expandedSections.personalData ? (
              <ChevronUp className="w-5 h-5" style={{ color: '#FF6A00' }} />
            ) : (
              <ChevronDown className="w-5 h-5" style={{ color: '#8B8B8B' }} />
            )}
          </button>
          {expandedSections.personalData && (
          <div className="px-6 pb-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block" style={{ fontFamily: 'Kufam, sans-serif' }}>
                {t.dashboard.profile.personalData.name}
              </label>
              <p className="text-base font-medium" style={{ fontFamily: 'Kufam, sans-serif', color: '#2C2C2C' }}>
                {profileUser?.name || 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block" style={{ fontFamily: 'Kufam, sans-serif' }}>
                {t.dashboard.profile.personalData.email}
              </label>
              <p className="text-base font-medium" style={{ fontFamily: 'Kufam, sans-serif', color: '#2C2C2C' }}>
                {profileUser?.email || 'N/A'}
              </p>
            </div>
            {profileUser?.phone && (
              <div>
                <label className="text-sm text-gray-600 mb-1 block" style={{ fontFamily: 'Kufam, sans-serif' }}>
                  {t.dashboard.profile.personalData.phone}
                </label>
                <p className="text-base font-medium" style={{ fontFamily: 'Kufam, sans-serif', color: '#2C2C2C' }}>
                  {profileUser.phone}
                </p>
              </div>
            )}
          </div>
          </div>
          )}
        </div>

        {/* Datos de Cuentas - Acordeón */}
        <div className="bg-white rounded-lg mb-4 shadow-sm overflow-hidden">
          <button
            onClick={() => toggleSection('accountData')}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'Kufam, sans-serif' }}
          >
            <div className="text-left">
              <h3 className="text-lg font-semibold mb-1" style={{ color: '#2C2C2C' }}>
                {t.dashboard.profile.accountData.title}
              </h3>
              <p className="text-sm" style={{ color: '#8B8B8B' }}>
                {t.dashboard.profile.accountData.subtitle}
              </p>
            </div>
            {expandedSections.accountData ? (
              <ChevronUp className="w-5 h-5" style={{ color: '#FF6A00' }} />
            ) : (
              <ChevronDown className="w-5 h-5" style={{ color: '#8B8B8B' }} />
            )}
          </button>
          {expandedSections.accountData && (
          <div className="px-6 pb-6">
          {/* Selector de moneda (solo Pesos) */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setSelectedCurrency('pesos')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCurrency === 'pesos'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
              style={{ fontFamily: 'Kufam, sans-serif' }}
            >
              {t.dashboard.profile.accountData.currency}
            </button>
          </div>

          {/* CVU o Alias */}
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Kufam, sans-serif' }}>
                  {t.dashboard.profile.accountData.cvu}
                </label>
                <button
                  onClick={() => handleCopy(profileUser?.walletAddress || '', t.dashboard.profile.accountData.cvu)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <Copy className="w-4 h-4" style={{ color: '#FF6A00' }} />
                </button>
              </div>
              <p className="text-base font-mono" style={{ fontFamily: 'Kufam, sans-serif', color: '#2C2C2C' }}>
                {profileUser?.walletAddress || '0000000000000000000000'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Kufam, sans-serif' }}>
                  {t.dashboard.profile.accountData.alias}
                </label>
                <div className="flex gap-2">
                  <button
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4" style={{ color: '#FF6A00' }} />
                  </button>
                  <button
                    onClick={() => handleCopy(profileUser?.name || '', t.dashboard.profile.accountData.alias)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <Copy className="w-4 h-4" style={{ color: '#FF6A00' }} />
                  </button>
                </div>
              </div>
              <p className="text-base font-medium" style={{ fontFamily: 'Kufam, sans-serif', color: '#2C2C2C' }}>
                {profileUser?.name?.toLowerCase().replace(/\s+/g, '.') || 'alias.belo'}
              </p>
            </div>
          </div>

          {/* Botón Compartir datos */}
          <Button
            onClick={handleShare}
            className="w-full mt-6 text-white"
            style={{ fontFamily: 'Kufam, sans-serif', backgroundColor: '#FF6A00' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FF8A33'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FF6A00'}
          >
            <Share2 className="w-4 h-4 mr-2" />
            {t.dashboard.profile.accountData.shareData}
          </Button>
          </div>
          )}
        </div>
      </div>
      </div>
    </DashboardLayout>
  )
}
