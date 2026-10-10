async function until(callback) {
   try {
      return [null, await callback().catch((error) => {
         throw error;
      })];
   } catch (error) {
      return [error, null];
   }
}

module.exports = { until };
