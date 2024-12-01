const { db } = require('./database');
const { logger } = require('./logger');
const { log } = require('console');

function updatePrices() {
    logger.info('Price update job started!');
    function calculateAdjustedPrice(currencyData, currentPrice) {
        const { priceFloor, priceCeiling, sentiment, volatility, weight, currentSupply, initialSupply, elasticity } = currencyData;

        // Calculate market cap
        const marketCap = currentPrice * currentSupply;

        // Calculate factors influencing price adjustment
        const sentimentFactor = sentiment * 0.5; // Reduced impact
        const volatilityFactor = volatility * 0.5; // Reduced impact
        const supplyRatio = currentSupply / initialSupply;
        const marketCapFactor = marketCap / 100000;
        const priceMomentumFactor = 0.2; // Adjust as needed

        // Combine factors to determine the price adjustment factor
        const priceAdjustmentFactor = (sentimentFactor + volatilityFactor - supplyRatio + marketCapFactor) * weight * elasticity * priceMomentumFactor;

        // Limit the price adjustment factor to a reasonable value
        const maxAdjustmentFactor = 0.2;
        const adjustedPriceFactor = Math.min(priceAdjustmentFactor, maxAdjustmentFactor);

        console.log('sentimentFactor:', sentimentFactor);
        console.log('volatilityFactor:', volatilityFactor);
        console.log('supplyRatio:', supplyRatio);
        console.log('marketCapFactor:', marketCapFactor);
        console.log('priceAdjustmentFactor:', priceAdjustmentFactor);


        // Calculate the adjusted price
        let adjustedPrice = currentPrice * (1 + adjustedPriceFactor);

        // Apply price floor and ceiling
        const roundedPrice = Math.max(priceFloor, Math.min(priceCeiling, adjustedPrice)).toFixed(2);

        console.log('adjustedPrice:', adjustedPrice);
        console.log('roundedPrice:', roundedPrice);

        return parseFloat(roundedPrice);
    }

    try {
        const economyRef = db.ref('economy');
        economyRef.once('value', (snapshot) => {
            const economyData = snapshot.val();

            for (const currency in economyData) {
                console.log('Checking ', economyData[currency].name);
                if (currency !== 'vc') {
                    logger.info(` - Updating price for ${currency}`);

                    const currencyData = economyData[currency];
                    const { currentPrice } = currencyData;
                    logger.info(`Current price: ${currentPrice}`);

                    // Calculate the adjusted price
                    const adjustedPrice = calculateAdjustedPrice(currencyData, currentPrice);
                    logger.info(`Adjusted price: ${adjustedPrice}`);

                    // Update the currency's price
                    const currencyRef = db.ref(`economy/${currency}`);
                    currencyRef.update({ currentPrice: adjustedPrice, lastUpdated: new Date().toISOString() });

                } else { 
                    logger.info(` - Skipping price update for ${currency}`);
                };
            }

            logger.info(' - Price updates completed successfully!');
        });
    } catch (err) {
        logger.error('Error updating prices:', err);
    }
}

module.exports = {
    updatePrices,
};