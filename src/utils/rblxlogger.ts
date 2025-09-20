/**
 * @INFO
 * Organization : FLOGRE Studio
 * Author       : Mubinet

 * @CONTACT
 * Email        : mubinet.workspace@gmail.com
 * 
 * @LICENSE
 * MIT License - Copyright (c) 2025 FLOGRE Studio
*/

/** @internal */
export namespace RblxLogger {
    const LIBRARY_NAME   : string = "RblxDataStore";
    const isDebugEnabled    : boolean = false;

    export const debug = {
        logInfo: (...message: string[]) => {
            if (!isDebugEnabled) {return;}
            print(`[DEBUG] [INFO] ${LIBRARY_NAME}  ||  ${message}  ||  ${os.date("%X", os.time())}`);
        }
    }

    export function logInfo(...message: string[]) {
        print(`[INFO] ${LIBRARY_NAME}  ||  ${message}  ||  ${os.date("%X", os.time())}`);
    }

    export function logError(...message: string[]) {
        error(`[ERR] ${LIBRARY_NAME}  ||  ${message}  ||  ${os.date("%X", os.time())}`);
    }

    export function logWarn(...message: string[]) {
        warn(`[WARN] ${LIBRARY_NAME}  ||  ${message}  ||  ${os.date("%X", os.time())}`);
    }

}