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

import { Err, Result } from "../utils/result";

/**
 * Retries a function call up to a maximum number of attempts, with a delay between each attempt.
 * If the function returns a successful Result, the retry loop stops and returns the value.
 * If all attempts fail, returns an Err.
 *
 * @template SuccessfulResult - The type of the successful result.
 * @template Args - The argument types for the function to retry.
 * @param maxAttempts - Maximum number of attempts before giving up.
 * @param initialDelayTime - Initial delay time (seconds) before retrying, increases with each attempt.
 * @param exponentialBackoffFactor - The rate at how fast the delay time increase between attempts.
 * @param func - The function to retry, must return a Result.
 * @param args - Arguments to pass to the function.
 * @returns Result<SuccessfulResult, unknown> - Ok on success, Err on failure after all attempts.
 */
export function retry<OkType, ErrType, cancelOkType = OkType, cancelErrorType = ErrType, Args extends unknown[] = unknown[]>(
    maxAttempts               : number,
    initialDelayTime          : number,
    exponentialBackoffFactor  : number,
    func                      : (cancelRetry: (err: Err<cancelOkType, cancelErrorType>) => Err<cancelOkType, cancelErrorType>, ...args: Args) => Result<OkType, ErrType>,
    ...args: Args
): Result<OkType, ErrType> {
    // Cancel the retry function when the value is set true.
    let cancelError      : Err<cancelOkType, cancelErrorType> | undefined    = undefined;
    const onCancel       : (err: Err<cancelOkType, cancelErrorType>) => Err<cancelOkType, cancelErrorType> = ((err) => {
        cancelError = err; return err;
    });

    // Tracks the current attempt number.
    let currentAttempt   : number = 1;

    // Get the first result.
    let result           : Result<OkType, ErrType> = func(onCancel, ...args);

    // Repeat retrying until all attempts are exhausted.
    while (cancelError === undefined && result.isErr() && currentAttempt <= maxAttempts) {
        // Call the function with provided arguments.
        result = func(onCancel, ...args);

        // If successful, return the result.
        if (result.isOk()) return result;
        if (cancelError) {
            return cancelError;
        }

        // Calculate delay time and add a jitter.
        const delayTime     : number      = initialDelayTime * exponentialBackoffFactor ** currentAttempt;
        const jitterTime    : number      = ((delayTime / 4) * math.random());

        // Yield the thread for the time.
        task.wait(delayTime + jitterTime);

        // Increase the attempt.
        currentAttempt++;
    }

    // If all attempts fail, return an unsuccessful result.
    return result;
}