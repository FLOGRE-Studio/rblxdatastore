# RblxDataStore

A robust, strictly-typed Roblox DataStore library written in TypeScript (via [Roblox-TS](https://roblox-ts.com)) that organizes data with strictly-typed schemas, enforces strict validation, enables migrations that mutate data overtime, and features robust error handling.



## Overview

**RblxDataStore** provides a modern, structured way to manage Roblox DataStore operations by:

- Enforcing **strict schema validation**
- Supporting **data transformation** through a transformer that run before migrations
- Handling **data migrations** over time
- Offering two seperate classes for both session locked documents through `CacheDocument` and non session locked documents through `ConcurrentDocument`
- Automatic cleanup on game shutdown via `game.BindToClose`

It is designed for developers who want **predictable, type-safe, and scalable** data handling in Roblox games.

## Features
- ✅ Strictly typed documents

- ✅ Schema validation

- ✅ Persistent Transformation for transformating data before migrations (Mainly used for reconcilation)

- ✅ Migrations for evolving data structures

- ✅ Session locking and non session locking document access

- ✅ Automatic lifecycle management

- ✅ Debug logging support for diagnosing internal issues

## Core Concepts

### Document Store

A `RblxDocumentStore` manages a collection of documents associated with a Roblox `DataStore`. Each document represents a single key-value record and can be accessed either:

- **Cached (`CacheDocument`)** – Uses session locking in the type of the document to ensure only one document can edit the data at a time.
- **Concurrent (`ConcurrentDocument`)** – Does not use session locking in the type of document, for multi-server editing.

### Document Schema

Every document in `RblxDataStore` is strictly typed via a schema. You provide:

- `defaultSchema` – Default values if a document does not exist.
- `schemaValidate` – Function to validate data before writing.
- `transformation` – Optional transformation applied on data, mainly for reconcilation.
- `migrations` – Functions to upgrade/mutate data over time, they run on incremental versions.

### Automatic Lifecycle Handling

By enabling `bindToClose` in the configuration:

- All cache and concurrent documents are automatically closed when the game shuts down.
- Prevents data loss and ensures proper cleanup.

### Debug Mode

Though optional, you can enable the debug mode in the configuration to see detailed logging in data operations.

Usually used by the maintainers for diagnosing internal issues.


## DISCLAIMERS
**RblxDataStore** is in early development and is actively updated. All features are subject to change. No stability guarantee can be given in the usage of this library.

## Installation

```bash
npm install @rbxts/rblxdatastore
```

## Examples
*Soon*