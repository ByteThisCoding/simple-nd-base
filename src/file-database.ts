import {
    iFileDatabaseReader,
    iFileDatabaseWriter,
} from "./models/file-database";
import fs from "fs";
import readline from "readline";

/**
 * This is the concrete implementation for both the reader and writer interfaces
 */
export class FileDatabase<DataType>
    implements iFileDatabaseReader<DataType>, iFileDatabaseWriter<DataType> {

    //Use a promise to keep track of whether or not the filesystem is locked / pending operations
    private lockedPromise = Promise.resolve();

    //Use a temporary file for certain write operations
    private tmpFileName: string;

    /**
     * Create an instance of the class.
     * @param ndjsonFilename Name of the ndjson database
     * Each instance should have a unique filename to avoid race conditions
     */
    constructor(private readonly ndjsonFilename: string) {
        this.tmpFileName = this.ndjsonFilename + ".tmp.ndjson";
    }

    /**
    * Get the size of the database on the filesystem
    */
    async getDatabaseSize(): Promise<number> {
        const stats = await fs.promises.stat(this.ndjsonFilename);
        return stats.size;
    }

    /**
     * Get the number of records in the database
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    async getNumRecords(waitForUnlock: boolean): Promise<number> {
        return this.getAllRecords(waitForUnlock).then((rc) => rc.length);
    }

    /**
     * Get all records at once (can be problematic if the number of records is large)
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    async getAllRecords(waitForUnlock: boolean): Promise<DataType[]> {
        const records: Array<DataType> = [];
        await this.forEachRecord(async (data: DataType) => {
            records.push(data);
            return true;
        }, waitForUnlock);
        return records;
    }

    /**
     * Find a single record which matches some callback criteria
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    async findRecord(
        callback: (record: DataType) => boolean | Promise<boolean>,
        waitForUnlock: boolean
    ): Promise<DataType | undefined> {
        let foundRecord: DataType | undefined = undefined;
        await this.forEachRecord(async (record: DataType) => {
            const isAccepted = await callback(record);
            if (isAccepted) {
                foundRecord = record;
            }
            return !isAccepted;
        }, waitForUnlock);
        return foundRecord;
    }

    /**
     * Find all records which match some callback criteria
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    async findRecords(
        callback: (record: DataType) => boolean | Promise<boolean>,
        waitForUnlock: boolean
    ): Promise<DataType[]> {
        const foundRecords: Array<DataType> = [];
        await this.forEachRecord(async (record: DataType) => {
            const isAccepted = await callback(record);
            if (isAccepted) {
                foundRecords.push(record);
            }
            return true;
        }, waitForUnlock);
        return foundRecords;
    }

    /**
     * Iterate over all records and perform some action. Return false or Promise<false> to stop iterating
     * @param waitForUnlock: if false, should return result immediately, otherwise, wait for pending operations
     */
    async forEachRecord(
        callback: (record: DataType) => boolean | Promise<boolean>,
        waitForUnlock: boolean
    ): Promise<void> {
        await this.lockAndExecute(async () => {
            const exists = await this.fileExists(this.ndjsonFilename);
            if (!exists) {
                return;
            }

            const filestream = fs.createReadStream(this.ndjsonFilename);
            const rlInterface = readline.createInterface({
                input: filestream,
                crlfDelay: Infinity,
                terminal: false,
            });

            for await (const line of rlInterface) {
                if (line.trim()) {
                    const data = JSON.parse(line);
                    const doContinue = await callback(data);
                    if (typeof doContinue !== "undefined" && !doContinue) {
                        break;
                    }
                }
            }

            await rlInterface.close();
            await filestream.close();
        }, waitForUnlock);
    }

    /**
     * Add a single record of DataType
     * @param record DataType
     */
    async addRecord(record: DataType): Promise<void> {
        await this.addRecords([record]);
    }

    /**
     * Add many records of DataType
     * @param record DataType
     */
    async addRecords(records: Array<DataType>): Promise<void> {
        await this.lockAndExecute(async () => {
            const newJson = records.reduce((str, record) => {
                return str + JSON.stringify(record) + "\n";
            }, "");

            await this.writeFile(this.ndjsonFilename, newJson, true);
        });
    }

    /**
     * Update multiple records based on some callback
     * Will update ALL records where the return of the callback is true or Promise<true>
     * @param findCallback 
     * @param newRecord 
     */
    async updateRecords(
        findCallback: (record: DataType) => boolean | Promise<boolean>,
        newRecord: DataType
    ): Promise<void> {
        //make updates to some temp file, then replace the real file with that file
        await this.lockAndExecute(async () => {
            const tmpWriter = this.getTmpWriter();
            await tmpWriter.deleteAllRecords();

            let isUpdated = false;
            await this.forEachRecord(async (record: DataType) => {
                const isAccepted = await findCallback(record);
                let updateRecord = record;
                if (isAccepted) {
                    updateRecord = newRecord;
                }
                await tmpWriter.addRecord(updateRecord);
                isUpdated = true;
                return true;
            }, false);

            if (isUpdated) {
                await this.deleteFile(this.ndjsonFilename).catch((err) => {});
                await this.renameFile(this.tmpFileName, this.ndjsonFilename);
            }
        });
    }

    /**
     * Delete multiple records based on some callback
     * Will delete ALL records where the return of the callback is true or Promise<true>
     * @param findCallback 
     * @param newRecord 
     */
    async deleteRecords(
        findCallback: (record: DataType) => boolean | Promise<boolean>
    ): Promise<void> {
        //make deletions to some temp file, then replace the real file with that file
        await this.lockAndExecute(async () => {
            const tmpWriter = this.getTmpWriter();
            await tmpWriter.deleteAllRecords();

            let isUpdated = false;
            await this.forEachRecord(async (record: DataType) => {
                const doDelete = await findCallback(record);
                if (!doDelete) {
                    await tmpWriter.addRecord(record);
                } else {
                    isUpdated = true;
                }
                return true;
            }, false);

            if (isUpdated) {
                await this.deleteFile(this.ndjsonFilename).catch((err) => {
                    console.error(
                        `Could not delete ndjson file ${this.ndjsonFilename}`,
                        err
                    );
                });
                await this.renameFile(
                    this.tmpFileName,
                    this.ndjsonFilename
                ).catch((err) => {
                    console.error(`Could not delete entry from db`, err);
                    throw "Could not properly delete database entry";
                });
            } else {
                await this.deleteFile(this.tmpFileName).catch((err) => {
                    console.error(
                        `Could not delete tmp ndjson file ${this.tmpFileName}`,
                        err
                    );
                });
            }
        });
    }

    /**
     * Delete all records unconditionally
     */
    async deleteAllRecords(): Promise<void> {
        await this.lockAndExecute(async () => {
            await this.writeFile(this.ndjsonFilename, "", false);
        });
    }

    /**
     * Lock the database until some action within callback is completed
     * @param callback 
     * @param waitForUnlock 
     * @returns 
     */
    private async lockAndExecute(
        callback: () => Promise<void>,
        waitForUnlock = true
    ): Promise<void> {
        if (waitForUnlock) {
            await this.lockedPromise;
        }

        const promise = new Promise<void>(async (resolve, reject) => {
            try {
                await callback();
                resolve();
            } catch (err) {
                reject(err);
            }
        });
        this.lockedPromise = promise.catch(() => {});
        return promise;
    }

    /**
     * Get a temporary writer for the temp file
     * @returns 
     */
    private getTmpWriter(): iFileDatabaseWriter<DataType> {
        return new FileDatabase<DataType>(this.tmpFileName);
    }

    /**
     * Rename a file
     * @param oldName 
     * @param newName 
     */
    private async renameFile(oldName: string, newName: string): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            fs.rename(oldName, newName, (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    }

    /**
     * Delete a file
     * @param fileName 
     */
    private async deleteFile(fileName: string): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            fs.unlink(fileName, (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    }

    /**
     * Write to a new file or append to an existing file
     * @param fileName 
     * @param contents 
     * @param doAppend 
     */
    private async writeFile(
        fileName: string,
        contents: string,
        doAppend: boolean
    ): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const args: any = [fileName, contents];
            if (doAppend) {
                args.push({
                    flag: "a",
                });
            }
            args.push((err: any) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });

            fs.writeFile.apply(fs, args);
        });
    }

    /**
     * Check if some file exists
     * @param fileName 
     * @returns 
     */
    private async fileExists(fileName: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            fs.stat(fileName, (err, data) => {
                if (err) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }
}
