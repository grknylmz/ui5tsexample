import fs from "fs"

export class Logger {
    // Gets overriden in define
    public static logInfo(msg: string, details?: string, component?: string, supportInfo?: Function): void {
        // tslint:disable-next-line: no-console
        //console.log(msg); //todo disable logInfo for now, change to configurable
    }

    // Gets overriden in define
    public static logWarning(msg: string, details?: string, component?: string, supportInfo?: Function): void {
        // tslint:disable-next-line: no-console
        console.log(msg);
    }

    // Gets overriden in define
    public static logError(msg: string, details?: string, component?: string): void {
        // tslint:disable-next-line: no-console
        console.log(msg);
    }
}
