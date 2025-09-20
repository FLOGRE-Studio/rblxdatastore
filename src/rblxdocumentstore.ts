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

import { RblxDocument } from "./rblxdocument";
import { Migration } from "./types/global";
import { RblxDataStoreUtility } from "./utils/rblxdatastore-utility";
import { RblxDocumentStoreConfiguration } from "./utils/rblxdocumentstore-configuration";
import { RblxLogger } from "./utils/rblxlogger";

interface RblxDocumentProps<DataSchema> {
    dataStore                             : DataStore;
    schemaValidate                        : (data: Partial<DataSchema> & Record<string, unknown>) => boolean;
    defaultSchema                         : DataSchema;
    migrations                            : Migration<DataSchema>[];
    rblxDocumentStoreConfiguration        : RblxDocumentStoreConfiguration;
}

/**
 * ## RblxDocumentStore
 * An object that contain a collection of documents.
*/
export class RblxDocumentStore<DataSchema> {
    //* FIELDS *\\
        private _dataStore                             : DataStore;
        private _schemaValidate                        : (data: Partial<DataSchema> & Record<string, unknown>) => boolean;
        private _defaultSchema                         : DataSchema;
        private _migrations                            : Migration<DataSchema>[];
        private _documents                             : Map<string, RblxDocument<DataSchema>>;
        private _rblxDocumentStoreConfiguration        : RblxDocumentStoreConfiguration;
    //

    /**
     * 
     * @param dataStore The DataStore object obtained from ``DataStoreService.GetDataStore(...)``
     * @param schemaValidate The function responsible for validation of data.
     * @param defaultSchema The default data that will be created for the associated key in case it does not exist.
     * @param migrations The array of functions responsible for mutating data over time.
     */
    constructor(props: RblxDocumentProps<DataSchema>) {
        this._dataStore                           = props.dataStore;
        this._schemaValidate                      = props.schemaValidate;
        this._defaultSchema                       = props.defaultSchema;
        this._migrations                          = props.migrations;
        this._rblxDocumentStoreConfiguration      = props.rblxDocumentStoreConfiguration;
        this._documents                           = new Map();

        // Invoke the main method.
        this._main();
    }

    private _main(): void {
        if (!this._rblxDocumentStoreConfiguration.bindToClose) return;

        game.BindToClose(() => {
            RblxLogger.debug.logInfo("Attempting to close all documents...");
            for (const [, document] of this._documents) {
                document.close();
            }
        });
    }

    public getRblxDocument(key: string): RblxDocument<DataSchema> {
        return new RblxDocument({
            dataStore: this._dataStore,
            rblxDataStoreUtility: new RblxDataStoreUtility(this._dataStore),
            key: key,
            schemaValidate: this._schemaValidate,
            defaultSchema: this._defaultSchema,
            migrations: this._migrations,
            rblxDocumentStoreConfiguration: this._rblxDocumentStoreConfiguration
        });
    }
}   