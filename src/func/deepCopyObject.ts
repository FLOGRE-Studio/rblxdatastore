export function deepCopyObject<T extends object>(object: T): T {
    if (!typeIs(object, "table")) return object as T;
    const clonedObject: Record<string, unknown> = {};

    for (const [k, v] of pairs(object as Record<string, unknown>)) {
        clonedObject[k] = typeIs(v, "table") ? deepCopyObject(v) : v;
    }

    const metatable = getmetatable(object);
    if (metatable) setmetatable(clonedObject, deepCopyObject(metatable));

    return clonedObject as T;
}