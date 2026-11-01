Extra licence PUBLIC keys (key rotation). Every `*.pem` here is accepted.

* New signing key: `python tools/license_issuer.py init-keys --name 2027`
  writes the private key to ~/.ragentis/ and the public key here.
* Retire an old key: delete its `.pem` here and ship an update; licences
  signed with it then stop working.

Never put a PRIVATE key in this folder.
