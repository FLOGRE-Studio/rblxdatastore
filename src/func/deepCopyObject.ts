export function deepCopyObject<T extends Record<string, unknown>>(object: T): T {
    if (!typeIs(object, "table")) return object as T;
    const clonedObject: Record<string, unknown> = {}

    for (const [k, v] of pairs(object as Record<string, unknown>)) {
        if (typeIs(v, "table")) {
            clonedObject[k] = deepCopyObject(v as Record<string, unknown>);
        } else {
            clonedObject[k] = v;
        }
    }

    return clonedObject as T;
}
