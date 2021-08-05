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
