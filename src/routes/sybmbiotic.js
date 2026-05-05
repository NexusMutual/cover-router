const express = require('express');

const riSubnetworks = require('../store/riSubnetworks.json');

const router = express.Router();

/**
 * @openapi
 * /v2/sybmbiotic:
 *   get:
 *     tags:
 *       - Symbiotic
 *     description: Get RI subnetworks configuration
 *     responses:
 *       200:
 *         description: Returns RI subnetworks keyed by subnetwork id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RiSubnetworksResponse'
 */
router.get('/sybmbiotic', (req, res) => {
  res.json(riSubnetworks);
});

/**
 * @openapi
 * components:
 *   schemas:
 *     RiSubnetworkProduct:
 *       type: object
 *       properties:
 *         productId:
 *           type: integer
 *           description: The product id
 *         price:
 *           type: integer
 *           description: Product price in basis points
 *         weight:
 *           type: integer
 *           description: Product weight in the subnetwork
 *         riCoverAmountPercentage:
 *           type: integer
 *           description: Optional RI cover amount percentage
 *     RiSubnetwork:
 *       type: object
 *       properties:
 *         products:
 *           type: object
 *           additionalProperties:
 *             $ref: '#/components/schemas/RiSubnetworkProduct'
 *         vaults:
 *           type: array
 *           items:
 *             type: string
 *         maxLimit:
 *           type: integer
 *         limit:
 *           type: integer
 *     RiSubnetworksResponse:
 *       type: object
 *       description: Object keyed by subnetwork id
 *       additionalProperties:
 *         $ref: '#/components/schemas/RiSubnetwork'
 */

module.exports = router;
