import { generateChartData, generateTheChartData } from '../../utils/client/generateChartData';

describe('generateChartData & generateTheChartData', () => {
   const now = new Date();
   const formatDateKey = (daysAgo: number): string => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
   };

   describe('generateTheChartData', () => {
      it('should carry forward previous ranking across gap days without dropping to 111 or 0', () => {
         // Scraped 5 days ago (rank 12), then no scraping until 1 day ago (rank 10)
         const history: KeywordHistory = {
            [formatDateKey(5)]: 12,
            [formatDateKey(1)]: 10,
         };

         const chartData = generateTheChartData(history, '7');
         expect(chartData.labels.length).toBe(8); // 7 days down to 0 = 8 points

         const day5Index = chartData.labels.indexOf(formatDateKey(5));
         const day4Index = chartData.labels.indexOf(formatDateKey(4));
         const day3Index = chartData.labels.indexOf(formatDateKey(3));
         const day2Index = chartData.labels.indexOf(formatDateKey(2));
         const day1Index = chartData.labels.indexOf(formatDateKey(1));
         const day0Index = chartData.labels.indexOf(formatDateKey(0));

         expect(chartData.series[day5Index]).toBe(12);
         // Gap days should retain rank 12!
         expect(chartData.series[day4Index]).toBe(12);
         expect(chartData.series[day3Index]).toBe(12);
         expect(chartData.series[day2Index]).toBe(12);
         // Day 1 updated to 10
         expect(chartData.series[day1Index]).toBe(10);
         // Day 0 (today) retains rank 10
         expect(chartData.series[day0Index]).toBe(10);
      });

      it('should carry forward historical rank that occurred prior to window start date', () => {
         // Scraped 15 days ago (rank 8), viewing 7-day window
         const history: KeywordHistory = {
            [formatDateKey(15)]: 8,
         };

         const chartData = generateTheChartData(history, '7');
         // All points in 7-day window should carry forward the rank 8
         chartData.series.forEach((val) => {
            expect(val).toBe(8);
         });
      });

      it('should mark position as 111 (unranked) if scrape returned 0 or if not yet scraped', () => {
         const history: KeywordHistory = {
            [formatDateKey(3)]: 5,
            [formatDateKey(1)]: 0, // Dropped out of top 100
         };

         const chartData = generateTheChartData(history, '5');
         const day3Index = chartData.labels.indexOf(formatDateKey(3));
         const day2Index = chartData.labels.indexOf(formatDateKey(2));
         const day1Index = chartData.labels.indexOf(formatDateKey(1));
         const day0Index = chartData.labels.indexOf(formatDateKey(0));

         expect(chartData.series[day3Index]).toBe(5);
         expect(chartData.series[day2Index]).toBe(5);
         expect(chartData.series[day1Index]).toBe(111);
         expect(chartData.series[day0Index]).toBe(111);
      });

      it('should support time="all" sorted chronologically', () => {
         const history: KeywordHistory = {
            [formatDateKey(10)]: 20,
            [formatDateKey(30)]: 45,
            [formatDateKey(2)]: 15,
         };

         const chartData = generateTheChartData(history, 'all');
         expect(chartData.labels).toEqual([
            formatDateKey(30),
            formatDateKey(10),
            formatDateKey(2),
         ]);
         expect(chartData.series).toEqual([45, 20, 15]);
      });
   });

   describe('generateChartData (30-day view)', () => {
      it('should smoothly fill gaps over 30 days', () => {
         const history: KeywordHistory = {
            [formatDateKey(20)]: 14,
            [formatDateKey(10)]: 11,
         };

         const chartData = generateChartData(history);
         expect(chartData.labels.length).toBe(31);
         expect(chartData.series.length).toBe(31);

         // Prior to day 20: unranked (111)
         expect(chartData.series[0]).toBe(111);
         // Day 20 down to day 11: 14
         const day15Index = 30 - 15;
         expect(chartData.series[day15Index]).toBe(14);
         // Day 10 down to today: 11
         const day5Index = 30 - 5;
         expect(chartData.series[day5Index]).toBe(11);
      });
   });
});
