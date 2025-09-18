export namespace RblxLogger {
    const LIBRARY_NAME   : string = "RblxDataStore";
    const isDebugEnabled    : boolean = false;

    export const debug = {
        logInfo: (...message: string[]) => {
            if (!isDebugEnabled) {return;}
            print(`[DEBUG] ${LIBRARY_NAME} - [INFO] ${message} - ${os.date("%X", os.time())}`);
        }
    }

    export function logInfo(...message: string[]) {
        print(`${LIBRARY_NAME} - [INFO] ${message} - ${os.date("%X", os.time())}`);
    }

    export function logError(...message: string[]) {
        error(`${LIBRARY_NAME} - [ERR] ${message} - ${os.date("%X", os.time())}`, 2);
    }

    export function logWarn(...message: string[]) {
        warn(`${LIBRARY_NAME} - [WARN] ${message} - ${os.date("%X", os.time())}`);
    }

}