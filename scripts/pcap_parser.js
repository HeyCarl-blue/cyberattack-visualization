import {HeaderLinkType, EthernetProtocolType, IPProtocolType, getFirstNBits, getLastNBits, getFlagBit} from "./utils.js";

function parseProtocolDatagram (data, protocol) {
    switch (protocol) {
        case IPProtocolType.TCP:
            const sourcePort = new DataView(data.slice(0, 2).buffer).getUint16();
            const destPort = new DataView(data.slice(2, 4).buffer).getUint16();
            const sequenceNumber = new DataView(data.slice(4, 8).buffer).getUint32();
            const ACKNumber = new DataView(data.slice(8, 12).buffer).getUint32();

            const offsetReserved = data[12];
            const dataOffset = getFirstNBits(offsetReserved, 4) * 4;
            const reserved = getLastNBits(offsetReserved, 4);

            const flags = data[13];
            const FIN = getFlagBit(flags, 0);
            const SYN = getFlagBit(flags, 1);
            const RST = getFlagBit(flags, 2);
            const PSH = getFlagBit(flags, 3);
            const ACK = getFlagBit(flags, 4);
            const URG = getFlagBit(flags, 5);
            const ECE = getFlagBit(flags, 6);
            const CWR = getFlagBit(flags, 7);

            const window = new DataView(data.slice(14, 16).buffer).getUint16();
            const checksum = new DataView(data.slice(16, 18).buffer).getUint16();
            const urgentPointer = new DataView(data.slice(18, 20).buffer).getUint16();

            const options = data.slice(20, dataOffset);
            // TODO: option parsing

            const tcpData = data.slice(dataOffset);

            return {
                type: "TCP PDU",
                header: {
                    sourcePort: sourcePort,
                    destPort: destPort,
                    sequenceNumber: sequenceNumber,
                    ACKNumber: ACKNumber,
                    dataOffset: dataOffset,
                    reserved: reserved,
                    flags: {
                        CWR: CWR,
                        ECE: ECE,
                        URG: URG,
                        ACK: ACK,
                        PSH: PSH,
                        RST: RST,
                        SYN: SYN,
                        FIN: FIN
                    },
                    window: window,
                    checksum: checksum,
                    urgentPointer: urgentPointer,
                    options: options
                },
                data: tcpData
            }
    }
}

function parseIPv4Payload (data) {
    const versionIHL = data[14];
    const version = getFirstNBits(versionIHL, 4);
    const headerLen = getLastNBits(versionIHL, 4) * 4;

    const typeOfService = data[15];
    const differentiatedServicesCodepoint = getFirstNBits(typeOfService, 6);
    const ecn = getLastNBits(typeOfService, 2);

    const ipLen = new DataView(data.slice(16, 18).buffer).getUint16();

    const ipId = new DataView(data.slice(18, 20).buffer).getUint16();

    const flagsFragmentOffset = new DataView(data.slice(20, 22).buffer).getUint16();
    const flags = getFirstNBits(flagsFragmentOffset, 3, 16);
    const dontFragmentFlag = (flags == 2 || flags == 3);
    const moreFragmentsFlag = (flags == 1 || flags == 3);
    const fragmentOffset = getLastNBits(flagsFragmentOffset, 13);

    const ttl = data[22];

    const protocol = data[23];

    const headerChecksum = new DataView(data.slice(24, 26).buffer).getUint16();

    const sourceIp = data.slice(26, 30);

    const destIp = data.slice(30, 34);

    const lastIdx = 14 + headerLen;
    const options = data.slice(34, lastIdx);
    // TODO: option parsing

    const datagram = parseProtocolDatagram(data.slice(lastIdx), protocol);

    return {
        type: "IP PDU",
        header: {
            version: version,
            headerLen: headerLen,
            differentiatedServicesCodepoint: differentiatedServicesCodepoint,
            ecn: ecn,
            ipLen: ipLen,
            ipId: ipId,
            flags: {
                dontFragment: dontFragmentFlag,
                moreFragments: moreFragmentsFlag,
            },
            fragmentOffset: fragmentOffset,
            ttl: ttl,
            protocol: protocol,
            headerChecksum: headerChecksum,
            sourceIP: {
                array: sourceIp,
                string: `${sourceIp[0]}.${sourceIp[1]}.${sourceIp[2]}.${sourceIp[3]}`,
            },
            destIP: {
                array: destIp,
                string: `${destIp[0]}.${destIp[1]}.${destIp[2]}.${destIp[3]}`,
            },
            options: options
        },
        datagram: datagram,
    }
}

function parseEthernetFrame (data) {
    const macDest = data.slice(0, 6).toHex();
    const macSrc = data.slice(6, 12).toHex();
    const etherType = new DataView(data.slice(12, 14).buffer).getUint16();

    let payload;

    switch (etherType) {
        case EthernetProtocolType.IPv4:
            payload = parseIPv4Payload(data);
            break;
        case EthernetProtocolType.IPv6:
            break;
        default:
            console.warn(`Unrecognized packet's EtherType: ${etherType}`);
    }

    return {
        type: "Ethernet Frame",
        macDest: macDest,
        macSrc: macSrc,
        etherType: etherType,
        payload: payload
    }
}

function parsePcapPacket (packet, headerType=HeaderLinkType.ETHERNET) {
    const data = new Uint8Array(packet);

    switch (headerType) {
        case HeaderLinkType.ETHERNET: {
            return parseEthernetFrame(data);
        }
        case HeaderLinkType.IEEE802_11: {
            break;
        }
        default:
            console.error(`Packet link-layer type not recognized: ${headerType}`);
    }
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

        const packetData = data.slice(byteNum + 16, byteNum + 16 + inclLen) //new DataView(data, byteNum + 16, inclLen);
        packets.push({
            header: {
                tsSec: tsSec,
                tsUsec: tsUsec,
                inclLen: inclLen,
                origLen: origLen
            },
            packet: parsePcapPacket(packetData, network)
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