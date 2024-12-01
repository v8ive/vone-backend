const { db } = require('./database');
const { logger } = require('./logger');
const { log } = require('console');

function updatePrices() {
    logger.info('Price update job started!');
    function calculateAdjustedPrice(currencyData, currentPrice) {
        const { sentiment, volatility, weight, currentSupply, initialSupply } = currencyData;

        // Calculate factors influencing price adjustment
        const sentimentFactor = sentiment * 2; // Adjust the multiplier as needed
        const volatilityFactor = volatility * 1.5; // Adjust the multiplier as needed
        const supplyRatio = currentSupply / initialSupply;

        // Combine factors to determine the price adjustment factor
        const priceAdjustmentFactor = (sentimentFactor + volatilityFactor - supplyRatio) * weight;

        // Calculate the adjusted price
        const adjustedPrice = currentPrice * (1 + priceAdjustmentFactor);

        return adjustedPrice;
    }

    try {
        const economyRef = db.ref('economy');
        economyRef.once('value', (snapshot) => {
            const economyData = snapshot.val();

            for (const currency in economyData) {
                console.log('Checking ', economyData[currency].name);
                if (!economyData[currency].name === 'VC') {
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