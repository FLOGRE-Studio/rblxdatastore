# RblxDataStore

A robust, strictly-typed Roblox DataStore library written in TypeScript (via [Roblox-TS](https://roblox-ts.com)) that organizes data with schemas and enforces strict validation.



## Overview

`RblxDataStore` provides a modern, structured way to manage Roblox DataStore operations by:

- Enforcing **strict schema validation**
- Supporting **data transformations**
- Handling **data migrations** over time
- Offering both **cached** and **concurrent-safe** document access
- Automatic cleanup on game shutdown via `game.BindToClose`

It is designed for developers who want **predictable, type-safe, and scalable** data handling in Roblox games.



## Core Concepts

### Document Store

A `RblxDocumentStore` manages a collection of documents associated with a Roblox `DataStore`. Each document represents a single key-value record and can be accessed either:

- **Cached (`CacheDocument`)** – Uses session locking in the type of the document to ensure only one document can edit the data at a time.
- **Concurrent (`ConcurrentDocument`)** – Non-session locking type of document for multi-server editing.

### Document Schema

Every document in `RblxDataStore` is strictly typed via a schema. You provide:

- `defaultSchema` – Default values if a document does not exist.
- `schemaValidate` – Function to validate data before writing.
- `transformation` – Optional transformation applied on read/write, mainly for reconcilation.
- `migrations` – Functions to upgrade/mutate data over time, they run on incremental versions.

### Automatic Lifecycle Handling

By enabling `bindToClose` in the configuration:

- All cache and concurrent documents are automatically closed when the game shuts down.
- Prevents data loss and ensures proper cleanup.

### Debug Mode

Though optional, you can enable the debug mode in the configuration to see detailed logging in data operations.

Usually used by the maintainers for diagnosing internal issues.

---

## Installation

```bash
npm install @rbxts/rblxdatastore
```

## Examples
*Soon*