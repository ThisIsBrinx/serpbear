// Migration: Resets initial auto-assigned 'daily' intervals to 'default' (Use Global Setting)
// so existing keywords inherit the global scraping frequency from Settings.

module.exports = {
   up: async (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            await queryInterface.sequelize.query(
               "UPDATE keyword SET interval = 'default' WHERE interval = 'daily' OR interval IS NULL OR interval = '';",
               { transaction: t },
            );
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
   down: async () => Promise.resolve(),
};
