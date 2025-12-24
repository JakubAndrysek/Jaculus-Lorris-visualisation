import * as wifi from "wifi";
import { UdpSocket } from "udp";
import * as gpio from "gpio";
import { currentIp } from "wifi";
import { Packet, PacketParser } from "./libs/lorris-packet.js";
import { createRobutek } from "./libs/robutek.js"
const robutek = createRobutek("V2");

let stopTimeout = null;
gpio.pinMode(1, gpio.PinMode.INPUT);

enum Command {
	CMD_SET_PARAMS = 0,
	CMD_ROBOT_NEC_L = 1,
	CMD_ROBOT_NEC_R = 2,
	CMD_ROBOT_BUTTON = 3
}

const gParser = new PacketParser();
let clientAddress: string | null = null;
let clientPort: number | null = null;


function processPacket(pkt: Packet): void {
	switch (pkt.command()) {
		case Command.CMD_SET_PARAMS:
			const dir = pkt.readUint8();
			switch (dir) {
				case 0:
					console.log("Stop");
					robutek.leftMotor.setSpeed(0);
					robutek.rightMotor.setSpeed(0);
					break;
				case 1: // w
					console.log("Forward");
					robutek.leftMotor.setSpeed(100);
					robutek.rightMotor.setSpeed(100);
					break;
				case 2: // a
					console.log("Left");
					robutek.leftMotor.setSpeed(-100);
					robutek.rightMotor.setSpeed(100);
					break;
				case 3: // s
					console.log("Backward");
					robutek.leftMotor.setSpeed(-100);
					robutek.rightMotor.setSpeed(-100);
					break;
				case 4: // d
					console.log("Right");
					robutek.leftMotor.setSpeed(100);
					robutek.rightMotor.setSpeed(-100);
					break;
			}
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


function stop() {
    robutek.leftMotor.setSpeed(0);
    robutek.rightMotor.setSpeed(0);
    stopTimeout = null;
}

function scale(value: number): number {
    // Scale the joystick value from -32768..32767 to -1..1
    return value / 32768;
}

function setMotorsJoystick(x: number, y: number, coef = 2.5) {
    // Scale the joystick values
    x = scale(x);
    y = scale(y);

    // Calculate motor powers
    let r = (y - (x / coef));
    let l = (y + (x / coef));

    // Apply speed limiter
    r *= speedLimiter;
    l *= speedLimiter;

    // Swap r and l if both are negative
    if (r < 0 && l < 0) {
        [r, l] = [l, r];
    }

    console.log(`x: ${x}, y: ${y}`);
    console.log(`left motor power: ${l}, right motor power: ${r}`);

    // Set motor power
    robutek.leftMotor.setSpeed(l * speedMul);
    robutek.rightMotor.setSpeed(r * speedMul);

    // Stop robot on connection loss
    if (stopTimeout !== null) {
        clearTimeout(stopTimeout);
    }
    stopTimeout = setTimeout(stop, 1000);
}


console.log(`UDP Lorris server listening on ${currentIp()}:${PORT}`);
console.log("Waiting for client connection...");
while (clientAddress === null) {
	await sleep(1000);
	console.log("Still waiting for client connection...");
}

let speedLimiter = 0.5
let speedMul = 500;

robutek.leftMotor.move();
robutek.rightMotor.move();

const pkt = new Packet();

setInterval(() => {
	if (clientAddress === null || clientPort === null) {
		return;
	}

	// Send SIN packet
	pkt.reset(Command.CMD_ROBOT_NEC_L);
	pkt.writeInt32(robutek.leftMotor.getPosition());
	socket.write(pkt.rawBuffer(), clientAddress, clientPort);

	// Send COS packet
	pkt.reset(Command.CMD_ROBOT_NEC_R);
	pkt.writeInt32(robutek.rightMotor.getPosition());
	socket.write(pkt.rawBuffer(), clientAddress, clientPort);

	// Send button state
	pkt.reset(Command.CMD_ROBOT_BUTTON);
	pkt.writeUint8(gpio.read(1));
	socket.write(pkt.rawBuffer(), clientAddress, clientPort);
}, 100);
