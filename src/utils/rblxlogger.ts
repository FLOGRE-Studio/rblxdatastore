/* eslint-disable prefer-const */
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
    const LIBRARY_NAME          : string    = "RblxDataStore";
    export let isDebugEnabled   : boolean   = false;

    export const debug = {
        logInfo: (...message: string[]) => {
            if (!isDebugEnabled) return;
            print(`[DEBUG] [INFO] ${LIBRARY_NAME} || ${message.join()}|| ${os.date("%X", os.time())}`);
        }
    }

    export function logInfo(...message: string[]) {
        print(`[INFO] ${LIBRARY_NAME} || ${message.join()} || ${os.date("%X", os.time())}`);
    }

    export function logError(...message: string[]) {
        error(`[INFO] ${LIBRARY_NAME} || ${message.join()} || ${os.date("%X", os.time())}`);
    }

    export function logWarn(...message: string[]) {
        warn(`[INFO] ${LIBRARY_NAME} || ${message.join()} || ${os.date("%X", os.time())}`);
    }
}