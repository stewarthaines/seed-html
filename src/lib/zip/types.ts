// Type definitions for ZIP library

export interface ZipEntry {
  signature: string;
  version: number;
  generalPurpose: number;
  compressionMethod: number;
  lastModifiedTime: number;
  lastModifiedDate: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  fileNameLength: number;
  fileName: string;
  extraLength: number;
  extra: string;
  startsAt: number;
  extract: () => Promise<Blob>;
}

export interface CentralDirectoryEntry {
  signature: string;
  versionCreated: number;
  versionNeeded: number;
  generalPurpose: number;
  compressionMethod: number;
  lastModifiedTime: number;
  lastModifiedDate: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  fileNameLength: number;
  extraLength: number;
  fileCommentLength: number;
  diskNumber: number;
  internalAttributes: number;
  externalAttributes: number;
  offset: number;
  fileName: string;
  extra: string;
  comments: string;
}

export interface EndOfCentralDirectory {
  signature: string;
  numberOfDisks: number;
  centralDirectoryStartDisk: number;
  numberCentralDirectoryRecordsOnThisDisk: number;
  numberCentralDirectoryRecords: number;
  centralDirectorySize: number;
  centralDirectoryOffset: number;
  commentLength: number;
  comment: string;
}

export interface ZipWriterEntry {
  fileName: string;
  compressionMethod: number;
  lastModified: Date;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  data: ArrayBuffer;
  localHeaderOffset: number;
}

export interface AddFileOptions {
  compressionMethod?: number;
  lastModified?: Date;
}

export interface DosTime {
  date: number;
  time: number;
}

export type SupportedDataType = ArrayBuffer | Uint8Array | Blob | string;
