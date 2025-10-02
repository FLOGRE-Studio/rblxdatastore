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

export type Result<T, E> = Ok<T, E> | Err<T, E>;

export class Ok<T, E> {
    readonly type = "ok";
    constructor(public readonly value: T) {}

    isOk(): this is Ok<T, E> {
        return true;
    }

    isErr(): this is Err<T, E> {
        return false;
    }
}

export class Err<T, E> {
    readonly type = "err";
    constructor(public readonly errorType: E) {}

    isOk(): this is Ok<T, E> {
        return false;
    }

    isErr(): this is Err<T, E> {
        return true;
    }
}