#!/usr/bin/env python3
"""Подпись APK (схема Android v2 + v3 не нужна: minSdk 24) ключом из файла .p12.
   python3 sign_apk.py unsigned.apk signed.apk key.p12 ПАРОЛЬ
   Ключ НЕ хранится в репозитории — он у владельца (Google Диск)."""
import struct, hashlib, sys
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import pkcs12

def lp(b): return struct.pack('<I', len(b)) + b

def eocd_pos(d):
    for i in range(len(d) - 22, max(-1, len(d) - 22 - 65536), -1):
        if d[i:i+4] == b'PK\x05\x06': return i
    raise SystemExit('не ZIP')

def sign(src, dst, p12, pw):
    d = open(src, 'rb').read()
    key, cert, _ = pkcs12.load_key_and_certificates(open(p12, 'rb').read(), pw.encode())
    e = eocd_pos(d); cd_off, = struct.unpack('<I', d[e+16:e+20]); cd = d[cd_off:e]
    if d[cd_off-16:cd_off] == b'APK Sig Block 42': raise SystemExit('APK уже подписан')
    def top(sections):
        ch = []
        for s in sections:
            for i in range(0, len(s), 1 << 20):
                c = s[i:i + (1 << 20)]; ch.append(hashlib.sha256(b'\xa5' + struct.pack('<I', len(c)) + c).digest())
        return hashlib.sha256(b'\x5a' + struct.pack('<I', len(ch)) + b''.join(ch)).digest()
    dg = top([d[:cd_off], cd, d[e:]])   # в EOCD смещение каталога = начало блока подписи (оно же текущее)
    ALG = 0x0103                         # RSASSA-PKCS1-v1_5 + SHA-256
    der = cert.public_bytes(serialization.Encoding.DER)
    signed = lp(lp(struct.pack('<I', ALG) + lp(dg))) + lp(lp(der)) + lp(b'')
    sig = key.sign(signed, padding.PKCS1v15(), hashes.SHA256())
    pub = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    signer = lp(signed) + lp(lp(struct.pack('<I', ALG) + lp(sig))) + lp(pub)
    v2 = lp(lp(signer))
    pair = struct.pack('<Q', 4 + len(v2)) + struct.pack('<I', 0x7109871a) + v2
    size = len(pair) + 8 + 16
    block = struct.pack('<Q', size) + pair + struct.pack('<Q', size) + b'APK Sig Block 42'
    new_eocd = d[e:e+16] + struct.pack('<I', cd_off + len(block)) + d[e+20:]
    open(dst, 'wb').write(d[:cd_off] + block + cd + new_eocd)

if __name__ == '__main__':
    sign(*sys.argv[1:5])
    print('подписано:', sys.argv[2])
