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

import { RblxDocument } from "./rblxdocument";
import { Migration } from "./types/global";
import { RblxLogger } from "./utils/rblxlogger";

/**
 * ## RblxDocumentStore
 * An object that contain a collection of documents.
*/
export class RblxDocumentStore<DataSchema> {
    //* FIELDS *\\
        private _dataStore: DataStore;
        private _schemaValidate: (data: Partial<DataSchema> & Record<string, unknown>) => boolean;
        private _defaultSchema: DataSchema;
        private _migrations: Migration<DataSchema>[];
        private _documents: Map<string, RblxDocument<DataSchema>>;
    //

    /**
     * 
     * @param dataStore The DataStore object obtained from ``DataStoreService.GetDataStore(...)``
     * @param schemaValidate The function responsible for validation of data.
     * @param defaultSchema The default data that will be created for the associated key in case it does not exist.
     * @param migrations The array of functions responsible for mutating data over time.
     */
    constructor(
        dataStore: DataStore,
        schemaValidate: (data: Partial<DataSchema> & Record<string, unknown>) => boolean,
        defaultSchema: DataSchema,
        migrations: Migration<DataSchema>[]
    ) {
        this._dataStore = dataStore;
        this._schemaValidate = schemaValidate;
        this._defaultSchema = defaultSchema;
        this._migrations = migrations;
        this._documents = new Map();

        // Invoke the main method.
        this._main();
    }

    private _main() {
        game.BindToClose(() => {
            RblxLogger.debug.logInfo("Attempting to close all documents...");
            for (const [, document] of this._documents) {
                document.close();
            }
        });
    }
}   