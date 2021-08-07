# simple-nd-base
A simple ndjson based database useful for mockups, testing, and quickly getting projects off of the ground.

## Use Cases
This library provides a simple-to-use out-of-the-box file database reader and writer. Each database will have its own ndjson file (newline-deliniated json) which will be the subject of that database's CRUD operations. Useful for:
- Getting started on a project without the need to integrate with a real database.
- Mocking objects.
- Unit testing.

For our website www.bytethisstore.com, we used this implementation to start coding before we had officially decided upon what database technology to use.
For more information on how to use this library, please visit: https://bytethisstore.com/articles/pg/simple-nd-base

## Recommended Use
We recommend you use this in conjunction with a data access layer in this manner such as this:
1. Create interfaces for objects which need to read and write to the database. These objects should only do that, nothing else (single responsibility)
2. Implement these classes with an implementation which consumes this file database library.
3. When it is time, implement new classes using the database of your choice and use those moving forward.

For more information and a deeper analysis of this methodology, visit our article on the topic: https://bytethisstore.com/articles/pg/database-decoupled 

## How to Use
1. Install via: ```npm install @byte-this/simple-nd-base```
1. Create connection objects which use the basic CRUD operations provided in this FileDatabase class.
1. Have classes which need to read/write to the database consume connection objects from the step above.

The FileDatabase class implements both interfaces shown below. When creating connection objects, utilize the functionality provided:
```typescript
/**
 * Interface for the read operations the FileDatabase will provide
 * The interface is a generic (parameterized) type:
 * -> DataType is the type of the record to be stored (can be set as 'any' if needed)
 */
 export interface iFileDatabaseReader<DataType> {

    /**
     * Get all records at once (can be problematic if the number of records is large)
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    getAllRecords(waitForUnlock: boolean): Promise<DataType[]>;

    /**
     * Find a single record which matches some callback criteria
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    findRecord(
        callback: (record: DataType) => boolean | Promise<boolean>,
        waitForUnlock: boolean
    ): Promise<DataType | undefined>;

    /**
     * Find all records which match some callback criteria
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    findRecords(
        callback: (record: DataType) => boolean | Promise<boolean>,
        waitForUnlock: boolean
    ): Promise<Array<DataType>>;

    /**
     * Iterate over all records and perform some action. Return false or Promise<false> to stop iterating
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    forEachRecord(
        callback: (record: DataType) => boolean | Promise<boolean>,
        waitForUnlock: boolean
    ): Promise<void>;

    /**
     * Get the number of records in the database
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    getNumRecords(waitForUnlock: boolean): Promise<number>;

    /**
    * Get the size of the database on the filesystem
    */
    getDatabaseSize(): Promise<number>;
}

/**
 * Interface for the write operations the FileDatabase will provide
 * The interface is a generic (parameterized) type:
 * -> DataType is the type of the record to be stored (can be set as 'any' if needed)
 */
export interface iFileDatabaseWriter<DataType> {

    /**
     * Add a single record of DataType
     * @param record DataType
     */
    addRecord(record: DataType): Promise<void>;

    /**
     * Add many records of DataType
     * @param record DataType
     */
    addRecords(records: DataType[]): Promise<void>;

    /**
     * Update multiple records based on some callback
     * Will update ALL records where the return of the callback is true or Promise<true>
     * @param findCallback 
     * @param newRecord 
     */
    updateRecords(
        findCallback: (record: DataType) => boolean | Promise<boolean>,
        newRecord: DataType
    ): Promise<void>;

    /**
     * Delete multiple records based on some callback
     * Will delete ALL records where the return of the callback is true or Promise<true>
     * @param findCallback 
     * @param newRecord 
     */
    deleteRecords(
        findCallback: (record: DataType) => boolean | Promise<boolean>
    ): Promise<void>;

    /**
     * Delete all records unconditionally
     */
    deleteAllRecords(): Promise<void>;
}
```
