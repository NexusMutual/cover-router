# Cover Router
Computes the optimal capacity allocation in order to get the best price on cover purchases.

## Table of Contents

- [Cover Router](#cover-router)
    - [Table of Contents](#table-of-contents)
    - [Setup](#setup)
    - [Usage](#usage)
        - [Get Quote](#quote-route)
        - [Get Capacity](#capacity-route)

## Setup

1. `git clone git@github.com:NexusMutual/cover-router.git`
2. `cd cover-router && npm ci`
3. `cp .env.sample .env`
    1. Set environment variables in .env:
    2. CONCURRENCY_NUMBER= number of concurrent products to process for faster startup
    3. PROVIDER_URL - use either [Infura](https://www.infura.io/) or [Alchemy](https://www.alchemy.com/)
    4. PORT= port number for the server
4. To run the server `npm run start`

*Note: if running the server in nodemon(dev), change the destination of persisted data so the server wouldn't 
restart constantly*

## Usage

### Quote Route
- **URL**: `/v2/api/quote`
- **Method**: `GET`
- **OpenAPI**: `/v2/api/docs/#/Quote/get_api_v2_quote`
- **Description**: The quote route uses a product id, a period and the cover amount for a given cover asset to return premium and the
best available combination of pools for the premium.
- **Quote Engine**: Calculation is based on batching the current capacities and mapping them with the
  price per pool, then the cheapest capacity is selected, and remapped if the whole cover amount is not covered by the
  cheapest capacity.

### Capacity Route
- **URL**: `v2/api/capacity`
- **Method**: `GET`
- **OpenAPI**: `/v2/api/docs/#/Capacity/get_api_v2_capacity_`
- **Description**: Returns the current capacity for all products for a period of 30 days if no period query param is specified.

### Capacity Route for a specific product
- **URL**: `v2/api/capacity/{productId}`
- **Method**: `GET`
- **OpenAPI**: `/v2/api/docs/#/Capacity/get_api_v2_capacity__productId_`
- **Description**: Returns the current capacity for a specific product for a period of 30 days if no period query param is specified.

