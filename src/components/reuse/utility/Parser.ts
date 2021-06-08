import chrono from "chrono-node";
import { strict } from "assert";
import {currencyCodes} from "./CurrencyCodes";

export class Parser {
    /**
     * returns date in yyyy-MM-dd format if the text can be parsed
     * 
     * @param text 
     */
    public static parseDate(text: string): string {
        const parsedResults = chrono.strict.parse(text);
        if(parsedResults.length > 0) {
            const result = parsedResults[0];
            return (result.text === text.trim() && 
                    'year' in result.start.knownValues && 
                    'month' in result.start.knownValues &&
                    'day' in result.start.knownValues) ? result.start.date().toISOString().slice(0,10) : null;
        }
        return null;
    }

    /**
     * 
     * return a number if the text can be parsed as number in relevent country format
     * @param text 
     */
    public static parseFloat(text: string): string {
        const value = sap.ui.core.format.NumberFormat.getFloatInstance().parse(text) as number
        return isNaN(value) ? null : `${value}`; 
    }

    public static parseCurrency(text: string): string {
        for (const currency of currencyCodes) {
            if(text === currency['code'] || text === currency['symbol']) {
                return currency['code'];
            }
        }
        return null;
    }

}
