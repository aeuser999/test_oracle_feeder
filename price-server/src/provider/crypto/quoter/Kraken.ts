import fetch, { toQueryString } from 'lib/fetch'
import { errorHandler } from 'lib/error'
import * as logger from 'lib/logger'
import { num } from 'lib/num'
import { getBaseCurrency, getQuoteCurrency } from 'lib/currency'
import { Quoter } from 'provider/base'

// lodash has problems with:  import _ from 'lodash'
import * as _ from 'lodash'

interface Response {
  error?: string[]
  result: {
    [x: string]: { a: string }
  }
}

export class Kraken extends Quoter {
  private getBaseCurrency(symbol) {
    const currency = getBaseCurrency(symbol)

    let translateCurrency = currency == 'LUNC' ? 'LUNA' : currency
    translateCurrency = translateCurrency == 'USTC' ? 'UST' : translateCurrency

    return translateCurrency
  }

  private getQuoteCurrency(symbol) {
    const currency = getQuoteCurrency(symbol)

    let translateCurrency = currency == 'LUNC' ? 'LUNA' : currency
    translateCurrency = translateCurrency == 'USTC' ? 'UST' : translateCurrency
    
    return translateCurrency
  }
  
  private getNonXZSymbol(symbol) {
      // Handle Kraken's inconsistent use of USD vs ZUSD (allows the ticker USDTUSD but returns USDTZUSD)
      // On Kraken, ZUSD is not referencing the ZUSD cryptocurrency, but rather is referencing USD
      // X is used as a beginning on some older crypto currency beginnings
      // Z is used on some fiat currency beginnings
      //    See:  https://support.kraken.com/hc/en-us/articles/360001185506-How-to-interpret-asset-codes
      
      if (typeof symbol == 'string'){
        let separator = symbol.match(/[\/\-]/)
        
        if (separator !== null) {
          let part1 = this.getBaseCurrency(symbol)
          let part2 = this.getQuoteCurrency(symbol)

          part1 = part1.startsWith('X') || part1.startsWith('Z') ? part1.replace(/^[XZ]/, '') : part1
          part2 = part2.startsWith('X') || part2.startsWith('Z') ? part2.replace(/^[XZ]/, '') : part2

          symbol = part1 + separator[0] + part2
        } else {

          let midPoint = Math.floor(symbol.length / 2)
          let part1 = symbol.substring(0,midPoint)
          let part2 = symbol.substring(midPoint)

          part1 = part1.startsWith('X') || part1.startsWith('Z') ? part1.replace(/^[XZ]/, '') : part1
          part2 = part2.startsWith('X') || part2.startsWith('Z') ? part2.replace(/^[XZ]/, '') : part2

          symbol = part1 + part2
        }
      }

      return symbol
  }

  private async updatePrices(): Promise<void> {

    const params = {      
      pair: this.symbols.map((symbol) => this.getBaseCurrency(symbol)+this.getQuoteCurrency(symbol)).join(','),
    }

    const response: Response = await fetch(`https://api.kraken.com/0/public/Ticker?${toQueryString(params)}`, {
      timeout: this.options.timeout,
    }).then((res) => res.json())


    if (response && _.isEmpty(response.result)) {
      logger.error(`${this.constructor.name}:`, response ? JSON.stringify(response) : 'empty')
      throw new Error('Invalid response from Kraken')
    }

    for (const symbol in response.result) {      
      const data = response.result[symbol]

      if (data.a[0]) {        

        let translatedSymbol = this.symbols.find((localSymbol) => {
          if (this.getBaseCurrency(localSymbol)+this.getQuoteCurrency(localSymbol) === symbol) {
            return this.getBaseCurrency(localSymbol)+this.getQuoteCurrency(localSymbol) === symbol
          } else {
            return this.getBaseCurrency(localSymbol)+this.getQuoteCurrency(localSymbol) === this.getNonXZSymbol(symbol)
          }
        })
        translatedSymbol = translatedSymbol === undefined ? '' : translatedSymbol

        if (translatedSymbol !== '') {
          this.setPrice(translatedSymbol, num(data.a[0]))          
        }
        
console.log('Kraken: ' + translatedSymbol + ' - ' + num(data.a[0]) + ' = ' + this.getPrice(translatedSymbol))        
      }
    }
  }

  protected async update(): Promise<boolean> {
    await this.updatePrices().catch(errorHandler)

    return true
  }
}

export default Kraken
