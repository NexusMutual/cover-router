const { addresses } = require('@nexusmutual/deployments');
const { AwsKmsSigner } = require('@nexusmutual/ethers-v5-aws-kms-signer');
const ethers = require('ethers');

const config = require('../config');

const { keccak256 } = ethers.utils;

const domain = {
  name: 'NexusMutualCover',
  version: '1.0.0',
  chainId: 0,
  verifyingContract: addresses.Cover,
};

const types = {
  RiQuote: [
    { name: 'coverId', type: 'uint256' },
    { name: 'productId', type: 'uint24' },
    { name: 'providerId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'premium', type: 'uint256' },
    { name: 'period', type: 'uint32' },
    { name: 'coverAsset', type: 'uint8' },
    { name: 'data', type: 'bytes32' },
    { name: 'dataFormat', type: 'uint8' },
    { name: 'deadline', type: 'uint32' },
    { name: 'nonce', type: 'uint256' },
  ],
};

const getSigner = () => {
  const provider = new ethers.providers.JsonRpcProvider(config.get('providerUrl'));

  if (
    config.get('awsAccessKeyId') &&
    config.get('awsSecretAccessKey') &&
    config.get('awsKmsKeyId') &&
    config.get('awsRegion')
  ) {
    console.info('Using AWS KMS signer');
    return new AwsKmsSigner(config.get('awsKmsKeyId'), config.get('awsRegion'), provider);
  }

  throw new Error('Could not get signer. AWS/KMS env vars must be set');
};

const signRiQuote = async quote => {
  const signer = getSigner();

  const params = {
    coverId: quote.coverId ?? 0,
    productId: quote.productId,
    providerId: quote.providerId,
    amount: quote.amount,
    premium: quote.premium,
    period: quote.period,
    coverAsset: quote.coverAsset,
    nonce: quote.nonce,
    data: keccak256(quote.data),
    dataFormat: quote.dataFormat,
    deadline: quote.deadline,
  };

  return signer._signTypedData(domain, types, params);
};

module.exports = { getSigner, signRiQuote };

if (require.main === module) {
  (async () => {
    const testMessage = 'Hello, mutants!';

    // get signer and sign message
    const [signature, ethAddress] = await Promise.all([getSigner().signMessage(testMessage), getSigner().getAddress()]);

    // recover address from signature
    const eip191Hash = ethers.utils.hashMessage(testMessage);
    const recoveredAddress = ethers.utils.recoverAddress(eip191Hash, signature);

    if (recoveredAddress !== ethAddress) {
      throw new Error(`Recovered address ${recoveredAddress} does not match signer address ${ethAddress}`);
    }

    console.log(`Recovered address matches signature address (${recoveredAddress}) ✅`);
    process.exit();
  })().catch(console.error);
}
