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


import { DataStoreService, HttpService, MemoryStoreService } from "@rbxts/services";
import { retry } from "../func/retry";
import { RblxLogger } from "./rblxlogger";
import { Err, Ok, Result } from "./result";
import { RblxStoreDataDocumentFormat } from "../types/global";
import { RblxDocumentSession } from "./rblxdocument-session";

//* ERROR TYPES*\\
    export type VerifyRblxDataStoreDataFormatError   = "INVALID_TABLE_DATA_ARGUMENT" | "INVALID_DATA" | "SCHEMA_VERSION_INVALID_OR_UNDEFINED" | "LAST_COMPATIABLE_SCHEMA_VERSION_INVALID_OR_UNDEFINED";

    export type GetAsyncResultError                  = "DATASTORE_READ_BUDGET_RAN_OUT"  | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type SetAsyncResultError                  = "DATASTORE_WRITE_BUDGET_RAN_OUT" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type UpdateAsyncResultError               = "DATASTORE_UPDATE_BUDGET_RAN_OUT" | "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type RemoveAsyncResultError               = "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    
    export type CheckForDataStorabilityResultError   = "THREAD_FIELD_NOT_STORABLE"                            | "USERDATA_FIELD_NOT_STORABLE"                            | "METATABLE_OR_CLASSES_FIELD_NOT_STORABLE"
                                                     | "MIXED_TABLE_FIELD_NOT_STORABLE"                       | "NON_STRING_OR_NON_NUMERIC_TABLE_FIELD_NOT_STORABLE"     | "INVALID_UTF8_STRING_FIELD_NOT_STORABLE"
                                                     | "NON-SEQUENTIAL_NUMERIC_TABLE_FIELD_NOT_STORABLE"      | "CYCLIC_TABLE_FIELD_NOT_STORABLE"                        | "NAN_FIELD_NOT_STORABLE"
                                                     | "FUNCTION_FIELD_NOT_STORABLE";

    export type GetLockSessionIdResultError          = "ROBLOX_SERVICE_ERROR";
    export type TryLockingResultError                = "ROBLOX_SERVICE_ERROR" | "SESSION_LOCKED";
    export type TryUnlockingResultError              = "ROBLOX_SERVICE_ERROR" | "LOCK_NOT_OWNED";

//

//* CONFIGS *\\
    const GET_ASYNC_RETRY_ATTEMPTS         : number   = 5;
    const INITAL_RETRY_DELAY_TIME          : number   = 2;
    const RETRY_EXPOENNTIAL_BACKOF_FACTOR  : number   = 1.5;
//

export class RblxDataStoreUtility {
    //* FIELDS *\\
        private _dataStore                                                : DataStore;
        private _MEMORY_STORE_RBLX_DOCUMENTS_LOCK_SESSIONS_COLLECTION_KEY : string = "rblxDocumentsLockSessions";
        private _MEMORY_STORE_RBLX_DOCUMENT_LOCK_SESSION_EXPIRATION_TIME  : number = 10 * 60; //* 10 minutes.
    //

    constructor(
        dataStore: DataStore
    ) {
        this._dataStore = dataStore;
    }

    /**
     * Checks if the provided data is storable in Roblox DataStore.
     * Performs deep validation for types, cyclic references, metatables, key types, and sequential numeric indices.
     * Returns an error result with a specific error type and field name for debugging purpose if the data is not storable.
     *
     * @param data - The data to check for storability.
     * @param visited - A set of already visited tables to detect cyclic references. (Meant for recursive functions only.)
     * @param fieldName - The name of the field being checked (used for error reporting).
     * @returns Ok<void> if storable, Err<[CheckForDataStorabilityResultError, string]> if not.
     */
    public checkForDataStorability(data: unknown, visited?: Set<unknown>, fieldName?: string): Result<void, [CheckForDataStorabilityResultError, string]> {
        // A helper function to create a new Err object based on an error type and a field name. 
        function getDataStorabilityError(errorType: CheckForDataStorabilityResultError, errorFieldName: string): Err<void, [CheckForDataStorabilityResultError, string]> {
            return new Err([errorType, errorFieldName]);
        }
    
        // By default, set fieldName to the root if fieldName is left undefined.
        if (!fieldName) fieldName = "data";

        // Initalize the visited set
        if (!visited) visited = new Set();

        // Checking agains the data for a type issue.
        if (data !== data)                return getDataStorabilityError("NAN_FIELD_NOT_STORABLE", fieldName);
        if (type(data) === "userdata")    return getDataStorabilityError("USERDATA_FIELD_NOT_STORABLE", fieldName);
        if (type(data) === "function")    return getDataStorabilityError("FUNCTION_FIELD_NOT_STORABLE", fieldName);
        if (type(data) === "thread")      return getDataStorabilityError("THREAD_FIELD_NOT_STORABLE", fieldName);

        // Checking against the string data for any invalid UTF8 character.
        if (typeIs(data, "string")) {
            if (utf8.len(data) === undefined) return getDataStorabilityError("INVALID_UTF8_STRING_FIELD_NOT_STORABLE", fieldName);
        }

        if (typeIs(data, "table")) {
            // Reject tables with metatables (classes, custom behaviors).
            if (getmetatable(data) !== undefined) return getDataStorabilityError("METATABLE_OR_CLASSES_FIELD_NOT_STORABLE", fieldName);

            let indexDataType              : keyof CheckableTypes | undefined = undefined;
            let previousNumericIndex       : number | undefined               = undefined;

            // Iterate over all key-value pairs in the table.
            for (const [index, value] of data as Map<unknown, unknown>) 
            {
                // Detect cyclic references in nested tables.
                if (typeOf(value) === "table") {
                    if (visited.has(value)) {
                        // Cyclic reference found, not storable.
                        return getDataStorabilityError("CYCLIC_TABLE_FIELD_NOT_STORABLE", fieldName);
                    }
                    // Mark this table as visited.
                    visited.add(value);    
                }

                // Set the expected index type on first iteration.
                if (!indexDataType) indexDataType = typeOf(index);

                // Only string or number keys are allowed.
                if (!(typeOf(index) === "string" || typeOf(index) === "number")) return getDataStorabilityError("NON_STRING_OR_NON_NUMERIC_TABLE_FIELD_NOT_STORABLE", fieldName); 

                // All keys must be of the same type.
                if (typeOf(index) !== indexDataType) return getDataStorabilityError("MIXED_TABLE_FIELD_NOT_STORABLE", fieldName);

                // For numeric keys, ensure they are sequential (like arrays).
                if (typeIs(index, "number")) {
                    // First numeric index must be 1.
                    if (previousNumericIndex === undefined && index !== 1) return getDataStorabilityError("NON-SEQUENTIAL_NUMERIC_TABLE_FIELD_NOT_STORABLE", fieldName);

                    if (previousNumericIndex !== undefined) {
                        // Numeric indices must increment by 1.
                        const numericIndexPositionDifference = (index - previousNumericIndex);
                        if (numericIndexPositionDifference !== 1) return getDataStorabilityError("NON-SEQUENTIAL_NUMERIC_TABLE_FIELD_NOT_STORABLE", fieldName);
                    }

                    previousNumericIndex = index;
                }

                // Recursively check value storability.
                const result = this.checkForDataStorability(value, visited, tostring(index));

                // Remove from visited after recursion.
                visited.delete(value);

                // If any nested value is not storable, return its error.
                if (result.isErr()) return result;
            }
        }

        // If all checks pass, data is storable.
        return new Ok(undefined);
    }

    /**
     * Verifies that the provided data matches the expected Roblox DataStore document format.
     * Checks for required fields and their types: schemaVersion (number), lastCompatibleSchemaVersion (number), and data (table).
     * Returns an error result with a specific error type if the format is invalid.
     *
     * @param data - The data to verify.
     * @returns Ok<RblxStoreDataDocumentFormat<DataSchema>> if valid, Err<VerifyRblxDataStoreDataFormatError> if not.
     */
    public verifyRblxDataStoreDocumentFormat<DataSchema extends object>(data: unknown): Result<RblxStoreDataDocumentFormat<DataSchema>, VerifyRblxDataStoreDataFormatError> {
        // Data must be a table.
        if (!data || !typeIs(data, "table")) return new Err("INVALID_TABLE_DATA_ARGUMENT");

        // Must have a numeric schemaVersion field.
        if (!("schemaVersion" in data) || !typeIs(data.schemaVersion, "number")) return new Err("SCHEMA_VERSION_INVALID_OR_UNDEFINED");

        // Must have a numeric lastCompatibleSchemaVersion field.
        if (!("minimalSupportedVersion" in data) || !typeIs(data.minimalSupportedVersion, "number")) return new Err("LAST_COMPATIABLE_SCHEMA_VERSION_INVALID_OR_UNDEFINED");

        // Must have a data field that is a table.
        if (!("data" in data) || !typeIs(data.data, "table")) return new Err("INVALID_DATA");

        // All checks passed, cast and return as Ok.
        return new Ok(data as RblxStoreDataDocumentFormat<DataSchema>);
    }

    /**
     * Gets the current read budget for DataStore GetAsync requests.
     * @returns The number of available read requests.
     */
    public getDataStoreReadBudget() {
        return DataStoreService.GetRequestBudgetForRequestType(Enum.DataStoreRequestType.GetAsync);
    }

    /**
     * Gets the current write budget for DataStore SetAsync/IncrementAsync requests.
     * @returns The number of available write requests.
     */
    public getDataStoreWriteBudget() {
        return DataStoreService.GetRequestBudgetForRequestType(Enum.DataStoreRequestType.SetIncrementAsync);
    }

    /**
     * Gets the current update budget for DataStore UpdateAsync requests.
     * @returns The number of available update requests.
     */
    public getDataStoreUpdateBudget() {
        return DataStoreService.GetRequestBudgetForRequestType(Enum.DataStoreRequestType.UpdateAsync);
    }

    /**
     * Reads a value from the DataStore for the given key, with retry and error handling.
     * @param key - The key to read from the DataStore.
     * @returns Ok<[value, keyInfo]> on success, Err<GetAsyncResultError> on failure.
     */
    public getAsync(key: string): Result<[unknown, DataStoreKeyInfo], GetAsyncResultError> {
        return retry<[unknown, DataStoreKeyInfo], GetAsyncResultError>(
            GET_ASYNC_RETRY_ATTEMPTS, 
            INITAL_RETRY_DELAY_TIME, 
            RETRY_EXPOENNTIAL_BACKOF_FACTOR,
            () => {
                RblxLogger.debug.logInfo("Fetching data from DataStoreService...");
                // Use pcall to safely call GetAsync and handle errors.
                const luauPcallResult = pcall(() => this._dataStore.GetAsync(key));
                if (!luauPcallResult[0]) {
                    return new Err("ROBLOX_SERVICE_ERROR");
                }
                // Return the value and key info on success.
                return new Ok([luauPcallResult[1], luauPcallResult[2]]);
            }
        );
    }

    // public setAsync(key: string, value: unknown): Result<unknown, SetAsyncResultError> { /* empty */ }

    /**
     * Atomically updates a value in the DataStore for the given key using a transform function.
     * Retries on failure and enforces atomicity by returning the same data if transformation fails.
     * @param key - The key to update in the DataStore.
     * @param transform - Function to transform the data. Must return a Result.
     * @returns Ok<[updatedValue, keyInfo]> on success, Err<UpdateAsyncResultError | TransformErr> on failure.
     */
    public updateAsync<TransformOk, TransformErr extends string>(
        key: string, 
        transform: (dataToTransform: unknown, cancel: (err: Err<TransformOk, TransformErr>) => Err<TransformOk, TransformErr>) => Result<TransformOk, TransformErr>
    ): Result<[TransformOk, DataStoreKeyInfo], UpdateAsyncResultError | TransformErr> {
        // Error flag for transformation errors.
        let transformationError: TransformErr | undefined = undefined;

        // Get the available update budget.
        const dataStoreUpdateBudget = this.getDataStoreUpdateBudget();

        // Cancel if out of update budget.
        if (dataStoreUpdateBudget <= 0) {
            return new Err("DATASTORE_UPDATE_BUDGET_RAN_OUT");
        }

        // Retry the update operation with atomicity enforcement.
        const result = retry<
            [TransformOk, DataStoreKeyInfo], 
            UpdateAsyncResultError | TransformErr,
            TransformOk,
            TransformErr
        >(3, 2, 1.25, (cancel) => {
            /**
             * + [INFO] +
             * * Invoke the update async function with transform function as a parameter.
             * * Attempt to update the data, the transform function may be called several times as needed by Roblox in case of any conflict.
             * * In case this happens, Roblox will just invoke the transform function with latest data to be transformed.
             * * For that reason, you must return the same data if any issue occur to enforce atomicity and ensure nothing is overwritten.
            */
            const luauResult = pcall(() => this._dataStore.UpdateAsync<unknown, TransformOk | undefined>(key, (data) => {
                // Reset the error flag for each transform attempt.
                transformationError = undefined;

                // Transform the data and handle errors.
                const transformationResult = transform(data, cancel); 
                // If transformation fails, return the original data to enforce atomicity.
                if (transformationResult.isErr()) {
                    transformationError = transformationResult.errorType;
                    return $tuple(data as TransformOk | undefined);
                }
                // Return the transformed value.
                return $tuple(transformationResult.value);
            }));

            // Handle Roblox service errors.
            if (!luauResult[0]) return new Err("ROBLOX_SERVICE_ERROR");

            const [updateAsyncResult, dataStoreKeyInfo] = [luauResult[1], luauResult[2]];

            // Return transformation error if occurred.
            if (transformationError) return new Err(transformationError);

            // Return success result.
            return new Ok([updateAsyncResult!, dataStoreKeyInfo]);
        });

        return result;
    }

    /**
     * Removes a value from the DataStore for the given key, with retry and error handling.
     * @param key - The key to remove from the DataStore.
     * @returns Ok<[removedValue, keyInfo]> on success, Err<RemoveAsyncResultError> on failure.
     */
    public removeAsync(key: string): Result<[unknown, DataStoreKeyInfo | undefined], RemoveAsyncResultError> { 
        const removeAsyncResult = retry<[unknown, DataStoreKeyInfo | undefined], RemoveAsyncResultError>(3, 2, 1.1, () => {
            // Use pcall to safely call RemoveAsync and handle errors.
            const result = pcall(() => this._dataStore.RemoveAsync(key));
            if (!result[0]) return new Err("ROBLOX_SERVICE_ERROR");

            // Return the removed value and key info on success.
            return new Ok([result[1], result[2]]);
        });

        return removeAsyncResult;
    }

    /**
     * Gets the current lock session ID for a document key from MemoryStore.
     * Used for distributed locking of DataStore documents.
     * @param key - The document key to check for a lock session.
     * @returns Ok<string | undefined> with session ID if locked, Err<GetLockSessionIdResultError> on failure.
     */
    public getlockSessionId(key: string): Result<string | undefined, GetLockSessionIdResultError> {
        const memoryStoreRblxDocumentLockSessionKey = `${key}-lockSession`;

        // Get the lock sessions hash map from MemoryStore.
        const getRblxDocumentsLockSessionsHashMapResult = retry<MemoryStoreHashMap, "ROBLOX_SERVICE_ERROR">(3, 2, 1.1, () => {
            const luauResult = pcall(() => MemoryStoreService.GetHashMap(this._MEMORY_STORE_RBLX_DOCUMENTS_LOCK_SESSIONS_COLLECTION_KEY));
            if (!luauResult) return new Err("ROBLOX_SERVICE_ERROR");

            return new Ok(luauResult[1] as MemoryStoreHashMap);
        });

        if (getRblxDocumentsLockSessionsHashMapResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");

        // Get the lock session ID for the specific document key.
        const getRblxDocumentLockSessionHashMapResult = retry<string | undefined, "ROBLOX_SERVICE_ERROR">(3, 2, 1.1, () => {
            const luauResult = pcall(() => getRblxDocumentsLockSessionsHashMapResult.value.GetAsync(memoryStoreRblxDocumentLockSessionKey));
            if (!luauResult) return new Err("ROBLOX_SERVICE_ERROR");

            return new Ok(luauResult[1] as string | undefined);
        });

        if (getRblxDocumentLockSessionHashMapResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");

        // Return the session ID (or undefined if not locked).
        return new Ok(getRblxDocumentLockSessionHashMapResult.value);
    }

    /**
     * Attempts to acquire a distributed lock for a document key in MemoryStore.
     * Generates a unique session ID and sets it in the lock sessions hash map.
     * @param key - The document key to lock.
     * @returns Ok<string> with session ID if lock acquired, Err<TryLockingResultError> if already locked or on failure.
     */
    public tryLocking(key: string): Result<string, TryLockingResultError> {
        // Check if the document is already locked.
        const getLockSessionIdResult = this.getlockSessionId(key);
        if (getLockSessionIdResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");
        if (getLockSessionIdResult.value) return new Err("SESSION_LOCKED");

        // Generate a new session ID for the lock.
        const memoryStoreRblxDocumentLockSessionKey = `${key}-lockSession`;
        const memoryStoreRblxDocumentLockSessionId  = `${memoryStoreRblxDocumentLockSessionKey}::${HttpService.GenerateGUID(false)}`;

        // Get the lock sessions hash map from MemoryStore.
        const getRblxDocumentsLockSessionsHashMapResult = retry<MemoryStoreHashMap, "ROBLOX_SERVICE_ERROR">(3, 2, 1.1, () => {
            const luauResult = pcall(() => MemoryStoreService.GetHashMap(this._MEMORY_STORE_RBLX_DOCUMENTS_LOCK_SESSIONS_COLLECTION_KEY));
            if (!luauResult) return new Err("ROBLOX_SERVICE_ERROR");

            return new Ok(luauResult[1] as MemoryStoreHashMap);
        });

        if (getRblxDocumentsLockSessionsHashMapResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");

        // Set the lock session ID in the hash map with expiration.
        const setRblxDocumentLockSessionHashMapResult = retry<void, "ROBLOX_SERVICE_ERROR">(3, 2, 1.1, () => {
            const luauResult = pcall(() => getRblxDocumentsLockSessionsHashMapResult.value.SetAsync(memoryStoreRblxDocumentLockSessionKey, memoryStoreRblxDocumentLockSessionId, this._MEMORY_STORE_RBLX_DOCUMENT_LOCK_SESSION_EXPIRATION_TIME));
            if (!luauResult) return new Err("ROBLOX_SERVICE_ERROR");

            return new Ok(undefined);
        });

        if (setRblxDocumentLockSessionHashMapResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");
        // Return the new session ID.
        return new Ok(memoryStoreRblxDocumentLockSessionId);
    }

    /**
     * Attempts to release a distributed lock for a document key in MemoryStore.
     * Only the owner of the lock (or if stealing is allowed) can unlock.
     * @param key - The document key to unlock.
     * @param lockSessionInfo - The session info of the lock owner.
     * @param steal - If true, forcibly unlock even if not the owner.
     * @returns Ok<void> on success, Err<TryUnlockingResultError> on failure or if not owned.
     */
    public tryUnlocking(key: string, lockSessionInfo?: RblxDocumentSession, steal?: boolean): Result<void, TryUnlockingResultError> {
        // If no session info and not stealing, cannot unlock.
        if (!lockSessionInfo && !steal) return new Err("LOCK_NOT_OWNED");

        // If not stealing, verify ownership of the lock.
        if (!steal) {
            const getLockSessionIdResult = this.getlockSessionId(key);
            if (getLockSessionIdResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");
            if (lockSessionInfo !== undefined && getLockSessionIdResult.value && lockSessionInfo.sessionId !== getLockSessionIdResult.value) return new Err("LOCK_NOT_OWNED");
        }

        // Get the lock sessions hash map from MemoryStore.
        const memoryStoreRblxDocumentLockSessionKey = `${key}-lockSession`;
        const getRblxDocumentsLockSessionsHashMapResult = retry<MemoryStoreHashMap, "ROBLOX_SERVICE_ERROR">(3, 2, 1.1, () => {
            const luauResult = pcall(() => MemoryStoreService.GetHashMap(this._MEMORY_STORE_RBLX_DOCUMENTS_LOCK_SESSIONS_COLLECTION_KEY));
            if (!luauResult) return new Err("ROBLOX_SERVICE_ERROR");

            return new Ok(luauResult[1] as MemoryStoreHashMap);
        });

        if (getRblxDocumentsLockSessionsHashMapResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");

        // Remove the lock session ID from the hash map.
        const setRblxDocumentLockSessionHashMapResult = retry<void, "ROBLOX_SERVICE_ERROR">(3, 2, 1.1, () => {
            const luauResult = pcall(() => getRblxDocumentsLockSessionsHashMapResult.value.RemoveAsync(memoryStoreRblxDocumentLockSessionKey));
            if (!luauResult) return new Err("ROBLOX_SERVICE_ERROR");

            return new Ok(undefined);
        });

        if (setRblxDocumentLockSessionHashMapResult.isErr()) return new Err("ROBLOX_SERVICE_ERROR");
        // Return success.
        return new Ok(undefined);
    }
}