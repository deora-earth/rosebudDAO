/* global artifacts, contract, assert, web3 */
/* eslint-env mocha */

const Moloch = artifacts.require('./Moloch')
const SimpleToken = artifacts.require('./SimpleToken')
const configJSON = require('../migrations/config.json')

const abi = require('web3-eth-abi')
const HttpProvider = require(`ethjs-provider-http`)
const EthRPC = require(`ethjs-rpc`)
const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'))

const BigNumber = require('bignumber.js')

const should = require('chai').use(require('chai-as-promised')).use(require('chai-bignumber')(BigNumber)).should()

async function blockTime() {
  return (await web3.eth.getBlock('latest')).timestamp
}

async function forceMine() {
  return await ethRPC.sendAsync({ method: `evm_mine` }, err => {});
}

async function moveForwardPeriods(periods) {
  const blocktimestamp = await blockTime();
  const goToTime = configJSON.PERIOD_DURATION * periods;
  await ethRPC.sendAsync(
    {
      jsonrpc: "2.0",
      method: `evm_increaseTime`,
      params: [goToTime],
      id: 0
    },
    err => {
      `error increasing time`;
    }
  );
  await forceMine();
  const updatedBlocktimestamp = await blockTime();
  return true;
}

contract('Moloch', accounts => {

  before('deploy contracts', async () => {
    moloch = await Moloch.deployed();
    simpleToken = await SimpleToken.deployed();

    summoner = accounts[0];
    applicant = accounts[1];
    beneficiary = accounts[2];
    // transfer 10 SIM to applicant
    await simpleToken.transfer(applicant, new BigNumber(configJSON.PROPOSAL_DEPOSIT));
    
    // approve 10 SIM owner summoner and applicant to Moloch contract (spender)
    await simpleToken.approve(moloch.address, new BigNumber(configJSON.PROPOSAL_DEPOSIT * 2));
    await simpleToken.approve(moloch.address, new BigNumber(configJSON.PROPOSAL_DEPOSIT), {from:applicant});
  })

  it('verify deployment parameters', async () => {
    const now = await blockTime() 
    const summoningTime =  await moloch.summoningTime()

    assert.equal(await moloch.approvedToken(), simpleToken.address)
    assert.equal(await moloch.periodDuration(), configJSON.PERIOD_DURATION)
    assert.equal(await moloch.votingPeriodLength(), configJSON.VOTING_PERIOD_LENGTH)
    assert.equal(await moloch.gracePeriodLength(), configJSON.GRACE_PERIOD_LENGTH)
    assert.equal(await moloch.proposalDeposit(), configJSON.PROPOSAL_DEPOSIT)
    assert.equal(await moloch.dilutionBound(), configJSON.DILUTION_BOUND)
    assert.equal(await moloch.processingReward(), configJSON.PROCESSING_REWARD)
  })

  it('submit membership proposal', async () => {
    const tx = await moloch.submitProposal(applicant, new BigNumber(configJSON.PROPOSAL_DEPOSIT), 3, "first proposal");
    assert.equal(+tx.logs[0].args.proposalIndex, 0);
    assert.equal(tx.logs[0].args.applicant, applicant);
    assert.equal(tx.logs[0].args.memberAddress, summoner);
  })

  it("submit membership vote", async () => {
    await moveForwardPeriods(1);
    let tx = await moloch.submitVote(0, 1, {from: summoner});
    assert.equal(+tx.logs[0].args.proposalIndex, 0);
    assert.equal(tx.logs[0].args.delegateKey, summoner);
    assert.equal(tx.logs[0].args.memberAddress, summoner);
    assert.equal(+tx.logs[0].args.uintVote, 1);
  });

  it("process membership proposals", async () => {
    await moveForwardPeriods(14);
    let tx = await moloch.processProposal(0);
    assert.equal(+tx.logs[0].args.proposalIndex, 0);
    assert.equal(tx.logs[0].args.applicant, applicant);
    assert.equal(tx.logs[0].args.memberAddress, summoner);
    assert.equal(+tx.logs[0].args.tokenTribute, new BigNumber(configJSON.PROPOSAL_DEPOSIT));
    assert.equal(+tx.logs[0].args.sharesRequested, 3);
    assert.equal(tx.logs[0].args.didPass, true);
  });

  it('submit funding proposal', async () => {
    // there are 4 shares in total, requesting 2
    const tx = await moloch.submitProposal(beneficiary, 0, 2, "funding proposal");
    assert.equal(+tx.logs[0].args.proposalIndex, 1);
    assert.equal(tx.logs[0].args.applicant, beneficiary);
    assert.equal(tx.logs[0].args.memberAddress, summoner);
  })

  it("submit funding vote", async () => {
    await moveForwardPeriods(1);
    let tx = await moloch.submitVote(1, 1, {from: summoner});
    assert.equal(+tx.logs[0].args.proposalIndex, 1);
    assert.equal(tx.logs[0].args.delegateKey, summoner);
    assert.equal(tx.logs[0].args.memberAddress, summoner);
    assert.equal(+tx.logs[0].args.uintVote, 1);
  });

  it("process funding proposals", async () => {
    await moveForwardPeriods(14);
    const balBefore = await simpleToken.balanceOf(beneficiary);
    assert.equal(+balBefore, 0);
    let tx = await moloch.processProposal(1);
    assert.equal(+tx.logs[0].args.proposalIndex, 1);
    assert.equal(tx.logs[0].args.applicant, beneficiary);
    assert.equal(tx.logs[0].args.memberAddress, summoner);
    assert.equal(+tx.logs[0].args.tokenTribute, 0);
    assert.equal(+tx.logs[0].args.sharesRequested, 2);
    assert.equal(tx.logs[0].args.didPass, true);
    const balAfter = await simpleToken.balanceOf(beneficiary);
    // requesting funding of 2 shares, when total shares are 4, will return half of total bank
    assert.equal(balAfter * 2, new BigNumber(configJSON.PROPOSAL_DEPOSIT));
    // amount of shares should have not increased
    const shares = await moloch.totalShares();
    assert.equal(+shares, 4);
  });

})
