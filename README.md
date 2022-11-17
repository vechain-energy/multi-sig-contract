# Multi-Signature-Wallet

A simple multi signature wallet that:

1. allows to manage owners after deployment
1. allows to set a custom number of required confirmations
1. supports sending VET and Token Transfers
1. supports contract interaction with and without sending VET


The administration is embedded into Sync2 to support a smooth ecosystem expercience:  
https://github.com/vechain/sync2/pull/278

## Confirmations

1. Any **Owner** can submit a transaction
1. A transaction can only be executed once the number of required owners have confirmed
1. Owners can revoke previously given confirmations
1. Any **Owner** can execute a transaction

# Build & Deploy

## Build

```shell
git clone https://github.com/vechain-energy/multi-sig-contract.git
cd multi-sig-contract
yarn install
yarn build
yarn test
```

## Manual Deployments


**Sync2**

* clone and build Sync2 with Multi-Signature-Wallet builtin: https://github.com/ifavo/sync2/tree/multisig
* Add new Wallet and select type `Multi-Signature`

**cli: TestNet**

```shell
$ yarn deploy MultiSigWallet
yarn run v1.22.19
$ node scripts/deploy-contract.js MultiSigWallet

Deploying to **TEST** network

ℹ [MultiSigWallet] Artifact written to src/contracts/test/MultiSigWallet.json
ℹ [MultiSigWallet] Transaction Id: 0xd10b62b53b2d8623423e489e9abbd4ef765b6857853530df37e7b93a42870fb6
✔ [MultiSigWallet] Contract is now available at 0x347a627F63E8A80eB6d9D78BE4421dA0976146ea

✨  Done in 26.61s.

```


**cli: MainNet**

```shell
$ NETWORK=main yarn deploy MultiSigWallet
yarn run v1.22.19
$ node scripts/deploy-contract.js MultiSigWallet

Deploying to **MAIN** network

ℹ [MultiSigWallet] Artifact written to src/contracts/main/MultiSigWallet.json
ℹ [MultiSigWallet] Transaction Id: 0x66416a1b574298fbce493a2764aaa335e9b5b9dae340a45074be17404eca4f7c
✔ [MultiSigWallet] Contract is now available at 0xE057DcC615efb725C1e823EF194BF46271447710

✨  Done in 18.66s.

```

**Sandbox**

* https://sandbox.vechain.energy
* select `configure & deploy contract`
* copy & paste content from `contracts/MultiSig.sol`
* `Compile & Deploy`

**Inspector**

* Extract bytecode and abi:

```shell
jq '.bytecode' ./artifacts/contracts/MultiSig.sol/MultiSigWallet.json -r
jq '.abi' ./artifacts/contracts/MultiSig.sol/MultiSigWallet.json -r
```

* Deploy bytecode at: https://inspector.vecha.in/#/deploy
  * paste bytecode
  * lookup contract address from transaction
* Add contract at: https://inspector.vecha.in/#/contracts
  * paste contract address
  * paste abi


---

_**Credits**_

* The original contract is based on https://solidity-by-example.org/app/multi-sig-wallet
