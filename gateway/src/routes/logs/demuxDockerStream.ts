// Demux Docker's multiplexed stream header (8-byte prefix per frame).
// Byte 0 = stream type (1=stdout, 2=stderr), bytes 4-7 = payload size (big-endian).
export function demuxDockerStream(
  raw: NodeJS.ReadableStream,
  onLine: (line: string, isStderr: boolean) => void,
  onEnd: () => void,
): () => void {
  let buf = Buffer.alloc(0);
  let destroyed = false;

  function processBuffer() {
    while (buf.length >= 8) {
      const streamType = buf[0];
      const payloadLen = buf.readUInt32BE(4);
      if (buf.length < 8 + payloadLen) break;
      const payload = buf.subarray(8, 8 + payloadLen).toString('utf8');
      buf = buf.subarray(8 + payloadLen);
      const isStderr = streamType === 2;
      const lines = payload.split('\n');
      for (const line of lines) {
        if (line.length > 0) onLine(line, isStderr);
      }
    }
  }

  raw.on('data', (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
    processBuffer();
  });

  raw.on('end', onEnd);
  raw.on('error', onEnd);

  return () => {
    if (!destroyed) {
      destroyed = true;
      (raw as any).destroy?.();
    }
  };
}
