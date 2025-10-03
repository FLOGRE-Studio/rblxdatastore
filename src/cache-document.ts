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
import { RblxDocumentStoreConfiguration } from "./utils/rblxdocumentstore-configuration";
import { RblxDataStoreUtility } from "./utils/rblxdatastore-utility";
import { RblxLogger } from "./utils/rblxlogger";
import { Err, Ok, Result } from "./utils/result";
import { RblxDocumentSession } from "./utils/rblxdocument-session";
import { retry } from "./func/retry";
import { deepFreezeObject } from "./func/deepFreezeObject";
import { deepCopyObject } from "./func/deepCopyObject";

//* ERROR TYPES
    export type OpenRblxDocumentResultError     = "DOCUMENT_ALREADY_OPEN" | "DOCUMENT_CLOSE_PENDING" | "DOCUMENT_VERSION_INCOMPATIBLE" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNSTORABLE_DATA_ERROR" | "TRANSFORMATION_ERROR" | "MIGRATIONS_ERROR" | "UNKNOWN";
    export type CloseRblxDocumentResultError    = "DOCUMENT_ALREADY_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type GetCacheRblxDocumentResultError = "DOCUMENT_NOT_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type SetCacheRblxDocumentResultError = "DOCUMENT_NOT_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type UpdateRblxDocumentResultError   = "DOCUMENT_NOT_OPEN" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type SaveRblxDocumentResultError     = "DOCUMENT_NOT_OPEN" | "SESSION_LOCKED" | "NON_SESSION_LOCKING_DOCUMENT_NOT_SUPPORTED" |"ROBLOX_SERVICE_ERROR" | "SCHEMA_VALIDATION_ERROR" | "UNKNOWN";
    export type StealRblxDocumentResultError    = "DOCUMENT_CLOSE_PENDING" | "NON_SESSION_LOCKING_DOCUMENT_NOT_SUPPORTED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type EraseRblxDocumentResultError    = "DOCUMENT_MUST_BE_CLOSED" | "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type IsOpenAvailableResultError      = "ROBLOX_SERVICE_ERROR";
//

export type RblxDocumentStatus                  = "OPENED" | "CLOSED" | "OPENING" | "CLOSING";

interface CacheDocumentProps<DataSchema extends object> {
    dataStore                        : DataStore;
    rblxDataStoreUtility             : RblxDataStoreUtility;
    key                              :  string;
    schemaValidate                   : (data: Partial<DataSchema> & object) => boolean;
    defaultSchema                    : DataSchema;
    transformation                   : Transformation<DataSchema>;
    migrations                       : Migration<DataSchema>[];
}

/**
 * ## CacheDocument
 * A data object that is organized by schema and contain information about entity.
*/
export class CacheDocument<DataSchema extends object> {
    //* FIELDS *\\
        private AUTO_SAVE_INTERVAL                : number = 300;

        private _dataStore                        : DataStore;
        private _rblxDataStoreUtility             : RblxDataStoreUtility;
        private _key                              : string;
        private _schemaValidate                   : (data: Partial<DataSchema>) => boolean;
        private _defaultSchema                    : DataSchema;
        private _transformation                   : Transformation<DataSchema>;
        private _migrations                       : Migration<DataSchema>[];
        private _rblxDocumentStatus               : RblxDocumentStatus;
        private _rblxDocumentCache                : DataSchema;
        private _rblxDocumentSession?             : RblxDocumentSession;
        private _autoSaveThread?                  : thread;
        private _lockStolen                       : boolean;

        private _onOpenEvent                      : BindableEvent<(result: Result<void, OpenRblxDocumentResultError>) => void>;
        private _onCloseEvent                     : BindableEvent<(result: Result<void, CloseRblxDocumentResultError>) => void>;
        private _onCacheUpdatedEvent              : BindableEvent<() => void>;

        public onOpen                             : RBXScriptSignal<(result: Result<void, OpenRblxDocumentResultError>) => void>;
        public onClose                            : RBXScriptSignal<(result: Result<void, CloseRblxDocumentResultError>) => void>;
        public onCacheUpdated                     : RBXScriptSignal<() => void>;
    //

    constructor(rblxDocumentProps: CacheDocumentProps<DataSchema>) {
        this._dataStore                          = rblxDocumentProps.dataStore;
        this._rblxDataStoreUtility               = rblxDocumentProps.rblxDataStoreUtility;
        this._key                                = rblxDocumentProps.key;
        this._schemaValidate                     = rblxDocumentProps.schemaValidate;
        this._transformation                     = rblxDocumentProps.transformation;
        this._defaultSchema                      = rblxDocumentProps.defaultSchema;
        this._migrations                         = rblxDocumentProps.migrations;
        this._rblxDocumentStatus                 = "CLOSED";
        this._rblxDocumentCache                  = this._defaultSchema;
        this._lockStolen                         = false;

        this._onOpenEvent                        = new Instance("BindableEvent");
        this._onCloseEvent                       = new Instance("BindableEvent");
        this._onCacheUpdatedEvent                = new Instance("BindableEvent");

        this.onOpen                              = this._onOpenEvent.Event;
        this.onClose                             = this._onCloseEvent.Event;
        this.onCacheUpdated                      = this._onCacheUpdatedEvent.Event;
    }

    //* OPEN & CLOSE METHODS *\\
        /**
        * Opens the cache document for reading and writing.
        * Handles session locking, schema validation, migrations, and transformation.
        * Ensures atomicity and ACID compensation on failure.
        * @returns Ok<RblxStoreDataDocumentFormat<DataSchema>> on success, Err<OpenRblxDocumentResultError> on failure.
        */
        public open(): Result<RblxStoreDataDocumentFormat<DataSchema>, OpenRblxDocumentResultError> {
            RblxLogger.debug.logInfo(`Attempting to open the cache document with key ("${this._key}")...`);

            // Take the key of the document. 
            const dataKey = this._key;

            const compensateACID = () => {
                const unlockRblxDocumentSessionResult = retry<void, unknown>(2, 2, 1.5, () => {
                    const tryUnlockingResult = this._rblxDataStoreUtility.tryUnlocking(dataKey, this._rblxDocumentSession);
                    if (tryUnlockingResult.isErr()) return new Err(tryUnlockingResult.errorType);

                    return new Ok(undefined);
                });

                if (unlockRblxDocumentSessionResult.isErr()) {
                    RblxLogger.logWarn("Failed to unlock the RblxDocument's session as a part of the ACID compensation process after encountering failure in opening the RblxDocument.");
                }
            }

            /**
                * Return an error if the document is already opened, indicating it was unnecessary to re-open it.
                * Ensure you cache any successfully opened documents in memory to use for any data operations.
            */
            if (this._rblxDocumentStatus === "OPENED")   return new Err("DOCUMENT_ALREADY_OPEN");

            /**
                * Return an error if the closure of the document is pending.
                * You must wait until the document is closed in order to open the document.
            */
            if (this._rblxDocumentStatus === "CLOSING")  return new Err("DOCUMENT_CLOSE_PENDING");

            // Set document status
            this._rblxDocumentStatus = "OPENING";

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
                    // The previous version that migration will migrate data FROM.
                    const fromVersion = (targetVersion - 1);
                    
                    // Run the migration ONLY when the version of the old data MATCH the previous version that migration is migrating FROM.
                    if (rblxDocumentSchemaVersion === fromVersion) {
                        const migrationResult = migration.migrate(rblxDocumentData);
                        if (migrationResult.isErr()) {
                            return cancel(new Err("MIGRATIONS_ERROR"));
                        }

                        rblxDocumentData          = migrationResult.value;
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
                    const migration = this._migrations[newestMigration - 1];
                    if (!migration.backwardsCompatible) {
                        minimalSupportedVersion = newestMigration;
                        break;
                    }
                }

                const immutableData = deepFreezeObject(rblxDocumentData);
                this._rblxDocumentCache = immutableData;

                const updatedRblxDataStoreDocument: RblxStoreDataDocumentFormat<DataSchema> = {
                    data: immutableData,
                    minimalSupportedVersion: minimalSupportedVersion,
                    schemaVersion: math.max(this._migrations.size(), rblxDocumentSchemaVersion)
                }

                return new Ok(updatedRblxDataStoreDocument);
            }
            
            if (!this._rblxDocumentSession || !this._rblxDocumentSession.sessionId) {
                const lockResult = retry<string, "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR">(5, 2, 1.1, () => {
                    const lockRblxDocumentSessionResult = this._rblxDataStoreUtility.tryLocking(dataKey);
                    if (lockRblxDocumentSessionResult.isErr()) return new Err(lockRblxDocumentSessionResult.errorType);

                    return new Ok(lockRblxDocumentSessionResult.value);
                });

                if (lockResult.isErr()) return new Err(lockResult.errorType);
                
                this._rblxDocumentSession = new RblxDocumentSession({
                    sessionId: lockResult.value
                });
            } 

            const updateAsyncResult = this._rblxDataStoreUtility.updateAsync<RblxStoreDataDocumentFormat<DataSchema>, OpenRblxDocumentResultError>(dataKey, transformFunc);
            if (updateAsyncResult.isErr()) {
                compensateACID();
                
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

            this._autoSaveThread = task.defer(() => {
                while (this._rblxDocumentStatus === "OPENED" && task.wait(this.AUTO_SAVE_INTERVAL)) {
                    if (this._rblxDocumentStatus !== "OPENED") return;
                    const saveResult = this.save();
                    if (saveResult.isErr()) {
                        RblxLogger.logWarn(`RblxDataStore Auto-Save feature for the CacheDocument (${this._key}) has failed. Error code: ${saveResult.errorType}`)
                    }
                }
            });

            RblxLogger.debug.logInfo(`Successfully opened the cache document with key ("${this._key}").`);

            const okResult = new Ok(updateAsyncResult.value[0]!);
            this._onOpenEvent.Fire(new Ok(undefined));
            return okResult;
        }

        /**
        * Closes the cache document and releases the session lock.
        * Handles lock ownership and error reporting.
        * @returns Ok<void> on success, Err<CloseRblxDocumentResultError> on failure.
        */
        public close(): Result<void, CloseRblxDocumentResultError> {
            RblxLogger.debug.logInfo(`Attempting to close the cache document with key ("${this._key}")...`);

            const tryClosing: () => Result<void, CloseRblxDocumentResultError> = () => {
                if (this._rblxDocumentStatus === "CLOSED") return new Err("DOCUMENT_ALREADY_CLOSED");
                this._rblxDocumentStatus = "CLOSING";

                const result = this._rblxDataStoreUtility.tryUnlocking(this._key, this._rblxDocumentSession);
                if (result.isErr()) {
                    if (result.errorType === "LOCK_NOT_OWNED") return new Err("SESSION_LOCKED");
                    RblxLogger.debug.logInfo(`Failed to close the cache document with key ("${this._key}") due to the session being locked by other server.`);
                    return new Err("ROBLOX_SERVICE_ERROR");
                }

                RblxLogger.debug.logInfo(`Successfully closed the cache document with key ("${this._key}").`);
                if (this._autoSaveThread) task.cancel(this._autoSaveThread);

                this._rblxDocumentSession = undefined;
                this._rblxDocumentStatus = "CLOSED";

                return new Ok(undefined);
            }

            const result = tryClosing();
            if (result.isErr()) {
                this._onCloseEvent.Fire(new Err(result.errorType));
                return result;
            }

            this._onCloseEvent.Fire(new Ok(undefined));
            return result;
        }
    //

    //* GETTER & SETTER METHODS *\\
        /**
         * Gets the current cached document data.
         * @returns Ok<DataSchema> with cached data.
         */
        public getCache(): Result<DataSchema, GetCacheRblxDocumentResultError> {
            if (this._rblxDocumentStatus !== "OPENED") return new Err("DOCUMENT_NOT_OPEN");
            return new Ok(this._rblxDocumentCache);
        }

        /**
         * Sets the cache to a new value, deep copying and freezing the object.
         * @param newRblxDocumentSchemaCache - The new cache value.
         * @returns Ok<DataSchema> with updated cache.
         */
        public setCache(newRblxDocumentSchemaCache: DataSchema): Result<DataSchema, SetCacheRblxDocumentResultError> {
            if (this._rblxDocumentStatus !== "OPENED") return new Err("DOCUMENT_NOT_OPEN");

            const copiedCache = deepCopyObject(newRblxDocumentSchemaCache);
            this._rblxDocumentCache = deepFreezeObject(copiedCache);

            this._onCacheUpdatedEvent.Fire();
            return new Ok(this._rblxDocumentCache);
        }
    //

    //* DATA OPERATIONS *\\
        /**
         * Updates the cached document data using a transformation function and writes to the DataStore.
         * Handles session lock, schema validation, and error reporting.
         * @param transformFunc - Function to transform the cached data.
         * @returns Ok<DataSchema> with updated data, Err<UpdateRblxDocumentResultError> on failure.
         */
        public update(transformFunc: (data: DataSchema) => DataSchema): Result<DataSchema, UpdateRblxDocumentResultError> {
            if (this._rblxDocumentStatus !== "OPENED") return new Err("DOCUMENT_NOT_OPEN");
            RblxLogger.debug.logInfo(`Attempting to update the cache of CacheDocument with key ("${this._key}") with latest transformed data to the datastore...`);

            // Helper to perform update and handle schema validation.
            const tryUpdating = (transformedData: DataSchema): Result<DataSchema, UpdateRblxDocumentResultError> => {
                if (!this._schemaValidate(transformedData)) return new Err("SCHEMA_VALIDATION_ERROR");

                // Update the document in the DataStore.
                const updateAsyncResult = this._rblxDataStoreUtility.updateAsync<RblxStoreDataDocumentFormat<DataSchema>, UpdateRblxDocumentResultError>(this._key, (data) => {
                    const rblxDocumentDataFormatResult = this._rblxDataStoreUtility.verifyRblxDataStoreDocumentFormat(data);
                    if (rblxDocumentDataFormatResult.isErr()) return new Err("UNKNOWN");

                    const rblxDocumentDataFormat = rblxDocumentDataFormatResult.value;

                    // Merge transformed data into the document format.
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

            // Check session lock before updating.
            const getSessionIdResult = this._rblxDataStoreUtility.getlockSessionId(this._key);
            if (getSessionIdResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");
            if (getSessionIdResult.value && (!this._rblxDocumentSession || this._rblxDocumentSession.sessionId !== getSessionIdResult.value)) {
                return new Err("SESSION_LOCKED");
            }

            // Transform the cached data.
            const transformedData = transformFunc(this._rblxDocumentCache);
            this._rblxDocumentCache = deepFreezeObject(deepCopyObject(transformedData));

            // Perform the update operation.
            const updateResult = tryUpdating(transformedData);
            if (updateResult.isErr()) return new Err(updateResult.errorType);

            RblxLogger.debug.logInfo(`Successfully updated the cache of CacheDocument with key ("${this._key}") to the datastore.`);
            return new Ok(updateResult.value)
        }

        /**
         * Saves the current cached document data to the DataStore.
         * Uses update to perform the save and handles error reporting.
         * @returns Ok<DataSchema> on success, Err<SaveRblxDocumentResultError> on failure.
         */
        public save(): Result<DataSchema, SaveRblxDocumentResultError> {
            if (this._rblxDocumentStatus !== "OPENED") return new Err("DOCUMENT_NOT_OPEN");
            RblxLogger.debug.logInfo(`Attempting to save the current cache of CacheDocument with key ("${this._key}") to the datastore...`);

            // Save by updating with the current cache.
            const rblxDocumentUpdateResult = this.update((cache) => cache);
            if (rblxDocumentUpdateResult.isErr()) {
                if (rblxDocumentUpdateResult.errorType === "ROBLOX_SERVICE_ERROR") return new Err(rblxDocumentUpdateResult.errorType);
                if (rblxDocumentUpdateResult.errorType === "SCHEMA_VALIDATION_ERROR") return new Err(rblxDocumentUpdateResult.errorType);
                if (rblxDocumentUpdateResult.errorType === "SESSION_LOCKED") return new Err(rblxDocumentUpdateResult.errorType);
                return new Err("UNKNOWN");
            }
            
            RblxLogger.debug.logInfo(`Successfully saved the current cache of CacheDocument with key ("${this._key}") to the datastore...`);
            return new Ok(rblxDocumentUpdateResult.value);
        }

        /**
         * Marks the cache document as stolen, typically for lock recovery.
         * @returns Ok<void> on success, Err<StealRblxDocumentResultError> if close is pending.
         */
        public steal(): Result<void, StealRblxDocumentResultError> {
            if (this._rblxDocumentStatus === "CLOSING") return new Err("DOCUMENT_CLOSE_PENDING");
            this._lockStolen = true;

            RblxLogger.debug.logInfo(`The CacheDocument with key ("${this._key}") has been marked stolen.`);
            return new Ok(undefined);
        }

        /**
         * Erases the cache document from the DataStore.
         * Only allowed if the document is closed.
         * @returns Ok<void> on success, Err<EraseRblxDocumentResultError> if not closed or on failure.
         */
        public erase(): Result<void, EraseRblxDocumentResultError> {
            if (this._rblxDocumentStatus === "OPENED" || this._rblxDocumentStatus === "OPENING") return new Err("DOCUMENT_MUST_BE_CLOSED");
            
            const removeAsyncResult = this._rblxDataStoreUtility.removeAsync(this._key);
            if (removeAsyncResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");

            RblxLogger.debug.logInfo(`The CacheDocument with key ("${this._key}") has been completely erased from the datastore.`);
            return new Ok(undefined);
        }
    //

    //* MISCS *\\
        public getCacheDocumentStatus() {
            return this._rblxDocumentStatus
        }

        public isOpenAvailable(): Result<boolean, IsOpenAvailableResultError> {
            if (this._rblxDocumentStatus === "OPENED") return new Ok(false);

            const getSessionIdResult = this._rblxDataStoreUtility.getlockSessionId(this._key);
            if (getSessionIdResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");

            const sessionId = getSessionIdResult.value;
            if (sessionId !== undefined) {
                if (!this._rblxDocumentSession || this._rblxDocumentSession.sessionId !== sessionId) return new Ok(false);
            }

            return new Ok(true);
        }
    //

    //* META OPERATIONS *\\
        /**
        * Returns a string representation of the cache document for debugging.
        * @returns The string representation.
        */
        public toString() {
            return `ConcurrentDocument(${this._key})`;
        }
    //
}