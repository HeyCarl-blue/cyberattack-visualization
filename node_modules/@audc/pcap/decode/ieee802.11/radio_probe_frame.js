var radioUtils = require("./radio_utils");
class RadioProbeFrame {
    constructor() {
        this.tags = undefined;
    }
    decode(raw_packet, offset) {
        this.tags = radioUtils.parseTags(raw_packet, offset);
        return this;
    }
}

module.exports = RadioProbeFrame;
