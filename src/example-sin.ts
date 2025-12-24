import { UdpSocket } from "udp";
import { currentIp } from "wifi";
import { Packet, PacketParser } from "./libs/lorris-packet.js";

/**
 * UDP Lorris protocol server - sends periodic data and listens for commands
 */
enum Command {
	CMD_SET_PARAMS = 0,
	CMD_SIN = 1,
	CMD_COS = 2,
	CMD_TAN = 3,
	CMD_INDEX = 4,
	CMD_STEP = 5,
}

interface DataParams {
	tickRateMs: number;
	step: number;
}

let gParams: DataParams = {
	tickRateMs: 100,
	step: 0.1,
};

const gParser = new PacketParser();
let clientAddress: string | null = null;
let clientPort: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function processPacket(pkt: Packet): void {
	switch (pkt.command()) {
		case Command.CMD_SET_PARAMS:
			gParams.tickRateMs = pkt.readUint32();
			gParams.step = pkt.readDouble();
			console.log(`Params updated: tickRate=${gParams.tickRateMs}ms, step=${gParams.step}`);
			// Restart interval with new tick rate
			if (intervalId !== null) {
				clearInterval(intervalId);
				intervalId = startDataInterval();
			}
			break;
	}
}

while (!currentIp()) {
    console.log("Waiting for network...");
    await sleep(1000);
}

const PORT = 9999;

const socket = new UdpSocket({
    address: "0.0.0.0",
    port: PORT,
    onError: () => {
        console.log("Socket error");
    },
    onReadable: (count) => {
        const msg = socket.read();
        if (msg) {
			// Remember client address for sending data back
			clientAddress = msg.address;
			clientPort = msg.port;
			console.log(`Received data from ${msg.address}:${msg.port}`);

			// Process received bytes through packet parser
			const bytes = new Uint8Array(msg);
			for (const byte of bytes) {
				if (gParser.addByte(byte)) {
					processPacket(gParser.packet());
				}
			}
        }
    }
});


console.log(`UDP Lorris server listening on ${currentIp()}:${PORT}`);
console.log("Waiting for client connection...");
while (clientAddress === null) {
	await sleep(1000);
	console.log("Still waiting for client connection...");
}


let value = 0;
const pkt = new Packet();

function startDataInterval() {
	return setInterval(() => {
		// Only send if we have a client address
		if (clientAddress === null || clientPort === null) {
			return;
		}

		const params = gParams;

		// Send SIN packet
		pkt.reset(Command.CMD_SIN);
		pkt.writeDouble(Math.sin(value));
		socket.write(pkt.rawBuffer(), clientAddress, clientPort);

		// Send COS packet
		pkt.reset(Command.CMD_COS);
		pkt.writeDouble(Math.cos(value));
		socket.write(pkt.rawBuffer(), clientAddress, clientPort);

		// Send TAN packet
		pkt.reset(Command.CMD_TAN);
		pkt.writeDouble(Math.tan(value));
		socket.write(pkt.rawBuffer(), clientAddress, clientPort);

		// Send INDEX packet
		pkt.reset(Command.CMD_INDEX);
		pkt.writeUint8(Math.floor(value) % 256);
		socket.write(pkt.rawBuffer(), clientAddress, clientPort);

		// Send STEP packet
		pkt.reset(Command.CMD_STEP);
		pkt.writeDouble(params.step);
		socket.write(pkt.rawBuffer(), clientAddress, clientPort);

		value += params.step;
	}, gParams.tickRateMs);
}

intervalId = startDataInterval();
