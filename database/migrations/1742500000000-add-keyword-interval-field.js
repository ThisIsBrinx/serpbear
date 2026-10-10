// Migration: Adds interval column to keyword table ('daily' | 'weekly').

module.exports = {
   up: async (queryInterface, Sequelize) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const keywordTableDefinition = await queryInterface.describeTable('keyword');
            if (keywordTableDefinition && !keywordTableDefinition.interval) {
               await queryInterface.addColumn('keyword', 'interval', {
                  type: Sequelize.DataTypes.STRING,
                  defaultValue: 'daily',
               }, { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
   down: (queryInterface) => {
      return queryInterface.sequelize.transaction(async (t) => {
         try {
            const keywordTableDefinition = await queryInterface.describeTable('keyword');
            if (keywordTableDefinition && keywordTableDefinition.interval) {
               await queryInterface.removeColumn('keyword', 'interval', { transaction: t });
            }
         } catch (error) {
            console.log('error :', error);
         }
      });
   },
};
