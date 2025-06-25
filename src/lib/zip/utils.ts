/**
 * Utility functions for ZIP library operations
 */

/**
 * Converts an ArrayBuffer to a ReadableStream
 */
export function bufferToStream(arrayBuffer: ArrayBuffer): ReadableStream<ArrayBuffer> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(arrayBuffer);
      controller.close();
    },
  });
}

/**
 * Triggers download of an ArrayBuffer as a file
 */
export function downloadArrayBuffer(arrayBuffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([arrayBuffer]);
  downloadBlob(blob, fileName);
}

/**
 * Triggers download of a Blob as a file
 */
export function downloadBlob(blob: Blob, fileName: string = 'download.x'): void {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', fileName);
  link.click();
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * Converts a ReadableStream to a Blob
 */
export async function streamToBlob(stream: ReadableStream, type?: string): Promise<Blob> {
  const reader = stream.getReader();
  let done = false;
  const data: Uint8Array[] = [];

  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      data.push(result.value);
    }
  }

  return new Blob(data, { type });
}

/**
 * Converts Unix timestamp to JavaScript Date
 */
export function unixTimestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Reads a string of specified length from DataView at given offset
 */
export function readString(dataView: DataView, offset: number, length: number): string {
  const str: string[] = [];
  for (let i = 0; i < length; i++) {
    str.push(String.fromCharCode(dataView.getUint8(offset + i)));
  }
  return str.join('');
}

/**
 * Reads a null-terminated string from DataView at given offset
 */
export function readTerminatedString(dataView: DataView, offset: number): string {
  const str: string[] = [];
  let val: number = 1; // Initialize to non-zero value
  let i = 0;

  while (val !== 0) {
    val = dataView.getUint8(offset + i);
    if (val !== 0) {
      str.push(String.fromCharCode(val));
    }
    i++;
  }
  return str.join('');
}

/**
 * Reads an array of bytes from DataView at given offset
 */
export function readBytes(dataView: DataView, offset: number, length: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < length; i++) {
    bytes.push(dataView.getUint8(offset + i));
  }
  return bytes;
}

/**
 * Reads flag bits from DataView and returns an object with named flags
 */
export function readFlags(
  dataView: DataView,
  offset: number,
  flagLabels: string[]
): Record<string, boolean> {
  const flags: Record<string, boolean> = {};

  for (let i = 0; i < flagLabels.length; i++) {
    const byte = dataView.getUint8(offset + Math.floor(i / 8));
    flags[flagLabels[i]] = ((1 << i) & byte) >> i === 1;
  }

  return flags;
}
