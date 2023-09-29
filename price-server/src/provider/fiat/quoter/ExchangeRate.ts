import nodeFetch from 'node-fetch'
import { errorHandler } from 'lib/error'
import { toQueryString } from 'lib/fetch'
import { num } from 'lib/num'
import * as logger from 'lib/logger'
import { Quoter } from 'provider/base'

interface ResponseOpen {
  result: string
  rates: { [symbol: string]: number }  
  'error-type'?: Record<string, unknown> | string
}

interface Response {
  result: boolean
  conversion_rates: { [symbol: string]: number }
  'error-type'?: Record<string, unknown> | string
}

/**
 *
 * ExchangeRate API allow querying fiat prices
 * using a base coin to do a single call.
 *
 * In order to optimize the program and have
 * parity with the other services the price
 * is switched as of 1 unit of the basis currency being
 * the quoted currency e.g.:
 *  instead of USD/EUR, it will be EUR/USD
 *
 * https://exchangerate.host/#/#our-services
 */
export class ExchangeRate extends Quoter {
  private async updatePrices(): Promise<void> {
    const params = {
      api_key: this.options.apiKey,
      base: 'USD',
      symbols: this.symbols.map((symbol) => (symbol === 'SDR/USD' ? 'XDR' : symbol.replace('/USD', ''))).join(','),
    }

    if (typeof params.api_key === 'undefined' || params.api_key.length == 0) {
      const responseOpen: ResponseOpen = await nodeFetch(`https://open.er-api.com/v6/latest/${params.base}`, {
        timeout: this.options.timeout,
      }).then((res) => res.json())

      if (!responseOpen || !responseOpen.result || !responseOpen.rates) {
        logger.error(`${this.constructor.name}: wrong api response`, responseOpen ? JSON.stringify(response) : 'empty')
        throw new Error('Invalid response from ExchangeRate')
      }

      // Update the latest trades (Open Version)
      for (const symbol of Object.keys(responseOpen.rates)) {
          const convertedSymbol = (symbol == 'XDR') ? 'SDR' + '/' + params.base : symbol + '/' + params.base

          if (this.symbols.includes(convertedSymbol)) {
            const convertedPrice = num(1).dividedBy(num(responseOpen.rates[symbol]))

  console.log ('ExchangeRate - Open: ' + convertedSymbol + ' - ' + convertedPrice)

            this.setPrice(convertedSymbol, convertedPrice)
          }
      }

    } else {
      const response: Response = await nodeFetch(`https://v6.exchangerate-api.com/v6/${params.api_key}/latest/${params.base}`, {
        timeout: this.options.timeout,
      }).then((res) => res.json())

      if (!response || !response.result || !response.conversion_rates) {
        logger.error(`${this.constructor.name}: wrong api response`, response ? JSON.stringify(response) : 'empty')
        throw new Error('Invalid response from ExchangeRate')
      }

      // Update the latest trades (API Version)
      for (const symbol of Object.keys(response.conversion_rates)) {
        const convertedSymbol = (symbol == 'XDR') ? 'SDR' + '/' + params.base : symbol + '/' + params.base
        
        if (this.symbols.includes(convertedSymbol)) {
          const convertedPrice = num(1).dividedBy(num(response.conversion_rates[symbol]))

console.log ('ExchangeRate - API: ' + convertedSymbol + ' - ' + convertedPrice)

          this.setPrice(convertedSymbol, convertedPrice)
        }
      }
    }

    

    
  }

  protected async update(): Promise<boolean> {
    await this.updatePrices().catch(errorHandler)

    return true
  }
}

export default ExchangeRate
