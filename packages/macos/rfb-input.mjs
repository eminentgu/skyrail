import { Transform } from "node:stream";

// Track protocol boundaries, not screen content. Once authenticated, a parked
// viewer can continue requesting frames but cannot inject keyboard or pointer
// input while Codex owns the computer. Incomplete packets stay behind the gate.
export class RFBInputGate extends Transform {
  constructor() {
    super();
    this.c = Buffer.alloc(0);
    this.s = Buffer.alloc(0);
    this.cs = "version";
    this.ss = "version";
    this.enabled = true;
    this.ready = false;
    this.keys = new Map();
    this.pointer = null;
  }
  _transform(chunk, _encoding, done) {
    try {
      this.c = Buffer.concat([this.c, chunk]);
      if (this.c.length > 1024 * 1024) throw Error("RFB client buffer limit");
      this.pump();
      done();
    } catch (e) {
      done(e);
    }
  }
  observe(chunk) {
    if (this.ss === "done" || this.destroyed) return;
    try {
      this.s = Buffer.concat([this.s, chunk]);
      if (this.s.length > 1024 * 1024)
        throw Error("RFB handshake buffer limit");
      this.pump();
    } catch (e) {
      this.destroy(e);
    }
  }
  take(channel, length) {
    const b = this[channel],
      value = b.subarray(0, length);
    this[channel] = b.length === length ? Buffer.alloc(0) : b.subarray(length);
    return value;
  }
  pump() {
    while (!this.destroyed && (this.serverStep() || this.clientStep())) {}
  }
  serverStep() {
    if (this.ss === "version" && this.s.length >= 12) {
      if (!/^RFB 003\.(008|889)\n$/.test(this.take("s", 12).toString("ascii")))
        throw Error("Unsupported RFB version");
      this.ss = "wait-version";
      this.version = true;
      return true;
    }
    if (this.ss === "types" && this.s.length >= 1) {
      const n = this.s[0];
      if (!n) throw Error("RFB authentication unavailable");
      if (this.s.length < n + 1) return false;
      this.types = [...this.take("s", n + 1).subarray(1)];
      this.ss = "wait-choice";
      return true;
    }
    if (this.ss === "ard" && this.s.length >= 4) {
      const length = this.s.readUInt16BE(2);
      if (length < 16 || length > 4096) throw Error("Invalid ARD key size");
      if (this.s.length < 4 + 2 * length) return false;
      this.take("s", 4 + 2 * length);
      this.authLength = 128 + length;
      this.ss = "wait-auth";
      return true;
    }
    if (this.ss === "challenge" && this.s.length >= 16) {
      this.take("s", 16);
      this.authLength = 16;
      this.ss = "wait-auth";
      return true;
    }
    if (this.ss === "result" && this.s.length >= 4) {
      if (this.take("s", 4).readUInt32BE() !== 0)
        throw Error("RFB authentication rejected");
      this.authenticated = true;
      this.ss = "wait-init";
      return true;
    }
    if (this.ss === "init" && this.s.length >= 24) {
      const length = this.s.readUInt32BE(20);
      if (length > 65536) throw Error("RFB desktop name limit");
      if (this.s.length < 24 + length) return false;
      this.s = Buffer.alloc(0);
      this.ss = "done";
      this.ready = true;
      this.emit("ready");
      return true;
    }
    return false;
  }
  clientStep() {
    if (this.cs === "version" && this.version && this.c.length >= 12) {
      const version = this.take("c", 12);
      if (version.toString("ascii") !== "RFB 003.008\n")
        throw Error("Unsupported client RFB version");
      this.push(version);
      this.cs = "choice";
      this.ss = "types";
      return true;
    }
    if (this.cs === "choice" && this.types && this.c.length) {
      const choice = this.take("c", 1),
        type = choice[0];
      if (!this.types.includes(type) || ![1, 2, 30].includes(type))
        throw Error("Unsupported RFB authentication");
      this.push(choice);
      this.cs = type === 1 ? "init" : "auth";
      this.ss = type === 30 ? "ard" : type === 2 ? "challenge" : "result";
      return true;
    }
    if (
      this.cs === "auth" &&
      this.authLength &&
      this.c.length >= this.authLength
    ) {
      this.push(this.take("c", this.authLength));
      this.cs = "init";
      this.ss = "result";
      return true;
    }
    if (this.cs === "init" && this.authenticated && this.c.length) {
      this.push(this.take("c", 1));
      this.cs = "messages";
      this.ss = "init";
      return true;
    }
    if (this.cs !== "messages" || !this.c.length) return false;
    const type = this.c[0];
    let length;
    if (type === 0) length = 20;
    else if (type === 2) {
      if (this.c.length < 4) return false;
      length = 4 + this.c.readUInt16BE(2) * 4;
    } else if (type === 3) length = 10;
    else if (type === 4) length = 8;
    else if (type === 5) {
      if (this.c.length < 2) return false;
      length = this.c[1] & 0x80 ? 7 : 6;
    } else if (type === 6) {
      if (this.c.length < 8) return false;
      length = 8 + Math.abs(this.c.readInt32BE(4));
    } else if (type === 150) length = 10;
    else if (type === 248) {
      if (this.c.length < 9) return false;
      length = 9 + this.c[8];
    } else if (type === 250) length = 4;
    else if (type === 251) {
      if (this.c.length < 8) return false;
      length = 8 + this.c[6] * 16;
    } else if (type === 255) {
      if (this.c.length < 2) return false;
      if (this.c[1] !== 0) throw Error("Unsupported RFB extension");
      length = 12;
    } else throw Error("Unsupported RFB message");
    if (length > 1024 * 1024) throw Error("RFB message size limit");
    if (this.c.length < length) return false;
    const packet = this.take("c", length),
      input = [4, 5, 6, 250, 251, 255].includes(type);
    if (!input || this.enabled) {
      if (type === 4 || type === 255) {
        const id =
          type +
          ":" +
          packet.readUInt32BE(4) +
          (type === 255 ? ":" + packet.readUInt32BE(8) : "");
        const down =
          type === 4 ? packet[1] !== 0 : packet.readUInt16BE(2) !== 0;
        if (down) {
          if (this.keys.size >= 256 && !this.keys.has(id))
            throw Error("RFB held key limit");
          this.keys.set(id, Buffer.from(packet));
        } else this.keys.delete(id);
      }
      if (type === 5) this.pointer = Buffer.from(packet);
      this.push(packet);
    }
    return true;
  }
  park() {
    this.enabled = false;
    for (const packet of this.keys.values()) {
      if (packet[0] === 4) packet[1] = 0;
      else packet.writeUInt16BE(0, 2);
      this.push(packet);
    }
    this.keys.clear();
    if (this.pointer) {
      const up = Buffer.from(this.pointer.subarray(0, 6));
      up[1] = 0;
      this.push(up);
      this.pointer = null;
    }
  }
  resumeInput() {
    this.enabled = true;
  }
  _destroy(error, done) {
    this.c = Buffer.alloc(0);
    this.s = Buffer.alloc(0);
    this.keys.clear();
    this.pointer = null;
    done(error);
  }
}
