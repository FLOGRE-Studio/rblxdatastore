function deepCopyObjectHelper(object: object, encounteredObjects: Map<object, object>): object {
    if (!typeIs(object, "table")) return object;
    const clonedObject: Map<unknown, unknown> = new Map();
    encounteredObjects.set(object, clonedObject);

    for (const [k, v] of pairs(object)) {
        const key = typeIs(k, "table") ? (encounteredObjects.get(k) || deepCopyObjectHelper(k, encounteredObjects)) : k;
        const value = typeIs(v, "table") ? (encounteredObjects.get(v) || deepCopyObjectHelper(v, encounteredObjects)) : v;

        clonedObject.set(key, value);
    }

    const metatable = getmetatable(object);
    if (metatable) setmetatable(clonedObject, deepCopyObjectHelper(metatable, encounteredObjects));

    return clonedObject as object;
}

export function deepCopyObject<T extends object>(object: T): T {
    return deepCopyObjectHelper(object, new Map()) as T;
}