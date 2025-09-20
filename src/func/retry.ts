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

/**
 * Retries a function call up to a maximum number of attempts, with a delay between each attempt.
 * If the function returns a successful Result, the retry loop stops and returns the value.
 * If all attempts fail, returns an Err.
 *
 * @template SuccessfulResult - The type of the successful result.
 * @template Args - The argument types for the function to retry.
 * @param maxAttempts - Maximum number of attempts before giving up.
 * @param initalDelayTime - Initial delay time (seconds) before retrying, increases with each attempt.
 * @param exponentialBackoffFactor - The rate at how fast the delay time increase between attempts.
 * @param func - The function to retry, must return a Result.
 * @param args - Arguments to pass to the function.
 * @returns Result<SuccessfulResult, unknown> - Ok on success, Err on failure after all attempts.
 */
export function retry<OkType, ErrType, Args extends unknown[] = unknown[]>(
    maxAttempts               : number,
    initalDelayTime           : number,
    exponentialBackoffFactor  : number,
    func                      : (...args: Args) => Result<OkType, ErrType>,
    ...args: Args
): Result<OkType, ErrType> {
    // Tracks the current attempt number.
    let currentAttempt   : number = 0;
    let result           : Result<OkType, ErrType> = func(...args);

    // Repeat retrying until all attempts are exhausted.
    while (result.isErr() && currentAttempt < maxAttempts) {
        currentAttempt++;

        // Call the function with provided arguments.
        result = func(...args);

        // If successful, return the result.
        if (result.isOk()) return result;

        // Calculate delay time and add a jitter.
        const delayTime     : number      = initalDelayTime / exponentialBackoffFactor ** currentAttempt;
        const jitterTime    : number      = ((delayTime / 4) * math.random());

        // Yield the thread for the time.
        task.wait(delayTime + jitterTime);
    }

    // If all attempts fail, return an unsuccessful result.
    return result;
}