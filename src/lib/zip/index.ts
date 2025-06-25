/**
 * ZIP library exports
 */

// Main classes
export { Zip } from './zip-reader.js';
export { ZipWriter } from './zip-writer.js';

// Utility functions
export {
  bufferToStream,
  downloadArrayBuffer,
  downloadBlob,
  streamToBlob,
  unixTimestampToDate,
  readString,
  readTerminatedString,
  readBytes,
  readFlags,
} from './utils.js';

// Type definitions
export type {
  ZipEntry,
  CentralDirectoryEntry,
  EndOfCentralDirectory,
  ZipWriterEntry,
  AddFileOptions,
  DosTime,
  SupportedDataType,
} from './types.js';
