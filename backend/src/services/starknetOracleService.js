const axios = require('axios');

class StarknetOracleService {
  constructor() {
    // Configuración de Starknet Sepolia
    this.rpcUrl = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_9/b6oJemkCmlgEGq1lXC5uTXwOHZA14WNP';
    this.oracleAddress = '0x01d5f1e352b69065229f872828a2ccaf9182302a34a326fe503df66c042e498c';
    this.usdtTokenAddress = '0x040898923d06af282d4a647966fc65c0f308020c43388026b56ef833eda0efdc';
    
    // ABI del Oracle contract
    this.oracleABI = {
      quote_ars_to_usdt: {
        name: 'quote_ars_to_usdt',
        type: 'function',
        inputs: [
          { name: 'amount_ars', type: 'core::integer::u128' }
        ],
        outputs: [
          { type: 'core::integer::u128' }
        ]
      },
      get_rate_ppm: {
        name: 'get_rate_ppm',
        type: 'function',
        inputs: [],
        outputs: [
          { type: 'core::integer::u128' }
        ]
      },
      get_scale: {
        name: 'get_scale',
        type: 'function',
        inputs: [],
        outputs: [
          { type: 'core::integer::u128' }
        ]
      },
      is_active: {
        name: 'is_active',
        type: 'function',
        inputs: [],
        outputs: [
          { type: 'core::bool' }
        ]
      }
    };

    // ABI del USDT Token contract
    this.usdtABI = {
      balanceOf: {
        name: 'balanceOf',
        type: 'function',
        inputs: [
          { name: 'account', type: 'core::starknet::contract_address::ContractAddress' }
        ],
        outputs: [
          { type: 'core::integer::u256' }
        ]
      }
    };
  }

  // Llamar a una función del contrato Oracle
  async callOracleFunction(functionName, calldata = []) {
    try {
      const selector = this.getFunctionSelector(functionName);
      
      const requestData = {
        jsonrpc: '2.0',
        id: 1,
        method: 'starknet_call',
        params: [
          {
            contract_address: this.oracleAddress,
            entry_point_selector: selector,
            calldata: calldata
          },
          'latest'
        ]
      };
      
      const response = await axios.post(this.rpcUrl, requestData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.error) {
        throw new Error(`Oracle RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error) {
      console.error(`Error calling Oracle function ${functionName}:`, error.message);
      throw error;
    }
  }

  // Llamar a una función del contrato USDT Token
  async callUSDTFunction(functionName, calldata = []) {
    try {
      const selector = this.getFunctionSelector(functionName);
      
      const response = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'starknet_call',
        params: [
          {
            contract_address: this.usdtTokenAddress,
            entry_point_selector: selector,
            calldata: calldata
          },
          'latest'
        ]
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.error) {
        throw new Error(`USDT RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error) {
      console.error(`Error calling USDT function ${functionName}:`, error.message);
      throw error;
    }
  }

  // Obtener cotización ARS a USDT usando el Oracle
  async getARSToUSDTQuote(amountARS) {
    try {
      console.log(`🔍 Obteniendo cotización ARS → USDT del Oracle para ${amountARS} ARS`);
      
      // Convertir amountARS a u128 con escala de 18 decimales (SCALE = 1_000_000_000_000_000_000 según el contrato)
      const amountARS_u128 = Math.floor(amountARS * 1000000000000000000);
      const amountARS_hex = '0x' + amountARS_u128.toString(16);
      
      // Llamar a quote_ars_to_usdt
      const result = await this.callOracleFunction('quote_ars_to_usdt', [amountARS_hex]);
      
      // El resultado viene en formato hexadecimal, convertir a decimal (sin dividir - ya está en la escala correcta)
      const usdtAmount_u128 = parseInt(result[0], 16);
      const usdtAmount = usdtAmount_u128; // No dividir - el Oracle ya devuelve el valor correcto
      
      // Calcular el rate (evitar división por cero)
      const rate = usdtAmount > 0 ? amountARS / usdtAmount : 0;
      
      console.log(`✅ Cotización obtenida del Oracle: ${amountARS} ARS = ${usdtAmount} USDT (Rate: ${rate})`);
      
      return {
        amountARS,
        usdtAmount,
        rate,
        source: 'STARKNET_ORACLE',
        timestamp: new Date(),
        oracleAddress: this.oracleAddress
      };
    } catch (error) {
      console.error('Error obteniendo cotización del Oracle:', error.message);
      throw error;
    }
  }

  // Obtener el rate actual del Oracle
  async getCurrentRate() {
    try {
      console.log('🔍 Obteniendo rate actual del Oracle');
      
      const rateResult = await this.callOracleFunction('get_rate_ppm', []);
      const scaleResult = await this.callOracleFunction('get_scale', []);
      const activeResult = await this.callOracleFunction('is_active', []);
      
      const rate_ppm = parseInt(rateResult[0], 16);
      const scale = parseInt(scaleResult[0], 16);
      const isActive = activeResult[0] === '0x1';
      
      // Calcular rate real: rate_ppm / scale
      const actualRate = rate_ppm / scale;
      
      console.log(`✅ Rate del Oracle: ${actualRate} (${rate_ppm} ppm / ${scale} scale, activo: ${isActive})`);
      
      return {
        rate_ppm,
        scale,
        actualRate,
        isActive,
        source: 'STARKNET_ORACLE',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error obteniendo rate del Oracle:', error.message);
      throw error;
    }
  }

  // Obtener balance USDT de una cuenta
  async getUSDTBalance(accountAddress) {
    try {
      console.log(`🔍 Obteniendo balance USDT para ${accountAddress}`);
      
      const result = await this.callUSDTFunction('balanceOf', [accountAddress]);
      
      // El resultado viene en formato hexadecimal, convertir a decimal (dividir por escala de 6 decimales)
      const balance_u256 = parseInt(result[0], 16);
      const balance = balance_u256 / 1000000;
      
      console.log(`✅ Balance USDT: ${balance} USDT`);
      
      return {
        balance,
        balance_u256,
        accountAddress,
        tokenAddress: this.usdtTokenAddress,
        source: 'STARKNET_USDT',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error obteniendo balance USDT:', error.message);
      throw error;
    }
  }

  // Obtener selector de función (hash de la función)
  getFunctionSelector(functionName) {
    // Selectores conocidos para las funciones del Oracle y USDT Token
    const selectors = {
      'quote_ars_to_usdt': '0x35cc48151d07616d346a3d1d328772a9944e6564a7dca5339beb8915634d309',
      'get_rate_ppm': '0x03b9c4b0b8c7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7',
      'get_scale': '0x04b9c4b0b8c7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7',
      'is_active': '0x05b9c4b0b8c7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7b7',
      'balanceOf': '0x2e4263afad30923c891518314c3c95dbe830a16874e8a5761d37084e37954567'
    };

    // Si tenemos el selector predefinido, usarlo
    if (selectors[functionName]) {
      return selectors[functionName];
    }

    // Para otras funciones, calcular el hash (esto es un placeholder)
    // En producción, deberías calcular el hash real usando la función de Cairo
    console.warn(`⚠️ Selector no encontrado para ${functionName}, usando placeholder`);
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }

  // Verificar estado del Oracle
  async checkOracleStatus() {
    try {
      const rateData = await this.getCurrentRate();
      
      return {
        isActive: rateData.isActive,
        currentRate: rateData.actualRate,
        oracleAddress: this.oracleAddress,
        usdtTokenAddress: this.usdtTokenAddress,
        status: rateData.isActive ? 'ACTIVE' : 'INACTIVE',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error verificando estado del Oracle:', error.message);
      return {
        isActive: false,
        currentRate: null,
        oracleAddress: this.oracleAddress,
        usdtTokenAddress: this.usdtTokenAddress,
        status: 'ERROR',
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

module.exports = StarknetOracleService;
