# Local TLS certificates

Generate self-signed certificates for local HTTPS (development only).

## Option 1: mkcert (recommended)
```bash
mkcert -install
mkcert -key-file dev.key -cert-file dev.cert localhost 127.0.0.1 ::1
```
Place the resulting `dev.key` and `dev.cert` in this directory.

## Option 2: openssl
```bash
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout dev.key -out dev.cert \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Update `.env` with `TLS_CERT_PATH=./certs/dev.cert` and `TLS_KEY_PATH=./certs/dev.key`.
