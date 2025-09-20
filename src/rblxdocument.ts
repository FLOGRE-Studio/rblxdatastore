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

import { Migration } from "./types/global";
import { RblxDocumentStoreConfiguration } from "./utils/rblxdocumentstore-configuration";
import { RblxDataStoreUtility } from "./utils/rblxdatastore-utility";
import { RblxLogger } from "./utils/rblxlogger";
import { Err, Ok, Result } from "./utils/result";

//* ERROR TYPES
    export type OpenRblxDocumentResultError     = "DOCUMENT_ALREADY_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type CloseRblxDocumentResultError    = "DOCUMENT_ALREADY_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type GetCacheRblxDocumentResultError = "DOCUMENT_IS_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type SetCacheRblxDocumentResultError = "DOCUMENT_IS_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type SaveRblxDocumentResultError     = "DOCUMENT_IS_CLOSE" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type StealRblxDocumentResultError    = "DOCUMENT_CLOSE_PENDING" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type EraseRblxDocumentResultError    = "DOCUMENT_STILL_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
//

export type RblxDocumentStatus               = "OPENED" | "CLOSED" | "OPENING" | "CLOSING";
interface RblxDocumentProps<DataSchema> {
    dataStore                        : DataStore;
    rblxDataStoreUtility             : RblxDataStoreUtility;
    key                              :  string;
    schemaValidate                   : (data: Partial<DataSchema> & Record<string, unknown>) => boolean;
    defaultSchema                    : DataSchema;
    migrations                       : Migration<DataSchema>[];
    rblxDocumentStoreConfiguration   : RblxDocumentStoreConfiguration;
}

/**
 * ## RblxDocument
 * A data object that is organized by schema and contain information about entity.
*/
export class RblxDocument<DataSchema> {
    //* FIELDS *\\
        private _dataStore                        : DataStore;
        private _rblxDataStoreUtility             : RblxDataStoreUtility;
        private _key                              : string;
        private _schemaValidate                   : (data: Partial<DataSchema> & Record<string, unknown>) => boolean;
        private _defaultSchema                    : DataSchema;
        private _migrations                       : Migration<DataSchema>[];
        private _rblxDocumentStatus               : RblxDocumentStatus;
        private _rblxDocumentCache?               : DataSchema;
        private _rblxDocumentStoreConfiguration   : RblxDocumentStoreConfiguration;
    //

    constructor(rblxDocumentProps: RblxDocumentProps<DataSchema>) {
        this._dataStore                          = rblxDocumentProps.dataStore;
        this._rblxDataStoreUtility               = rblxDocumentProps.rblxDataStoreUtility;
        this._key                                = rblxDocumentProps.key;
        this._schemaValidate                     = rblxDocumentProps.schemaValidate;
        this._defaultSchema                      = rblxDocumentProps.defaultSchema;
        this._migrations                         = rblxDocumentProps.migrations;
        this._rblxDocumentStatus                 = "CLOSED";
        this._rblxDocumentStoreConfiguration     = rblxDocumentProps.rblxDocumentStoreConfiguration;

        // Invoke the main method.
        this._main();
    }

    private _main() { /* empty */ }

    //* OPEN & CLOSE METHODS *\\
        public open(): Result<DataSchema, OpenRblxDocumentResultError> {
            if (this._rblxDocumentStatus === "OPENED") {
                RblxLogger.logError("The document is already open.");
            }

            return new Err("UNKNOWN");
        }

        public close(): Result<DataSchema, CloseRblxDocumentResultError> {
            if (this._rblxDocumentStatus === "CLOSED") {
                RblxLogger.logError("The document is already closed.");
            }

            return new Err("UNKNOWN");
        }
    //

    //* GETTER & SETTER METHODS *\\
        public getCache(): Result<DataSchema, GetCacheRblxDocumentResultError> {
            return new Err("UNKNOWN");
        }

        public setCache(): Result<DataSchema, SetCacheRblxDocumentResultError> {
            return new Err("UNKNOWN");
        }
    //

    //* DATA OPERATIONS *\\
        public save(): Result<DataSchema, CloseRblxDocumentResultError> {
            return new Err("UNKNOWN");
        }

        public steal(): Result<void, StealRblxDocumentResultError> {
            return new Ok(undefined);
        }

        public erase(): Result<DataSchema, EraseRblxDocumentResultError> {
            return new Err("UNKNOWN");
        }
    //
}