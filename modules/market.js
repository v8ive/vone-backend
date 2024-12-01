const { db } = require('./database');
const { logger } = require('./logger');
const { log } = require('console');

function updatePrices() {
    logger.info('Price update job started!');

    function calculateAdjustedPrice(currencyData, currentPrice) {
        const { historicalData, volatility, status, priceFloor, priceCeiling } = currencyData;

        // Calculate trend based on historical data
        const trendFactor = calculateTrend(historicalData, 10);

        // Calculate volatility index based on recent price changes
        const volatilityIndex = calculateVolatilityIndex(historicalData);

        // Adjust random fluctuation based on status and volatility index
        let adjustedRandomFluctuation = Math.random() * volatility * volatilityIndex * 2 - volatility * volatilityIndex;

        if (status === "rising") {
            adjustedRandomFluctuation *= 1.5;
        } else if (status === "crashing") {
            adjustedRandomFluctuation *= -1.5;
        } else if (status === "stable") {
            adjustedRandomFluctuation *= 0.5;
        } else if (status === "risky") {
            adjustedRandomFluctuation *= -0.5;
        }

        // Calculate the adjusted price
        const adjustedPrice = currentPrice + (currentPrice * trendFactor) + adjustedRandomFluctuation;
    
        // Apply price floor and ceiling
        const newPrice = Math.max(priceFloor, Math.min(priceCeiling, adjustedPrice));

        return parseFloat(newPrice.toFixed(2));
    }

    function calculateTrend(historicalData, windowSize) {
        const window = historicalData.slice(-windowSize);
        const averagePrice = window.reduce((acc, price) => acc + price, 0) / window.length;
        const trendFactor = (averagePrice - historicalData[0]) / historicalData[0];
        console.log('Trend factor:', trendFactor);

        return trendFactor;
    }

    function calculateVolatilityIndex(historicalData) {
        // Calculate the standard deviation of recent price changes
        // You can adjust the window size to control the sensitivity of the volatility index
        const windowSize = 10;
        const recentPrices = historicalData.slice(-windowSize);
        const standardDeviation = calculateStandardDeviation(recentPrices);

        // Normalize the standard deviation to a value between 0 and 1
        const normalizedStandardDeviation = standardDeviation / (recentPrices[recentPrices.length - 1] * 0.1);

        console.log('Volatility index:', normalizedStandardDeviation);
        return normalizedStandardDeviation;
    }

    function calculateStandardDeviation(values) {
        const mean = values.reduce((acc, val) => acc + val, 0) / values.length;

        const variance = values.reduce((acc,
            val) => acc + Math.pow(val - mean, 2), 0) / values.length;


        const standardDeviation = Math.sqrt(variance);
        
        console.log('Standard deviation:', standardDeviation);
        return standardDeviation;
    }

    function updateCurrencyStatus(currencyData) {
        const { historicalData, currentPrice, basePrice } = currencyData;

        // Check if the price has increased significantly
        if (currentPrice > basePrice * 1.2) {
            currencyData.status = 'rising';
        } else if (currentPrice < basePrice * 0.8) {
            currencyData.status = 'crashing';
        } else if (currentPrice > basePrice * 1.05) {
            currencyData.status = 'stable';
        } else if (currentPrice < basePrice * 0.95) {
            currencyData.status = 'risky';
        }
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
                    currencyData.historicalData.push(adjustedPrice);
                    currencyRef.update({ currentPrice: adjustedPrice, historicalData: currencyData.historicalData, lastUpdated: new Date().toISOString() });

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