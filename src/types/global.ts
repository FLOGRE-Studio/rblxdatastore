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

import { Result } from "../utils/result";

export interface Migration<DataSchema> {
    backwardsCompatible: boolean,
    migrate: (data: Partial<DataSchema>) => Result<DataSchema, unknown>
}

export interface Transformation<DataSchema extends object> {
    transform: (data: Partial<DataSchema>) => Result<DataSchema, unknown>
}

export interface RblxStoreDataDocumentFormat<DataSchema extends object> {
    schemaVersion: number;
    minimalSupportedVersion: number;
    data: DataSchema;
}