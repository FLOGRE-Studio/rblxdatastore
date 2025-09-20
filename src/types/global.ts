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

export interface Migration<DataSchema> {
    backwardsCompatible: boolean,
    migrate: (data: Partial<DataSchema> & Record<string, unknown>) => Partial<DataSchema> & Record<string, unknown>,
}