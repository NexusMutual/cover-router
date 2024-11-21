# Cover Router
Computes the optimal capacity allocation in order to get the best price on cover purchases.

## Table of Contents

- [Cover Router](#cover-router)
  - [Table of Contents](#table-of-contents)
  - [Setup](#setup)
  - [Usage](#usage)
    - [Quote Route](#quote-route)
    - [Capacity Route](#capacity-route)
    - [Capacity Route for a specific product](#capacity-route-for-a-specific-product)
    - [Capacity Route for all products in a pool](#capacity-route-for-all-products-in-a-pool)
    - [Capacity Route for a specific product in a pool](#capacity-route-for-a-specific-product-in-a-pool)

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
- **URL**: `/v2/quote`
- **Method**: `GET`
- **OpenAPI**: [v2/api/docs/#/Quote/get_v2_quote](https://api.nexusmutual.io/v2/api/docs/#/Quote/get_v2_quote)
- **Description**: The quote route uses a product id, a period and the cover amount for a given cover asset to return premium and the
best available combination of pools for the premium.
- **Quote Engine**: Calculation is based on batching the current capacities and mapping them with the
  price per pool, then the cheapest capacity is selected, and remapped if the whole cover amount is not covered by the
  cheapest capacity.

### Capacity Route
- **URL**: `/v2/capacity`
- **Method**: `GET`
- **OpenAPI**: [v2/api/docs/#/Capacity/get_v2_capacity_](https://api.nexusmutual.io/v2/api/docs/#/Capacity/get_v2_capacity_)
- **Description**: Returns the current capacity for all products for a period of 30 days if no period query param is specified.

### Capacity Route for a specific product
- **URL**: `/v2/capacity/{productId}`
- **Method**: `GET`
- **OpenAPI**: [v2/api/docs/#/Capacity/get_v2_capacity__productId_](https://api.nexusmutual.io/v2/api/docs/#/Capacity/get_v2_capacity__productId_)
- **Description**: Returns the current capacity for a specific product for a period of 30 days if no period query param is specified. Additionally, if the query parameter `withPools=true` is provided, the response will include the `capacityPerPool` field with detailed capacity information per pool.

### Capacity Route for all products in a pool
- **URL**: `/v2/capacity/pools/{poolId}`
- **Method**: `GET`
- **OpenAPI**: [v2/api/docs/#/Capacity/get_v2_capacity_pools__poolId_](https://api.nexusmutual.io/v2/api/docs/#/Capacity/
get_v2_capacity_pools__poolId_)

- **Description**: Returns the current capacity for all products in a specific pool for a period of 30 days if no period query param is specified.
- **Parameters**:
  - `poolId`: Required path parameter specifying the pool ID.
  - `period`: Optional query parameter specifying the period in days (default is 30, range is 28-365).

### Capacity Route for a specific product in a pool
- **URL**: `/v2/capacity/pools/{poolId}/products/{productId}`
- **Method**: `GET`
- **OpenAPI**: [v2/api/docs/#/Capacity/get_v2_capacity_pools__poolId__products__productId_](https://api.nexusmutual.io/v2/api/docs/#/Capacity/get_v2_capacity_pools__poolId__products__productId_)
                
- **Description**: Returns the current capacity for a specific product in a specific pool for a period of 30 days if no period query param is specified.
- **Parameters**:
  - `poolId`: Required path parameter specifying the pool ID.
  - `productId`: Required path parameter specifying the product ID.
  - `period`: Optional query parameter specifying the period in days (default is 30, range is 28-365).
