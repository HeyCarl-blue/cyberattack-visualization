export const HeaderLinkType = {
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

export const EthernetProtocolType = {
    IPv4: 0x0800,
    IPv6: 0x86dd,
    // https://www.iana.org/assignments/ieee-802-numbers/ieee-802-numbers.xhtml
}

export const IPProtocolType = {
    TCP: 6,
    // https://www.iana.org/assignments/protocol-numbers/protocol-numbers.xhtml
}

export function printHexSlice (data) {
    let str = '';
    for (var n of data) {
        str += `${n.toString(16)} `;
    }
    console.log(str);
}

export function getFirstNBits(value, n, bitLen=8) {
    let r = 0;
    for (let i = 0; i < n; i++) {
        r <<= 1;
        r += 1;
    }
    const shiftBits = bitLen - n;
    r <<= shiftBits;

    return (value & r) >> shiftBits;
}

export function getLastNBits(value, n) {
    let r = 0;
    for (let i = 0; i < n; i++) {
        r <<= 1;
        r += 1;
    }
    return value & r;
}

export function getFlagBit (value, idx) {
    let r = 1 << idx;
    return (r & value) == r;
}