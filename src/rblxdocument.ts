/**
 * @INFO
 * Organization : FLOGRE Studio
 * Author       : Mubinet

 * @CONTACT
 * Email        : mubinet.workspace@gmail.com
 * 
 * @LICENSE
 * MIT License - Copyright (c) 2025 FLOGRE STUDIO
*/

import { Migration } from "./types/global";
import { RblxLogger } from "./utils/rblxlogger";
import { Err, Result } from "./utils/result";

export type RblxDocumentStatus               = "OPENED" | "CLOSED" | "OPENING" | "CLOSING"
export type OpenRblxDocumentResultErrors     = "DOCUMENT_ALREADY_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
export type CloseRblxDocumentResultErrors    = "DOCUMENT_ALREADY_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
export type GetCacheRblxDocumentResultErrors = "DOCUMENT_IS_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
export type SetCacheRblxDocumentResultErrors = "DOCUMENT_IS_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";

/**
 * ## RblxDocument
 * A data object that is organized by schema and contain information about entity.
*/
export class RblxDocument<DataSchema> {
    //* FIELDS *\\
        private _dataStore           : DataStore;
        private _schemaValidate      : (data: Partial<DataSchema> & Record<string, unknown>) => boolean;
        private _defaultSchema       : DataSchema;
        private _migrations          : Migration<DataSchema>[];
        private _rblxDocumentStatus  : RblxDocumentStatus;
        private _rblxDocumentCache?  : DataSchema;
    //

    constructor(
        dataStore: DataStore,
        schemaValidate: (data: Partial<DataSchema> & Record<string, unknown>) => boolean,
        defaultSchema: DataSchema,
        migrations: Migration<DataSchema>[]
    ) {
        this._dataStore          = dataStore;
        this._schemaValidate     = schemaValidate;
        this._defaultSchema      = defaultSchema;
        this._migrations         = migrations;
        this._rblxDocumentStatus = "CLOSED";
    }

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

    public erase(): Result<DataSchema, CloseRblxDocumentResultErrors> {
        return new Err("UNKNOWN");
    }

    public getCache(): Result<DataSchema, GetCacheRblxDocumentResultErrors> {
        return new Err("UNKNOWN");
    }

    public setCache(): Result<DataSchema, SetCacheRblxDocumentResultErrors> {
        return new Err("UNKNOWN");
    }
}