"""
Encrypt / decrypt backup files with a passphrase (AES-256-GCM, streamed).

Used by scripts/backup.* and scripts/restore.* inside the backend container:

    ... | python -m app.tools.backup_crypto encrypt > database.dump.enc
    python -m app.tools.backup_crypto decrypt < database.dump.enc | ...

The passphrase comes from RAGENTIS_BACKUP_PASSPHRASE (never a command-line
argument, so it does not appear in process lists).

File format: b"RGXBK1" | salt(16) | chunks, each chunk:
    length(4, big endian) | nonce(12) | AES-GCM ciphertext+tag
The chunk number and a "last chunk" flag are authenticated, so reordered,
removed or truncated chunks are detected.
"""

from __future__ import annotations

import os
import struct
import sys

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

MAGIC = b"RGXBK1"
CHUNK = 1024 * 1024
MIN_PASSPHRASE = 12


def _key(passphrase: str, salt: bytes) -> bytes:
    return Scrypt(salt=salt, length=32, n=2 ** 15, r=8, p=1).derive(passphrase.encode())


def _aad(index: int, last: bool) -> bytes:
    return struct.pack(">Q?", index, last)


def _read_exact(stream, size: int) -> bytes:
    data = b""
    while len(data) < size:
        piece = stream.read(size - len(data))
        if not piece:
            break
        data += piece
    return data


def encrypt(source, target, passphrase: str) -> None:
    salt = os.urandom(16)
    aes = AESGCM(_key(passphrase, salt))
    target.write(MAGIC + salt)
    index = 0
    current = _read_exact(source, CHUNK)
    while True:
        following = _read_exact(source, CHUNK)
        last = not following
        nonce = os.urandom(12)
        sealed = aes.encrypt(nonce, current, _aad(index, last))
        target.write(struct.pack(">I", len(sealed)) + nonce + sealed)
        if last:
            break
        current, index = following, index + 1
    target.flush()


def decrypt(source, target, passphrase: str) -> None:
    header = _read_exact(source, len(MAGIC) + 16)
    if not header.startswith(MAGIC) or len(header) != len(MAGIC) + 16:
        raise ValueError("Not a RAGENTIS encrypted backup file.")
    aes = AESGCM(_key(passphrase, header[len(MAGIC):]))
    index = 0
    saw_last = False
    while True:
        size_bytes = _read_exact(source, 4)
        if not size_bytes:
            break
        if saw_last:
            raise ValueError("Unexpected data after the end of the backup.")
        (size,) = struct.unpack(">I", size_bytes)
        nonce = _read_exact(source, 12)
        sealed = _read_exact(source, size)
        if len(nonce) != 12 or len(sealed) != size:
            raise ValueError("The backup file is truncated.")
        for last in (False, True):
            try:
                plain = aes.decrypt(nonce, sealed, _aad(index, last))
                break
            except InvalidTag:
                plain = None
        if plain is None:
            raise ValueError("Wrong passphrase or damaged backup file.")
        target.write(plain)
        saw_last = last
        index += 1
    if not saw_last:
        raise ValueError("The backup file is truncated.")
    target.flush()


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"encrypt", "decrypt"}:
        print("usage: python -m app.tools.backup_crypto encrypt|decrypt  (stdin -> stdout)", file=sys.stderr)
        return 2
    passphrase = os.environ.get("RAGENTIS_BACKUP_PASSPHRASE", "")
    if len(passphrase) < MIN_PASSPHRASE:
        print(f"Set RAGENTIS_BACKUP_PASSPHRASE (at least {MIN_PASSPHRASE} characters).", file=sys.stderr)
        return 2
    try:
        (encrypt if sys.argv[1] == "encrypt" else decrypt)(sys.stdin.buffer, sys.stdout.buffer, passphrase)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
