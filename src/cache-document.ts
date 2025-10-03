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
        private _AUTO_SAVE_INTERVAL               : number = 120;
        private _RENEW_SESSION_INTERVAL           : number = 60;

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
        private _renewThread?                     : thread;
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
            RblxLogger.debug.logInfo(`[open] Attempting to open the cache document with key ("${this._key}")...`);

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
                    RblxLogger.debug.logInfo(`[open:transformFunc] The data with the key ("${this._key}) has failed schema validation."`);
                    return cancel(new Err("SCHEMA_VALIDATION_ERROR"));
                }

                if (!this._rblxDataStoreUtility.checkForDataStorability(rblxDocumentData)) {
                    RblxLogger.debug.logInfo(`[open:transformFunc] The data with the key ("${this._key}) cannot be stored."`);
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

                const immutableData = deepFreezeObject(rblxDocumentData);
                this._rblxDocumentCache = immutableData;

                const updatedRblxDataStoreDocument: RblxStoreDataDocumentFormat<DataSchema> = {
                    data: immutableData,
                    minimalSupportedVersion: minimalSupportedVersion,
                    schemaVersion: math.max(this._migrations.size(), rblxDocumentSchemaVersion)
                }

                return new Ok(updatedRblxDataStoreDocument);
            }
            
            if (!this._rblxDocumentSession) {
                RblxLogger.debug.logInfo(`[open] No session information found for key ("${this._key}")`);
                const lockResult = retry<string, "SESSION_LOCKED" | "ROBLOX_SERVICE_ERROR">(5, 2, 1.1, () => {
                    RblxLogger.debug.logInfo(`[open] Attempting to lock document session for key ("${this._key}")`);
                    const lockRblxDocumentSessionResult = this._rblxDataStoreUtility.tryLocking(dataKey, this._lockStolen);
                    if (lockRblxDocumentSessionResult.isErr()) {
                        RblxLogger.debug.logInfo(`[open] Locking failed for key ("${this._key}") with error: ${lockRblxDocumentSessionResult.errorType}`);
                        return new Err(lockRblxDocumentSessionResult.errorType);
                    }
                    RblxLogger.debug.logInfo(`[open] Locking succeeded for key ("${this._key}")`);
                    return new Ok(lockRblxDocumentSessionResult.value);
                });

                if (lockResult.isErr()) {
                    RblxLogger.debug.logInfo(`[open] lockResult failed for key ("${this._key}") with error: ${lockResult.errorType}`);
                    return new Err(lockResult.errorType);
                }

                this._lockStolen = false;
                
                this._rblxDocumentSession = new RblxDocumentSession({
                    sessionId: lockResult.value
                });

                RblxLogger.debug.logInfo(`[open] Session created for key ("${this._key}") with sessionId: ${lockResult.value}`);
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
            RblxLogger.debug.logInfo(`[open] Document status set to OPENED for key ("${this._key}")`);

            this._autoSaveThread = task.defer(() => {
                RblxLogger.debug.logInfo(`[open:autoSaveThread] Auto-save thread started for key ("${this._key}")`);
                while (this._rblxDocumentStatus === "OPENED" && task.wait(this._AUTO_SAVE_INTERVAL)) {
                    RblxLogger.debug.logInfo(`[open:autoSaveThread] Auto-save tick for key ("${this._key}")`);
                    if (this._rblxDocumentStatus !== "OPENED") {
                        RblxLogger.debug.logInfo(`[open:autoSaveThread] Document status not OPENED, exiting auto-save for key ("${this._key}")`);
                        return;
                    }
                    const saveResult = this.save();
                    if (saveResult.isErr()) {
                        RblxLogger.logWarn(`RblxDataStore Auto-Save feature for the CacheDocument (${this._key}) has failed. Error code: ${saveResult.errorType}`)
                    } else {
                        RblxLogger.debug.logInfo(`[open:autoSaveThread] Auto-save succeeded for key ("${this._key}")`);
                    }
                }
                RblxLogger.debug.logInfo(`[open:autoSaveThread] Auto-save thread ended for key ("${this._key}")`);
            });

            this._renewThread = task.defer(() => {
                RblxLogger.debug.logInfo(`[open:renewThread] Renew session thread started for key ("${this._key}")`);
                while (this._rblxDocumentStatus === "OPENED" && task.wait(this._RENEW_SESSION_INTERVAL)) {
                    RblxLogger.debug.logInfo(`[open:renewThread] Renewed the session for key ("${this._key}")`);
                    if (this._rblxDocumentStatus !== "OPENED") {
                        RblxLogger.debug.logInfo(`[open:renewThread] Document status not OPENED, exiting auto-save for key ("${this._key}")`);
                        return;
                    }

                    const renewSessionLockResult = this._rblxDataStoreUtility.renewSessionLock(this._key, this._rblxDocumentSession);
                    if (renewSessionLockResult.isErr()) {
                        RblxLogger.logWarn(`RblxDataStore renewal session lock feature for the CacheDocument (${this._key}) has failed. Error code: ${renewSessionLockResult.errorType}`)
                    } else {
                        RblxLogger.debug.logInfo(`[open:renewThread] Successfully renewed the session lock for key ("${this._key}")`);
                    }
                }
                RblxLogger.debug.logInfo(`[open:renewThread] renew thread ended for key ("${this._key}")`);
            })

            RblxLogger.debug.logInfo(`[open] Successfully opened the cache document with key ("${this._key}").`);

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
            RblxLogger.debug.logInfo(`[close] Attempting to close the cache document with key ("${this._key}")...`);

            const tryClosing: () => Result<void, CloseRblxDocumentResultError> = () => {
                if (this._rblxDocumentStatus === "CLOSED") {
                    RblxLogger.debug.logInfo(`[close] Document already closed for key ("${this._key}")`);
                    return new Err("DOCUMENT_ALREADY_CLOSED");
                }

                this._rblxDocumentStatus = "CLOSING";
                RblxLogger.debug.logInfo(`[close] Document status set to CLOSING for key ("${this._key}")`);

                const saveResult = this.save();
                if (saveResult.isErr()) {
                    RblxLogger.debug.logInfo(`Failed to save the cache document with key ("${this._key}") before closing.`);
                    return new Err("ROBLOX_SERVICE_ERROR");
                }
                
                const result = this._rblxDataStoreUtility.tryUnlocking(this._key, this._rblxDocumentSession);
                if (result.isErr()) {
                    if (result.errorType === "LOCK_NOT_OWNED") return new Err("SESSION_LOCKED");
                    RblxLogger.debug.logInfo(`Failed to close the cache document with key ("${this._key}") due to the session being locked by other server.`);
                    return new Err("ROBLOX_SERVICE_ERROR");
                }

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

            RblxLogger.debug.logInfo(`[close] Successfully closed the cache document with key ("${this._key}").`);
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
            RblxLogger.debug.logInfo(`[getCache] Getting cache for key ("${this._key}")`);
            if (this._rblxDocumentStatus !== "OPENED") {
                RblxLogger.debug.logInfo(`[getCache] Document not open for key ("${this._key}")`);
                RblxLogger.debug.logInfo(`[getCache] Returning error DOCUMENT_NOT_OPEN for key ("${this._key}")`);
                return new Err("DOCUMENT_NOT_OPEN");
            }
            RblxLogger.debug.logInfo(`[getCache] Successfully returned cache for key ("${this._key}")`);
            RblxLogger.debug.logInfo(`[getCache] Returning Ok for key ("${this._key}")`);
            return new Ok(this._rblxDocumentCache);
        }

        /**
         * Sets the cache to a new value, deep copying and freezing the object.
         * @param newRblxDocumentSchemaCache - The new cache value.
         * @returns Ok<DataSchema> with updated cache.
         */
        public setCache(newRblxDocumentSchemaCache: DataSchema): Result<DataSchema, SetCacheRblxDocumentResultError> {
            RblxLogger.debug.logInfo(`[setCache] Setting cache for key ("${this._key}")`);
            if (this._rblxDocumentStatus !== "OPENED") {
                RblxLogger.debug.logInfo(`[setCache] Document not open for key ("${this._key}")`);
                RblxLogger.debug.logInfo(`[setCache] Returning error DOCUMENT_NOT_OPEN for key ("${this._key}")`);
                return new Err("DOCUMENT_NOT_OPEN");
            }

            const copiedCache = deepCopyObject(newRblxDocumentSchemaCache);
            this._rblxDocumentCache = deepFreezeObject(copiedCache);
            RblxLogger.debug.logInfo(`[setCache] Cache set and frozen for key ("${this._key}")`);

            this._onCacheUpdatedEvent.Fire();
            RblxLogger.debug.logInfo(`[setCache] Cache updated event fired for key ("${this._key}")`);
            RblxLogger.debug.logInfo(`[setCache] Returning Ok for key ("${this._key}")`);
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
            RblxLogger.debug.logInfo(`[update] Attempting to update the cache of CacheDocument with key ("${this._key}") with latest transformed data to the datastore...`);
            if (this._rblxDocumentStatus === "CLOSED") {
                RblxLogger.debug.logInfo(`[update] Document not open for key ("${this._key}")`);
                return new Err("DOCUMENT_NOT_OPEN");
            }

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
                RblxLogger.debug.logInfo(`[update] Session locked for key ("${this._key}")`);
                RblxLogger.debug.logInfo(`[update] Returning error SESSION_LOCKED for key ("${this._key}")`);
                return new Err("SESSION_LOCKED");
            }

            // Transform the cached data.
            const transformedData = transformFunc(this._rblxDocumentCache);
            this._rblxDocumentCache = deepFreezeObject(deepCopyObject(transformedData));
            RblxLogger.debug.logInfo(`[update] Cache transformed and frozen for key ("${this._key}")`);

            // Perform the update operation.
            const updateResult = tryUpdating(transformedData);
            if (updateResult.isErr()) {
                RblxLogger.debug.logInfo(`[update] Update failed for key ("${this._key}") with error: ${updateResult.errorType}`);
                RblxLogger.debug.logInfo(`[update] Returning error ${updateResult.errorType} for key ("${this._key}")`);
                return new Err(updateResult.errorType);
            }

            RblxLogger.debug.logInfo(`[update] Successfully updated the cache of CacheDocument with key ("${this._key}") to the datastore.`);
            RblxLogger.debug.logInfo(`[update] Returning Ok for key ("${this._key}")`);
            return new Ok(updateResult.value)
        }

        /**
         * Saves the current cached document data to the DataStore.
         * Uses update to perform the save and handles error reporting.
         * @returns Ok<DataSchema> on success, Err<SaveRblxDocumentResultError> on failure.
         */
        public save(): Result<DataSchema, SaveRblxDocumentResultError> {
            RblxLogger.debug.logInfo(`[save] Attempting to save the current cache of CacheDocument with key ("${this._key}") to the datastore...`);
            if (this._rblxDocumentStatus === "OPENING" || this._rblxDocumentStatus === "CLOSED") {
                RblxLogger.debug.logInfo(`[save] Document not open for key ("${this._key}")`);
                return new Err("DOCUMENT_NOT_OPEN");
            }

            // Save by updating with the current cache.
            const rblxDocumentUpdateResult = this.update((cache) => cache);
            if (rblxDocumentUpdateResult.isErr()) {
                RblxLogger.debug.logInfo(`[save] Save failed for key ("${this._key}") with error: ${rblxDocumentUpdateResult.errorType}`);
                RblxLogger.debug.logInfo(`[save] Returning error ${rblxDocumentUpdateResult.errorType} for key ("${this._key}")`);
                if (rblxDocumentUpdateResult.errorType === "ROBLOX_SERVICE_ERROR") return new Err(rblxDocumentUpdateResult.errorType);
                if (rblxDocumentUpdateResult.errorType === "SCHEMA_VALIDATION_ERROR") return new Err(rblxDocumentUpdateResult.errorType);
                if (rblxDocumentUpdateResult.errorType === "SESSION_LOCKED") return new Err(rblxDocumentUpdateResult.errorType);
                return new Err("UNKNOWN");
            }
            
            RblxLogger.debug.logInfo(`[save] Successfully saved the current cache of CacheDocument with key ("${this._key}") to the datastore...`);
            RblxLogger.debug.logInfo(`[save] Returning Ok for key ("${this._key}")`);
            return new Ok(rblxDocumentUpdateResult.value);
        }

        /**
         * Marks the cache document as stolen, typically for lock recovery.
         * @returns Ok<void> on success, Err<StealRblxDocumentResultError> if close is pending.
         */
        public steal(): Result<void, StealRblxDocumentResultError> {
            RblxLogger.debug.logInfo(`[steal] Attempting to mark cache document as stolen for key ("${this._key}")`);
            if (this._rblxDocumentStatus === "CLOSING") {
                RblxLogger.debug.logInfo(`[steal] Document close pending for key ("${this._key}")`);
                return new Err("DOCUMENT_CLOSE_PENDING");
            }
            this._lockStolen = true;

            RblxLogger.debug.logInfo(`[steal] The CacheDocument with key ("${this._key}") has been marked stolen.`);
            return new Ok(undefined);
        }

        /**
         * Erases the cache document from the DataStore.
         * Only allowed if the document is closed.
         * @returns Ok<void> on success, Err<EraseRblxDocumentResultError> if not closed or on failure.
         */
        public erase(): Result<void, EraseRblxDocumentResultError> {
            RblxLogger.debug.logInfo(`[erase] Attempting to erase cache document for key ("${this._key}")`);
            if (this._rblxDocumentStatus === "OPENED" || this._rblxDocumentStatus === "CLOSING") {
                RblxLogger.debug.logInfo(`[erase] Document must be closed before erasing for key ("${this._key}")`);
                return new Err("DOCUMENT_MUST_BE_CLOSED");
            }
            
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
            RblxLogger.debug.logInfo(`[getCacheDocumentStatus] Getting document status for key ("${this._key}")`);
            return this._rblxDocumentStatus
        }

        public isOpenAvailable(): Result<boolean, IsOpenAvailableResultError> {
            RblxLogger.debug.logInfo(`[isOpenAvailable] Checking if open is available for key ("${this._key}")`);
            if (this._rblxDocumentStatus === "OPENED") {
                RblxLogger.debug.logInfo(`[isOpenAvailable] Document already opened for key ("${this._key}")`);
                return new Ok(false);
            }

            const getSessionIdResult = this._rblxDataStoreUtility.getlockSessionId(this._key);
            if (getSessionIdResult.isErr()) {
                RblxLogger.debug.logInfo(`[isOpenAvailable] Failed to get session id for key ("${this._key}")`);
                return new Err("ROBLOX_SERVICE_ERROR");
            }

            const sessionId = getSessionIdResult.value;
            RblxLogger.debug.logInfo(`[isOpenAvailable] sessionId: ${sessionId} for key ("${this._key}")`);
            if (sessionId !== undefined) {
                if (!this._rblxDocumentSession || this._rblxDocumentSession.sessionId !== sessionId) {
                    RblxLogger.debug.logInfo(`[isOpenAvailable] Session id mismatch for key ("${this._key}")`);
                    return new Ok(false);
                }
            }

            RblxLogger.debug.logInfo(`[isOpenAvailable] Open is available for key ("${this._key}")`);
            return new Ok(true);
        }
    //

    //* META OPERATIONS *\\
        /**
        * Returns a string representation of the cache document for debugging.
        * @returns The string representation.
        */
        public toString() {
            const str = `ConcurrentDocument(${this._key})`;
            return str;
        }
    //
}