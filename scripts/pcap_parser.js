export function parsePcapFile (data) {
    const magicNumber = new DataView(data).getUint32(0, false);
    const littleEndian = magicNumber === 0xd4c3b2a1;

    const read32 = (start) => new DataView(data).getUint32(start, littleEndian);
    const read16 = (start) => new DataView(data).getUint16(start, littleEndian);
    const read32Int = (start) => new DataView(data).getInt32(start, littleEndian);

    const versionMajor = read16(4);
    const versionMinor = read16(6);
    const thisZone = read32Int(8);
    const sigfigs = read32(12);
    const snapLen = read32(16);
    const network = read32(20);

    // let byteNum = 24;
    // while (byteNum < data.size) {

    // }

    return {
        globalHeader: {
            magicNumber: magicNumber,
            versionMajor: versionMajor,
            versionMinor: versionMinor,
            thisZone: thisZone,
            sigfigs: sigfigs,
            snapLen: snapLen,
            network: network
        }

    }
}