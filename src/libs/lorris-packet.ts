export class Packet {
    private static readonly INDEX_DEVICE_ID = 1;
    private static readonly INDEX_COMMAND = 2;
    private static readonly INDEX_LENGTH = 3;
    private static readonly INDEX_DATA = 4;

    private data: number[];
    private readIndex: number;

    constructor(command: number = 0, deviceId: number = 1) {
        this.data = [0xFF, deviceId, command, 0];
        this.readIndex = Packet.INDEX_DATA;
    }

    reset(command: number = 0, deviceId: number = 1): void {
        this.data.length = Packet.INDEX_DATA;
        this.data[Packet.INDEX_DEVICE_ID] = deviceId;
        this.data[Packet.INDEX_COMMAND] = command;
        this.data[Packet.INDEX_LENGTH] = 0;
        this.readIndex = Packet.INDEX_DATA;
    }

    writeUint8(val: number): void {
        if (this.data.length + 1 > 255) {
            console.error(`invalid write() with index ${this.data.length} and size 1`);
            return;
        }
        this.data.push(val & 0xFF);
        this.data[Packet.INDEX_LENGTH]++;
    }

    writeUint16(val: number): void {
        if (this.data.length + 2 > 255) {
            console.error(`invalid write() with index ${this.data.length} and size 2`);
            return;
        }
        // Little-endian
        this.data.push(val & 0xFF);
        this.data.push((val >> 8) & 0xFF);
        this.data[Packet.INDEX_LENGTH] += 2;
    }

    writeUint32(val: number): void {
        if (this.data.length + 4 > 255) {
            console.error(`invalid write() with index ${this.data.length} and size 4`);
            return;
        }
        // Little-endian
        this.data.push(val & 0xFF);
        this.data.push((val >> 8) & 0xFF);
        this.data.push((val >> 16) & 0xFF);
        this.data.push((val >> 24) & 0xFF);
        this.data[Packet.INDEX_LENGTH] += 4;
    }

    writeInt8(val: number): void {
        this.writeUint8(val);
    }

    writeInt16(val: number): void {
        this.writeUint16(val);
    }

    writeInt32(val: number): void {
        this.writeUint32(val);
    }

    writeFloat32(val: number): void {
        if (this.data.length + 4 > 255) {
            console.error(`invalid write() with index ${this.data.length} and size 4`);
            return;
        }
        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setFloat32(0, val, true); // true = little-endian
        for (let i = 0; i < 4; i++) {
            this.data.push(view.getUint8(i));
        }
        this.data[Packet.INDEX_LENGTH] += 4;
    }

    writeFloat64(val: number): void {
        if (this.data.length + 8 > 255) {
            console.error(`invalid write() with index ${this.data.length} and size 8`);
            return;
        }
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        view.setFloat64(0, val, true); // true = little-endian
        for (let i = 0; i < 8; i++) {
            this.data.push(view.getUint8(i));
        }
        this.data[Packet.INDEX_LENGTH] += 8;
    }

    // Alias for C++ compatibility (double = float64)
    writeDouble(val: number): void {
        this.writeFloat64(val);
    }

    readUint8(): number {
        if (this.readIndex + 1 <= this.data.length) {
            const val = this.data[this.readIndex];
            this.readIndex++;
            return val;
        } else {
            console.error(`invalid read() with index ${this.readIndex} and size 1`);
            return 0;
        }
    }

    readUint16(): number {
        if (this.readIndex + 2 <= this.data.length) {
            const val = this.data[this.readIndex] | (this.data[this.readIndex + 1] << 8);
            this.readIndex += 2;
            return val;
        } else {
            console.error(`invalid read() with index ${this.readIndex} and size 2`);
            return 0;
        }
    }

    readUint32(): number {
        if (this.readIndex + 4 <= this.data.length) {
            const val = (this.data[this.readIndex] |
                (this.data[this.readIndex + 1] << 8) |
                (this.data[this.readIndex + 2] << 16) |
                (this.data[this.readIndex + 3] << 24)) >>> 0;
            this.readIndex += 4;
            return val;
        } else {
            console.error(`invalid read() with index ${this.readIndex} and size 4`);
            return 0;
        }
    }

    readInt8(): number {
        const val = this.readUint8();
        return val > 127 ? val - 256 : val;
    }

    readInt16(): number {
        const val = this.readUint16();
        return val > 32767 ? val - 65536 : val;
    }

    readInt32(): number {
        const val = this.readUint32();
        return val | 0; // Convert to signed
    }

    readFloat32(): number {
        if (this.readIndex + 4 <= this.data.length) {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            for (let i = 0; i < 4; i++) {
                view.setUint8(i, this.data[this.readIndex + i]);
            }
            this.readIndex += 4;
            return view.getFloat32(0, true); // true = little-endian
        } else {
            console.error(`invalid read() with index ${this.readIndex} and size 4`);
            return 0;
        }
    }

    readFloat64(): number {
        if (this.readIndex + 8 <= this.data.length) {
            const buffer = new ArrayBuffer(8);
            const view = new DataView(buffer);
            for (let i = 0; i < 8; i++) {
                view.setUint8(i, this.data[this.readIndex + i]);
            }
            this.readIndex += 8;
            return view.getFloat64(0, true); // true = little-endian
        } else {
            console.error(`invalid read() with index ${this.readIndex} and size 8`);
            return 0;
        }
    }

    // Alias for C++ compatibility (double = float64)
    readDouble(): number {
        return this.readFloat64();
    }

    // Read with specific index
    readUint8At(idx: number): number {
        if (idx + 1 <= this.data.length) {
            return this.data[idx];
        } else {
            console.error(`invalid read() with index ${idx} and size 1`);
            return 0;
        }
    }

    readUint32At(idx: number): number {
        if (idx + 4 <= this.data.length) {
            return (this.data[idx] |
                (this.data[idx + 1] << 8) |
                (this.data[idx + 2] << 16) |
                (this.data[idx + 3] << 24)) >>> 0;
        } else {
            console.error(`invalid read() with index ${idx} and size 4`);
            return 0;
        }
    }

    readFloat64At(idx: number): number {
        if (idx + 8 <= this.data.length) {
            const buffer = new ArrayBuffer(8);
            const view = new DataView(buffer);
            for (let i = 0; i < 8; i++) {
                view.setUint8(i, this.data[idx + i]);
            }
            return view.getFloat64(0, true);
        } else {
            console.error(`invalid read() with index ${idx} and size 8`);
            return 0;
        }
    }

    command(): number {
        return this.data[Packet.INDEX_COMMAND];
    }

    deviceId(): number {
        return this.data[Packet.INDEX_DEVICE_ID];
    }

    dataLength(): number {
        return this.data[Packet.INDEX_LENGTH];
    }

    raw(): Uint8Array {
        return new Uint8Array(this.data);
    }

    rawBuffer(): ArrayBuffer {
        const buffer = new ArrayBuffer(this.data.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < this.data.length; i++) {
            view[i] = this.data[i];
        }
        return buffer;
    }

    rawArray(): number[] {
        return this.data;
    }

    // Get Latin-1 encoded string (each char = one byte, no UTF-8 encoding)
    rawLatin1(): string {
        let result = "";
        for (let i = 0; i < this.data.length; i++) {
            // Use only codes 0-255, avoiding multi-byte UTF-8 sequences
            result += String.fromCharCode(this.data[i]);
        }
        return result;
    }

    // Encode packet to base64 string
    toBase64(): string {
        const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let result = "";
        let i = 0;

        while (i < this.data.length) {
            const byte1 = this.data[i++];
            const byte2 = i < this.data.length ? this.data[i++] : 0;
            const byte3 = i < this.data.length ? this.data[i++] : 0;

            const encoded1 = byte1 >> 2;
            const encoded2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
            const encoded3 = ((byte2 & 0xF) << 2) | (byte3 >> 6);
            const encoded4 = byte3 & 0x3F;

            result += base64Chars[encoded1];
            result += base64Chars[encoded2];
            result += (i - 2 < this.data.length) ? base64Chars[encoded3] : "=";
            result += (i - 1 < this.data.length) ? base64Chars[encoded4] : "=";
        }

        return result;
    }
}

export class PacketParser {
    private static readonly ST_START = 0;
    private static readonly ST_DEVICE = 1;
    private static readonly ST_COMMAND = 2;
    private static readonly ST_LENGTH = 3;
    private static readonly ST_DATA = 4;

    private state: number;
    private device: number;
    private command: number;
    private length: number;
    private pkt: Packet;

    constructor() {
        this.state = PacketParser.ST_START;
        this.device = 0;
        this.command = 0;
        this.length = 0;
        this.pkt = new Packet();
    }

    addByte(b: number): boolean {
        switch (this.state) {
            case PacketParser.ST_START:
                if (b !== 0xFF) {
                    return false;
                }
                break;

            case PacketParser.ST_DEVICE:
                this.device = b;
                break;

            case PacketParser.ST_COMMAND:
                this.command = b;
                break;

            case PacketParser.ST_LENGTH:
                this.length = b;
                this.pkt.reset(this.command, this.device);
                break;

            case PacketParser.ST_DATA:
                this.pkt.writeUint8(b);
                if (this.pkt.dataLength() < this.length) {
                    return false;
                }
                this.state = PacketParser.ST_START;
                return true;
        }

        this.state++;
        return false;
    }

    packet(): Packet {
        return this.pkt;
    }
}
