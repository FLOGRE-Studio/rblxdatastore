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
import { Migration, Transformation } from "./types/global";
import { RblxDataStoreUtility } from "./utils/rblxdatastore-utility";
import { RblxDocumentStoreConfiguration } from "./utils/rblxdocumentstore-configuration";
import { RblxLogger } from "./utils/rblxlogger";


interface RblxDocumentProps<DataSchema extends object> {
    dataStore                             : DataStore;
    schemaValidate                        : (data: Partial<DataSchema> & object) => boolean;
    defaultSchema                         : DataSchema;
    transformation                        : Transformation<DataSchema>;
    migrations                            : Migration<DataSchema>[];
    rblxDocumentStoreConfiguration        : RblxDocumentStoreConfiguration;
}

/**
 * ## RblxDocumentStore
 * An object that contain a collection of documents.
*/
export class RblxDocumentStore<DataSchema extends object> {
    //* FIELDS *\\
        private _dataStore                             : DataStore;
        private _schemaValidate                        : (data: Partial<DataSchema> & object) => boolean;
        private _defaultSchema                         : DataSchema;
        private _transformation                        : Transformation<DataSchema>;
        private _migrations                            : Migration<DataSchema>[];
        private _cacheDocuments                        : Map<string, CacheDocument<DataSchema>>;
        private _concurrentDocuments                   : Map<string, ConcurrentDocument<DataSchema>>;
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
        this._transformation                      = props.transformation;
        this._migrations                          = props.migrations;
        this._rblxDocumentStoreConfiguration      = props.rblxDocumentStoreConfiguration;
        this._cacheDocuments                      = new Map();
        this._concurrentDocuments                 = new Map();

        // Invoke the main method.
        this._main();
    }

    private _main(): void {
        if (!this._rblxDocumentStoreConfiguration.bindToClose) return;
        if (this._rblxDocumentStoreConfiguration.debug) RblxLogger.isDebugEnabled = true;

        game.BindToClose(() => {
            RblxLogger.debug.logInfo("Attempting to close all cache documents...");
            for (const [, cacheDocument] of this._cacheDocuments) {
                if (cacheDocument.getCacheDocumentStatus() !== "CLOSING" && cacheDocument.getCacheDocumentStatus() !== "CLOSED") cacheDocument.close();
            }

            RblxLogger.debug.logInfo("Attempting to close all concurrent documents...");
            for (const [, concurrentDocument] of this._concurrentDocuments) {
                if (concurrentDocument.getCacheDocumentStatus() !== "CLOSING" && concurrentDocument.getCacheDocumentStatus() !== "CLOSED") concurrentDocument.close();
            }
        });
    }

    public getCacheDocument(key: string): CacheDocument<DataSchema> {
        if (this._cacheDocuments.has(key)) return this._cacheDocuments.get(key)!;

        const cacheDocument = new CacheDocument({
            dataStore: this._dataStore,
            rblxDataStoreUtility: new RblxDataStoreUtility(this._dataStore),
            key: key,
            schemaValidate: this._schemaValidate,
            defaultSchema: this._defaultSchema,
            transformation: this._transformation,
            migrations: this._migrations,
        });

        this._cacheDocuments.set(key, cacheDocument);
        return cacheDocument;
    }

    public getConcurrentDocument(key: string): ConcurrentDocument<DataSchema> {
        if (this._concurrentDocuments.has(key)) return this._concurrentDocuments.get(key)!;


        const concurrentDocument = new ConcurrentDocument({
            dataStore: this._dataStore,
            rblxDataStoreUtility: new RblxDataStoreUtility(this._dataStore),
            key: key,
            schemaValidate: this._schemaValidate,
            defaultSchema: this._defaultSchema,
            transformation: this._transformation,
            migrations: this._migrations,
        });

        this._concurrentDocuments.set(key, concurrentDocument);
        return concurrentDocument;
    }
}   