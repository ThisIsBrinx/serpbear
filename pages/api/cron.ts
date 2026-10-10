import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import db from '../../database/database';
import Keyword from '../../database/models/keyword';
import Domain from '../../database/models/domain';
import { getAppSettings } from './settings';
import verifyUser from '../../utils/verifyUser';
import refreshAndUpdateKeywords from '../../utils/refresh';

type CRONRefreshRes = {
   started: boolean
   message?: string
   error?: string|null,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   const authorized = verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }
   if (req.method === 'POST') {
      return cronRefreshkeywords(req, res);
   }
   return res.status(502).json({ error: 'Unrecognized Route.' });
}

const cronRefreshkeywords = async (req: NextApiRequest, res: NextApiResponse<CRONRefreshRes>) => {
   try {
      const settings = await getAppSettings();
      if (!settings || (settings && settings.scraper_type === 'never')) {
         return res.status(400).json({ started: false, error: 'Scraper has not been set up yet.' });
      }

      // Check current day of week: Monday is 1 (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      const dayOfWeek = new Date().getDay();
      const isMonday = dayOfWeek === 1;

      // Optional manual query overrides (e.g. ?force=true, ?interval=weekly, ?interval=daily)
      const forceAll = req.query.force === 'all' || req.query.force === 'true' || req.query.interval === 'all';
      const requestedInterval = typeof req.query.interval === 'string' ? req.query.interval.toLowerCase() : null;

      let whereClause: any = {};
      if (forceAll) {
         whereClause = {};
      } else if (requestedInterval === 'weekly') {
         whereClause = { interval: 'weekly' };
      } else if (requestedInterval === 'daily') {
         whereClause = {
            [Op.or]: [
               { interval: 'daily' },
               { interval: null },
               { interval: '' },
            ],
         };
      } else if (isMonday) {
         // On Mondays, scrape both daily and weekly keywords
         whereClause = {};
      } else {
         // On all other days, only scrape daily (and legacy keywords with no interval set)
         whereClause = {
            [Op.or]: [
               { interval: 'daily' },
               { interval: null },
               { interval: '' },
            ],
         };
      }

      const keywordQueries: Keyword[] = await Keyword.findAll({ where: whereClause });
      if (keywordQueries.length === 0) {
         console.log(`[CRON] No keywords matching interval criteria for today (isMonday: ${isMonday}).`);
         return res.status(200).json({ started: true, message: 'No keywords to refresh today.' });
      }

      // Only mark the selected keywords as updating!
      await Keyword.update({ updating: true }, { where: whereClause });

      const allDomains: Domain[] = await Domain.findAll();
      const domainList: DomainType[] = allDomains.map((d) => d.get({ plain: true }));

      const activeInterval = requestedInterval || (isMonday ? 'all' : 'daily');
      console.log(`[CRON] Starting scrape for ${keywordQueries.length} keywords (isMonday: ${isMonday}, interval: ${activeInterval})`);
      refreshAndUpdateKeywords(keywordQueries, settings, domainList);

      return res.status(200).json({ started: true });
   } catch (error) {
      console.log('[ERROR] CRON Refreshing Keywords: ', error);
      return res.status(400).json({ started: false, error: 'CRON Error refreshing keywords!' });
   }
};
