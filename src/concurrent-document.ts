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

import { Migration, RblxStoreDataDocumentFormat, Transformation } from "./types/global";
import { RblxDataStoreUtility } from "./utils/rblxdatastore-utility";
import { RblxLogger } from "./utils/rblxlogger";
import { Err, Ok, Result } from "./utils/result";

//* ERROR TYPES
    export type OpenRblxDocumentResultError     = "DOCUMENT_ALREADY_OPEN" | "DOCUMENT_CLOSE_PENDING" | "DOCUMENT_VERSION_INCOMPATIBLE" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNSTORABLE_DATA_ERROR" | "TRANSFORMATION_ERROR" | "MIGRATIONS_ERROR" | "UNKNOWN";
    export type CloseRblxDocumentResultError    = "DOCUMENT_ALREADY_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type GetCacheRblxDocumentResultError = "DOCUMENT_NOT_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type SetCacheRblxDocumentResultError = "DOCUMENT_NOT_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type UpdateRblxDocumentResultError   = "DOCUMENT_NOT_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type SaveRblxDocumentResultError     = "DOCUMENT_NOT_OPEN" | "SESSION_LOCKED" | "NON_SESSION_LOCKING_DOCUMENT_NOT_SUPPORTED" |"ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type StealRblxDocumentResultError    = "DOCUMENT_CLOSE_PENDING" | "NON_SESSION_LOCKING_DOCUMENT_NOT_SUPPORTED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type EraseRblxDocumentResultError    = "DOCUMENT_MUST_BE_CLOSED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
//

export type ConcurrentDocumentStatus                  = "OPENED" | "CLOSED" | "OPENING" | "CLOSING";

interface ConcurrentDocumentProps<DataSchema extends object> {
    dataStore                        : DataStore;
    rblxDataStoreUtility             : RblxDataStoreUtility;
    key                              :  string;
    schemaValidate                   : (data: Partial<DataSchema> & object) => boolean;
    defaultSchema                    : DataSchema;
    transformation                   : Transformation<DataSchema>;
    migrations                       : Migration<DataSchema>[];
}

/**
 * ## ConcurrentDocument
 * A data object that is organized by schema and contain information about entity.
*/
export class ConcurrentDocument<DataSchema extends object> {
    //* FIELDS *\\
        private AUTO_SAVE_INTERVAL                : number = 300;

        private _dataStore                        : DataStore;
        private _rblxDataStoreUtility             : RblxDataStoreUtility;
        private _key                              : string;
        private _schemaValidate                   : (data: Partial<DataSchema>) => boolean;
        private _defaultSchema                    : DataSchema;
        private _transformation                   : Transformation<DataSchema>;
        private _migrations                       : Migration<DataSchema>[];
        private _rblxDocumentStatus               : ConcurrentDocumentStatus;
        private _autoSaveThread?                  : thread;

        private _onOpenEvent                      : BindableEvent<(result: Result<void, OpenRblxDocumentResultError>) => void>;
        private _onCloseEvent                     : BindableEvent<(result: Result<void, CloseRblxDocumentResultError>) => void>;
        private _onCacheUpdatedEvent              : BindableEvent<() => void>;

        public onOpen                             : RBXScriptSignal<(result: Result<void, OpenRblxDocumentResultError>) => void>;
        public onClose                            : RBXScriptSignal<(result: Result<void, CloseRblxDocumentResultError>) => void>;
        public onCacheUpdated                     : RBXScriptSignal<() => void>;
    //

    constructor(rblxDocumentProps: ConcurrentDocumentProps<DataSchema>) {
        this._dataStore                          = rblxDocumentProps.dataStore;
        this._rblxDataStoreUtility               = rblxDocumentProps.rblxDataStoreUtility;
        this._key                                = rblxDocumentProps.key;
        this._schemaValidate                     = rblxDocumentProps.schemaValidate;
        this._transformation                     = rblxDocumentProps.transformation;
        this._defaultSchema                      = rblxDocumentProps.defaultSchema;
        this._migrations                         = rblxDocumentProps.migrations;
        this._rblxDocumentStatus                 = "CLOSED";

        this._onOpenEvent                        = new Instance("BindableEvent");
        this._onCloseEvent                       = new Instance("BindableEvent");
        this._onCacheUpdatedEvent                = new Instance("BindableEvent");

        this.onOpen                              = this._onOpenEvent.Event;
        this.onClose                             = this._onCloseEvent.Event;
        this.onCacheUpdated                      = this._onCacheUpdatedEvent.Event;
    }

    //* OPEN & CLOSE METHODS *\\
    /**
     * Opens the concurrent document for reading and writing.
     * Handles schema validation, migrations, transformation, and atomicity.
     * @returns Ok<RblxStoreDataDocumentFormat<DataSchema>> on success, Err<OpenRblxDocumentResultError> on failure.
     */
    public open(): Result<RblxStoreDataDocumentFormat<DataSchema>, OpenRblxDocumentResultError> {
        // Take the key of the document. 
        const dataKey = this._key;
        
        /**
            * Return an error if the document is already opened, indicating it was unnecessary to re-open it.
            * Ensure you cache any successfully opened documents in memory to use for any data operations.
        */
        if (this._rblxDocumentStatus === "OPENED") {
            RblxLogger.debug.logInfo(`[open] Document already opened for key ("${this._key}")`);
            return new Err("DOCUMENT_ALREADY_OPEN");
        }

        /**
            * Return an error if the closure of the document is pending.
            * You must wait until the document is closed in order to open the document.
        */
        if (this._rblxDocumentStatus === "CLOSING") {
            RblxLogger.debug.logInfo(`[open] Document close pending for key ("${this._key}")`);
            return new Err("DOCUMENT_CLOSE_PENDING");
        }

        // Set document status
    this._rblxDocumentStatus = "CLOSING";
    RblxLogger.debug.logInfo(`[open] Document status set to CLOSING for key ("${this._key}")`);

        const transformFunc = (
            data: unknown, 
            cancel: (err: Err<RblxStoreDataDocumentFormat<DataSchema>, OpenRblxDocumentResultError>) => Err<RblxStoreDataDocumentFormat<DataSchema>, OpenRblxDocumentResultError>
        ): Result<RblxStoreDataDocumentFormat<DataSchema>, OpenRblxDocumentResultError> => {
            /**
                * * The entire function must be atomic; Either everything succeed or nothing will happen.
                * * Due to the nature of external systems, enforcing atomicity will be difficult.
                * * In case of any problem e.g failure to lock the session for data, transformation error, migrations error, Roblox API service error,
                * * we'll try to revert everything such as unlocking the session for the data.
            */

            let rblxDataStoreDocument        : RblxStoreDataDocumentFormat<DataSchema> | undefined = undefined;
            let rblxDocumentData             : DataSchema                                          = this._defaultSchema;
            let rblxDocumentSchemaVersion    : number                                              = 0;
            
            if (data) {
                const rblxDataStoreDocumentResult = this._rblxDataStoreUtility.verifyRblxDataStoreDocumentFormat<DataSchema>(data);

                if (rblxDataStoreDocumentResult.isOk()) {
                    rblxDataStoreDocument = rblxDataStoreDocumentResult.value;
                    rblxDocumentData      = rblxDataStoreDocumentResult.value.data;
                }
                if (rblxDataStoreDocumentResult.isErr()) rblxDocumentData = (typeIs(data, "table") ? data as DataSchema : { data } as unknown as DataSchema);
            }

            if (rblxDataStoreDocument && this._migrations.size() < rblxDataStoreDocument.minimalSupportedVersion) return cancel(new Err("DOCUMENT_VERSION_INCOMPATIBLE"));
            if (rblxDataStoreDocument) rblxDocumentSchemaVersion = rblxDataStoreDocument.schemaVersion;

            const rblxDocumentDataTransformationResult = this._transformation.transform(rblxDocumentData);
            if (rblxDocumentDataTransformationResult.isErr()) {
                return cancel(new Err("TRANSFORMATION_ERROR"));
            }

            rblxDocumentData = rblxDocumentDataTransformationResult.value;
            
            // eslint-disable-next-line prefer-const
            for (let [targetVersion, migration] of ipairs(this._migrations)) {
                RblxLogger.debug.logInfo(`[open:transformFunc] Checking migration for targetVersion ${targetVersion} for key ("${this._key}")`);
                // The previous version that migration will migrate data FROM.
                const fromVersion = (targetVersion - 1);
                RblxLogger.debug.logInfo(`[open:transformFunc] fromVersion set to ${fromVersion} for key ("${this._key}")`);
                // Run the migration ONLY when the version of the old data MATCH the previous version that migration is migrating FROM.
                if (rblxDocumentSchemaVersion === fromVersion) {
                    RblxLogger.debug.logInfo(`[open:transformFunc] Running migration for targetVersion ${targetVersion} for key ("${this._key}")`);
                    const migrationResult = migration.migrate(rblxDocumentData);
                    if (migrationResult.isErr()) {
                        RblxLogger.debug.logInfo(`[open:transformFunc] Migration failed for targetVersion ${targetVersion} for key ("${this._key}")`);
                        return cancel(new Err("MIGRATIONS_ERROR"));
                    }

                    rblxDocumentData          = migrationResult.value;
                    RblxLogger.debug.logInfo(`[open:transformFunc] Migration succeeded for targetVersion ${targetVersion} for key ("${this._key}")`);
                    rblxDocumentSchemaVersion = targetVersion;
                }
            }

            if (!this._schemaValidate(rblxDocumentData)) {
                return cancel(new Err("SCHEMA_VALIDATION_ERROR"));
            }

            if (!this._rblxDataStoreUtility.checkForDataStorability(rblxDocumentData)) {
                return cancel(new Err("UNSTORABLE_DATA_ERROR"));
            }
            
            let minimalSupportedVersion: number = rblxDataStoreDocument?.minimalSupportedVersion || 0;
            for (let newestMigration = this._migrations.size(); newestMigration > 0; newestMigration--) {
                RblxLogger.debug.logInfo(`[open:transformFunc] Checking backwards compatibility for migration ${newestMigration} for key ("${this._key}")`);
                const migration = this._migrations[newestMigration - 1];
                if (!migration.backwardsCompatible) {
                    RblxLogger.debug.logInfo(`[open:transformFunc] Migration ${newestMigration} is not backwards compatible for key ("${this._key}")`);
                    minimalSupportedVersion = newestMigration;
                    break;
                }
            }

            const updatedRblxDataStoreDocument: RblxStoreDataDocumentFormat<DataSchema> = {
                data: rblxDocumentData,
                minimalSupportedVersion: minimalSupportedVersion,
                schemaVersion: math.max(this._migrations.size(), rblxDocumentSchemaVersion)
            }

            return new Ok(updatedRblxDataStoreDocument);
        }

        const updateAsyncResult = this._rblxDataStoreUtility.updateAsync<RblxStoreDataDocumentFormat<DataSchema>, OpenRblxDocumentResultError>(dataKey, transformFunc);
        if (updateAsyncResult.isErr()) {
            if (updateAsyncResult.errorType !== "DATASTORE_UPDATE_BUDGET_RAN_OUT") {
                const errResult = new Err<RblxStoreDataDocumentFormat<DataSchema>, OpenRblxDocumentResultError>(updateAsyncResult.errorType);
                this._onOpenEvent.Fire(new Err(errResult.errorType));
                return errResult;
            }

            const errResult = new Err<RblxStoreDataDocumentFormat<DataSchema>, OpenRblxDocumentResultError>("ROBLOX_SERVICE_ERROR");
            this._onOpenEvent.Fire(new Err(errResult.errorType));
            return errResult;
        }

    this._rblxDocumentStatus = "OPENED";
    RblxLogger.debug.logInfo(`[open] Document status set to OPENED for key ("${this._key}")`);

    RblxLogger.debug.logInfo(`[open] Successfully opened the concurrent document with key ("${this._key}").`);

        const okResult = new Ok(updateAsyncResult.value[0]!);
        this._onOpenEvent.Fire(new Ok(undefined));
        return okResult;
    }


    /**
     * Closes the concurrent document and updates its status.
     * @returns Ok<void> on success, Err<CloseRblxDocumentResultError> on failure.
     */
    public close(): Result<void, CloseRblxDocumentResultError> {
        RblxLogger.debug.logInfo(`Attempting to close the concurrent document with key ("${this._key}")...`);
        
        if (this._rblxDocumentStatus === "CLOSED") {
            RblxLogger.debug.logInfo(`[close] Document already closed for key ("${this._key}")`);
            const errResult = new Err<void, CloseRblxDocumentResultError>("DOCUMENT_ALREADY_CLOSED");
            this._onCloseEvent.Fire(errResult);
            return errResult
        }

        this._rblxDocumentStatus = "CLOSING";
        
        RblxLogger.debug.logInfo(`[close] Document status set to CLOSING for key ("${this._key}")`);
        RblxLogger.debug.logInfo(`[close] Successfully closed the concurrent document with key ("${this._key}")`);
    
        this._onCloseEvent.Fire(new Ok(undefined));
        return new Ok(undefined);
    }
    //

    //* DATA OPERATIONS *\\
        /**
         * Updates the concurrent document data using a transformation function and writes to the DataStore.
         * Handles schema validation and error reporting.
         * @param transformFunc - Function to transform the document data.
         * @returns Ok<DataSchema> with updated data, Err<UpdateRblxDocumentResultError> on failure.
         */
        public update(transformFunc: (data: DataSchema) => DataSchema): Result<DataSchema, UpdateRblxDocumentResultError> {
            // Ensure document is open before updating.
            if (this._rblxDocumentStatus === "OPENING" || this._rblxDocumentStatus === "CLOSED") {
                RblxLogger.debug.logInfo(`[update] Document not open for key ("${this._key}")`);
                return new Err("DOCUMENT_NOT_OPEN");
            }
            RblxLogger.debug.logInfo(`[update] Attempting to update the cache of CacheDocument with key ("${this._key}") with latest transformed data to the datastore...`);

            // Helper to perform update and handle schema validation.
            const tryUpdating = (): Result<DataSchema, UpdateRblxDocumentResultError> => {
                // Update the document in the DataStore.
                const updateAsyncResult = this._rblxDataStoreUtility.updateAsync<RblxStoreDataDocumentFormat<DataSchema>, UpdateRblxDocumentResultError>(this._key, (data) => {
                    const rblxDocumentDataFormatResult = this._rblxDataStoreUtility.verifyRblxDataStoreDocumentFormat<DataSchema>(data);
                    if (rblxDocumentDataFormatResult.isErr()) return new Err("UNKNOWN");

                    const rblxDocumentDataFormat = rblxDocumentDataFormatResult.value;

                    // Transform the document data using the provided function.
                    const transformedData = transformFunc(rblxDocumentDataFormat.data);

                    // Validate the transformed data against the schema.
                    if (!this._schemaValidate(transformedData)) return new Err("SCHEMA_VALIDATION_ERROR");

                    // Return the updated document format.
                    return new Ok({
                        ...rblxDocumentDataFormat,
                        data: transformedData
                    });
                });

                // Handle update errors.
                if (updateAsyncResult.isErr()) {
                    if (updateAsyncResult.errorType === "DATASTORE_UPDATE_BUDGET_RAN_OUT") return new Err("ROBLOX_SERVICE_ERROR");
                    return new Err(updateAsyncResult.errorType);
                }

                // Return the updated data.
                return new Ok(updateAsyncResult.value[0].data);
            }

            // Perform the update operation.
            const tryUpdatingResult = tryUpdating();
            if (tryUpdatingResult.isErr()) {
                RblxLogger.debug.logInfo(`[update] Update failed for key ("${this._key}") with error: ${tryUpdatingResult.errorType}`);
                return tryUpdatingResult;
            }
            
            RblxLogger.debug.logInfo(`[update] Successfully updated the cache of CacheDocument with key ("${this._key}") to the datastore.`);
            return new Ok(tryUpdatingResult.value);
        }

        /**
         * Erases the concurrent document from the DataStore.
         * Only allowed if the document is closed.
         * @returns Ok<void> on success, Err<EraseRblxDocumentResultError> if not closed or on failure.
         */
        public erase(): Result<void, EraseRblxDocumentResultError> {
            // Only erase if document is closed.
            if (this._rblxDocumentStatus === "OPENED" || this._rblxDocumentStatus === "CLOSING") {
                RblxLogger.debug.logInfo(`[erase] Document must be closed before erasing for key ("${this._key}")`);
                return new Err("DOCUMENT_MUST_BE_CLOSED");
            }
            
            // Remove the document from the DataStore.
            const removeAsyncResult = this._rblxDataStoreUtility.removeAsync(this._key);
            if (removeAsyncResult.isErr()) {
                RblxLogger.debug.logInfo(`[erase] Erase failed for key ("${this._key}") with error: ${removeAsyncResult.errorType}`);
                return new Err("ROBLOX_SERVICE_ERROR");
            }

            RblxLogger.debug.logInfo(`[erase] The CacheDocument with key ("${this._key}") has been completely erased from the datastore.`);
            return new Ok(undefined);
        }
    //

    //* MISCS *\\
        public getCacheDocumentStatus() {
            return this._rblxDocumentStatus
        }
    //

    //* META OPERATIONS *\\
    /**
     * Returns a string representation of the concurrent document for debugging.
     * @returns The string representation.
     */
    public toString() {
        const str = `ConcurrentDocument(${this._key})`;
        return str;
    }
}