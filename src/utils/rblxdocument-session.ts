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

interface RblxDocumentSessionProps {
    readonly isLocked    : boolean;
    readonly sessionId?  : string;
}

export class RblxDocumentSession {
    public readonly isLocked     : boolean;
    public readonly sessionId?   : string;

    constructor(props: RblxDocumentSessionProps) {
        this.isLocked   = props.isLocked;
        this.sessionId  = props.sessionId;
    }
}