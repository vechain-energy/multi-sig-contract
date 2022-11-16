require("@nomiclabs/hardhat-waffle");
require('@vechain.energy/hardhat-thor')
require("hardhat-jest-plugin")

module.exports = {
  solidity: "0.8.13",
  networks: {
    vechain: {
      url: 'https://testnet.veblocks.net',
      privateKey: "0x07b454982790bd33763e1d92a07b3c849adb2a1cfbbe44e3679f1d7e4988fe9f",
      delegateUrl: 'https://sponsor-testnet.vechain.energy/by/90'
    }
  }
};
