const errors = {
  QUOTE: {
    INVALID_PRODUCT_ID: {
      message: 'Invalid Product Id',
      status: 400,
    },
    PRODUCT_IS_DEPRICATED: {
      message: 'Product is deprecated',
      status: 400,
    },
    NOT_ENOUGH_CAPACITY: {
      message: 'Not enough capacity for the cover amount',
      status: 400,
    },
  },
};

module.exports = { errors };
