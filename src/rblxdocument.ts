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
import { Configuration } from "./utils/rblxdocumentstore-configuration";
import { RblxLogger } from "./utils/rblxlogger";
import { Err, Ok, Result } from "./utils/result";

// Error types
export type RblxDocumentStatus               = "OPENED" | "CLOSED" | "OPENING" | "CLOSING";
export type OpenRblxDocumentResultErrors     = "DOCUMENT_ALREADY_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
export type CloseRblxDocumentResultErrors    = "DOCUMENT_ALREADY_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
export type GetCacheRblxDocumentResultErrors = "DOCUMENT_IS_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
export type SetCacheRblxDocumentResultErrors = "DOCUMENT_IS_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
export type SaveRblxDocumentResultErrors     = "DOCUMENT_IS_CLOSE" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
export type StealRblxDocumentResultErrors    = "DOCUMENT_CLOSE_PENDING" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
export type EraseRblxDocumentResultErrors    = "DOCUMENT_STILL_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";

/**
 * ## RblxDocument
 * A data object that is organized by schema and contain information about entity.
*/
export class RblxDocument<DataSchema> {
    //* FIELDS *\\
        private _dataStore           : DataStore;
        private _key                 : string;
        private _schemaValidate      : (data: Partial<DataSchema> & Record<string, unknown>) => boolean;
        private _defaultSchema       : DataSchema;
        private _migrations          : Migration<DataSchema>[];
        private _rblxDocumentStatus  : RblxDocumentStatus;
        private _rblxDocumentCache?  : DataSchema;
        private _configuration       : Configuration;
    //

    constructor(
        dataStore: DataStore,
        key: string,
        schemaValidate: (data: Partial<DataSchema> & Record<string, unknown>) => boolean,
        defaultSchema: DataSchema,
        migrations: Migration<DataSchema>[],
        configuration: Configuration
    ) {
        this._dataStore          = dataStore;
        this._key                = key;
        this._schemaValidate     = schemaValidate;
        this._defaultSchema      = defaultSchema;
        this._migrations         = migrations;
        this._rblxDocumentStatus = "CLOSED";
        this._configuration      = configuration;
    }

    //* OPEN & CLOSE METHODS *\\
        public open(): Result<DataSchema, OpenRblxDocumentResultErrors> {
            if (this._rblxDocumentStatus === "OPENED") {
                RblxLogger.logError("The document is already open.");
            }

            return new Err("UNKNOWN");
        }

        public close(): Result<DataSchema, CloseRblxDocumentResultErrors> {
            if (this._rblxDocumentStatus === "CLOSED") {
                RblxLogger.logError("The document is already closed.");
            }

            return new Err("UNKNOWN");
        }
    //

    //* GETTER & SETTER METHODS *\\
        public getCache(): Result<DataSchema, GetCacheRblxDocumentResultErrors> {
            return new Err("UNKNOWN");
        }

        public setCache(): Result<DataSchema, SetCacheRblxDocumentResultErrors> {
            return new Err("UNKNOWN");
        }
    //

    //* DATA OPERATIONS *\\
        public save(): Result<DataSchema, CloseRblxDocumentResultErrors> {
            return new Err("UNKNOWN");
        }

        public steal(): Result<void, StealRblxDocumentResultErrors> {
            return new Ok(undefined);
        }

        public erase(): Result<DataSchema, EraseRblxDocumentResultErrors> {
            return new Err("UNKNOWN");
        }
    //
}