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
    readonly sessionsLocked: boolean;
    readonly bindToClose: boolean;
}

export class RblxDocumentStoreConfiguration {
    public readonly sessionsLocked: boolean;
    public readonly bindToClose: boolean;

    constructor(props: RblxDocumentStoreConfigurationProps) {
        this.sessionsLocked  = props.sessionsLocked;
        this.bindToClose     = props.bindToClose;
    }
}