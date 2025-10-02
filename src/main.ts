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

import { CacheDocument } from "./cache-document";
import { ConcurrentDocument } from "./concurrent-document";
import { RblxDocumentStore } from "./rblxdocumentstore";
import { Result } from "./utils/result";
import { Ok, Err } from "./utils/result";

/**
 * ## RblxDataStore
 *
 A robust, strictly-typed Roblox DataStore library written in TypeScript through [Roblox-TS](https://roblox-ts.com) transpiler, designed to organize data with schema, enforce strict data validation.
*/
export {
    CacheDocument,
    ConcurrentDocument,
    RblxDocumentStore,
    Ok,
    Err,
    Result
}