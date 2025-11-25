const HeaderLinkType = {
    NULL: 0,
    ETHERNET: 1,
    EXP_ETHERNET: 2,
    AX25: 3,
    PRONET: 4,
    CHAOS: 5,
    IEEE802_5: 6,
    ARCNET_BSD: 7,
    SLIP: 8,
    PPP: 9,
    FDDI: 10,
    PPP_HDLC: 50,
    PPP_ETHER: 51,
    SYMANTEC_FIREWALL: 99,
    ATM_RFC1483: 100,
    RAW: 101,
    C_HDLC: 104,
    IEEE802_11: 105,
    ATM_CLIP: 106,
    FRELAY: 107,
    LOOP: 108,
    ENC: 109,
    NETBSD_HDLC: 112,
    // https://www.tcpdump.org/linktypes.html
};

function readBytes(data, start, bytesToRead, isLittleEndian=true) {
    if (isLittleEndian) {

    } else {

    }
}

function parsePacket (packet, headerType=HeaderLinkType.ETHERNET) {
    const read32 = (start) => packet.getUint32(start, false);
    const read16 = (start) => packet.getUint16(start, false);

    const data = packet.buffer;
    const a = new Uint8Array(data.slice(packet.byteOffset, packet.byteLength + packet.byteOffset));

    console.log(a[2]);
}

export function parsePcapFile (data) {
    const dataView = new DataView(data);
    const magicNumber = dataView.getUint32(0, false);
    const isLittleEndian = magicNumber === 0xd4c3b2a1;

    const read32 = (start) => dataView.getUint32(start, isLittleEndian);
    const read16 = (start) => dataView.getUint16(start, isLittleEndian);
    const read32Int = (start) => dataView.getInt32(start, isLittleEndian);

    const versionMajor = read16(4);
    const versionMinor = read16(6);
    const thisZone = read32Int(8);
    const sigfigs = read32(12);
    const snapLen = read32(16);
    const network = read32(20);

    let byteNum = 24;
    let packets = [];
    while (byteNum < data.byteLength) {
        const tsSec = read32(byteNum);
        const tsUsec = read32(byteNum + 4);
        const inclLen = read32(byteNum + 8);
        const origLen = read32(byteNum + 12);

        const packetData = new DataView(data, byteNum + 16, inclLen);
        packets.push({
            header: {
                tsSec: tsSec,
                tsUsec: tsUsec,
                inclLen: inclLen,
                origLen: origLen
            },
            packet: parsePacket(packetData, HeaderLinkType.ETHERNET, isLittleEndian)
        });
        byteNum += 16 + inclLen;
    }

    return {
        globalHeader: {
            magicNumber: magicNumber,
            versionMajor: versionMajor,
            versionMinor: versionMinor,
            thisZone: thisZone,
            sigfigs: sigfigs,
            snapLen: snapLen,
            network: network
        },
        packets: packets
    }
}