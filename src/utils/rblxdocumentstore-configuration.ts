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

interface RblxDocumentStoreConfigurationProps {
    readonly bindToClose: boolean;
    readonly debug: boolean;
}

export class RblxDocumentStoreConfiguration {
    public readonly bindToClose: boolean;
    public readonly debug?: boolean;

    constructor(props: RblxDocumentStoreConfigurationProps) {
        this.bindToClose     = props.bindToClose;
        this.debug           = props.debug;
    }
}