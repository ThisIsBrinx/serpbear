import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import cronHandler from '../../../pages/api/cron';
import Keyword from '../../../database/models/keyword';
import Domain from '../../../database/models/domain';
import { getAppSettings } from '../../../pages/api/settings';
import verifyUser from '../../../utils/verifyUser';
import refreshAndUpdateKeywords from '../../../utils/refresh';

jest.mock('sequelize', () => ({
   Op: {
      or: Symbol('or'),
      in: Symbol('in'),
      ne: Symbol('ne'),
   },
}));
jest.mock('../../../database/database', () => ({
   __esModule: true,
   default: { sync: jest.fn().mockResolvedValue(true) },
}));
jest.mock('../../../database/models/keyword', () => ({
   __esModule: true,
   default: {
      findAll: jest.fn(),
      update: jest.fn().mockResolvedValue([1]),
   },
}));
jest.mock('../../../database/models/domain', () => ({
   __esModule: true,
   default: {
      findAll: jest.fn().mockResolvedValue([]),
   },
}));
jest.mock('../../../pages/api/settings', () => ({
   getAppSettings: jest.fn(),
}));
jest.mock('../../../utils/verifyUser', () => ({
   __esModule: true,
   default: jest.fn(),
}));
jest.mock('../../../utils/refresh', () => ({
   __esModule: true,
   default: jest.fn(),
}));

const mockVerifyUser = verifyUser as jest.Mock;
const mockGetAppSettings = getAppSettings as jest.Mock;
const mockKeywordFindAll = Keyword.findAll as jest.Mock;
const mockKeywordUpdate = Keyword.update as jest.Mock;
const mockDomainFindAll = Domain.findAll as jest.Mock;
const mockRefresh = refreshAndUpdateKeywords as jest.Mock;

const createMockRes = () => {
   const res: Partial<NextApiResponse> = {};
   res.status = jest.fn().mockReturnValue(res);
   res.json = jest.fn().mockReturnValue(res);
   return res as NextApiResponse;
};

describe('/api/cron Interval & Global Setting Scheduling Logic', () => {
   beforeEach(() => {
      jest.clearAllMocks();
      mockVerifyUser.mockReturnValue('authorized');
      mockDomainFindAll.mockResolvedValue([]);
      mockKeywordFindAll.mockResolvedValue([{ ID: 1, keyword: 'test' }]);
   });

   afterEach(() => {
      jest.useRealTimers();
   });

   it('includes Global Setting (default) keywords on Mondays when global scrape_interval is weekly', async () => {
      // 2026-10-19 is a Monday
      jest.useFakeTimers().setSystemTime(new Date('2026-10-19T00:00:00Z'));
      mockGetAppSettings.mockResolvedValue({ scraper_type: 'serper', scrape_interval: 'weekly' });

      const req = { method: 'POST', query: {} } as unknown as NextApiRequest;
      const res = createMockRes();

      await cronHandler(req, res);

      expect(mockKeywordFindAll).toHaveBeenCalledTimes(1);
      const queryArg = mockKeywordFindAll.mock.calls[0][0];
      const orConditions = queryArg.where[Op.or];
      expect(orConditions).toBeDefined();
      const inList = orConditions[0].interval[Op.in];
      expect(inList).toContain('daily');
      expect(inList).toContain('weekly');
      expect(inList).toContain('default');
      expect(mockRefresh).toHaveBeenCalledTimes(1);
   });

   it('excludes Global Setting (default) keywords on Tuesdays when global scrape_interval is weekly, only scraping due overrides', async () => {
      // 2026-10-20 is a Tuesday
      jest.useFakeTimers().setSystemTime(new Date('2026-10-20T00:00:00Z'));
      mockGetAppSettings.mockResolvedValue({ scraper_type: 'serper', scrape_interval: 'weekly' });

      const req = { method: 'POST', query: {} } as unknown as NextApiRequest;
      const res = createMockRes();

      await cronHandler(req, res);

      expect(mockKeywordFindAll).toHaveBeenCalledTimes(1);
      const queryArg = mockKeywordFindAll.mock.calls[0][0];
      expect(queryArg.where[Op.or]).toBeUndefined();
      const inList = queryArg.where.interval[Op.in];
      expect(inList).toContain('daily');
      expect(inList).not.toContain('weekly');
      expect(inList).not.toContain('default');
   });

   it('scrapes all non-never keywords when force=true is passed', async () => {
      mockGetAppSettings.mockResolvedValue({ scraper_type: 'serper', scrape_interval: 'weekly' });

      const req = { method: 'POST', query: { force: 'true' } } as unknown as NextApiRequest;
      const res = createMockRes();

      await cronHandler(req, res);

      const queryArg = mockKeywordFindAll.mock.calls[0][0];
      const orConditions = queryArg.where[Op.or];
      expect(orConditions[0].interval[Op.ne]).toBe('never');
      expect(mockKeywordUpdate).toHaveBeenCalledWith({ updating: true }, { where: queryArg.where });
   });
});
