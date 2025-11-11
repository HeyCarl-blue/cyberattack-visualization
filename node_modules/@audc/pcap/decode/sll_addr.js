var util = require("../util");

class SLLAddr {
	decoderName = "ssl-addr";
	eventsOnDecode = false;
	
	constructor(raw_packet, offset, len) {
		this.addr = new Array(len);
		for (var i = 0; i < len; i++) {
			this.addr[i] = raw_packet[offset + i];
		}
	}
	toString() {
		var ret = "";
		for (var i = 0; i < this.addr.length - 1; i++) {
			ret += util.int8_to_hex[this.addr[i]] + ":";
		}
		ret += util.int8_to_hex[this.addr[i + 1]];
		return ret;
	}
}


module.exports = SLLAddr;
