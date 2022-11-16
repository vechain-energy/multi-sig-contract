const { ethers } = require('hardhat')
const { BigNumber } = ethers

const contracts = {}
const users = {}

beforeEach(async function () {
  [users.owner, users.user1, users.user2, users.user3, users.user4, users.user5, users.anon] = await ethers.getSigners()

  const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet')
  contracts.MultiSigWallet = await MultiSigWallet.connect(users.owner).deploy()

  await ethers.provider.send('hardhat_setBalance', [users.anon.address, ethers.utils.parseEther('1000').toHexString()])
  await ethers.provider.send('hardhat_setBalance', [contracts.MultiSigWallet.address, '0x0'])
})

describe('MultiSigWallet', () => {
  describe('Deployment', () => {
    it('deploys with depoyer as first and only owner', async () => {
      const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet')
      const contract = await MultiSigWallet.connect(users.user1).deploy()

      const owners = await contract.getOwners()

      expect(owners).toEqual([users.user1.address])
    })

    it('deploys with numConfirmationsRequired of 1', async () => {
      const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet')
      const contract = await MultiSigWallet.connect(users.user1).deploy()

      const numConfirmationsRequired = await contract.numConfirmationsRequired()

      expect(numConfirmationsRequired.toNumber()).toEqual(1)
    })
  })


  describe('owners(ownerIndex)', () => {
    it('returns a specific address by index', async () => {
      const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet')
      const contract = await MultiSigWallet.connect(users.user1).deploy()

      const owner = await contract.owners(0)

      expect(owner).toEqual(users.user1.address)
    })
  })

  describe('getOwners()', () => {
    it('returns a list of all owner addresses', async () => {
      const MultiSigWallet = await ethers.getContractFactory('MultiSigWallet')
      const contract = await MultiSigWallet.connect(users.user1).deploy()

      const owners = await contract.getOwners()

      expect(owners).toEqual([users.user1.address])
    })
  })

  describe('isOwner(address)', () => {
    it('returns false by default', async () => {
      const isOwner = await contracts.MultiSigWallet.isOwner(users.anon.address)
      expect(isOwner).toEqual(false)
    })

    it('returns true for owner', async () => {
      const isOwner = await contracts.MultiSigWallet.isOwner(users.owner.address)
      expect(isOwner).toEqual(true)
    })
  })

  describe('Transactions', () => {
    describe('submitTransaction(to, value, data)', () => {
      it('rejects non-owners', async () => {
        await expect(contracts.MultiSigWallet.connect(users.anon).submitTransaction(users.user2.address, 0, '0x')).rejects.toThrow('not owner')
      })

      it('accepts owners', async () => {
        await expect(contracts.MultiSigWallet.connect(users.owner).submitTransaction(users.user2.address, 0, '0x')).resolves.not.toThrow();
      })

      it('emits SubmitTransaction(sender, txIndex, to, value, data)', async () => {
        const { events } = await (await contracts.MultiSigWallet.connect(users.owner).submitTransaction(users.user2.address, 123, '0x')).wait()
        const event = events.find(({ event }) => event === 'SubmitTransaction')
        expect([...event.args]).toEqual([users.owner.address, BigNumber.from(0), users.user2.address, BigNumber.from(123), '0x'])
      })

      it('emits increasing txIndexes', async () => {
        await contracts.MultiSigWallet.connect(users.owner).submitTransaction(users.user2.address, 1, '0x')
        const { events } = await (await contracts.MultiSigWallet.connect(users.owner).submitTransaction(users.user2.address, 1, '0x')).wait()
        const { args: [, txIndex] } = events.find(({ event }) => event === 'SubmitTransaction')
        expect(txIndex).toEqual(BigNumber.from(1))
      })

      it('sets executed = false as default', async () => {
        const { events } = await (await contracts.MultiSigWallet.connect(users.owner).submitTransaction(users.user2.address, 1, '0x')).wait()
        const { args: [, txIndex] } = events.find(({ event }) => event === 'SubmitTransaction')
        const { executed } = await contracts.MultiSigWallet.transactions(txIndex)
        expect(executed).toEqual(false)
      })

      it('sets numConfirmations = 0 as default', async () => {
        const { events } = await (await contracts.MultiSigWallet.connect(users.owner).submitTransaction(users.user2.address, 1, '0x')).wait()
        const { args: [, txIndex] } = events.find(({ event }) => event === 'SubmitTransaction')
        const { numConfirmations } = await contracts.MultiSigWallet.transactions(txIndex)
        expect(numConfirmations).toEqual(BigNumber.from(0))
      })

      it('sets from = msg.sender', async () => {
        const { events } = await (await contracts.MultiSigWallet.connect(users.owner).submitTransaction(users.user2.address, 1, '0x')).wait()
        const { args: [, txIndex] } = events.find(({ event }) => event === 'SubmitTransaction')
        const { from } = await contracts.MultiSigWallet.transactions(txIndex)
        expect(from).toEqual(users.owner.address)
      })
    })

    describe('transactions(txIndex)', () => {
      it('provides access to submittedTransactions', async () => {
        const transaction = {
          from: users.owner.address,
          to: users.user2.address,
          value: BigNumber.from(123),
          data: '0xff',
          executed: false,
          numConfirmations: BigNumber.from(0)
        }
        const { events } = await (await contracts.MultiSigWallet.connect(users.owner).submitTransaction(transaction.to, transaction.value, transaction.data)).wait()
        const { args: [, txIndex] } = events.find(({ event }) => event === 'SubmitTransaction')
        const storedTransaction = await contracts.MultiSigWallet.transactions(txIndex)
        expect([...storedTransaction]).toEqual([transaction.from, transaction.to, transaction.value, transaction.data, transaction.executed, transaction.numConfirmations])
      })
    })

    describe('getTransaction(txIndex)', () => {
      it('provides access to submittedTransactions', async () => {
        const transaction = {
          from: users.owner.address,
          to: users.user2.address,
          value: BigNumber.from(123),
          data: '0xff',
          executed: false,
          numConfirmations: BigNumber.from(0)
        }
        const { events } = await (await contracts.MultiSigWallet.connect(users.owner).submitTransaction(transaction.to, transaction.value, transaction.data)).wait()
        const { args: [, txIndex] } = events.find(({ event }) => event === 'SubmitTransaction')
        const storedTransaction = await contracts.MultiSigWallet.getTransaction(txIndex)
        expect([...storedTransaction]).toEqual([transaction.from, transaction.to, transaction.value, transaction.data, transaction.executed, transaction.numConfirmations])
      })
    })

    describe('getTransactionCount()', () => {
      it('returns zero by default', async () => {
        const count = await contracts.MultiSigWallet.getTransactionCount()
        expect(count.toNumber()).toEqual(0)
      })

      it('returns correct increasing counter with new transactions', async () => {
        await contracts.MultiSigWallet.connect(users.owner).submitTransaction(users.user2.address, 0, '0x')
        await contracts.MultiSigWallet.connect(users.owner).submitTransaction(users.user2.address, 0, '0x')
        const count = await contracts.MultiSigWallet.getTransactionCount()
        expect(count.toNumber()).toEqual(2)
      })
    })

    describe('confirmTransaction(txIndex)', () => {
      it('rejects non-owners', async () => {
        await expect(contracts.MultiSigWallet.connect(users.anon).confirmTransaction(0)).rejects.toThrow('not owner')
      })

      it('rejects invalid txIndex', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await expect(contracts.MultiSigWallet.confirmTransaction(txIndex + 1)).rejects.toThrow('tx does not exist');
      })

      it('accepts owners', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await expect(contracts.MultiSigWallet.connect(users.owner).confirmTransaction(txIndex)).resolves.not.toThrow();
      })

      it('rejects already executed tranasctions', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)
        await expect(contracts.MultiSigWallet.confirmTransaction(txIndex)).rejects.toThrow('tx already executed');
      })


      it('increases numConfirmations +1', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }

        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        const { numConfirmations } = await contracts.MultiSigWallet.getTransaction(txIndex)
        expect(numConfirmations.toNumber()).toEqual(1)
      })

      it('does not change any other transaction properties', async () => {
        const transaction = {
          from: users.owner.address,
          to: users.user2.address,
          value: BigNumber.from(123),
          data: '0xff',
          executed: false,
          numConfirmations: BigNumber.from(0 + 1)
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        const storedTransaction = await contracts.MultiSigWallet.getTransaction(txIndex)
        expect([...storedTransaction]).toEqual([transaction.from, transaction.to, transaction.value, transaction.data, transaction.executed, transaction.numConfirmations])
      })
    })

    describe('revokeConfirmation(txIndex)', () => {
      it('rejects non-owners', async () => {
        await expect(contracts.MultiSigWallet.connect(users.anon).revokeConfirmation(0)).rejects.toThrow('not owner')
      })

      it('rejects invalid txIndex', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await expect(contracts.MultiSigWallet.revokeConfirmation(txIndex + 1)).rejects.toThrow('tx does not exist');
      })

      it('accepts owners', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await expect(contracts.MultiSigWallet.connect(users.owner).revokeConfirmation(txIndex)).resolves.not.toThrow();
      })

      it('rejects already executed tranasctions', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)
        await expect(contracts.MultiSigWallet.revokeConfirmation(txIndex)).rejects.toThrow('tx already executed');
      })

      it('rejects none-confirmed tranasctions', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await expect(contracts.MultiSigWallet.revokeConfirmation(txIndex)).rejects.toThrow('tx not confirmed');
      })

      it('decreases numConfirmations -1', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }

        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.revokeConfirmation(txIndex)
        const { numConfirmations } = await contracts.MultiSigWallet.getTransaction(txIndex)
        expect(numConfirmations.toNumber()).toEqual(0)
      })

      it('does not change any other transaction properties', async () => {
        const transaction = {
          from: users.owner.address,
          to: users.user2.address,
          value: BigNumber.from(123),
          data: '0xff',
          executed: false,
          numConfirmations: BigNumber.from(0)
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.revokeConfirmation(txIndex)
        const storedTransaction = await contracts.MultiSigWallet.getTransaction(txIndex)
        expect([...storedTransaction]).toEqual([transaction.from, transaction.to, transaction.value, transaction.data, transaction.executed, transaction.numConfirmations])
      })

      it('can not revoke multiple times', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.revokeConfirmation(txIndex)
        await expect(contracts.MultiSigWallet.revokeConfirmation(txIndex)).rejects.toThrow('tx not confirmed');
      })

      it('emits RevokeConfirmation(sender, txIndex)', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        const { events } = await (await contracts.MultiSigWallet.revokeConfirmation(txIndex)).wait()
        const event = events.find(({ event }) => event === 'RevokeConfirmation')
        expect([...event.args]).toEqual([users.owner.address, txIndex])
      })


    })

    describe('executeTransaction(txIndex)', () => {
      it('rejects non-owners', async () => {
        await expect(contracts.MultiSigWallet.connect(users.anon).executeTransaction(0)).rejects.toThrow('not owner')
      })

      it('rejects invalid txIndex', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await expect(contracts.MultiSigWallet.executeTransaction(txIndex + 1)).rejects.toThrow('tx does not exist');
      })

      it('accepts owners', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await expect(contracts.MultiSigWallet.connect(users.owner).executeTransaction(txIndex)).resolves.not.toThrow();
      })

      it('rejects already executed tranasctions', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)
        await expect(contracts.MultiSigWallet.executeTransaction(txIndex)).rejects.toThrow('tx already executed');
      })

      it('rejects if number of confirmations are not met', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await expect(contracts.MultiSigWallet.executeTransaction(txIndex)).rejects.toThrow('cannot execute tx');
      })

      it('sets executed = true', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }

        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)
        const { executed } = await contracts.MultiSigWallet.getTransaction(txIndex)
        expect(executed).toEqual(true)
      })

      it('does not change any other transaction properties', async () => {
        const transaction = {
          from: users.owner.address,
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x',
          executed: true,
          numConfirmations: BigNumber.from(0 + 1)
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)
        const storedTransaction = await contracts.MultiSigWallet.getTransaction(txIndex)
        expect([...storedTransaction]).toEqual([transaction.from, transaction.to, transaction.value, transaction.data, transaction.executed, transaction.numConfirmations])
      })

      it('can not execute multiple times', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)
        await expect(contracts.MultiSigWallet.executeTransaction(txIndex)).rejects.toThrow('tx already executed');
      })

      it('emits ExecuteTransaction(sender, txIndex)', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(0),
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        const { events } = await (await contracts.MultiSigWallet.executeTransaction(txIndex)).wait()
        const event = events.find(({ event }) => event === 'ExecuteTransaction')
        expect([...event.args]).toEqual([users.owner.address, txIndex])
      })

      it('reverts if execution fails', async () => {
        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(123),
          data: '0xff'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await expect(contracts.MultiSigWallet.executeTransaction(txIndex)).rejects.toThrow('tx failed');
      })

      it('allows every owner to execute the transaction', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)


        const transactionSetConfirmationsRequired = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("setConfirmationsRequired", [2])
        }

        const txSetConfirmationsRequired = await submitTransaction(transactionSetConfirmationsRequired, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txSetConfirmationsRequired)
        
        await expect(contracts.MultiSigWallet.connect(users.user2).executeTransaction(txSetConfirmationsRequired)).resolves.not.toThrow()
      })


      it('respects confirmation counter for multiple owners', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)


        const transactionSetConfirmationsRequired = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("setConfirmationsRequired", [2])
        }

        const txSetConfirmationsRequired = await submitTransaction(transactionSetConfirmationsRequired, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txSetConfirmationsRequired)
        await contracts.MultiSigWallet.connect(users.user2).executeTransaction(txSetConfirmationsRequired)

        const transaction = {
          to: users.user2.address,
          value: BigNumber.from(123),
          data: '0xff'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await expect(contracts.MultiSigWallet.executeTransaction(txIndex)).rejects.toThrow('cannot execute tx');
      })

      it('accepts if confirmation counter for multiple owners is lower than owner number', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)

        const transaction = {
          to: users.user2.address,
          value: 0,
          data: '0x'
        }
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await expect(contracts.MultiSigWallet.executeTransaction(txIndex)).resolves.not.toThrow()
      })


      it('transfers value correctly', async () => {
        const transaction = {
          to: users.anon.address,
          value: BigNumber.from(123),
          data: '0x'
        }

        await ethers.provider.send('hardhat_setBalance', [users.anon.address, '0x0'])
        await ethers.provider.send('hardhat_setBalance', [contracts.MultiSigWallet.address, BigNumber.from(123).toHexString()])
        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)

        const balanceUser = await ethers.provider.getBalance(users.anon.address)
        expect(balanceUser).toEqual(BigNumber.from(123))
      })

      it('calls target contract with data correctly', async () => {
        const transaction = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)

        const owners = await contracts.MultiSigWallet.getOwners()
        expect(owners).toEqual([users.owner.address, users.user2.address])
      })
    })
  })

  describe('Management', () => {

    describe('addOwner(address)', () => {
      it('rejects direct access', async () => {
        await expect(contracts.MultiSigWallet.connect(users.owner).addOwner(users.anon.address)).rejects.toThrow('need to be called from contract itself')
      })

      it('adds to owners[]', async () => {
        const transaction = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)

        const owners = await contracts.MultiSigWallet.getOwners()
        expect(owners).toEqual([users.owner.address, users.user2.address])
      })

      it('adjusts isOwner(address)', async () => {
        const transaction = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)

        const isOwner = await contracts.MultiSigWallet.isOwner(users.user2.address)
        expect(isOwner).toEqual(true)
      })

      it('does not change numConfirmationsRequired', async () => {
        const transaction = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)

        const numConfirmationsRequired = await contracts.MultiSigWallet.numConfirmationsRequired()
        expect(numConfirmationsRequired.toNumber()).toEqual(1)
      })

      it('emits AddOwner(owner)', async () => {
        const transaction = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndex = await submitTransaction(transaction, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        const { events } = await (await contracts.MultiSigWallet.executeTransaction(txIndex)).wait()
        const event = events.find(({ event }) => event === 'AddOwner')
        expect([...event.args]).toEqual([users.user2.address])
      })
    })

    describe('removeOwner(address)', () => {
      it('rejects direct access', async () => {
        await expect(contracts.MultiSigWallet.connect(users.owner).removeOwner(users.anon.address)).rejects.toThrow('need to be called from contract itself')
      })

      it('removes from owners[]', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)


        const transactionRemoveOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("removeOwner", [users.owner.address])
        }

        const txIndexRemoveOwner = await submitTransaction(transactionRemoveOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexRemoveOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexRemoveOwner)

        const owners = await contracts.MultiSigWallet.getOwners()
        expect(owners).toEqual([users.user2.address])
      })

      it('adjusts isOwner(address)', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)


        const transactionRemoveOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("removeOwner", [users.owner.address])
        }

        const txIndexRemoveOwner = await submitTransaction(transactionRemoveOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexRemoveOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexRemoveOwner)

        const isOwner = await contracts.MultiSigWallet.isOwner(users.owner.address)
        expect(isOwner).toEqual(false)
      })

      it('does not change numConfirmationsRequired by default', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)


        const transactionRemoveOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("removeOwner", [users.owner.address])
        }

        const txIndexRemoveOwner = await submitTransaction(transactionRemoveOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexRemoveOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexRemoveOwner)

        const numConfirmationsRequired = await contracts.MultiSigWallet.numConfirmationsRequired()
        expect(numConfirmationsRequired.toNumber()).toEqual(1)
      })

      it('ensures that required confirmations is never bigger than owner count', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)


        const transactionSetConfirmationsRequired = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("setConfirmationsRequired", [2])
        }

        const txSetConfirmationsRequired = await submitTransaction(transactionSetConfirmationsRequired, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txSetConfirmationsRequired)
        await contracts.MultiSigWallet.executeTransaction(txSetConfirmationsRequired)


        const transactionRemoveOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("removeOwner", [users.owner.address])
        }

        const txIndexRemoveOwner = await submitTransaction(transactionRemoveOwner, users.owner)
        await contracts.MultiSigWallet.connect(users.owner).confirmTransaction(txIndexRemoveOwner)
        await contracts.MultiSigWallet.connect(users.user2).confirmTransaction(txIndexRemoveOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexRemoveOwner)

        const numConfirmationsRequired = await contracts.MultiSigWallet.numConfirmationsRequired()
        expect(numConfirmationsRequired.toNumber()).toEqual(1)
      })

      it('does not change previous transaction confirmations', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)

        const txIndex = await submitTransaction()
        await contracts.MultiSigWallet.connect(users.owner).confirmTransaction(txIndex)
        await contracts.MultiSigWallet.connect(users.user2).confirmTransaction(txIndex)

        const transactionRemoveOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("removeOwner", [users.owner.address])
        }

        const txIndexRemoveOwner = await submitTransaction(transactionRemoveOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexRemoveOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexRemoveOwner)

        const { numConfirmations } = await contracts.MultiSigWallet.getTransaction(txIndex)
        expect(numConfirmations.toNumber()).toEqual(2)
      })

      it('emits RemoveOwner(owner)', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)

        const txIndex = await submitTransaction()
        await contracts.MultiSigWallet.connect(users.owner).confirmTransaction(txIndex)
        await contracts.MultiSigWallet.connect(users.user2).confirmTransaction(txIndex)

        const transactionRemoveOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("removeOwner", [users.owner.address])
        }

        const txIndexRemoveOwner = await submitTransaction(transactionRemoveOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexRemoveOwner)

        const { events } = await (await contracts.MultiSigWallet.executeTransaction(txIndexRemoveOwner)).wait()
        const event = events.find(({ event }) => event === 'RemoveOwner')
        expect([...event.args]).toEqual([users.owner.address])
      })
    })

    describe('setConfirmationsRequired(numConfirmationsRequired)', () => {
      it('rejects direct access', async () => {
        await expect(contracts.MultiSigWallet.connect(users.owner).setConfirmationsRequired(1)).rejects.toThrow('need to be called from contract itself')
      })

      it('can not be set to more than owner count', async () => {
        const transactionSetConfirmationsRequired = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("setConfirmationsRequired", [2])
        }

        const txIndex = await submitTransaction(transactionSetConfirmationsRequired, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await expect(contracts.MultiSigWallet.executeTransaction(txIndex)).rejects.toThrow('tx failed')
      })

      it('can not be set 0', async () => {
        const transactionSetConfirmationsRequired = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("setConfirmationsRequired", [0])
        }

        const txIndex = await submitTransaction(transactionSetConfirmationsRequired, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await expect(contracts.MultiSigWallet.executeTransaction(txIndex)).rejects.toThrow('tx failed')
      })

      it('updates numConfirmationsRequired', async () => {
        const transactionAddOwner = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("addOwner", [users.user2.address])
        }

        const txIndexAddOwner = await submitTransaction(transactionAddOwner, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndexAddOwner)
        await contracts.MultiSigWallet.executeTransaction(txIndexAddOwner)


        const transactionSetConfirmationsRequired = {
          to: contracts.MultiSigWallet.address,
          value: 0,
          data: contracts.MultiSigWallet.interface.encodeFunctionData("setConfirmationsRequired", [2])
        }

        const txIndex = await submitTransaction(transactionSetConfirmationsRequired, users.owner)
        await contracts.MultiSigWallet.confirmTransaction(txIndex)
        await contracts.MultiSigWallet.executeTransaction(txIndex)

        const numConfirmationsRequired = await contracts.MultiSigWallet.numConfirmationsRequired()
        expect(numConfirmationsRequired.toNumber()).toEqual(2)
      })
    })
  })
})

async function submitTransaction(_transaction = {}, sender = users.owner) {
  const transaction = {
    to: sender.address,
    value: BigNumber.from(0),
    data: '0x',
    ..._transaction
  }
  const { events } = await (await contracts.MultiSigWallet.connect(sender).submitTransaction(transaction.to, transaction.value, transaction.data)).wait()
  const { args: [, txIndex] } = events.find(({ event }) => event === 'SubmitTransaction')
  return txIndex
}