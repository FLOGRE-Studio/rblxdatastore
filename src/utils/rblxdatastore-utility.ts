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


import { retry } from "../func/retry";
import { RblxLogger } from "./rblxlogger";
import { Err, Ok, Result } from "./result";

//* ERROR TYPES*\\
    export type GetAsyncResultError                  = "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type SetAsyncResultError                  = "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type UpdateAsyncResultError               = "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type RemoveAsyncResultError               = "ROBLOX_SERVICE_ERROR" | "UNKNOWN";
    export type CheckForDataStorabilityResultError   = "THREAD_FIELD_NOT_STORABLE"                            | "USERDATA_FIELD_NOT_STORABLE"                            | "METATABLE_OR_CLASSES_FIELD_NOT_STORABLE"
                                                     | "MIXED_TABLE_FIELD_NOT_STORABLE"                       | "NON_STRING_OR_NON_NUMERIC_TABLE_FIELD_NOT_STORABLE"     | "INVALID_UTF8_STRING_FIELD_NOT_STORABLE"
                                                     | "NON-SEQUENTIAL_NUMERIC_TABLE_FIELD_NOT_STORABLE"      | "CYCLIC_TABLE_FIELD_NOT_STORABLE"                        | "NAN_FIELD_NOT_STORABLE"
                                                     | "FUNCTION_FIELD_NOT_STORABLE";
//

//* CONFIGS *\\
    const GET_ASYNC_RETRY_ATTEMPTS         : number   = 5;
    const INITAL_RETRY_DELAY_TIME          : number   = 2;
    const RETRY_EXPOENNTIAL_BACKOF_FACTOR  : number   = 1.5;
//

export class RblxDataStoreUtility {
    //* FIELDS *\\
        private _dataStore     : DataStore;
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
    public checkForDataStorability(data: unknown, visited: Set<unknown>, fieldName?: string): Result<void, [CheckForDataStorabilityResultError, string]> {
        // A helper function to create a new Err object based on an error type and a field name. 
        function getDataStorabilityError(errorType: CheckForDataStorabilityResultError, errorFieldName: string): Err<void, [CheckForDataStorabilityResultError, string]> {
            return new Err([errorType, errorFieldName]);
        }
    
        // By default, check the entire data for storability if fieldName is left undefined.
        if (!fieldName) fieldName = "Data";

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

    public getAsync(key: string): Result<[unknown, DataStoreKeyInfo], GetAsyncResultError> {
        return retry<[unknown, DataStoreKeyInfo], GetAsyncResultError>(
            GET_ASYNC_RETRY_ATTEMPTS, 
            INITAL_RETRY_DELAY_TIME, 
            RETRY_EXPOENNTIAL_BACKOF_FACTOR,
            () => {
                RblxLogger.debug.logInfo("Fetching data from DataStoreService...");
                
                const luauPcallResult = pcall(() => this._dataStore.GetAsync(key));
                if (!luauPcallResult[0]) {
                    return new Err("ROBLOX_SERVICE_ERROR");
                }

                return new Ok([luauPcallResult[1], luauPcallResult[2]]);
            }
        );
    }

    // public setAsync(key: string, value: unknown): Result<unknown, SetAsyncResultError> { /* empty */ }

    // public updateAsync(key: string): Result<unknown, UpdateAsyncResultError> { /* empty */ }

    // public removeAsync(key: string): Result<unknown, RemoveAsyncResultError> { /* empty */ }
}